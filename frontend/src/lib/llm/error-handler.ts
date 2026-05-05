// =============================================================================
// PRISM Writer - LLM Error Handler
// =============================================================================
// 파일: frontend/src/lib/llm/error-handler.ts
// 역할: LLM Provider(Gemini/OpenAI/Anthropic)에서 발생한 예외를 의미 있는
//       타입으로 분류하고, UI에 노출 가능한 사용자 친화 메시지로 변환한다.
// 설계 의도(왜 이 구조인가):
//   1) Provider SDK마다 에러 형태가 달라 호출 측이 매번 분기하면 사용처가
//      비대해진다. 단일 클래시파이어를 두어 사용처는 LLMError만 알도록 한다.
//   2) Quota·RateLimit·Network 등 retryable 여부는 Fallback 정책의 입력값이
//      되므로, 에러 객체가 retryable 정보를 직접 들고 있도록 했다.
//   3) UI 메시지를 비-기술 사용자에 맞춰 별도 함수(getUserFriendlyMessage)로
//      분리하여 i18n/문구 변경 시 영향을 작게 유지한다.
// =============================================================================

// -----------------------------------------------------------------------------
// 타입 정의
// -----------------------------------------------------------------------------

/**
 * LLM Provider에서 발생할 수 있는 에러의 의미적 분류.
 *
 * - QUOTA_EXCEEDED: 일별/월별 쿼터 초과 (장시간 차단, fallback 필요)
 * - RATE_LIMITED: 단기 호출량 제한 (수십 초~수 분, 재시도/fallback 가능)
 * - INVALID_API_KEY: 키 자체 문제 (재시도 무의미, 운영자 알림 대상)
 * - MODEL_NOT_FOUND: 모델 ID 오타/제거 (fallback 시도 가능)
 * - CONTEXT_TOO_LONG: 입력이 모델 한도 초과 (fallback 무의미, 입력 축소 필요)
 * - NETWORK_ERROR: 네트워크 단절/타임아웃 (재시도/fallback 가능)
 * - UNKNOWN: 위 분류에 해당하지 않는 모든 케이스
 */
export type LLMErrorType =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INVALID_API_KEY'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_TOO_LONG'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

/**
 * LLM 에러 표준 객체.
 *
 * @property type         - 분류된 에러 타입
 * @property message      - 한글 기본 메시지(개발자/로그 용도, 사용자 노출은 별도 함수 사용)
 * @property retryable    - 재시도 또는 fallback 시도 가능 여부
 * @property retryAfter   - 권장 대기 시간(초). 미상이면 undefined
 * @property originalError - 원본 에러(로그/디버깅용, UI 노출 금지)
 */
export interface LLMError {
  type: LLMErrorType
  message: string
  retryable: boolean
  retryAfter?: number
  originalError: unknown
}

// -----------------------------------------------------------------------------
// 패턴 상수
// -----------------------------------------------------------------------------
// 주석(시니어): 패턴은 모듈 상단에 모아두어 향후 Provider별 변종을 한 곳에서
// 관리할 수 있게 했다. 정규식 대신 includes를 쓴 것은 Provider 메시지에
// 특수문자가 섞여도 매칭을 단순하게 유지하기 위함이다.

// 주석(시니어): "exceeded" 단독 키워드는 quota/rate-limit/token-limit 메시지에
// 모두 등장할 수 있어 매칭 폭이 너무 넓다. 따라서 quota는 "quota" 또는
// "resource_exhausted" 같은 구체적 시그니처에서만 매칭하도록 좁혔다. 이렇게
// 하면 "rate_limit_exceeded"는 rate, "token limit exceeded"는 contextLong이
// 우선 적용되어 분류 정확도가 올라간다.
const PATTERNS = {
  quota: ['quota', 'resource_exhausted', 'usage limit'],
  rate: ['rate limit', 'rate_limit', '429', 'too many requests'],
  auth: ['api key', 'unauthorized', 'invalid_api_key', 'permission_denied', 'authentication'],
  modelMissing: ['not found', 'unknown model', 'model_not_found'],
  contextLong: ['context length', 'context_length', 'maximum context', 'token limit', 'too long'],
  network: ['network', 'fetch failed', 'timeout', 'econnreset', 'enotfound', 'socket'],
} as const

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n))
}

// -----------------------------------------------------------------------------
// 분류 함수
// -----------------------------------------------------------------------------

/**
 * Provider 에러를 LLMError로 분류한다.
 *
 * @description
 * - 입력은 unknown이며 Error 인스턴스가 아닐 수도 있어 String 캐스팅으로 보호한다.
 * - 매칭 우선순위: quota → rate → auth → model → context → network → unknown.
 *   이유: 동일한 에러가 여러 키워드를 포함할 때 더 구체적이고 차단 시간이 긴
 *   분류를 우선해야 fallback/대기 정책이 안전하게 작동한다.
 *
 * @param error - Provider SDK가 던진 임의 객체
 * @returns 분류된 LLMError
 */
export function classifyLLMError(error: unknown): LLMError {
  const errorMessage =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (matchesAny(errorMessage, PATTERNS.quota)) {
    return {
      type: 'QUOTA_EXCEEDED',
      message: 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
      retryAfter: 3600, // 보수적으로 1시간 후 재시도 권장
      originalError: error,
    }
  }

  if (matchesAny(errorMessage, PATTERNS.rate)) {
    return {
      type: 'RATE_LIMITED',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      retryable: true,
      retryAfter: 60,
      originalError: error,
    }
  }

  if (matchesAny(errorMessage, PATTERNS.auth)) {
    return {
      type: 'INVALID_API_KEY',
      message: 'API 키가 유효하지 않습니다.',
      retryable: false,
      originalError: error,
    }
  }

  // 주석(시니어): "model"과 "not found"가 함께 등장하는 경우만 모델 누락으로
  // 분류한다. "model" 단일 키워드로는 다른 메시지(e.g. "model is loading")까지
  // 잡혀 오분류 위험이 있어 두 조건의 교집합으로 좁혔다.
  if (errorMessage.includes('model') && matchesAny(errorMessage, PATTERNS.modelMissing)) {
    return {
      type: 'MODEL_NOT_FOUND',
      message: '요청한 모델을 찾을 수 없습니다.',
      retryable: false,
      originalError: error,
    }
  }

  if (matchesAny(errorMessage, PATTERNS.contextLong)) {
    return {
      type: 'CONTEXT_TOO_LONG',
      message: '입력 텍스트가 너무 깁니다.',
      retryable: false,
      originalError: error,
    }
  }

  if (matchesAny(errorMessage, PATTERNS.network)) {
    return {
      type: 'NETWORK_ERROR',
      message: '네트워크 연결에 문제가 있습니다.',
      retryable: true,
      retryAfter: 5,
      originalError: error,
    }
  }

  return {
    type: 'UNKNOWN',
    message: 'LLM 호출 중 오류가 발생했습니다.',
    retryable: false,
    originalError: error,
  }
}

// -----------------------------------------------------------------------------
// 사용자 친화 메시지
// -----------------------------------------------------------------------------

/**
 * UI 노출용 사용자 친화 메시지.
 *
 * @description
 * 운영 노출 메시지는 비-기술 사용자가 다음 행동을 결정할 수 있도록 작성했다.
 * 절대 원본 에러나 스택을 그대로 노출하지 않는다.
 */
export function getUserFriendlyMessage(error: LLMError): string {
  const messages: Record<LLMErrorType, string> = {
    QUOTA_EXCEEDED: '🚫 AI 서비스 사용량이 일시적으로 초과되었습니다. 잠시 후 다시 시도해주세요.',
    RATE_LIMITED: '⏳ 요청이 너무 많습니다. 잠시 기다려주세요.',
    INVALID_API_KEY: '🔑 시스템 설정 오류입니다. 관리자에게 문의해주세요.',
    MODEL_NOT_FOUND: '❓ 요청한 AI 모델을 사용할 수 없습니다.',
    CONTEXT_TOO_LONG: '📝 입력 텍스트가 너무 깁니다. 줄여서 다시 시도해주세요.',
    NETWORK_ERROR: '🌐 네트워크 연결을 확인해주세요.',
    UNKNOWN: '⚠️ 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
  }
  return messages[error.type]
}

/**
 * Provider 식별자 추정.
 *
 * @description
 * model ID로부터 Provider 그룹(gemini/openai/anthropic)을 식별한다.
 * Quota Manager가 Provider 단위로 차단을 관리하므로 단순한 prefix 매칭으로 충분하다.
 * 알 수 없는 형식은 'unknown'을 반환하여 안전 측면으로 fallback 차단을 유발하지 않는다.
 */
export function inferProviderFromModelId(modelId: string): string {
  const lower = modelId.toLowerCase()
  if (lower.startsWith('gemini') || lower.startsWith('gemma')) return 'gemini'
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3')) return 'openai'
  if (lower.startsWith('claude')) return 'anthropic'
  return 'unknown'
}
