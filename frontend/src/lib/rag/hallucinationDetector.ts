// =============================================================================
// PRISM Writer - Hallucination Detector Module
// =============================================================================
// 파일: frontend/src/lib/rag/hallucinationDetector.ts
// 역할: LLM 응답에서 환각(Hallucination) 패턴 탐지
// 생성일: 2025-12-27
// 
// [RAG 환각 방지 업그레이드]
// 회피형 환각(Evasion Hallucination)을 탐지하여 분석 데이터 수집
// False Positive 방지를 위해 패턴별 confidence 가중치 적용
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

/** 환각 유형 */
export type HallucinationType = 'evasion' | 'fabrication' | 'none'

/** 환각 패턴 정의 */
interface HallucinationPattern {
  /** 정규표현식 패턴 */
  pattern: RegExp
  /** 신뢰도 (0.0 ~ 1.0). 높을수록 확실한 환각 */
  confidence: number
  /** 패턴 설명 (디버깅용) */
  description: string
}

/** 환각 탐지 결과 */
export interface HallucinationCheckResult {
  /** 환각 여부 */
  isHallucination: boolean
  /** 환각 유형 */
  type: HallucinationType
  /** 신뢰도 (0.0 ~ 1.0) */
  confidence: number
  /** 매칭된 패턴 (정규식 소스) */
  matchedPattern: string | null
  /** 패턴 설명 */
  description: string | null
}

// =============================================================================
// 회피형 환각 패턴 (Evasion Patterns)
// =============================================================================
// [주의] False Positive 방지를 위해 confidence 가중치를 신중하게 설정
// - 0.9 이상: 거의 확실한 환각
// - 0.7 ~ 0.89: 높은 확률의 환각
// - 0.5 ~ 0.69: 중간 확률, 수동 검증 필요
// =============================================================================

const EVASION_PATTERNS: HallucinationPattern[] = [
  // ---------------------------------------------------------------------------
  // 높은 신뢰도 (0.9+): 명확한 회피 표현
  // ---------------------------------------------------------------------------
  {
    pattern: /참고\s*자료에\s*(관련)?\s*내용이\s*없/,
    confidence: 0.9,
    description: '참고 자료에 내용이 없다고 명시적 회피',
  },
  {
    pattern: /제공된\s*자료에는?\s*(관련)?\s*내용이?\s*없/,
    confidence: 0.9,
    description: '제공된 자료에 내용이 없다고 명시적 회피',
  },
  {
    pattern: /자료를?\s*찾을\s*수\s*없/,
    confidence: 0.85,
    description: '자료를 찾을 수 없다고 회피',
  },

  // ---------------------------------------------------------------------------
  // 중간 신뢰도 (0.7~0.85): 간접적 회피 표현
  // ---------------------------------------------------------------------------
  {
    pattern: /관련\s*문서가?\s*없/,
    confidence: 0.8,
    description: '관련 문서가 없다고 회피',
  },
  {
    pattern: /참고할\s*(만한)?\s*내용이?\s*없/,
    confidence: 0.75,
    description: '참고할 내용이 없다고 회피',
  },
  {
    pattern: /자료에서?\s*(관련)?\s*정보를?\s*찾지\s*못/,
    confidence: 0.75,
    description: '자료에서 정보를 찾지 못했다고 회피',
  },

  // ---------------------------------------------------------------------------
  // 낮은 신뢰도 (0.5~0.7): 수동 검증 필요
  // [주의] 이 패턴들은 정상 응답에서도 나타날 수 있음
  // ---------------------------------------------------------------------------
  {
    pattern: /일반적인\s*(글쓰기)?\s*방법(으로|을)/,
    confidence: 0.6,
    description: '일반적인 방법으로 시작 (참고 자료 무시 가능성)',
  },
  {
    pattern: /기본적으로\s*글(을)?\s*쓸\s*때/,
    confidence: 0.55,
    description: '기본적인 글쓰기 방법으로 시작 (참고 자료 무시 가능성)',
  },
]

// =============================================================================
// 환각 탐지 함수
// =============================================================================

/**
 * 회피형 환각 탐지
 * 
 * @description
 * 참고 자료가 제공되었는데도 "자료에 내용이 없다"고 답변하는 
 * 회피형 환각을 탐지합니다.
 * 
 * @param hasRetrievedDocs - 검색된 문서 존재 여부 (true: 문서 있음)
 * @param modelResponse - LLM 응답 텍스트
 * @param confidenceThreshold - 환각으로 판정할 최소 신뢰도 (기본: 0.7)
 * @returns 환각 탐지 결과
 * 
 * @example
 * ```typescript
 * const result = detectEvasionHallucination(true, "참고 자료에 관련 내용이 없습니다...")
 * if (result.isHallucination) {
 *   console.log(`환각 탐지! 신뢰도: ${result.confidence}`)
 * }
 * ```
 */
export function detectEvasionHallucination(
  hasRetrievedDocs: boolean,
  modelResponse: string,
  confidenceThreshold: number = 0.7
): HallucinationCheckResult {
  // ---------------------------------------------------------------------------
  // 문서가 없으면 환각이 아님 (정상적으로 자료 없음 표시)
  // ---------------------------------------------------------------------------
  if (!hasRetrievedDocs) {
    return {
      isHallucination: false,
      type: 'none',
      confidence: 1.0,
      matchedPattern: null,
      description: '검색된 문서 없음 - 정상 응답',
    }
  }

  // ---------------------------------------------------------------------------
  // 회피성 문구 패턴 검사
  // ---------------------------------------------------------------------------
  for (const { pattern, confidence, description } of EVASION_PATTERNS) {
    if (pattern.test(modelResponse)) {
      // 신뢰도가 임계값 이상이면 환각으로 판정
      const isHallucination = confidence >= confidenceThreshold
      
      console.log(`[HallucinationDetector] Pattern matched: ${description}`)
      console.log(`[HallucinationDetector] Confidence: ${confidence}, Threshold: ${confidenceThreshold}`)
      console.log(`[HallucinationDetector] Is Hallucination: ${isHallucination}`)
      
      return {
        isHallucination,
        type: isHallucination ? 'evasion' : 'none',
        confidence,
        matchedPattern: pattern.source,
        description,
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 환각 패턴 없음
  // ---------------------------------------------------------------------------
  return {
    isHallucination: false,
    type: 'none',
    confidence: 1.0,
    matchedPattern: null,
    description: '환각 패턴 미탐지',
  }
}

/**
 * 모든 환각 패턴에 대해 분석 (디버깅용)
 * 
 * @param modelResponse - LLM 응답 텍스트
 * @returns 매칭된 모든 패턴 목록
 */
export function analyzeAllPatterns(
  modelResponse: string
): Array<{ pattern: string; confidence: number; description: string; matched: boolean }> {
  return EVASION_PATTERNS.map(({ pattern, confidence, description }) => ({
    pattern: pattern.source,
    confidence,
    description,
    matched: pattern.test(modelResponse),
  }))
}

/**
 * 환각 패턴 개수 반환 (디버깅용)
 */
export function getPatternCount(): number {
  return EVASION_PATTERNS.length
}

/**
 * 신뢰도 임계값별 패턴 분류 (디버깅용)
 */
export function getPatternsByConfidence(): {
  high: number    // >= 0.85
  medium: number  // 0.7 ~ 0.84
  low: number     // < 0.7
} {
  return {
    high: EVASION_PATTERNS.filter(p => p.confidence >= 0.85).length,
    medium: EVASION_PATTERNS.filter(p => p.confidence >= 0.7 && p.confidence < 0.85).length,
    low: EVASION_PATTERNS.filter(p => p.confidence < 0.7).length,
  }
}
