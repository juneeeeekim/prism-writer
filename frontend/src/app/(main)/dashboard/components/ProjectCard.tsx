// =============================================================================
// PRISM Writer - ProjectCard Component
// =============================================================================
// 파일: frontend/src/app/dashboard/components/ProjectCard.tsx
// 역할: 개별 프로젝트 카드 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import type { Project } from '@/types/project'

// =============================================================================
// Types
// =============================================================================

export interface ProjectCardProps {
  project: Project
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isSelectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (e: React.MouseEvent) => void
}

// =============================================================================
// Component
// =============================================================================

export function ProjectCard({
  project,
  onClick,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect
}: ProjectCardProps) {
  const formattedDate = new Date(project.updated_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect({} as React.MouseEvent)
    } else {
      onClick()
    }
  }

  return (
    <div className={`project-card-wrapper ${isSelected ? 'selected' : ''}`}>
      {/* 선택 모드 체크박스 */}
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

      {/* 삭제 버튼 */}
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
// CreateProjectCard Component
// =============================================================================

interface CreateProjectCardProps {
  onClick: () => void
}

export function CreateProjectCard({ onClick }: CreateProjectCardProps) {
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
