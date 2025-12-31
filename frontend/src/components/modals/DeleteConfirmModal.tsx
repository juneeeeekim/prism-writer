// =============================================================================
// [P7-04-C] 삭제 확인 모달
// =============================================================================
// 파일: frontend/src/components/modals/DeleteConfirmModal.tsx
// 역할: 프로젝트 삭제 전 사용자 확인을 받는 모달
// 생성일: 2026-01-01
// =============================================================================

'use client'

import { useState } from 'react'

// =============================================================================
// Props 인터페이스
// =============================================================================

interface DeleteConfirmModalProps {
  /** 삭제할 프로젝트 이름 */
  projectName: string
  /** 모달 닫기 콜백 */
  onClose: () => void
  /** 삭제 확인 콜백 */
  onConfirm: () => Promise<void>
  /** 삭제 진행 중 여부 */
  isDeleting?: boolean
}

// =============================================================================
// DeleteConfirmModal 컴포넌트
// =============================================================================

/**
 * 프로젝트 삭제 확인 모달
 * 
 * @description
 * 사용자가 프로젝트를 삭제하기 전에 확인을 받는 모달입니다.
 * 30일간 휴지통에 보관 후 영구 삭제됨을 안내합니다.
 */
export default function DeleteConfirmModal({
  projectName,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  // ---------------------------------------------------------------------------
  // 삭제 확인 핸들러
  // ---------------------------------------------------------------------------
  const handleConfirm = async () => {
    try {
      setIsProcessing(true)
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('[DeleteConfirmModal] Delete error:', error)
      alert('삭제 중 오류가 발생했습니다.')
      setIsProcessing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 모달 외부 클릭 핸들러
  // ---------------------------------------------------------------------------
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isProcessing) {
      onClose()
    }
  }

  const processing = isDeleting || isProcessing

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div 
      className="modal-backdrop" 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="modal-content delete-confirm-modal">
        {/* -------------------------------------------------------------------
            모달 헤더
            ------------------------------------------------------------------- */}
        <div className="modal-header delete-modal-header">
          <div className="delete-modal-icon">🗑️</div>
          <h2 id="delete-modal-title">프로젝트 삭제</h2>
        </div>

        {/* -------------------------------------------------------------------
            모달 바디
            ------------------------------------------------------------------- */}
        <div className="modal-body">
          <p className="delete-confirm-text">
            <strong>"{projectName}"</strong> 프로젝트를 삭제하시겠습니까?
          </p>

          {/* 경고 메시지 */}
          <div className="delete-warning-box">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <p className="warning-title">30일 후 영구 삭제됩니다</p>
              <ul className="warning-list">
                <li>삭제된 프로젝트는 <strong>휴지통</strong>으로 이동됩니다.</li>
                <li>30일 이내에 복구할 수 있습니다.</li>
                <li>30일 후 프로젝트와 모든 관련 데이터가 영구 삭제됩니다.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------------
            버튼 영역
            ------------------------------------------------------------------- */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={processing}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleConfirm}
            disabled={processing}
          >
            {processing ? '삭제 중...' : '휴지통으로 이동'}
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          스타일 (Vanilla CSS-in-JS for self-contained component)
          ------------------------------------------------------------------- */}
      <style jsx>{`
        .delete-confirm-modal {
          max-width: 420px;
          animation: modalSlideIn 0.2s ease-out;
        }

        .delete-modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 16px;
        }

        .delete-modal-icon {
          font-size: 28px;
        }

        .delete-confirm-text {
          font-size: 15px;
          color: #374151;
          margin-bottom: 16px;
          line-height: 1.6;
        }

        .delete-warning-box {
          display: flex;
          gap: 12px;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 14px;
        }

        .warning-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .warning-content {
          flex: 1;
        }

        .warning-title {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .warning-list {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          color: #78350f;
          line-height: 1.7;
        }

        .warning-list li {
          margin-bottom: 4px;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-danger:disabled {
          background: #fca5a5;
          cursor: not-allowed;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 다크모드 지원 */
        @media (prefers-color-scheme: dark) {
          .delete-confirm-text {
            color: #d1d5db;
          }

          .delete-warning-box {
            background: rgba(245, 158, 11, 0.15);
            border-color: #d97706;
          }

          .warning-title {
            color: #fbbf24;
          }

          .warning-list {
            color: #fcd34d;
          }
        }
      `}</style>
    </div>
  )
}
