// =============================================================================
// PRISM Writer - BatchActions Component
// =============================================================================
// 파일: frontend/src/app/dashboard/components/BatchActions.tsx
// 역할: 배치 선택/삭제 액션 UI
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

// =============================================================================
// Types
// =============================================================================

interface BatchActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeleteSelected: () => void
}

interface BatchDeleteConfirmModalProps {
  count: number
  onClose: () => void
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

// =============================================================================
// BatchActionBar Component
// =============================================================================

export function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeleteSelected
}: BatchActionBarProps) {
  return (
    <div className="batch-action-bar">
      <button
        className="batch-select-all-btn"
        onClick={onSelectAll}
      >
        {selectedCount === totalCount ? '전체 해제' : '전체 선택'}
      </button>
      <span className="batch-selected-count">
        {selectedCount}개 선택됨
      </span>
      <button
        className="batch-delete-btn"
        onClick={onDeleteSelected}
        disabled={selectedCount === 0}
      >
        🗑️ 선택 삭제
      </button>
    </div>
  )
}

// =============================================================================
// BatchDeleteConfirmModal Component
// =============================================================================

export function BatchDeleteConfirmModal({
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
