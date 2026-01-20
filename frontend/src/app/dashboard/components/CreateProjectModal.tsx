// =============================================================================
// PRISM Writer - CreateProjectModal Component
// =============================================================================
// 파일: frontend/src/app/dashboard/components/CreateProjectModal.tsx
// 역할: 프로젝트 생성 모달 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import { useState } from 'react'
import type { CreateProjectInput } from '@/types/project'
import { PROJECT_ICONS } from '@/types/project'

// =============================================================================
// Types
// =============================================================================

interface CreateProjectModalProps {
  onClose: () => void
  onCreate: (input: CreateProjectInput) => Promise<void>
  isCreating: boolean
}

// =============================================================================
// Component
// =============================================================================

export function CreateProjectModal({ onClose, onCreate, isCreating }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📁')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

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
