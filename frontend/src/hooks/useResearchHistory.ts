// =============================================================================
// PRISM Writer - Research History Hook (API Version)
// =============================================================================
// 파일: frontend/src/hooks/useResearchHistory.ts
// 역할: 검색 히스토리 관리 (서버 DB 동기화)
// 
// [Search History Sync]
// 주석(시니어 개발자): localStorage 대신 서버 API를 사용하여
// 기기 간 동기화를 지원합니다.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import type { SummarizedResult } from '@/lib/research/resultSummarizer'

// =============================================================================
// Types
// =============================================================================

/**
 * [Search History Sync] 히스토리 아이템 타입
 * 서버 응답 형식과 일치
 */
export interface HistoryItem {
  id: string
  query: string
  timestamp: number  // created_at을 timestamp로 변환
  resultCount: number
  // [Search History Sync] 캐싱된 결과 (Tavily API 비용 절감)
  resultsSummary?: { title: string; url: string; keyFact: string }[]
}

/**
 * API 응답 타입
 */
interface ApiHistoryItem {
  id: string
  query: string
  result_count: number
  results_summary: { title: string; url: string; keyFact: string }[] | null
  created_at: string
}

// =============================================================================
// Hook: useResearchHistory
// =============================================================================

/**
 * [Search History Sync] 검색 히스토리 관리 훅 (API 연동)
 *
 * @description
 * - 서버 DB를 사용하여 영구 저장 및 기기 간 동기화
 * - projectId별 격리
 * - 개별/전체 삭제 지원
 *
 * @param projectId - 현재 프로젝트 ID
 */
export function useResearchHistory(projectId: string) {
  // ---------------------------------------------------------------------------
  // [Search History Sync] State
  // ---------------------------------------------------------------------------
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // [Search History Sync] Fetch History from Server
  // ---------------------------------------------------------------------------
  const fetchHistory = useCallback(async () => {
    // projectId가 없으면 조회하지 않음
    if (!projectId || projectId === 'default') {
      setHistory([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/research/history?projectId=${projectId}`)
      const data = await res.json()

      if (data.success && data.histories) {
        // API 응답을 HistoryItem 형식으로 변환
        const items: HistoryItem[] = data.histories.map((h: ApiHistoryItem) => ({
          id: h.id,
          query: h.query,
          timestamp: new Date(h.created_at).getTime(),
          resultCount: h.result_count,
          resultsSummary: h.results_summary || undefined,
        }))
        setHistory(items)
      }
    } catch (error) {
      console.error('[Search History Sync] Failed to fetch history:', error)
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // ---------------------------------------------------------------------------
  // [Search History Sync] Load on Mount / ProjectId Change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // ---------------------------------------------------------------------------
  // [Search History Sync] Add to History (POST)
  // ---------------------------------------------------------------------------
  const addToHistory = useCallback(async (
    query: string,
    results: SummarizedResult[],
    resultCount: number
  ) => {
    if (!projectId || projectId === 'default') return

    try {
      await fetch('/api/research/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          query,
          results,
          resultCount,
        }),
      })

      // 목록 새로고침 (서버에서 최신 데이터 로드)
      fetchHistory()
    } catch (error) {
      console.error('[Search History Sync] Failed to add history:', error)
    }
  }, [projectId, fetchHistory])

  // ---------------------------------------------------------------------------
  // [Search History Sync] Delete Individual Item
  // ---------------------------------------------------------------------------
  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      await fetch(`/api/research/history/${id}`, {
        method: 'DELETE',
      })

      // Optimistic Update
      setHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.error('[Search History Sync] Failed to delete history item:', error)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // [Search History Sync] Clear All History (Project Scope)
  // ---------------------------------------------------------------------------
  const clearHistory = useCallback(async () => {
    if (!projectId || projectId === 'default') return

    try {
      await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      setHistory([])
    } catch (error) {
      console.error('[Search History Sync] Failed to clear history:', error)
    }
  }, [projectId])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    history,
    isLoading,
    addToHistory,
    deleteHistoryItem,
    clearHistory,
    refetch: fetchHistory,
  }
}
