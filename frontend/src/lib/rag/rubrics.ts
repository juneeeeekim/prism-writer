// =============================================================================
// PRISM Writer - Rubrics Management
// =============================================================================
// 파일: frontend/src/lib/rag/rubrics.ts
// 역할: 글 평가를 위한 루브릭(평가 기준) 정의 및 관리
// =============================================================================

// =============================================================================
// 타입 정의
// =============================================================================

/** 루브릭 항목 */
export interface Rubric {
  /** 루브릭 고유 ID */
  id: string
  /** 루브릭 이름 */
  name: string
  /** 평가 기준 상세 설명 */
  description: string
  /** 카테고리 (구조, 내용, 표현 등) */
  category: RubricCategory
  /** 가중치 (0-100, 총합 100) */
  weight: number
  /** 활성화 여부 */
  enabled: boolean
}

/** 루브릭 카테고리 */
export type RubricCategory = 'structure' | 'content' | 'expression' | 'logic' | 'evidence'

/** 루브릭 세트 */
export interface RubricSet {
  /** 루브릭 세트 ID */
  id: string
  /** 세트 이름 */
  name: string
  /** 설명 */
  description: string
  /** 버전 */
  version: string
  /** 포함된 루브릭 목록 */
  rubrics: Rubric[]
  /** 생성일 */
  createdAt: string
}

// =============================================================================
// 기본 루브릭 정의 (10개)
// =============================================================================

/** 기본 루브릭 목록 */
export const DEFAULT_RUBRICS: Rubric[] = [
  // ---------------------------------------------------------------------------
  // 구조 (Structure) 관련 루브릭
  // ---------------------------------------------------------------------------
  {
    id: 'structure_intro',
    name: '서론 구성',
    description: '글의 서론이 주제를 명확히 소개하고 독자의 관심을 유도하는지 평가합니다. 배경, 목적, 방향성이 포함되어야 합니다.',
    category: 'structure',
    weight: 10,
    enabled: true,
  },
  {
    id: 'structure_body',
    name: '본론 전개',
    description: '본론이 논리적 순서로 전개되고, 각 단락이 명확한 주제문을 가지고 있는지 평가합니다.',
    category: 'structure',
    weight: 15,
    enabled: true,
  },
  {
    id: 'structure_conclusion',
    name: '결론 정리',
    description: '결론이 본론의 내용을 효과적으로 요약하고, 의미 있는 마무리를 제시하는지 평가합니다.',
    category: 'structure',
    weight: 10,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // 내용 (Content) 관련 루브릭
  // ---------------------------------------------------------------------------
  {
    id: 'content_accuracy',
    name: '내용 정확성',
    description: '글에 포함된 정보와 사실이 정확하고 신뢰할 수 있는지 평가합니다. 오류나 잘못된 정보가 없어야 합니다.',
    category: 'content',
    weight: 15,
    enabled: true,
  },
  {
    id: 'content_depth',
    name: '내용 깊이',
    description: '주제에 대한 충분한 깊이의 분석과 설명이 제공되는지 평가합니다. 피상적인 설명을 넘어선 통찰이 필요합니다.',
    category: 'content',
    weight: 10,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // 논리 (Logic) 관련 루브릭
  // ---------------------------------------------------------------------------
  {
    id: 'logic_coherence',
    name: '논리적 일관성',
    description: '글 전체의 논리 흐름이 일관되고, 모순되는 주장이 없는지 평가합니다.',
    category: 'logic',
    weight: 10,
    enabled: true,
  },
  {
    id: 'logic_reasoning',
    name: '논증 타당성',
    description: '주장을 뒷받침하는 논증이 타당하고 설득력 있는지 평가합니다. 논리적 오류가 없어야 합니다.',
    category: 'logic',
    weight: 10,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // 근거 (Evidence) 관련 루브릭
  // ---------------------------------------------------------------------------
  {
    id: 'evidence_quality',
    name: '근거 품질',
    description: '제시된 근거와 예시가 적절하고 신뢰할 수 있는지 평가합니다. 출처가 명확해야 합니다.',
    category: 'evidence',
    weight: 10,
    enabled: true,
  },
  {
    id: 'evidence_relevance',
    name: '근거 관련성',
    description: '근거가 주장과 직접적으로 관련되고 적절히 활용되는지 평가합니다.',
    category: 'evidence',
    weight: 5,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // 표현 (Expression) 관련 루브릭
  // ---------------------------------------------------------------------------
  {
    id: 'expression_clarity',
    name: '표현 명확성',
    description: '문장이 명확하고 이해하기 쉽게 작성되었는지 평가합니다. 모호한 표현이나 불필요한 복잡성이 없어야 합니다.',
    category: 'expression',
    weight: 5,
    enabled: true,
  },
]

// =============================================================================
// 기본 루브릭 세트
// =============================================================================

/** 기본 루브릭 세트 */
export const DEFAULT_RUBRIC_SET: RubricSet = {
  id: 'default_v1',
  name: '기본 평가 루브릭',
  description: '일반적인 글쓰기 평가를 위한 기본 루브릭 세트입니다.',
  version: '1.0.0',
  rubrics: DEFAULT_RUBRICS,
  createdAt: '2025-12-16',
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 활성화된 루브릭만 필터링
 * 
 * @param rubrics - 루브릭 배열
 * @returns 활성화된 루브릭만 포함된 배열
 */
export function getEnabledRubrics(rubrics: Rubric[] = DEFAULT_RUBRICS): Rubric[] {
  return rubrics.filter((rubric) => rubric.enabled)
}

/**
 * 카테고리별 루브릭 그룹화
 * 
 * @param rubrics - 루브릭 배열
 * @returns 카테고리별로 그룹화된 루브릭 맵
 */
export function groupRubricsByCategory(
  rubrics: Rubric[] = DEFAULT_RUBRICS
): Map<RubricCategory, Rubric[]> {
  const grouped = new Map<RubricCategory, Rubric[]>()
  
  for (const rubric of rubrics) {
    if (!grouped.has(rubric.category)) {
      grouped.set(rubric.category, [])
    }
    grouped.get(rubric.category)!.push(rubric)
  }
  
  return grouped
}

/**
 * 루브릭 ID로 루브릭 찾기
 * 
 * @param id - 루브릭 ID
 * @param rubrics - 루브릭 배열
 * @returns 루브릭 또는 undefined
 */
export function getRubricById(
  id: string,
  rubrics: Rubric[] = DEFAULT_RUBRICS
): Rubric | undefined {
  return rubrics.find((rubric) => rubric.id === id)
}

/**
 * 카테고리 한글 이름 반환
 * 
 * @param category - 카테고리
 * @returns 한글 카테고리 이름
 */
export function getCategoryLabel(category: RubricCategory): string {
  const labels: Record<RubricCategory, string> = {
    structure: '구조',
    content: '내용',
    expression: '표현',
    logic: '논리',
    evidence: '근거',
  }
  return labels[category]
}

/**
 * 총 가중치 검증
 * 
 * @param rubrics - 루브릭 배열
 * @returns 가중치 합계가 100인지 여부
 */
export function validateWeights(rubrics: Rubric[] = DEFAULT_RUBRICS): boolean {
  const enabledRubrics = getEnabledRubrics(rubrics)
  const totalWeight = enabledRubrics.reduce((sum, r) => sum + r.weight, 0)
  return totalWeight === 100
}
