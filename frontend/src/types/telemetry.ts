// =============================================================================
// PRISM Writer - Telemetry Types
// =============================================================================
// 파일: frontend/src/types/telemetry.ts
// 역할: Telemetry 관련 타입 정의
// P1 Phase 3.1
// =============================================================================

// =============================================================================
// Telemetry Step 타입
// =============================================================================

/**
 * 파이프라인 단계 타입
 * 
 * @description
 * RAG 파이프라인의 각 단계를 식별
 */
export type TelemetryStep = 
  | 'search'    // 벡터/키워드 검색
  | 'rerank'    // 리랭킹
  | 'answer'    // 답변 생성
  | 'review'    // Reviewer 검토
  | 'citation'  // 인용 검증

// =============================================================================
// Telemetry Record 인터페이스
// =============================================================================

/**
 * Telemetry 기록 인터페이스
 * 
 * @description
 * 각 파이프라인 단계의 실행 정보 및 비용
 */
export interface TelemetryRecord {
  /** 실행 고유 ID (모든 단계 연결) */
  runId: string
  /** 사용자 ID */
  userId: string
  /** 파이프라인 단계 */
  step: TelemetryStep
  /** 시작 시간 (Unix timestamp ms) */
  startTime: number
  /** 종료 시간 (Unix timestamp ms) */
  endTime: number
  /** 지연 시간 (밀리초) */
  latencyMs: number
  /** 사용된 모델 ID (옵션) */
  modelId?: string
  /** 입력 토큰 수 */
  tokensIn: number
  /** 출력 토큰 수 */
  tokensOut: number
  /** 비용 추정 (USD) */
  costEstimate: number
  /** 성공 여부 */
  success: boolean
  /** 에러 코드 (옵션) */
  errorCode?: string
}

// =============================================================================
// Telemetry 생성 헬퍼 타입
// =============================================================================

/**
 * TelemetryRecord 생성용 부분 타입
 * 
 * @description
 * runId와 userId는 외부에서 주입, 나머지는 measureStep에서 생성
 */
export type PartialTelemetry = Partial<Omit<TelemetryRecord, 'runId' | 'userId'>>

/**
 * measureStep 함수 반환 타입
 */
export interface MeasureStepResult<T> {
  result: T
  telemetry: PartialTelemetry
}

// =============================================================================
// 비용 모델 상수
// =============================================================================

/**
 * 모델별 토큰당 비용 (USD)
 * 
 * @description
 * 대략적인 비용 추정용 (정확한 값은 API 응답 참조)
 */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': {
    input: 0.000075,   // $0.075 per 1K tokens
    output: 0.0003,    // $0.30 per 1K tokens
  },
  'gemini-3-pro-preview': {
    input: 0.00125,    // $1.25 per 1K tokens
    output: 0.005,     // $5.00 per 1K tokens
  },
  'default': {
    input: 0.0001,
    output: 0.0004,
  },
}

/**
 * 비용 추정 계산
 * 
 * @param modelId - 모델 ID
 * @param tokensIn - 입력 토큰
 * @param tokensOut - 출력 토큰
 * @returns 추정 비용 (USD)
 */
export function estimateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number
): number {
  const costs = MODEL_COSTS[modelId] ?? MODEL_COSTS['default']
  return (tokensIn * costs.input / 1000) + (tokensOut * costs.output / 1000)
}
