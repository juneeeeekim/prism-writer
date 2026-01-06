// =============================================================================
// [P5-06-A] 프로젝트 대시보드 - 프로젝트 목록 및 생성
// =============================================================================
// 파일: frontend/src/app/dashboard/page.tsx
// 역할: 사용자의 프로젝트 목록을 표시하고 새 프로젝트 생성 UI 제공
// 생성일: 2025-12-31
// 수정일: 2026-01-01 - [P8-SEARCH] 검색/정렬 UI 추가
// 수정일: 2026-01-01 - [P8-BATCH] 배치 삭제 기능 추가
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment (prevent static generation errors)
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProjectProvider, useProject } from '@/contexts/ProjectContext'
import type { Project, CreateProjectInput, ProjectSortBy } from '@/types/project'
import { PROJECT_ICONS } from '@/types/project'
// [P7-04-C] 삭제 확인 모달
import DeleteConfirmModal from '@/components/modals/DeleteConfirmModal'

import AuthHeader from '@/components/auth/AuthHeader'

// =============================================================================
// 페이지 컴포넌트 (ProjectProvider로 래핑)
// =============================================================================

export default function DashboardPage() {
  return (
    <ProjectProvider>
      <DashboardContent />
    </ProjectProvider>
  )
}

// =============================================================================
// 대시보드 컨텐츠 컴포넌트
// =============================================================================

function DashboardContent() {
  const router = useRouter()
  const {
    projects,
    isLoading,
    error,
    createProject,
    deleteProject,
    filter,       // [P8-SEARCH]
    setSearch,    // [P8-SEARCH]
    setSortOption // [P8-SEARCH]
  } = useProject()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  // [P8-SEARCH] 검색 입력 로컬 상태 (디바운싱용)
  const [searchInput, setSearchInput] = useState('')

  // ---------------------------------------------------------------------------
  // [P8-SEARCH] 검색 디바운싱 (300ms)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, setSearch])

  // ---------------------------------------------------------------------------
  // [P8-SEARCH] 정렬 옵션 변경 핸들러
  // ---------------------------------------------------------------------------
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    // 형식: "sortBy-sortOrder" (예: "updated_at-desc")
    const [sortBy, sortOrder] = value.split('-') as [ProjectSortBy, 'asc' | 'desc']
    setSortOption(sortBy, sortOrder)
  }, [setSortOption])

  // ---------------------------------------------------------------------------
  // [P7-04-A] 삭제 모달 상태
  // ---------------------------------------------------------------------------
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ---------------------------------------------------------------------------
  // [P8-BATCH] 배치 삭제 상태
  // ---------------------------------------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  // ---------------------------------------------------------------------------
  // [Phase 6.3-B] 프로젝트 생성 핸들러
  // - 새 프로젝트 생성 후 에디터로 이동 시 `new=true` 파라미터 추가
  // - 이를 통해 에디터에서 온보딩 UX 제공 가능
  // ---------------------------------------------------------------------------
  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      setIsCreating(true)
      const newProject = await createProject(input)
      setShowCreateModal(false)
      // [Phase 6.3-B] 새 프로젝트임을 표시하는 파라미터 추가
      router.push(`/editor?projectId=${newProject.id}&new=true`)
    } catch (err) {
      console.error('[Dashboard] Failed to create project:', err)
      // 에러는 Context에서 처리됨
    } finally {
      setIsCreating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 프로젝트 카드 클릭 핸들러
  // ---------------------------------------------------------------------------
  const handleProjectClick = (project: Project) => {
    router.push(`/editor?projectId=${project.id}`)
  }

  // ---------------------------------------------------------------------------
  // [P7-04-A] 프로젝트 삭제 핸들러
  // ---------------------------------------------------------------------------
  const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation() // 카드 클릭 이벤트 전파 방지
    setProjectToDelete(project)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return

    try {
      setIsDeleting(true)
      await deleteProject(projectToDelete.id)
      setShowDeleteModal(false)
      setProjectToDelete(null)
    } catch (err) {
      console.error('[Dashboard] Failed to delete project:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // [P8-BATCH] 배치 삭제 핸들러
  // ---------------------------------------------------------------------------

  /** 선택 모드 토글 */
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        // 선택 모드 종료 시 선택 초기화
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  /** 프로젝트 선택/해제 */
  const toggleProjectSelection = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  /** 전체 선택/해제 */
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === projects.length) {
      // 전체 해제
      setSelectedIds(new Set())
    } else {
      // 전체 선택
      setSelectedIds(new Set(projects.map((p) => p.id)))
    }
  }, [projects, selectedIds.size])

  /** 배치 삭제 확인 */
  const handleBatchDeleteConfirm = async () => {
    if (selectedIds.size === 0) return

    try {
      setIsBatchDeleting(true)
      // 순차적으로 삭제 (병렬 처리 시 race condition 방지)
      const idsToDelete = Array.from(selectedIds)
      for (const id of idsToDelete) {
        await deleteProject(id)
      }
      setShowBatchDeleteModal(false)
      setSelectedIds(new Set())
      setIsSelectionMode(false)
    } catch (err) {
      console.error('[Dashboard] Failed to batch delete projects:', err)
    } finally {
      setIsBatchDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 로딩 상태 렌더링
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>프로젝트 로딩 중...</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 메인 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 글로벌 헤더 추가 */}
      <AuthHeader showLogo={true} showProjectSelector={true} />
      
      <div className="dashboard-container">
        {/* -------------------------------------------------------------------
            헤더 영역 (로고 제거, 타이틀만 유지)
            ------------------------------------------------------------------- */}
        <header className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">내 AI 코치 목록</h1>
            <p className="dashboard-subtitle">
              프로젝트별로 문서를 관리하고 AI 코치를 훈련시키세요
            </p>
          </div>
        </header>

        {/* -------------------------------------------------------------------
          [P8-SEARCH] 검색 및 정렬 툴바
          ------------------------------------------------------------------- */}
      <div className="dashboard-toolbar">
        <div className="dashboard-toolbar-content">
          {/* 검색 입력 */}
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="프로젝트 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="프로젝트 검색"
            />
            {searchInput && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchInput('')}
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>

          {/* 정렬 드롭다운 */}
          <div className="sort-container">
            <label htmlFor="sort-select" className="sort-label">정렬:</label>
            <select
              id="sort-select"
              className="sort-select"
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onChange={handleSortChange}
              aria-label="정렬 옵션"
            >
              <option value="updated_at-desc">최근 수정순</option>
              <option value="updated_at-asc">오래된 수정순</option>
              <option value="created_at-desc">최근 생성순</option>
              <option value="created_at-asc">오래된 생성순</option>
              <option value="name-asc">이름 (ㄱ-ㅎ)</option>
              <option value="name-desc">이름 (ㅎ-ㄱ)</option>
            </select>
          </div>

          {/* [P8-BATCH] 선택 모드 버튼 */}
          <button
            className={`batch-select-btn ${isSelectionMode ? 'active' : ''}`}
            onClick={toggleSelectionMode}
            aria-label={isSelectionMode ? '선택 모드 종료' : '선택 모드 시작'}
          >
            {isSelectionMode ? '✕ 취소' : '☑️ 선택'}
          </button>
        </div>

        {/* [P8-BATCH] 선택 모드 액션 바 */}
        {isSelectionMode && (
          <div className="batch-action-bar">
            <button
              className="batch-select-all-btn"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === projects.length ? '전체 해제' : '전체 선택'}
            </button>
            <span className="batch-selected-count">
              {selectedIds.size}개 선택됨
            </span>
            <button
              className="batch-delete-btn"
              onClick={() => setShowBatchDeleteModal(true)}
              disabled={selectedIds.size === 0}
            >
              🗑️ 선택 삭제
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------
          에러 메시지
          ------------------------------------------------------------------- */}
      {error && (
        <div className="dashboard-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* -------------------------------------------------------------------
          프로젝트 그리드
          ------------------------------------------------------------------- */}
      <main className="dashboard-main">
        <div className="project-grid">
          {/* 기존 프로젝트 카드들 */}
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
              onDelete={(e) => handleDeleteClick(project, e)}
              // [P8-BATCH] 선택 모드 props
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(project.id)}
              onToggleSelect={(e) => toggleProjectSelection(project.id, e)}
            />
          ))}

          {/* [P8-SEARCH] 검색 중이 아닐 때만 새 프로젝트 생성 카드 표시 */}
          {!filter.search && (
            <CreateProjectCard onClick={() => setShowCreateModal(true)} />
          )}
        </div>

        {/* [P8-SEARCH] 프로젝트가 없을 때 안내 메시지 */}
        {projects.length === 0 && !error && (
          <div className="dashboard-empty">
            {filter.search ? (
              // 검색 결과 없음
              <>
                <div className="dashboard-empty-icon">🔍</div>
                <h2>검색 결과가 없습니다</h2>
                <p>&quot;{filter.search}&quot;에 해당하는 프로젝트를 찾을 수 없습니다.</p>
                <button
                  className="btn-secondary"
                  onClick={() => setSearchInput('')}
                >
                  검색 초기화
                </button>
              </>
            ) : (
              // 프로젝트 없음
              <>
                <div className="dashboard-empty-icon">📚</div>
                <h2>아직 프로젝트가 없습니다</h2>
                <p>첫 번째 AI 코치 프로젝트를 만들어보세요!</p>
              </>
            )}
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------------
          프로젝트 생성 모달
          ------------------------------------------------------------------- */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
          isCreating={isCreating}
        />
      )}

      {/* -------------------------------------------------------------------
          [P7-04-C] 삭제 확인 모달
          ------------------------------------------------------------------- */}
      {showDeleteModal && projectToDelete && (
        <DeleteConfirmModal
          projectName={projectToDelete.name}
          onClose={() => {
            setShowDeleteModal(false)
            setProjectToDelete(null)
          }}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      )}

      {/* -------------------------------------------------------------------
          [P8-BATCH] 배치 삭제 확인 모달
          ------------------------------------------------------------------- */}
      {showBatchDeleteModal && (
        <BatchDeleteConfirmModal
          count={selectedIds.size}
          onClose={() => setShowBatchDeleteModal(false)}
          onConfirm={handleBatchDeleteConfirm}
          isDeleting={isBatchDeleting}
        />
      )}

      {/* -------------------------------------------------------------------
          [P7-04-B] 휴지통 링크
          ------------------------------------------------------------------- */}
      <Link href="/trash" className="trash-link">
        🗑️ 휴지통
      </Link>
    </div>
    </div>
  )
}

// =============================================================================
// ProjectCard 컴포넌트
// =============================================================================

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void  // [P7-04-A] 삭제 핸들러
  // [P8-BATCH] 선택 모드 props
  isSelectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (e: React.MouseEvent) => void
}

function ProjectCard({
  project,
  onClick,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect
}: ProjectCardProps) {
  // 마지막 수정일 포맷팅
  const formattedDate = new Date(project.updated_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  // [P8-BATCH] 선택 모드에서는 카드 클릭 시 선택 토글
  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect({} as React.MouseEvent)
    } else {
      onClick()
    }
  }

  return (
    <div className={`project-card-wrapper ${isSelected ? 'selected' : ''}`}>
      {/* [P8-BATCH] 선택 모드 체크박스 */}
      {isSelectionMode && (
        <button
          className={`project-checkbox ${isSelected ? 'checked' : ''}`}
          onClick={onToggleSelect}
          aria-label={isSelected ? '선택 해제' : '선택'}
        >
          {isSelected ? '✓' : ''}
        </button>
      )}

      <button
        className="project-card"
        onClick={handleCardClick}
        aria-label={`${project.name} 프로젝트 ${isSelectionMode ? '선택' : '열기'}`}
      >
        <div className="project-card-icon">{project.icon}</div>
        <div className="project-card-content">
          <h3 className="project-card-title">{project.name}</h3>
          {project.description && (
            <p className="project-card-description">{project.description}</p>
          )}
          <span className="project-card-date">
            마지막 수정: {formattedDate}
          </span>
        </div>
        {!isSelectionMode && <div className="project-card-arrow">→</div>}
      </button>

      {/* [P7-04-A] 삭제 버튼 - 선택 모드에서는 숨김 */}
      {!isSelectionMode && (
        <button
          className="project-delete-btn"
          onClick={onDelete}
          aria-label={`${project.name} 프로젝트 삭제`}
          title="휴지통으로 이동"
        >
          🗑️
        </button>
      )}
    </div>
  )
}

// =============================================================================
// CreateProjectCard 컴포넌트
// =============================================================================

interface CreateProjectCardProps {
  onClick: () => void
}

function CreateProjectCard({ onClick }: CreateProjectCardProps) {
  return (
    <button
      className="create-project-card"
      onClick={onClick}
      aria-label="새 프로젝트 만들기"
    >
      <div className="create-project-icon">+</div>
      <span className="create-project-text">새 프로젝트 만들기</span>
    </button>
  )
}

// =============================================================================
// CreateProjectModal 컴포넌트
// =============================================================================

interface CreateProjectModalProps {
  onClose: () => void
  onCreate: (input: CreateProjectInput) => Promise<void>
  isCreating: boolean
}

function CreateProjectModal({ onClose, onCreate, isCreating }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')
  const [validationError, setValidationError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 폼 제출 핸들러
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 유효성 검사
    if (!name.trim()) {
      setValidationError('프로젝트 이름을 입력해주세요.')
      return
    }

    if (name.trim().length > 100) {
      setValidationError('프로젝트 이름은 100자 이내로 입력해주세요.')
      return
    }

    setValidationError(null)

    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
    })
  }

  // ---------------------------------------------------------------------------
  // 모달 외부 클릭 핸들러
  // ---------------------------------------------------------------------------
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content create-project-modal">
        <div className="modal-header">
          <h2>새 프로젝트 만들기</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
            disabled={isCreating}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* 프로젝트 아이콘 선택 */}
          <div className="form-group">
            <label className="form-label">아이콘</label>
            <div className="icon-selector">
              {PROJECT_ICONS.map((iconOption) => (
                <button
                  key={iconOption}
                  type="button"
                  className={`icon-option ${icon === iconOption ? 'selected' : ''}`}
                  onClick={() => setIcon(iconOption)}
                  disabled={isCreating}
                >
                  {iconOption}
                </button>
              ))}
            </div>
          </div>

          {/* 프로젝트 이름 */}
          <div className="form-group">
            <label className="form-label" htmlFor="project-name">
              프로젝트 이름 <span className="required">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기업 문서, 학술 논문"
              maxLength={100}
              disabled={isCreating}
              autoFocus
            />
            <div className="form-hint">
              {name.length}/100
            </div>
          </div>

          {/* 프로젝트 설명 */}
          <div className="form-group">
            <label className="form-label" htmlFor="project-description">
              설명 (선택)
            </label>
            <textarea
              id="project-description"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 프로젝트에 대한 간단한 설명..."
              rows={3}
              disabled={isCreating}
            />
          </div>

          {/* 유효성 검사 에러 */}
          {validationError && (
            <div className="form-error">
              <span>⚠️</span> {validationError}
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isCreating}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isCreating || !name.trim()}
            >
              {isCreating ? '생성 중...' : '프로젝트 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// [P8-BATCH] BatchDeleteConfirmModal 컴포넌트
// =============================================================================

interface BatchDeleteConfirmModalProps {
  count: number
  onClose: () => void
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

function BatchDeleteConfirmModal({
  count,
  onClose,
  onConfirm,
  isDeleting
}: BatchDeleteConfirmModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content batch-delete-modal">
        <div className="modal-header">
          <h2>프로젝트 일괄 삭제</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
            disabled={isDeleting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="batch-delete-warning">
            <span className="warning-icon">⚠️</span>
            <p>
              <strong>{count}개</strong>의 프로젝트를 휴지통으로 이동합니다.
            </p>
            <p className="warning-note">
              휴지통에서 30일 내에 복구할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? `삭제 중... (${count}개)` : `${count}개 삭제`}
          </button>
        </div>
      </div>
    </div>
  )
}
