// =============================================================================
// PRISM Writer - Rubrics Management (v2.0 - Form-Based Design)
// =============================================================================
// 파일: frontend/src/lib/rag/rubrics.ts
// 역할: 글 평가를 위한 루브릭(평가 기준) 정의 및 관리
// 업데이트: 2026-01-03 - 형식 중심 카테고리로 재설계 (주제 무관 적용)
// =============================================================================

// =============================================================================
// [PATTERN] 타입 정의
// =============================================================================

/** 루브릭 항목 */
export interface Rubric {
  /** 루브릭 고유 ID */
  id: string
  /** 루브릭 이름 */
  name: string
  /** 평가 기준 상세 설명 */
  description: string
  /** 카테고리 (형식 중심: 구조, 어투, 설득 등) */
  category: RubricCategory
  /** 가중치 (0-100, 총합 100) */
  weight: number
  /** 활성화 여부 */
  enabled: boolean
}

/** 
 * [PATTERN] 루브릭 카테고리 (v2.0 - 형식 중심)
 * 주제와 무관하게 적용 가능한 6개 형식 카테고리
 */
export type RubricCategory = 
  | 'structure'   // 구조 - 글의 뼈대 패턴
  | 'tone'        // 어투 - 말하기 스타일
  | 'persuasion'  // 설득 장치 - 설득 기법
  | 'rhythm'      // 리듬 - 문장 패턴
  | 'trust'       // 신뢰 형성 - 근거 제시 방식
  | 'cta'         // 행동 유도 - CTA 설계

/**
 * [LEGACY] 기존 카테고리 (하위 호환용)
 * @deprecated v2.0에서 새 카테고리로 마이그레이션
 */
export type LegacyRubricCategory = 'content' | 'expression' | 'logic' | 'evidence'

// =============================================================================
// [P4-01] 루브릭 티어 (12-Rubric Rule)
// - Category: "무엇에 대한 기준인가" (구조, 어투, 설득 등)
// - Tier: "얼마나 중요한가" (Core, Style, Detail) ← 별개 개념
// - 최적 조합: Core(5) + Style(4) + Detail(3) = 12개
// =============================================================================

/**
 * [P4-01] 루브릭 티어 타입
 * - core: 글의 본질적 성패를 가르는 핵심 기준 (권장 5개)
 * - style: 글의 매력도와 가독성을 높이는 장치 (권장 4개)
 * - detail: 완성도를 높이는 미세 조정 (권장 3개)
 */
export type RubricTier = 'core' | 'style' | 'detail'

/**
 * [P4-01] 티어별 설정
 * - label: UI 표시용 레이블 (이모지 포함)
 * - max: 권장 최대 개수
 * - description: 티어 설명
 */
export const TIER_CONFIG = {
  core: {
    label: '🟢 Core',
    max: 5,
    description: '글의 본질적 성패를 가르는 기준',
  },
  style: {
    label: '🔵 Style',
    max: 4,
    description: '글의 매력도와 가독성',
  },
  detail: {
    label: '⚪ Detail',
    max: 3,
    description: '완성도를 높이는 미세 조정',
  },
} as const

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
// [PATTERN] 기본 루브릭 정의 (12개 - 형식 중심)
// =============================================================================

/** 기본 루브릭 목록 (v2.0 - 형식 중심, 카테고리별 2개) */
export const DEFAULT_RUBRICS: Rubric[] = [
  // ---------------------------------------------------------------------------
  // [PATTERN] 구조 (Structure) - 글의 뼈대 패턴
  // ---------------------------------------------------------------------------
  {
    id: 'structure_hook',
    name: '도입 훅',
    description: '글의 첫 1-2문장이 독자의 관심을 즉시 사로잡는지 평가합니다. 질문, 통계, 도발적 주장, 이익 약속 등으로 시작해야 합니다.',
    category: 'structure',
    weight: 10,
    enabled: true,
  },
  {
    id: 'structure_flow',
    name: '논리 흐름',
    description: '훅→문제정의→원인→해결→증거→CTA 순서로 자연스럽게 전개되는지 평가합니다. 각 단계 간 연결이 명확해야 합니다.',
    category: 'structure',
    weight: 10,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // [PATTERN] 어투 (Tone) - 말하기 스타일
  // ---------------------------------------------------------------------------
  {
    id: 'tone_consistency',
    name: '어투 일관성',
    description: '글 전체에서 선택한 어투(단정/친근/권위/공감)가 일관되게 유지되는지 평가합니다.',
    category: 'tone',
    weight: 8,
    enabled: true,
  },
  {
    id: 'tone_authority',
    name: '전문성 어투',
    description: '해당 분야의 전문성을 드러내면서도 독자가 이해할 수 있는 표현을 사용하는지 평가합니다.',
    category: 'tone',
    weight: 8,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // [PATTERN] 설득 장치 (Persuasion) - 설득 기법
  // ---------------------------------------------------------------------------
  {
    id: 'persuasion_contrast',
    name: '대비 활용',
    description: 'Before/After, 문제/해결, 일반적 vs 권장 등 대비 프레임을 효과적으로 사용하는지 평가합니다.',
    category: 'persuasion',
    weight: 10,
    enabled: true,
  },
  {
    id: 'persuasion_rebuttal',
    name: '반박 선제처리',
    description: '독자가 품을 수 있는 의심이나 반론을 미리 언급하고 해소하는지 평가합니다. "하지만", "그럼에도" 패턴 활용.',
    category: 'persuasion',
    weight: 10,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // [PATTERN] 리듬 (Rhythm) - 문장 패턴
  // ---------------------------------------------------------------------------
  {
    id: 'rhythm_sentence',
    name: '문장 리듬',
    description: '짧은 문장과 긴 문장이 적절히 섞여 리듬감을 주는지 평가합니다. 연속 3문장 이상 같은 길이 X.',
    category: 'rhythm',
    weight: 8,
    enabled: true,
  },
  {
    id: 'rhythm_question',
    name: '질문 활용',
    description: '독자의 사고를 유도하는 질문을 적절히 배치하는지 평가합니다. 수사적 질문, 호기심 유발 질문 등.',
    category: 'rhythm',
    weight: 8,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // [PATTERN] 신뢰 형성 (Trust) - 근거 제시 방식
  // ---------------------------------------------------------------------------
  {
    id: 'trust_evidence',
    name: '근거 제시',
    description: '주장에 대해 "근거→해석→적용" 순서로 신뢰를 쌓는지 평가합니다. 출처가 명확하고 관련성 있어야 합니다.',
    category: 'trust',
    weight: 10,
    enabled: true,
  },
  {
    id: 'trust_limitation',
    name: '한계 인정',
    description: '모든 상황에 적용되지 않음을 솔직히 인정하여 오히려 신뢰를 높이는지 평가합니다.',
    category: 'trust',
    weight: 6,
    enabled: true,
  },

  // ---------------------------------------------------------------------------
  // [PATTERN] 행동 유도 (CTA) - CTA 설계
  // ---------------------------------------------------------------------------
  {
    id: 'cta_specific',
    name: 'CTA 구체성',
    description: '행동 요청이 구체적인지 평가합니다. "언제", "어디서", "무엇을" 명시. 추상적 권고 X.',
    category: 'cta',
    weight: 6,
    enabled: true,
  },
  {
    id: 'cta_friction',
    name: '마찰 감소',
    description: '행동 전환의 장벽을 낮추는 표현이 있는지 평가합니다. "단 3분만", "지금 바로" 등.',
    category: 'cta',
    weight: 6,
    enabled: true,
  },
]

// =============================================================================
// [PATTERN] 기본 루브릭 세트
// =============================================================================

/** 기본 루브릭 세트 (v2.0 - 형식 중심) */
export const DEFAULT_RUBRIC_SET: RubricSet = {
  id: 'default_v2',
  name: '형식 중심 평가 루브릭',
  description: '주제와 무관하게 글의 형식적 패턴을 평가하는 루브릭 세트입니다.',
  version: '2.0.0',
  rubrics: DEFAULT_RUBRICS,
  createdAt: '2026-01-03',
}

// =============================================================================
// [PATTERN] Helper Functions
// =============================================================================

/**
 * 활성화된 루브릭만 필터링
 */
export function getEnabledRubrics(rubrics: Rubric[] = DEFAULT_RUBRICS): Rubric[] {
  return rubrics.filter((rubric) => rubric.enabled)
}

/**
 * 카테고리별 루브릭 그룹화
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
 */
export function getRubricById(
  id: string,
  rubrics: Rubric[] = DEFAULT_RUBRICS
): Rubric | undefined {
  return rubrics.find((rubric) => rubric.id === id)
}

/**
 * [PATTERN] 카테고리 한글 이름 반환 (v2.0 - 형식 중심)
 */
export function getCategoryLabel(category: RubricCategory): string {
  const labels: Record<RubricCategory, string> = {
    structure: '구조',
    tone: '어투',
    persuasion: '설득 장치',
    rhythm: '리듬',
    trust: '신뢰 형성',
    cta: '행동 유도',
  }
  return labels[category] || category
}

/**
 * 총 가중치 검증
 */
export function validateWeights(rubrics: Rubric[] = DEFAULT_RUBRICS): boolean {
  const enabledRubrics = getEnabledRubrics(rubrics)
  const totalWeight = enabledRubrics.reduce((sum, r) => sum + r.weight, 0)
  return totalWeight === 100
}

// =============================================================================
// [P4-03] Helper: 패턴 타입 → 티어 매핑
// =============================================================================

/**
 * 패턴 타입에 따라 적절한 티어를 반환합니다.
 * - Core: 글의 핵심 구조 (훅, 문제, 원인, 해결, 증거, 콜백, 요약)
 * - Style: 표현 방식 (비유, 대비, 질문, 반복, 스토리, 유추, 전환)
 * - Detail: 세부 요소 (CTA, 통계, 반박, 권위, 증거, 희소성)
 */
export function getTierForPattern(patternType: string): RubricTier {
  const corePatterns = new Set(['hook', 'problem', 'cause', 'solution', 'evidence', 'callback', 'summary'])
  const stylePatterns = new Set(['metaphor', 'contrast', 'question', 'repetition', 'story', 'analogy', 'transition'])
  
  if (corePatterns.has(patternType)) return 'core'
  if (stylePatterns.has(patternType)) return 'style'
  
  return 'detail' // cta, statistics, rebuttal, authority, social_proof, scarcity
}
