// =============================================================================
// [P5-06-A] 프로젝트 대시보드 - 프로젝트 목록 및 생성
// =============================================================================
// 파일: frontend/src/app/dashboard/page.tsx
// 역할: 사용자의 프로젝트 목록을 표시하고 새 프로젝트 생성 UI 제공
// 생성일: 2025-12-31
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment (prevent static generation errors)
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProjectProvider, useProject } from '@/contexts/ProjectContext'
import type { Project, CreateProjectInput } from '@/types/project'
import { PROJECT_ICONS } from '@/types/project'

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
  const { projects, isLoading, error, createProject } = useProject()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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
    <div className="dashboard-container">
      {/* -------------------------------------------------------------------
          헤더 영역
          ------------------------------------------------------------------- */}
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <Link href="/" className="dashboard-logo">
            💎 PRISM Writer
          </Link>
          <h1 className="dashboard-title">내 AI 코치 목록</h1>
          <p className="dashboard-subtitle">
            프로젝트별로 문서를 관리하고 AI 코치를 훈련시키세요
          </p>
        </div>
      </header>

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
            />
          ))}

          {/* 새 프로젝트 생성 카드 */}
          <CreateProjectCard onClick={() => setShowCreateModal(true)} />
        </div>

        {/* 프로젝트가 없을 때 안내 메시지 */}
        {projects.length === 0 && !error && (
          <div className="dashboard-empty">
            <div className="dashboard-empty-icon">📚</div>
            <h2>아직 프로젝트가 없습니다</h2>
            <p>첫 번째 AI 코치 프로젝트를 만들어보세요!</p>
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
    </div>
  )
}

// =============================================================================
// ProjectCard 컴포넌트
// =============================================================================

interface ProjectCardProps {
  project: Project
  onClick: () => void
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  // 마지막 수정일 포맷팅
  const formattedDate = new Date(project.updated_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <button
      className="project-card"
      onClick={onClick}
      aria-label={`${project.name} 프로젝트 열기`}
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
      <div className="project-card-arrow">→</div>
    </button>
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
