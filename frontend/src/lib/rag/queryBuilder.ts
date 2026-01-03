// =============================================================================
// PRISM Writer - Query Builder
// =============================================================================
// 파일: frontend/src/lib/rag/queryBuilder.ts
// 역할: 루브릭 기반 검색 쿼리 자동 생성 (LLM 호출 없이 결정적)
// 작성일: 2026-01-03
// =============================================================================
// [R-05] 리트리벌 파이프라인 v2 - Query Builder
// - 루브릭 정보를 기반으로 Rule/Example/Pattern 쿼리 생성
// - 쿼리 흔들림 방지를 위해 템플릿 기반 결정적 생성
// =============================================================================

// =============================================================================
// 상수
// =============================================================================

/** 쿼리 최대 길이 (BM25 성능 최적화) */
const MAX_QUERY_LENGTH = 50

/** 키워드 추출 시 최대 단어 수 */
const MAX_KEYWORD_WORDS = 5

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * [R-05] Query Builder 입력 타입
 * 
 * @description
 * 루브릭 정보를 받아 검색 쿼리를 생성하기 위한 입력 데이터
 */
export interface QueryBuilderInput {
  /** 루브릭 ID */
  criteria_id: string
  /** 루브릭 이름 (예: "서론의 흡입력") */
  name: string
  /** 루브릭 정의/설명 */
  definition: string
  /** 루브릭 카테고리 (structure, trust, persuasion 등) */
  category: string
  /** 검색 힌트 (우선 사용) */
  query_hints?: string[]
}

/**
 * [R-05] Query Builder 출력 타입
 * 
 * @description
 * 생성된 3종류의 검색 쿼리
 */
export interface QueryBuilderOutput {
  /** 규칙/정의 검색 쿼리 */
  rule_query: string
  /** 예시 검색 쿼리 */
  example_query: string
  /** 패턴 검색 쿼리 */
  pattern_query: string
}

// =============================================================================
// Helper 함수
// =============================================================================

/**
 * [R-05] 핵심 키워드 추출
 * 
 * @description
 * 텍스트에서 첫 N개 단어를 추출하여 핵심 키워드로 사용합니다.
 * 
 * @param text - 원본 텍스트
 * @param maxWords - 최대 단어 수 (기본값: 5)
 * @returns 추출된 키워드 문자열
 */
export function extractKeyword(text: string, maxWords: number = MAX_KEYWORD_WORDS): string {
  if (!text || text.trim() === '') {
    return ''
  }
  
  // 공백으로 분리하고 빈 문자열 제거
  const words = text.trim().split(/\s+/).filter(Boolean)
  
  // 첫 N개 단어 추출
  return words.slice(0, maxWords).join(' ')
}

/**
 * [R-05] 쿼리 길이 제한
 * 
 * @description
 * BM25 검색 성능을 위해 쿼리 길이를 제한합니다.
 * 
 * @param query - 원본 쿼리
 * @param maxLength - 최대 길이 (기본값: 50)
 * @returns 길이 제한된 쿼리
 */
export function truncateQuery(query: string, maxLength: number = MAX_QUERY_LENGTH): string {
  if (!query) return ''
  
  if (query.length <= maxLength) {
    return query
  }
  
  // 최대 길이에서 단어 경계로 자르기
  const truncated = query.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace)
  }
  
  return truncated
}

// =============================================================================
// 메인 함수
// =============================================================================

/**
 * [R-05] 루브릭 기반 검색 쿼리 생성
 * 
 * @description
 * 루브릭 정보를 기반으로 Rule/Example/Pattern 3종류의 검색 쿼리를 생성합니다.
 * LLM을 호출하지 않고 템플릿 기반으로 결정적(deterministic) 쿼리를 생성합니다.
 * 
 * @param input - 루브릭 정보
 * @returns 생성된 쿼리 3종 (rule_query, example_query, pattern_query)
 * 
 * @example
 * ```typescript
 * const queries = buildSearchQueries({
 *   criteria_id: 'R01',
 *   name: '서론의 흡입력',
 *   definition: '독자의 호기심을 자극하고 문제의식을 명확히 제시',
 *   category: 'structure'
 * })
 * // { rule_query: 'structure 서론의 흡입력 규칙 정의', ... }
 * ```
 */
export function buildSearchQueries(input: QueryBuilderInput): QueryBuilderOutput {
  const { name, definition, category, query_hints } = input

  // -------------------------------------------------------------------------
  // 1. 기본값 처리
  // -------------------------------------------------------------------------
  const safeName = name?.trim() || '평가 기준'
  const safeDefinition = definition?.trim() || safeName
  const safeCategory = category?.trim() || 'general'

  // -------------------------------------------------------------------------
  // 2. 템플릿 기반 쿼리 생성
  // -------------------------------------------------------------------------
  let rule_query = `${safeCategory} ${safeName} 규칙 정의`
  let example_query = `${safeName} 좋은 예시 사례`
  let pattern_query = `${safeCategory} ${extractKeyword(safeDefinition)} 패턴`

  // -------------------------------------------------------------------------
  // 3. query_hints 우선 적용
  // -------------------------------------------------------------------------
  // query_hints가 있으면 rule_query에 우선 사용
  if (query_hints && query_hints.length > 0 && query_hints[0]?.trim()) {
    rule_query = query_hints[0].trim()
    
    // 2번째 힌트가 있으면 example_query에 사용
    if (query_hints.length > 1 && query_hints[1]?.trim()) {
      example_query = query_hints[1].trim()
    }
    
    // 3번째 힌트가 있으면 pattern_query에 사용
    if (query_hints.length > 2 && query_hints[2]?.trim()) {
      pattern_query = query_hints[2].trim()
    }
  }

  // -------------------------------------------------------------------------
  // 4. 길이 제한 적용 (BM25 성능)
  // -------------------------------------------------------------------------
  return {
    rule_query: truncateQuery(rule_query),
    example_query: truncateQuery(example_query),
    pattern_query: truncateQuery(pattern_query),
  }
}

// =============================================================================
// 배치 처리
// =============================================================================

/**
 * [R-05] 여러 루브릭에 대한 쿼리 일괄 생성
 * 
 * @description
 * 여러 루브릭에 대해 검색 쿼리를 일괄 생성합니다.
 * 
 * @param inputs - 루브릭 정보 배열
 * @returns 루브릭 ID를 키로 하는 쿼리 맵
 */
export function buildSearchQueriesBatch(
  inputs: QueryBuilderInput[]
): Map<string, QueryBuilderOutput> {
  const result = new Map<string, QueryBuilderOutput>()
  
  for (const input of inputs) {
    const queries = buildSearchQueries(input)
    result.set(input.criteria_id, queries)
  }
  
  return result
}

// =============================================================================
// 유틸리티: 루브릭 → QueryBuilderInput 변환
// =============================================================================

/**
 * [R-05] 루브릭 객체를 QueryBuilderInput으로 변환
 * 
 * @description
 * DEFAULT_RUBRICS 등의 루브릭 객체를 Query Builder 입력 형식으로 변환합니다.
 * 
 * @param rubric - 루브릭 객체
 * @returns QueryBuilderInput
 */
export function rubricToQueryInput(rubric: {
  id: string
  name: string
  description?: string
  category: string
}): QueryBuilderInput {
  return {
    criteria_id: rubric.id,
    name: rubric.name,
    definition: rubric.description || rubric.name,
    category: rubric.category,
  }
}
