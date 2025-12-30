// =============================================================================
// [P5-05-A] Project Context - 프로젝트 전역 상태 관리
// =============================================================================
// 파일: frontend/src/contexts/ProjectContext.tsx
// 역할: 멀티 프로젝트 시스템의 전역 상태 및 CRUD 액션 제공
// 생성일: 2025-12-31
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
  // API 호출 함수들
  // ---------------------------------------------------------------------------

  /**
   * 프로젝트 목록 새로고침
   */
  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/projects')
      
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
      if (!currentProject && loadedProjects.length > 0) {
        // localStorage에서 마지막 선택 프로젝트 확인
        const lastProjectId = localStorage.getItem('lastProjectId')
        const lastProject = loadedProjects.find((p: Project) => p.id === lastProjectId)
        
        if (lastProject) {
          setCurrentProject(lastProject)
        } else {
          setCurrentProject(loadedProjects[0])
        }
      }

      console.log(`[ProjectContext] Loaded ${loadedProjects.length} projects`)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류'
      setError(errorMessage)
      console.error('[ProjectContext] Error loading projects:', e)
    } finally {
      setIsLoading(false)
    }
  }, [currentProject])

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
  // 초기 로드
  // ---------------------------------------------------------------------------

  useEffect(() => {
    refreshProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Context 값 메모이제이션
  // ---------------------------------------------------------------------------

  const contextValue = useMemo<ProjectContextValue>(
    () => ({
      currentProject,
      projects,
      isLoading,
      error,
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      refreshProjects,
    }),
    [
      currentProject,
      projects,
      isLoading,
      error,
      selectProject,
      createProject,
      updateProject,
      deleteProject,
      refreshProjects,
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
