// =============================================================================
// PRISM Writer - RAG Search Service
// =============================================================================
// 파일: frontend/src/lib/services/chat/ragSearchService.ts
// 역할: RAG 검색 비즈니스 로직 (Query Expansion, Criteria Pack, Self-RAG)
// 리팩토링: 2026-01-20
// =============================================================================

import { hybridSearch, type SearchResult } from '@/lib/rag/search'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { buildSearchQueries } from '@/lib/rag/queryBuilder'
import { checkSufficiency } from '@/lib/rag/sufficiencyGate'
import {
  checkRetrievalNecessity,
  critiqueRetrievalResults,
} from '@/lib/rag/selfRAG'

// =============================================================================
// Types
// =============================================================================

export interface RAGSearchOptions {
  userId: string
  projectId?: string
  topK?: number
  minScore?: number
}

export interface RAGSearchResult {
  context: string
  hasRetrievedDocs: boolean
  uniqueResults: SearchResult[]
}

// =============================================================================
// Helper: Deduplicate by ChunkId
// =============================================================================

function deduplicateByChunkId(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    if (seen.has(r.chunkId)) return false
    seen.add(r.chunkId)
    return true
  })
}

// =============================================================================
// Main RAG Search
// =============================================================================

export async function performRAGSearch(
  query: string,
  options: RAGSearchOptions
): Promise<RAGSearchResult> {
  const { userId, projectId, topK = 5, minScore = 0.35 } = options

  try {
    // =========================================================================
    // Step 1: Retrieval Necessity Check (Self-RAG)
    // =========================================================================
    if (FEATURE_FLAGS.ENABLE_SELF_RAG) {
      const necessity = await checkRetrievalNecessity(query)
      if (!necessity.needed) {
        console.log(`[RAGSearch] Retrieval skipped: ${necessity.reason}`)
        return { context: '', hasRetrievedDocs: false, uniqueResults: [] }
      }
    }

    let uniqueResults: SearchResult[] = []

    // =========================================================================
    // Step 2: Criteria Pack Mode
    // =========================================================================
    if (FEATURE_FLAGS.ENABLE_CRITERIA_PACK) {
      const queries = buildSearchQueries({
        criteria_id: 'chat-query',
        name: query,
        definition: query,
        category: 'general',
      })

      const searchOptions = {
        userId,
        topK: 3,
        projectId,
        minScore,
        vectorWeight: 0.6,
        keywordWeight: 0.4,
      }

      const [ruleResults, exampleResults, patternResults] = await Promise.all([
        hybridSearch(queries.rule_query, searchOptions).catch(() => []),
        hybridSearch(queries.example_query, searchOptions).catch(() => []),
        hybridSearch(queries.pattern_query, searchOptions).catch(() => []),
      ])

      const allResults = [...ruleResults, ...exampleResults, ...patternResults]
      uniqueResults = deduplicateByChunkId(allResults)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      const sufficiency = checkSufficiency(uniqueResults)
      console.log(`[RAGSearch] Sufficiency: ${sufficiency.sufficient}`)
    }

    // =========================================================================
    // Step 3: Fallback to Query Expansion / Legacy
    // =========================================================================
    if (uniqueResults.length === 0) {
      const enableQueryExpansion = process.env.ENABLE_QUERY_EXPANSION === 'true'

      if (enableQueryExpansion) {
        const { expandQuery } = await import('@/lib/rag/queryExpansion')
        const { calculateDynamicThreshold } = await import('@/lib/rag/dynamicThreshold')

        const expandedQueries = expandQuery(query)
        const dynamicThreshold = calculateDynamicThreshold(query)

        const searchPromises = expandedQueries.map((q) =>
          hybridSearch(q, {
            userId,
            topK: 3,
            minScore: dynamicThreshold,
            vectorWeight: 0.6,
            keywordWeight: 0.4,
            projectId,
          }).catch(() => [])
        )

        const searchResultsArray = await Promise.all(searchPromises)
        const allResults = searchResultsArray.flat()

        uniqueResults = deduplicateByChunkId(allResults)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
      } else {
        uniqueResults = await hybridSearch(query, {
          userId,
          topK,
          minScore,
          vectorWeight: 0.6,
          keywordWeight: 0.4,
          projectId,
        })
      }
    }

    // =========================================================================
    // Step 4: Critique (Self-RAG)
    // =========================================================================
    if (FEATURE_FLAGS.ENABLE_SELF_RAG && uniqueResults.length > 0) {
      const initialCount = uniqueResults.length
      const critiqued = await critiqueRetrievalResults(query, uniqueResults)
      uniqueResults = critiqued.filter((c) => c.isRelevant).map((c) => c.result)
      console.log(`[RAGSearch] Critique: ${initialCount} -> ${uniqueResults.length}`)
    }

    // =========================================================================
    // Step 5: Format Context
    // =========================================================================
    if (uniqueResults.length > 0) {
      return {
        context: uniqueResults
          .map((result, index) =>
            `[참고 자료 ${index + 1}: ${result.metadata?.title || 'Untitled'}]\n${result.content}`
          )
          .join('\n\n'),
        hasRetrievedDocs: true,
        uniqueResults,
      }
    }

    return { context: '', hasRetrievedDocs: false, uniqueResults: [] }
  } catch (error) {
    console.warn('[RAGSearch] Search failed:', error)
    return { context: '', hasRetrievedDocs: false, uniqueResults: [] }
  }
}
