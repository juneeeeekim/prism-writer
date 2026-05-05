// =============================================================================
// PRISM Writer - LLM Quota Manager
// =============================================================================
// 파일: frontend/src/lib/llm/quota-manager.ts
// 역할: Provider 단위로 quota/rate-limit 차단 상태를 메모리에 보관하고,
//       후속 호출이 빠르게 fallback으로 우회할 수 있도록 한다.
// 설계 의도(왜 이 구조인가):
//   1) Vercel Functions(Fluid Compute)는 인스턴스 재사용은 되지만 글로벌 상태가
//      보장되지는 않는다. 그래서 메모리 Map을 "베스트 에포트 캐시"로만 쓰고,
//      누락되더라도 정확성에 영향이 없도록(fallback 단순 미적용) 설계했다.
//   2) Provider 단위(gemini/openai/anthropic)로 차단을 관리한다. 모델 단위로
//      잡으면 같은 Provider의 다른 모델로도 무의미한 호출이 발생할 수 있어
//      Provider 그룹으로 차단 범위를 묶었다.
//   3) error-log/external/llm-quota 도메인에 차단 사실을 기록한다. 로그 실패는
//      writeErrorLog 내부에서 격리되어 본 기능에 영향이 없다.
// =============================================================================

import { writeErrorLog } from '@/lib/error-log'
import { getFallbackModel, type LLMUsageContext } from '@/config/llm-usage-map'

// -----------------------------------------------------------------------------
// 타입
// -----------------------------------------------------------------------------

interface QuotaState {
  provider: string
  isExceeded: boolean
  exceededAt: number // epoch ms (Date 대신 number를 써서 비교 비용 절감)
  retryAfter: number // 초 단위
}

// -----------------------------------------------------------------------------
// 메모리 저장소
// -----------------------------------------------------------------------------
// 주석(API/Integration): 서버리스 환경에서 인스턴스 간 상태 공유는 보장되지
// 않는다. 따라서 본 매니저는 "차단을 절대 누락하지 않는 것"이 아니라
// "감지된 차단을 빠르게 우회"하는 캐시 역할이다. 누락 시 다음 실제 호출에서
// 다시 분류되어 fallback이 적용되므로 사용자 영향은 한 번의 실패에 한정된다.

const quotaStates = new Map<string, QuotaState>()

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Provider의 quota 초과 상태를 기록한다.
 *
 * @description
 * - retryAfter는 Provider가 정확한 값을 주지 않을 수 있어 호출자가 보수적으로
 *   넘기도록 설계되어 있다(error-handler에서 기본값 1시간).
 * - 로깅은 writeErrorLog로 위임하여 파일 시스템 장애가 본 기능에 전파되지
 *   않도록 한다.
 */
export function markQuotaExceeded(provider: string, retryAfter: number): void {
  quotaStates.set(provider, {
    provider,
    isExceeded: true,
    exceededAt: Date.now(),
    retryAfter,
  })

  console.warn(
    `[QuotaManager] ${provider} quota exceeded, retry after ${retryAfter}s`
  )

  // 비동기 로깅 — await 하지 않는다. writeErrorLog는 절대 throw하지 않으며
  // 본 기능 흐름과 분리되어야 한다.
  void writeErrorLog({
    category: 'external',
    domain: 'llm-quota',
    severity: 'warn',
    source: 'quota-manager.markQuotaExceeded',
    operation: 'mark',
    message: `Provider quota exceeded: ${provider}`,
    metadata: { provider, retryAfter },
  })
}

/**
 * Provider의 rate limit 차단 상태를 기록한다.
 *
 * @description
 * Quota와 분리하여 짧은 대기 시간이 적용되도록 했다. 매니저 외부에서는 동일한
 * 키로 isQuotaExceeded를 호출하여 결과를 공유한다.
 */
export function markRateLimited(provider: string, retryAfter: number): void {
  quotaStates.set(provider, {
    provider,
    isExceeded: true,
    exceededAt: Date.now(),
    retryAfter,
  })

  console.warn(
    `[QuotaManager] ${provider} rate-limited, retry after ${retryAfter}s`
  )

  void writeErrorLog({
    category: 'external',
    domain: 'llm-quota',
    severity: 'warn',
    source: 'quota-manager.markRateLimited',
    operation: 'mark',
    message: `Provider rate-limited: ${provider}`,
    metadata: { provider, retryAfter },
  })
}

/**
 * 현재 시점에 Provider가 차단 상태인지 확인한다.
 *
 * @description
 * retryAfter가 만료된 상태는 Map에서 즉시 제거하여 다음 호출이 정상 경로를
 * 시도할 수 있도록 한다. 이 때문에 본 함수는 부수효과(state 정리)를 가진다.
 */
export function isQuotaExceeded(provider: string): boolean {
  const state = quotaStates.get(provider)
  if (!state || !state.isExceeded) return false

  const elapsedSec = (Date.now() - state.exceededAt) / 1000
  if (elapsedSec > state.retryAfter) {
    quotaStates.delete(provider)
    return false
  }

  return true
}

/**
 * Quota 차단 시 사용할 fallback 모델 ID를 반환한다.
 *
 * @description
 * llm-usage-map에 정의된 context별 fallback을 그대로 사용한다. 이 모듈은
 * usage-map의 정책을 변경하지 않고 "차단 시점에 fallback이 필요한가?"만
 * 판단한다. 매핑이 없으면 null을 반환하여 호출자가 원래 에러를 throw하도록 한다.
 */
export function getFallbackIfNeeded(
  context: LLMUsageContext,
  primaryProvider: string
): string | null {
  if (!isQuotaExceeded(primaryProvider)) return null

  const fallback = getFallbackModel(context)
  if (!fallback) return null

  console.log(`[QuotaManager] Using fallback for ${context}: ${fallback}`)
  return fallback
}

/**
 * 테스트/디버깅용 상태 초기화.
 *
 * @description
 * 프로덕션 코드에서는 호출하지 않는다. provider 인자가 있으면 해당 provider만,
 * 없으면 전체를 초기화한다.
 */
export function resetQuotaState(provider?: string): void {
  if (provider) {
    quotaStates.delete(provider)
  } else {
    quotaStates.clear()
  }
}

/**
 * 현재 차단된 Provider 스냅샷.
 *
 * @description
 * 운영 디버깅용. 외부 키 누출 우려가 없는 메타데이터만 노출한다.
 */
export function getQuotaSnapshot(): Array<{
  provider: string
  exceededAt: number
  retryAfter: number
  remainingSec: number
}> {
  const now = Date.now()
  return Array.from(quotaStates.values()).map((s) => ({
    provider: s.provider,
    exceededAt: s.exceededAt,
    retryAfter: s.retryAfter,
    remainingSec: Math.max(0, s.retryAfter - Math.floor((now - s.exceededAt) / 1000)),
  }))
}
