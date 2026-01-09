// =============================================================================
// PRISM Writer - Research Persistence Hook
// =============================================================================
// 파일: frontend/src/hooks/useResearchPersistence.ts
// 역할: 검색 상태 지속성 관리 (새로고침 방어)
// 전략: sessionStorage 사용 (탭 닫으면 초기화, 새로고침은 유지)
// 참고: [Deep Scholar Persistence 체크리스트 P3-01]
// =============================================================================

import { useCallback } from 'react'
import type { SummarizedResult } from '@/lib/research/resultSummarizer'

// =============================================================================
// Types
// =============================================================================

export interface PersistenceData {
  /** 검색 쿼리 */
  query: string
  /** 검색 결과 */
  results: SummarizedResult[]
  /** 실제 검색된 쿼리 (LLM 생성) */
  searchedQuery: string | null
  /** 검색 언어 */
  language: 'ko' | 'en' | 'all'
}

// =============================================================================
// Hook: useResearchPersistence
// =============================================================================

/**
 * 검색 상태 지속성 관리 훅
 *
 * @description
 * [시니어 개발자 주석]
 * - sessionStorage를 사용하여 새로고침 시에도 검색 상태 유지
 * - projectId별 격리 (키 이름에 포함)
 * - JSON 파싱 예외 처리 필수
 *
 * @param projectId - 현재 프로젝트 ID (격리용)
 */
export function useResearchPersistence(projectId: string) {
  // ---------------------------------------------------------------------------
  // [P3-01-01] Storage Key (ProjectId 기반 격리)
  // ---------------------------------------------------------------------------
  const storageKey = `deep-scholar-state-${projectId}`

  /**
   * 상태 저장
   */
  const saveState = useCallback((data: PersistenceData) => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(data))
      }
    } catch (error) {
      console.error('[Persistence] Failed to save state:', error)
    }
  }, [storageKey])

  /**
   * 상태 로드
   */
  const loadState = useCallback((): PersistenceData | null => {
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(storageKey)
        return stored ? JSON.parse(stored) : null
      }
      return null
    } catch (error) {
      console.error('[Persistence] Failed to load state:', error)
      return null
    }
  }, [storageKey])

  /**
   * 상태 초기화
   */
  const clearState = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(storageKey)
      }
    } catch (error) {
      console.error('[Persistence] Failed to clear state:', error)
    }
  }, [storageKey])

  return { saveState, loadState, clearState }
}
