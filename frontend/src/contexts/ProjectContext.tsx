// =============================================================================
// [P5-05-A] Project Context - 프로젝트 전역 상태 관리
// =============================================================================
// 파일: frontend/src/contexts/ProjectContext.tsx
// 역할: 멀티 프로젝트 시스템의 전역 상태 및 CRUD 액션 제공
// 생성일: 2025-12-31
// 수정일: 2026-01-01 - [P8-SEARCH] 검색/정렬 필터 상태 추가
// =============================================================================

'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectContextValue,
  ProjectFilter,
  ProjectSortBy,
} from '@/types/project'

// =============================================================================
// Context 생성
// =============================================================================

const ProjectContext = createContext<ProjectContextValue | null>(null)

// =============================================================================
// Provider 컴포넌트
// =============================================================================

interface ProjectProviderProps {
  children: React.ReactNode
}

/**
 * 프로젝트 전역 상태 Provider
 * 
 * @description
 * 앱 전체에서 현재 프로젝트 상태와 CRUD 액션을 제공합니다.
 * localStorage를 통해 마지막 선택 프로젝트를 기억합니다.
 * 
 * @example
 * ```tsx
 * // layout.tsx or providers.tsx
 * <ProjectProvider>
 *   <App />
 * </ProjectProvider>
 * ```
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  // ---------------------------------------------------------------------------
  // 상태 정의
  // ---------------------------------------------------------------------------

  /** 현재 선택된 프로젝트 */
  const [currentProject, setCurrentProject] = useState<Project | null>(null)

  /** 사용자의 모든 프로젝트 목록 */
  const [projects, setProjects] = useState<Project[]>([])

  /** 로딩 상태 */
  const [isLoading, setIsLoading] = useState(true)

  /** 에러 메시지 */
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // [P8-SEARCH] 필터 상태
  // ---------------------------------------------------------------------------
  const [filter, setFilter] = useState<ProjectFilter>({
    status: 'active',
    search: '',
    sortBy: 'updated_at',
    sortOrder: 'desc',
  })

  // ---------------------------------------------------------------------------
  // API 호출 함수들
  // ---------------------------------------------------------------------------

  /**
   * 프로젝트 목록 새로고침
   * [P8-SEARCH] 필터 파라미터를 API에 전달
   */
  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // [P8-SEARCH] 필터 파라미터를 쿼리스트링으로 구성
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.search) params.set('search', filter.search)
      if (filter.sortBy) params.set('sortBy', filter.sortBy)
      if (filter.sortOrder) params.set('sortOrder', filter.sortOrder)

      const response = await fetch(`/api/projects?${params.toString()}`)

      if (!response.ok) {
        throw new Error('프로젝트 목록을 불러오는 데 실패했습니다.')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || '프로젝트 로드 실패')
      }

      const loadedProjects = data.data?.projects ?? []
      setProjects(loadedProjects)

      // 현재 프로젝트가 없고, 로드된 프로젝트가 있으면 첫 번째 선택
      // [P8-SEARCH] 검색 중이 아닐 때만 자동 선택
      if (!currentProject && loadedProjects.length > 0 && !filter.search) {
        // localStorage에서 마지막 선택 프로젝트 확인
        const lastProjectId = localStorage.getItem('lastProjectId')
        const lastProject = loadedProjects.find((p: Project) => p.id === lastProjectId)

        if (lastProject) {
          setCurrentProject(lastProject)
        } else {
          setCurrentProject(loadedProjects[0])
        }
      }

      console.log(`[ProjectContext] Loaded ${loadedProjects.length} projects (filter: ${filter.search || 'none'})`)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(errorMessage)
      console.error('[ProjectContext] Error loading projects:', e)
    } finally {
      setIsLoading(false)
    }
  }, [currentProject, filter])

  /**
   * 프로젝트 선택 (전환)
   */
  const selectProject = useCallback((projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    
    if (project) {
      setCurrentProject(project)
      localStorage.setItem('lastProjectId', projectId)
      console.log(`[ProjectContext] Selected project: ${project.name}`)
    } else {
      console.warn(`[ProjectContext] Project not found: ${projectId}`)
    }
  }, [projects])

  /**
   * 새 프로젝트 생성
   */
  const createProject = useCallback(async (input: CreateProjectInput): Promise<Project> => {
    try {
      setError(null)

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '프로젝트 생성 실패')
      }

      const newProject = data.data as Project
      
      // 목록에 추가 및 선택
      setProjects((prev) => [newProject, ...prev])
      setCurrentProject(newProject)
      localStorage.setItem('lastProjectId', newProject.id)

      console.log(`[ProjectContext] Created project: ${newProject.name}`)
      return newProject
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '프로젝트 생성 중 오류'
      setError(errorMessage)
      throw e
    }
  }, [])

  /**
   * 프로젝트 수정
   */
  const updateProject = useCallback(async (id: string, input: UpdateProjectInput): Promise<Project> => {
    try {
      setError(null)

      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '프로젝트 수정 실패')
      }

      const updatedProject = data.data as Project

      // 목록에서 업데이트
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? updatedProject : p))
      )

      // 현재 프로젝트라면 상태도 업데이트
      if (currentProject?.id === id) {
        setCurrentProject(updatedProject)
      }

      console.log(`[ProjectContext] Updated project: ${updatedProject.name}`)
      return updatedProject
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '프로젝트 수정 중 오류'
      setError(errorMessage)
      throw e
    }
  }, [currentProject])

  /**
   * [P6-03] 현재 프로젝트 온보딩 완료 처리
   */
  const completeSetup = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      console.warn('[ProjectContext] No current project to complete setup')
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup_completed: true }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '온보딩 완료 처리 실패')
      }

      // 현재 프로젝트 상태 업데이트
      const updatedProject = { ...currentProject, setup_completed: true }
      setCurrentProject(updatedProject)

      // 목록에서도 업데이트
      setProjects((prev) =>
        prev.map((p) => (p.id === currentProject.id ? updatedProject : p))
      )

      console.log(`[ProjectContext] Setup completed for: ${currentProject.name}`)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '온보딩 완료 처리 중 오류'
      setError(errorMessage)
      throw e
    }
  }, [currentProject])

  /**
   * 프로젝트 삭제
   */
  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null)

      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok && response.status !== 204) {
        const data = await response.json()
        throw new Error(data.message || '프로젝트 삭제 실패')
      }

      // 목록에서 제거
      setProjects((prev) => prev.filter((p) => p.id !== id))

      // 현재 프로젝트였다면 다음 프로젝트로 전환
      if (currentProject?.id === id) {
        const remaining = projects.filter((p) => p.id !== id)
        if (remaining.length > 0) {
          setCurrentProject(remaining[0])
          localStorage.setItem('lastProjectId', remaining[0].id)
        } else {
          setCurrentProject(null)
          localStorage.removeItem('lastProjectId')
        }
      }

      console.log(`[ProjectContext] Deleted project: ${id}`)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '프로젝트 삭제 중 오류'
      setError(errorMessage)
      throw e
    }
  }, [currentProject, projects])

  // ---------------------------------------------------------------------------
  // [P8-SEARCH] 필터 액션 함수들
  // ---------------------------------------------------------------------------

  /**
   * 검색어 설정
   */
  const setSearch = useCallback((search: string) => {
    setFilter((prev) => ({ ...prev, search }))
  }, [])

  /**
   * 정렬 옵션 설정
   */
  const setSortOption = useCallback((sortBy: ProjectSortBy, sortOrder: 'asc' | 'desc' = 'desc') => {
    setFilter((prev) => ({ ...prev, sortBy, sortOrder }))
  }, [])

  // ---------------------------------------------------------------------------
  // 초기 로드
  // ---------------------------------------------------------------------------

  useEffect(() => {
    refreshProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // [P8-SEARCH] 필터 변경 시 목록 새로고침
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // 초기 로드는 위에서 처리하므로, 필터 변경 시에만 새로고침
    // isLoading이 false일 때만 (초기 로드 완료 후)
    if (!isLoading) {
      refreshProjects()
    }
    // refreshProjects를 deps에서 제외하여 무한 루프 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.search, filter.sortBy, filter.sortOrder])

  // ---------------------------------------------------------------------------
  // Context 값 메모이제이션
  // ---------------------------------------------------------------------------

  const contextValue = useMemo<ProjectContextValue>(
    () => ({
      currentProject,
      projects,
      isLoading,
      error,
      filter,  // [P8-SEARCH]
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      refreshProjects,
      completeSetup,  // [P6-03]
      setSearch,      // [P8-SEARCH]
      setSortOption,  // [P8-SEARCH]
    }),
    [
      currentProject,
      projects,
      isLoading,
      error,
      filter,  // [P8-SEARCH]
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      refreshProjects,
      completeSetup,  // [P6-03]
      setSearch,      // [P8-SEARCH]
      setSortOption,  // [P8-SEARCH]
    ]
  )

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  )
}

// =============================================================================
// Custom Hook
// =============================================================================

/**
 * Project Context 사용을 위한 커스텀 훅
 * 
 * @throws ProjectProvider 외부에서 사용 시 에러
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentProject, projects, selectProject } = useProject()
 *   
 *   return (
 *     <div>
 *       <h1>{currentProject?.name ?? '프로젝트 선택'}</h1>
 *       <ul>
 *         {projects.map(p => (
 *           <li key={p.id} onClick={() => selectProject(p.id)}>
 *             {p.icon} {p.name}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error(
      '[useProject] ProjectProvider 외부에서 사용할 수 없습니다. ' +
      '컴포넌트를 ProjectProvider로 감싸주세요.'
    )
  }

  return context
}

// =============================================================================
// Export
// =============================================================================

export { ProjectContext }
