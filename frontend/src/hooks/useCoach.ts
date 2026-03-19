// =============================================================================
// PRISM Writer - useCoach Hook
// =============================================================================
// 파일: frontend/src/hooks/useCoach.ts
// 역할: AI 글쓰기 코치 상태 관리 및 CRUD 작업
// 생성일: 2026-03-19
// Phase C: P3-07
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface Coach {
  id: string
  user_id: string
  project_id: string | null
  name: string
  description: string | null
  icon: string
  source_document_ids: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  // style_profile은 목록 조회 시 제외됨 (용량 최적화)
  style_profile?: Record<string, unknown>
}

export interface CreateCoachInput {
  name: string
  description?: string
  icon?: string
  documentIds: string[]
  projectId?: string | null
}

export interface UpdateCoachInput {
  name?: string
  description?: string
  icon?: string
  is_active?: boolean
}

export interface UseCoachReturn {
  coaches: Coach[]
  activeCoach: Coach | null
  isLoading: boolean
  isAnalyzing: boolean
  fetchCoaches: (projectId: string | null) => Promise<void>
  createCoach: (input: CreateCoachInput) => Promise<Coach | null>
  activateCoach: (coach: Coach | null) => void
  deleteCoach: (coachId: string) => Promise<boolean>
  updateCoach: (coachId: string, updates: UpdateCoachInput) => Promise<boolean>
}

// =============================================================================
// localStorage 키
// =============================================================================
const ACTIVE_COACH_KEY = 'prism_active_coach_id'

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCoach(projectId?: string | null): UseCoachReturn {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // ---------------------------------------------------------------------------
  // localStorage에서 activeCoach 복원
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedId = localStorage.getItem(ACTIVE_COACH_KEY)
    if (storedId && coaches.length > 0) {
      const found = coaches.find((c) => c.id === storedId)
      if (found) {
        setActiveCoach(found)
      } else {
        // 저장된 코치가 목록에 없으면 제거
        localStorage.removeItem(ACTIVE_COACH_KEY)
        setActiveCoach(null)
      }
    }
  }, [coaches])

  // ---------------------------------------------------------------------------
  // 코치 목록 조회
  // ---------------------------------------------------------------------------
  const fetchCoaches = useCallback(async (pid: string | null) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (pid) params.set('projectId', pid)

      const res = await fetch(`/api/coaches?${params.toString()}`)
      if (!res.ok) {
        console.error('[useCoach] fetchCoaches failed:', res.status)
        setCoaches([])
        return
      }

      const data = await res.json()
      if (data.success) {
        setCoaches(data.coaches || [])
      } else {
        setCoaches([])
      }
    } catch (err) {
      console.error('[useCoach] fetchCoaches error:', err)
      setCoaches([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // projectId 변경 시 자동 fetch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (projectId !== undefined) {
      fetchCoaches(projectId ?? null)
    }
  }, [projectId, fetchCoaches])

  // ---------------------------------------------------------------------------
  // 코치 생성 + 스타일 분석 시작
  // ---------------------------------------------------------------------------
  const createCoach = useCallback(async (input: CreateCoachInput): Promise<Coach | null> => {
    try {
      // 1. 코치 생성
      const createRes = await fetch('/api/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          description: input.description || null,
          icon: input.icon || undefined,
          projectId: input.projectId || null,
          documentIds: input.documentIds,
        }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}))
        console.error('[useCoach] createCoach failed:', errData)
        return null
      }

      const createData = await createRes.json()
      if (!createData.success || !createData.coach) {
        return null
      }

      const newCoach: Coach = createData.coach

      // 목록에 즉시 추가
      setCoaches((prev) => [newCoach, ...prev])

      // 2. 비동기 스타일 분석 시작
      setIsAnalyzing(true)
      try {
        const analyzeRes = await fetch('/api/coaches/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId: newCoach.id,
            documentIds: input.documentIds,
          }),
        })

        if (analyzeRes.ok) {
          const analyzeData = await analyzeRes.json()
          if (analyzeData.success && analyzeData.coach) {
            // 분석 완료된 코치로 목록 업데이트
            setCoaches((prev) =>
              prev.map((c) => (c.id === newCoach.id ? analyzeData.coach : c))
            )
            return analyzeData.coach
          }
        } else {
          console.error('[useCoach] Style analysis failed:', analyzeRes.status)
        }
      } catch (analyzeErr) {
        console.error('[useCoach] Style analysis error:', analyzeErr)
      } finally {
        setIsAnalyzing(false)
      }

      return newCoach
    } catch (err) {
      console.error('[useCoach] createCoach error:', err)
      return null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 코치 활성화/비활성화
  // ---------------------------------------------------------------------------
  const activateCoach = useCallback((coach: Coach | null) => {
    setActiveCoach(coach)
    if (typeof window !== 'undefined') {
      if (coach) {
        localStorage.setItem(ACTIVE_COACH_KEY, coach.id)
      } else {
        localStorage.removeItem(ACTIVE_COACH_KEY)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 코치 삭제
  // ---------------------------------------------------------------------------
  const deleteCoach = useCallback(async (coachId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/coaches?id=${coachId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        console.error('[useCoach] deleteCoach failed:', res.status)
        return false
      }

      const data = await res.json()
      if (data.success) {
        setCoaches((prev) => prev.filter((c) => c.id !== coachId))
        // 삭제된 코치가 활성 코치였으면 비활성화
        setActiveCoach((prev) => {
          if (prev?.id === coachId) {
            localStorage.removeItem(ACTIVE_COACH_KEY)
            return null
          }
          return prev
        })
        return true
      }
      return false
    } catch (err) {
      console.error('[useCoach] deleteCoach error:', err)
      return false
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 코치 수정
  // ---------------------------------------------------------------------------
  const updateCoach = useCallback(async (coachId: string, updates: UpdateCoachInput): Promise<boolean> => {
    try {
      const res = await fetch('/api/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coachId, ...updates }),
      })

      if (!res.ok) {
        console.error('[useCoach] updateCoach failed:', res.status)
        return false
      }

      const data = await res.json()
      if (data.success && data.coach) {
        setCoaches((prev) =>
          prev.map((c) => (c.id === coachId ? data.coach : c))
        )
        // 활성 코치가 수정된 경우 activeCoach도 업데이트
        setActiveCoach((prev) => {
          if (prev?.id === coachId) return data.coach
          return prev
        })
        return true
      }
      return false
    } catch (err) {
      console.error('[useCoach] updateCoach error:', err)
      return false
    }
  }, [])

  return {
    coaches,
    activeCoach,
    isLoading,
    isAnalyzing,
    fetchCoaches,
    createCoach,
    activateCoach,
    deleteCoach,
    updateCoach,
  }
}
