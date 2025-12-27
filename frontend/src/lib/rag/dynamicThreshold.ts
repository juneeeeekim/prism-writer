// =============================================================================
// PRISM Writer - Dynamic Threshold Module
// =============================================================================
// 파일: frontend/src/lib/rag/dynamicThreshold.ts
// 역할: 쿼리 특성에 따른 검색 임계값 동적 조정
// 생성일: 2025-12-27
// 
// [RAG 환각 방지 업그레이드]
// 추상적인 질문에는 임계값을 낮춰 더 많은 문서를 검색하고,
// 구체적인 질문에는 임계값을 높여 정확도를 우선합니다.
// =============================================================================

// =============================================================================
// 상수 정의
// =============================================================================

/** 기본 임계값 */
const BASE_THRESHOLD = 0.35

/** 최소 임계값 (너무 낮으면 관련 없는 문서까지 검색됨) */
const MIN_THRESHOLD = 0.25

/** 최대 임계값 (너무 높으면 관련 문서도 놓침) */
const MAX_THRESHOLD = 0.45

// =============================================================================
// 패턴 정의
// =============================================================================

/**
 * 추상적 질문 패턴 (임계값 낮춤 → 더 많은 문서 검색)
 * 
 * @description
 * 사용자가 포괄적이고 일반적인 질문을 할 때
 * 관련 문서를 놓치지 않도록 임계값을 낮춥니다.
 */
const ABSTRACT_PATTERNS: RegExp[] = [
  /어떻게.*해야/,      // "어떻게 해야 하나요?"
  /방법/,             // "~ 방법"
  /무엇/,             // "무엇인가요?"
  /~란\??$/,          // "~란?"
  /알려/,             // "알려주세요"
  /설명/,             // "설명해주세요"
  /가르쳐/,           // "가르쳐주세요"
  /도움/,             // "도움이 필요해요"
  /팁/,               // "팁 알려주세요"
  /조언/,             // "조언 부탁"
]

/**
 * 구체적 질문 패턴 (임계값 높임 → 정확도 우선)
 * 
 * @description
 * 사용자가 특정 개념이나 용어를 명시적으로 언급할 때
 * 정확한 문서만 검색하도록 임계값을 높입니다.
 */
const SPECIFIC_PATTERNS: RegExp[] = [
  /공감.*정보/,       // PRISM Writer 특화 개념
  /유튜브.*원고/,     // 유튜브 원고 작성
  /주원규/,           // 디렉터님 이름
  /프레임워크/,       // 특정 구조
  /PRISM/i,           // 서비스명
  /기승전결/,         // 특정 구조
  /Hook/i,            // 훅 (도입부)
  /CTA/i,             // Call To Action
]

// =============================================================================
// 동적 임계값 계산 함수
// =============================================================================

/**
 * 쿼리 특성에 따른 동적 임계값 계산
 * 
 * @description
 * 추상적인 질문에는 낮은 임계값 (더 많은 문서)
 * 구체적인 질문에는 높은 임계값 (정확도 우선)
 * 
 * @param query - 검색 쿼리
 * @returns 조정된 임계값 (MIN_THRESHOLD ~ MAX_THRESHOLD 범위)
 * 
 * @example
 * ```typescript
 * calculateDynamicThreshold("글쓰기 방법") // → 0.245 (추상적)
 * calculateDynamicThreshold("공감-정보 구조") // → 0.42 (구체적)
 * calculateDynamicThreshold("안녕하세요") // → 0.35 (기본)
 * ```
 */
export function calculateDynamicThreshold(query: string): number {
  // ---------------------------------------------------------------------------
  // 입력 검증
  // ---------------------------------------------------------------------------
  if (!query || query.trim().length === 0) {
    return BASE_THRESHOLD
  }

  const trimmedQuery = query.trim()

  // ---------------------------------------------------------------------------
  // 추상적 질문 패턴 검사 → 임계값 낮춤
  // ---------------------------------------------------------------------------
  if (ABSTRACT_PATTERNS.some(pattern => pattern.test(trimmedQuery))) {
    const loweredThreshold = BASE_THRESHOLD * 0.7
    const clamped = Math.max(MIN_THRESHOLD, loweredThreshold)
    
    console.log(`[DynamicThreshold] Abstract query detected. Threshold: ${clamped.toFixed(3)}`)
    return clamped
  }

  // ---------------------------------------------------------------------------
  // 구체적 질문 패턴 검사 → 임계값 높임
  // ---------------------------------------------------------------------------
  if (SPECIFIC_PATTERNS.some(pattern => pattern.test(trimmedQuery))) {
    const raisedThreshold = BASE_THRESHOLD * 1.2
    const clamped = Math.min(MAX_THRESHOLD, raisedThreshold)
    
    console.log(`[DynamicThreshold] Specific query detected. Threshold: ${clamped.toFixed(3)}`)
    return clamped
  }

  // ---------------------------------------------------------------------------
  // 기본 임계값
  // ---------------------------------------------------------------------------
  console.log(`[DynamicThreshold] Default threshold: ${BASE_THRESHOLD}`)
  return BASE_THRESHOLD
}

/**
 * 현재 임계값 범위 반환 (디버깅용)
 */
export function getThresholdRange(): { min: number; base: number; max: number } {
  return {
    min: MIN_THRESHOLD,
    base: BASE_THRESHOLD,
    max: MAX_THRESHOLD,
  }
}

/**
 * 쿼리 분석 결과 반환 (디버깅용)
 * 
 * @param query - 검색 쿼리
 * @returns 분석 결과 객체
 */
export function analyzeQuery(query: string): {
  query: string
  isAbstract: boolean
  isSpecific: boolean
  threshold: number
  matchedPattern: string | null
} {
  const trimmedQuery = query.trim()
  
  // 추상적 패턴 검사
  for (const pattern of ABSTRACT_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        query: trimmedQuery,
        isAbstract: true,
        isSpecific: false,
        threshold: calculateDynamicThreshold(query),
        matchedPattern: pattern.source,
      }
    }
  }

  // 구체적 패턴 검사
  for (const pattern of SPECIFIC_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        query: trimmedQuery,
        isAbstract: false,
        isSpecific: true,
        threshold: calculateDynamicThreshold(query),
        matchedPattern: pattern.source,
      }
    }
  }

  // 기본
  return {
    query: trimmedQuery,
    isAbstract: false,
    isSpecific: false,
    threshold: BASE_THRESHOLD,
    matchedPattern: null,
  }
}
