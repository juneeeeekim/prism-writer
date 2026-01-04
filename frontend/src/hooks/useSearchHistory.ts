// =============================================================================
// PRISM Writer - Search History Hook (P-A05-01)
// =============================================================================
// 파일: frontend/src/hooks/useSearchHistory.ts
// 역할: 검색 히스토리 관리 훅 (localStorage 기반)
// 작성일: 2026-01-04
// Phase: A - Quick Wins (UX 개선)
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// [P-A05-01] 상수 정의
// =============================================================================

/** localStorage 저장 키 */
const STORAGE_KEY = 'prism-search-history'

/** 최대 히스토리 개수 */
const MAX_HISTORY = 10

// =============================================================================
// [P-A05-01] 타입 정의
// =============================================================================

/** 검색 히스토리 항목 */
export interface SearchHistoryItem {
  /** 검색어 */
  query: string
  /** 검색 시간 (Unix timestamp) */
  timestamp: number
}

/** useSearchHistory 훅 반환 타입 */
export interface UseSearchHistoryReturn {
  /** 검색 히스토리 목록 (최신순) */
  history: SearchHistoryItem[]
  /** 히스토리에 검색어 추가 */
  addToHistory: (query: string) => void
  /** 히스토리에서 특정 검색어 삭제 */
  removeFromHistory: (query: string) => void
  /** 전체 히스토리 삭제 */
  clearHistory: () => void
}

// =============================================================================
// [P-A05-01] 헬퍼 함수
// =============================================================================

/**
 * localStorage에서 히스토리 로드
 *
 * @returns 저장된 히스토리 배열 또는 빈 배열
 */
function loadHistoryFromStorage(): SearchHistoryItem[] {
  // SSR 환경 체크 (서버에서는 localStorage 없음)
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 배열 유효성 검증
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is SearchHistoryItem =>
            typeof item === 'object' &&
            typeof item.query === 'string' &&
            typeof item.timestamp === 'number'
        )
      }
    }
  } catch (e) {
    console.warn('[useSearchHistory] Failed to load search history:', e)
  }

  return []
}

/**
 * localStorage에 히스토리 저장
 *
 * @param history - 저장할 히스토리 배열
 */
function saveHistoryToStorage(history: SearchHistoryItem[]): void {
  // SSR 환경 체크
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (e) {
    console.warn('[useSearchHistory] Failed to save search history:', e)
  }
}

// =============================================================================
// [P-A05-01] useSearchHistory 훅
// =============================================================================

/**
 * 검색 히스토리 관리 훅
 *
 * @description
 * localStorage를 사용하여 검색 히스토리를 저장하고 관리합니다.
 * - 최대 10개 항목 유지
 * - 중복 검색어는 최신으로 갱신
 * - 새로고침 후에도 히스토리 유지
 *
 * @example
 * ```tsx
 * const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory()
 *
 * // 검색 성공 후 히스토리에 추가
 * const handleSearch = async (query: string) => {
 *   const results = await search(query)
 *   if (results.length > 0) {
 *     addToHistory(query)
 *   }
 * }
 *
 * // 히스토리 목록 표시
 * {history.map(item => (
 *   <button key={item.timestamp} onClick={() => setQuery(item.query)}>
 *     {item.query}
 *     <span onClick={() => removeFromHistory(item.query)}>✕</span>
 *   </button>
 * ))}
 * ```
 */
export function useSearchHistory(): UseSearchHistoryReturn {
  // ---------------------------------------------------------------------------
  // [P-A05-01] 상태 관리
  // ---------------------------------------------------------------------------
  const [history, setHistory] = useState<SearchHistoryItem[]>([])

  // ---------------------------------------------------------------------------
  // [P-A05-01] 초기 로드 (컴포넌트 마운트 시)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loaded = loadHistoryFromStorage()
    setHistory(loaded)
  }, [])

  // ---------------------------------------------------------------------------
  // [P-A05-01] 히스토리 추가
  // ---------------------------------------------------------------------------
  /**
   * 검색어를 히스토리에 추가
   *
   * @param query - 추가할 검색어
   *
   * @description
   * - 빈 검색어는 무시
   * - 중복 검색어는 제거 후 맨 앞에 추가 (최신으로 갱신)
   * - 최대 MAX_HISTORY개 유지
   */
  const addToHistory = useCallback((query: string) => {
    // 빈 검색어 무시
    if (!query.trim()) return

    setHistory(prev => {
      // 중복 제거 (대소문자 구분)
      const filtered = prev.filter(h => h.query !== query.trim())

      // 새 항목 맨 앞에 추가
      const newHistory: SearchHistoryItem[] = [
        { query: query.trim(), timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY) // 최대 개수 제한

      // localStorage에 저장
      saveHistoryToStorage(newHistory)

      return newHistory
    })
  }, [])

  // ---------------------------------------------------------------------------
  // [P-A05-01] 히스토리 항목 삭제
  // ---------------------------------------------------------------------------
  /**
   * 특정 검색어를 히스토리에서 삭제
   *
   * @param query - 삭제할 검색어
   */
  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(h => h.query !== query)

      // localStorage에 저장
      saveHistoryToStorage(newHistory)

      return newHistory
    })
  }, [])

  // ---------------------------------------------------------------------------
  // [P-A05-01] 전체 히스토리 삭제
  // ---------------------------------------------------------------------------
  /**
   * 모든 검색 히스토리 삭제
   */
  const clearHistory = useCallback(() => {
    // SSR 환경 체크
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        console.warn('[useSearchHistory] Failed to clear search history:', e)
      }
    }

    setHistory([])
  }, [])

  // ---------------------------------------------------------------------------
  // [P-A05-01] 반환
  // ---------------------------------------------------------------------------
  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default useSearchHistory
