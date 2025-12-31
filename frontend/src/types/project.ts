// =============================================================================
// [P5-02-A] Project Types - 멀티 프로젝트 시스템 타입 정의
// =============================================================================
// 파일: frontend/src/types/project.ts
// 생성일: 2025-12-31
// 담당: Tech Lead
//
// 주석(시니어 개발자): 이 파일은 멀티 프로젝트 시스템의 핵심 타입을 정의합니다.
// DB 스키마(`projects` 테이블)와 1:1 대응되도록 설계되었습니다.
// =============================================================================

// =============================================================================
// 기본 타입 정의
// =============================================================================

/**
 * 프로젝트 상태
 * - 'active': 활성 상태 (기본값)
 * - 'archived': 보관됨 (숨김 처리)
 */
export type ProjectStatus = 'active' | 'archived'

/**
 * 프로젝트 엔티티 (DB 스키마와 매핑)
 * 
 * @description
 * `public.projects` 테이블의 TypeScript 표현
 * 
 * @example
 * ```typescript
 * const project: Project = {
 *   id: '550e8400-e29b-41d4-a716-446655440000',
 *   user_id: '...',
 *   name: '기업 문서',
 *   description: '회사 정책 및 가이드라인',
 *   icon: '📁',
 *   status: 'active',
 *   created_at: '2025-12-31T00:00:00Z',
 *   updated_at: '2025-12-31T00:00:00Z'
 * }
 * ```
 */
export interface Project {
  /** 프로젝트 고유 ID (UUID) */
  id: string

  /** 소유자 ID (auth.users 참조) */
  user_id: string

  /** 프로젝트 이름 (필수, 최대 100자) */
  name: string

  /** 프로젝트 설명 (선택) */
  description: string | null

  /** 아이콘 (이모지, 기본값: 📁) */
  icon: string

  /** 상태: 'active' | 'archived' */
  status: ProjectStatus

  /** [P6-03] 온보딩 완료 여부: false(참고자료 설정 필요) | true(설정 완료) */
  setup_completed: boolean

  /** 생성일 (ISO 8601) */
  created_at: string

  /** 수정일 (ISO 8601) */
  updated_at: string
}

// =============================================================================
// API 요청/응답 타입
// =============================================================================

/**
 * 프로젝트 생성 입력
 * 
 * @description
 * POST /api/projects 요청 바디
 */
export interface CreateProjectInput {
  /** 프로젝트 이름 (필수) */
  name: string
  
  /** 프로젝트 설명 (선택) */
  description?: string
  
  /** 아이콘 (선택, 기본값: 📁) */
  icon?: string
}

/**
 * 프로젝트 수정 입력
 * 
 * @description
 * PATCH /api/projects/:id 요청 바디
 * 모든 필드 선택적 (부분 업데이트)
 */
export interface UpdateProjectInput {
  /** 새 이름 */
  name?: string

  /** 새 설명 */
  description?: string | null

  /** 새 아이콘 */
  icon?: string

  /** 새 상태 */
  status?: ProjectStatus

  /** [P6-03] 온보딩 완료 상태 */
  setup_completed?: boolean
}

/**
 * 프로젝트 목록 응답
 * 
 * @description
 * GET /api/projects 응답
 */
export interface ProjectListResponse {
  /** 프로젝트 배열 */
  projects: Project[]
  
  /** 총 개수 */
  total: number
}

/**
 * 프로젝트 상세 응답
 * 
 * @description
 * GET /api/projects/:id 응답
 */
export interface ProjectDetailResponse extends Project {
  /** 문서 수 (선택적 확장) */
  document_count?: number
  
  /** 평가 수 (선택적 확장) */
  evaluation_count?: number
}

// =============================================================================
// Context 타입 (React 상태 관리)
// =============================================================================

/**
 * Project Context 값
 * 
 * @description
 * ProjectProvider가 제공하는 전역 상태 및 액션
 * 
 * @example
 * ```typescript
 * const { currentProject, selectProject, createProject } = useProject()
 * 
 * // 프로젝트 전환
 * selectProject('project-id')
 * 
 * // 프로젝트 생성
 * const newProject = await createProject({ name: '새 프로젝트' })
 * ```
 */
export interface ProjectContextValue {
  // -------------------------------------------------------------------------
  // 상태
  // -------------------------------------------------------------------------
  
  /** 현재 선택된 프로젝트 (null = 미선택) */
  currentProject: Project | null
  
  /** 사용자의 모든 프로젝트 목록 */
  projects: Project[]
  
  /** 로딩 상태 */
  isLoading: boolean
  
  /** 에러 메시지 (null = 에러 없음) */
  error: string | null
  
  // -------------------------------------------------------------------------
  // 액션
  // -------------------------------------------------------------------------
  
  /**
   * 프로젝트 선택 (전환)
   * @param projectId - 선택할 프로젝트 ID
   */
  selectProject: (projectId: string) => void
  
  /**
   * 새 프로젝트 생성
   * @param input - 생성 입력
   * @returns 생성된 프로젝트
   */
  createProject: (input: CreateProjectInput) => Promise<Project>
  
  /**
   * 프로젝트 수정
   * @param id - 대상 프로젝트 ID
   * @param input - 수정 입력
   * @returns 수정된 프로젝트
   */
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>
  
  /**
   * 프로젝트 삭제
   * @param id - 대상 프로젝트 ID
   */
  deleteProject: (id: string) => Promise<void>
  
  /**
   * 프로젝트 목록 새로고침
   */
  refreshProjects: () => Promise<void>

  /**
   * [P6-03] 현재 프로젝트 온보딩 완료 처리
   * @description 참고자료 설정이 완료되면 호출하여 전체 기능 활성화
   */
  completeSetup: () => Promise<void>
}

// =============================================================================
// 유틸리티 타입
// =============================================================================

/**
 * 프로젝트 아이콘 옵션
 * 
 * @description
 * 프로젝트 생성/수정 시 선택 가능한 아이콘 목록
 */
export const PROJECT_ICONS = [
  '📁', '📚', '📝', '💼', '🎓', '🔬', '💡', '🎯',
  '📊', '📈', '🗂️', '📋', '🖊️', '✍️', '📖', '🎨'
] as const

export type ProjectIcon = typeof PROJECT_ICONS[number]

/**
 * 프로젝트 정렬 옵션
 */
export type ProjectSortBy = 'name' | 'created_at' | 'updated_at'

/**
 * 프로젝트 필터 옵션
 */
export interface ProjectFilter {
  /** 상태 필터 */
  status?: ProjectStatus
  
  /** 검색어 (이름에서 검색) */
  search?: string
  
  /** 정렬 기준 */
  sortBy?: ProjectSortBy
  
  /** 정렬 방향 */
  sortOrder?: 'asc' | 'desc'
}
