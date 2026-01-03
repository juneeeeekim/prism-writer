// =============================================================================
// PRISM Writer - Criteria Pack Builder
// =============================================================================
// 파일: frontend/src/lib/rag/criteriaPackBuilder.ts
// 역할: 루브릭 기반 CriteriaPack 구축 (Query Builder → 검색 → Gate 검증)
// 작성일: 2026-01-03
// =============================================================================
// [R-08] 리트리벌 파이프라인 v2 - Criteria Pack Builder
// - Query Builder로 쿼리 생성
// - 병렬 검색 (규칙/예시/패턴)
// - Sufficiency Gate + Citation Gate 검증
// - 최종 CriteriaPackV2 조립
// =============================================================================

import { buildSearchQueries, type QueryBuilderOutput } from './queryBuilder'
import { hybridSearch, type SearchResult } from './search'
import { checkSufficiency, type SufficiencyResult } from './sufficiencyGate'
import { verifyCitation } from './citationGate'
import { 
  type CriteriaPackV2, 
  type RetrievedChunk,
  createDefaultCriteriaPackV2 
} from '@/types/rag'
import { type Rubric } from './rubrics'

// =============================================================================
// 상수
// =============================================================================

/** 기본 Top-K 값 */
const DEFAULT_TOP_K = 3

/** 패턴 검색 Top-K 값 */
const PATTERN_TOP_K = 3

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * [R-08] CriteriaPack Builder 옵션
 */
export interface BuildCriteriaPackOptions {
  /** Top-K 결과 수 (기본값: 3) */
  topK?: number
  /** 프로젝트 ID (옵션) */
  projectId?: string
  /** 문서 ID 필터 (옵션) */
  documentId?: string
  /** 디버그 로깅 활성화 */
  debug?: boolean
}

/**
 * [R-08] 배치 빌드 결과
 */
export interface BatchBuildResult {
  /** 전체 성공 여부 */
  success: boolean
  /** 생성된 CriteriaPack 배열 */
  packs: CriteriaPackV2[]
  /** 에러 발생한 루브릭 ID 목록 */
  failedIds: string[]
  /** 총 소요 시간 (ms) */
  totalDurationMs: number
}

// =============================================================================
// Helper 함수
// =============================================================================

/**
 * [R-08] SearchResult → RetrievedChunk 변환
 * 
 * @description
 * hybridSearch 결과를 CriteriaPackV2의 evidence 형식으로 변환합니다.
 */
function mapToRetrievedChunks(results: SearchResult[]): RetrievedChunk[] {
  if (!results || results.length === 0) {
    return []
  }

  return results.map(result => ({
    chunk_id: result.chunkId,
    content: result.content,
    score: result.score,
    source: {
      document_id: result.documentId,
      page: result.metadata?.pageNumber as number | undefined,
      section: result.metadata?.sectionTitle as string | undefined,
    },
  }))
}

/**
 * [R-08] 안전한 검색 실행 (개별 폴백)
 * 
 * @description
 * Promise.all에서 개별 실패 시에도 다른 검색이 계속되도록 래핑합니다.
 */
async function safeSearch(
  query: string,
  options: { 
    userId: string
    topK: number
    projectId?: string
    documentId?: string
  },
  searchType: 'rule' | 'example' | 'pattern'
): Promise<SearchResult[]> {
  try {
    return await hybridSearch(query, {
      userId: options.userId,
      topK: options.topK,
      projectId: options.projectId || undefined,
      documentId: options.documentId,
    })
  } catch (error) {
    console.warn(`[CriteriaPackBuilder] ${searchType} 검색 실패:`, error)
    return [] // 실패 시 빈 배열 반환
  }
}

// =============================================================================
// 메인 함수
// =============================================================================

/**
 * [R-08] CriteriaPack 구축
 * 
 * @description
 * 루브릭을 기반으로 Query Builder → 병렬 검색 → Gate 검증을 수행하고
 * 최종 CriteriaPackV2를 반환합니다.
 * 
 * @param rubric - 입력 루브릭
 * @param userId - 사용자 ID
 * @param options - 빌드 옵션
 * @returns CriteriaPackV2
 * 
 * @example
 * ```typescript
 * const pack = await buildCriteriaPack(rubric, userId, { topK: 5 })
 * if (pack.gates.retrieval_sufficient) {
 *   // Judge에 전달
 * }
 * ```
 */
export async function buildCriteriaPack(
  rubric: Rubric,
  userId: string,
  options: BuildCriteriaPackOptions = {}
): Promise<CriteriaPackV2> {
  const startTime = Date.now()
  const { topK = DEFAULT_TOP_K, projectId, documentId, debug = false } = options

  // -------------------------------------------------------------------------
  // 0. 기본 Pack 생성 (에러 발생 시 반환용)
  // -------------------------------------------------------------------------
  const defaultPack = createDefaultCriteriaPackV2(rubric.id)

  try {
    // -----------------------------------------------------------------------
    // 1. Query Builder로 쿼리 생성
    // -----------------------------------------------------------------------
    const queries: QueryBuilderOutput = buildSearchQueries({
      criteria_id: rubric.id,
      name: rubric.name,
      definition: rubric.description,
      category: rubric.category,
    })

    if (debug) {
      console.log('[CriteriaPackBuilder] Queries:', queries)
    }

    // -----------------------------------------------------------------------
    // 2. 검색 실행 (병렬) - 개별 폴백 적용
    // -----------------------------------------------------------------------
    const searchOptions = { userId, topK, projectId, documentId }
    
    const [ruleResults, exampleResults, patternResults] = await Promise.all([
      safeSearch(queries.rule_query, searchOptions, 'rule'),
      safeSearch(queries.example_query, searchOptions, 'example'),
      safeSearch(queries.pattern_query, { ...searchOptions, topK: PATTERN_TOP_K }, 'pattern'),
    ])

    if (debug) {
      console.log(`[CriteriaPackBuilder] Results - Rules: ${ruleResults.length}, Examples: ${exampleResults.length}, Patterns: ${patternResults.length}`)
    }

    // -----------------------------------------------------------------------
    // 3. Sufficiency Gate
    // -----------------------------------------------------------------------
    const allResults = [...ruleResults, ...exampleResults, ...patternResults]
    const sufficiency: SufficiencyResult = checkSufficiency(allResults)

    if (debug) {
      console.log('[CriteriaPackBuilder] Sufficiency:', sufficiency)
    }

    // -----------------------------------------------------------------------
    // 4. Citation Gate (Top 1에 대해)
    // -----------------------------------------------------------------------
    let citationVerified = false
    if (allResults.length > 0) {
      const topResult = allResults[0]
      // verifyCitation은 quote와 sourceChunks를 받음
      const citationResult = verifyCitation(
        topResult.content,
        allResults.map(r => ({ id: r.chunkId, content: r.content }))
      )
      citationVerified = citationResult.valid
    }

    if (debug) {
      console.log('[CriteriaPackBuilder] Citation verified:', citationVerified)
    }

    // -----------------------------------------------------------------------
    // 5. Pack 조립
    // -----------------------------------------------------------------------
    const criteriaPack: CriteriaPackV2 = {
      criteria_id: rubric.id,
      queries: {
        rule_query: queries.rule_query,
        example_query: queries.example_query,
        pattern_query: queries.pattern_query,
      },
      evidence: {
        rules: mapToRetrievedChunks(ruleResults),
        examples: mapToRetrievedChunks(exampleResults),
        patterns: mapToRetrievedChunks(patternResults),
      },
      gates: {
        citation_verified: citationVerified,
        retrieval_sufficient: sufficiency.sufficient,
      },
      metadata: {
        created_at: new Date().toISOString(),
        search_duration_ms: Date.now() - startTime,
      },
    }

    if (debug) {
      console.log(`[CriteriaPackBuilder] Pack built in ${criteriaPack.metadata.search_duration_ms}ms`)
    }

    return criteriaPack

  } catch (error) {
    // -----------------------------------------------------------------------
    // 에러 발생 시: 기본 Pack 반환 (Gates 실패 상태)
    // -----------------------------------------------------------------------
    console.error('[CriteriaPackBuilder] Error building pack:', error)
    
    return {
      ...defaultPack,
      metadata: {
        created_at: new Date().toISOString(),
        search_duration_ms: Date.now() - startTime,
      },
    }
  }
}

// =============================================================================
// 배치 처리
// =============================================================================

/**
 * [R-08] 여러 루브릭에 대한 CriteriaPack 일괄 구축
 * 
 * @description
 * 여러 루브릭에 대해 병렬로 CriteriaPack을 구축합니다.
 * 개별 실패 시에도 다른 루브릭은 계속 처리됩니다.
 * 
 * @param rubrics - 루브릭 배열
 * @param userId - 사용자 ID
 * @param options - 빌드 옵션
 * @returns BatchBuildResult
 * 
 * @example
 * ```typescript
 * const result = await buildCriteriaPackBatch(rubrics, userId)
 * console.log(`Success: ${result.packs.length}, Failed: ${result.failedIds.length}`)
 * ```
 */
export async function buildCriteriaPackBatch(
  rubrics: Rubric[],
  userId: string,
  options: BuildCriteriaPackOptions = {}
): Promise<BatchBuildResult> {
  const startTime = Date.now()
  const packs: CriteriaPackV2[] = []
  const failedIds: string[] = []

  // 병렬 처리 (최대 5개씩 배치)
  const BATCH_SIZE = 5
  
  for (let i = 0; i < rubrics.length; i += BATCH_SIZE) {
    const batch = rubrics.slice(i, i + BATCH_SIZE)
    
    const batchResults = await Promise.allSettled(
      batch.map(rubric => buildCriteriaPack(rubric, userId, options))
    )
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        packs.push(result.value)
      } else {
        failedIds.push(batch[index].id)
        console.error(`[CriteriaPackBuilder] Failed to build pack for ${batch[index].id}:`, result.reason)
      }
    })
  }

  return {
    success: failedIds.length === 0,
    packs,
    failedIds,
    totalDurationMs: Date.now() - startTime,
  }
}

// =============================================================================
// 유틸리티
// =============================================================================

/**
 * [R-08] CriteriaPack의 총 근거 수 반환
 */
export function getTotalEvidenceCount(pack: CriteriaPackV2): number {
  return (
    pack.evidence.rules.length +
    pack.evidence.examples.length +
    pack.evidence.patterns.length
  )
}

/**
 * [R-08] CriteriaPack의 평균 점수 계산
 */
export function getAverageScore(pack: CriteriaPackV2): number {
  const allChunks = [
    ...pack.evidence.rules,
    ...pack.evidence.examples,
    ...pack.evidence.patterns,
  ]
  
  if (allChunks.length === 0) return 0
  
  const totalScore = allChunks.reduce((sum, chunk) => sum + chunk.score, 0)
  return totalScore / allChunks.length
}

/**
 * [R-08] CriteriaPack 요약 정보 반환 (디버깅용)
 */
export function summarizeCriteriaPack(pack: CriteriaPackV2): string {
  const evidenceCount = getTotalEvidenceCount(pack)
  const avgScore = getAverageScore(pack)
  const gatesStatus = pack.gates.retrieval_sufficient && pack.gates.citation_verified
    ? '✅ PASS'
    : '❌ FAIL'
  
  return `[${pack.criteria_id}] Evidence: ${evidenceCount}, Avg Score: ${(avgScore * 100).toFixed(1)}%, Gates: ${gatesStatus}, Duration: ${pack.metadata.search_duration_ms}ms`
}
