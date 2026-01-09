// =============================================================================
// PRISM Writer - Research History Hook
// =============================================================================
// 파일: frontend/src/hooks/useResearchHistory.ts
// 역할: 검색 히스토리 관리 (최근 검색어)
// 전략: localStorage 사용 (영구 보관, 최대 10개)
// 참고: [Deep Scholar Persistence 체크리스트 P3-02]
// =============================================================================

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface HistoryItem {
  id: string
  query: string
  timestamp: number
  resultCount: number
}

// =============================================================================
// Hook: useResearchHistory
// =============================================================================

/**
 * 검색 히스토리 관리 훅
 *
 * @description
 * [시니어 개발자 주석]
 * - localStorage를 사용하여 영구 보관
 * - projectId별 격리
 * - 최대 10개 항목 유지 (FIFO + 중복 최신화)
 *
 * @param projectId - 현재 프로젝트 ID
 */
export function useResearchHistory(projectId: string) {
  // ---------------------------------------------------------------------------
  // [P3-02-01] Storage Key (ProjectId 기반 격리)
  // ---------------------------------------------------------------------------
  const storageKey = `deep-scholar-history-${projectId}`
  const MAX_HISTORY_ITEMS = 10

  const [history, setHistory] = useState<HistoryItem[]>([])

  // ---------------------------------------------------------------------------
  // [P3-02-02] Load History
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          setHistory(JSON.parse(stored))
        } else {
          setHistory([])
        }
      }
    } catch (error) {
      console.error('[History] Failed to load history:', error)
      setHistory([])
    }
  }, [projectId, storageKey])

  // ---------------------------------------------------------------------------
  // [P3-02-03] Add History Item
  // ---------------------------------------------------------------------------
  const addToHistory = useCallback((query: string, resultCount: number) => {
    try {
      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        query,
        timestamp: Date.now(),
        resultCount,
      }

      setHistory((prev) => {
        // 중복 제거 (같은 쿼리 최상단 이동)
        const filtered = prev.filter((item) => item.query !== query)
        
        // 최대 개수 제한 적용
        const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)

        // LocalStorage 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(newHistory))
        }

        return newHistory
      })
    } catch (error) {
      console.error('[History] Failed to add history:', error)
    }
  }, [storageKey])

  // ---------------------------------------------------------------------------
  // [P3-02-04] Clear History
  // ---------------------------------------------------------------------------
  const clearHistory = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey)
      }
      setHistory([])
    } catch (error) {
      console.error('[History] Failed to clear history:', error)
    }
  }, [storageKey])

  return { history, addToHistory, clearHistory }
}
