// =============================================================================
// PRISM Writer - Document Card Component
// =============================================================================
// 파일: frontend/src/components/structure/DocumentCard.tsx
// 역할: AI Structurer에서 사용하는 문서 카드 UI
// Pipeline: AI Structurer (P4-03)
// 생성일: 2026-01-08
//
// [UX/UI 전문가 주석]
// - 드래그 가능한 카드 디자인 (향후 DnD 구현용)
// - 순서 번호, 제목, 태그, 이유 표시
// - 다크 모드 지원
// =============================================================================

'use client'

import { memo } from 'react'

// =============================================================================
// [P4-03] 타입 정의
// =============================================================================

export interface DocumentCardProps {
  /** 문서 ID */
  id: string
  /** 순서 번호 (1-based) */
  order: number
  /** 문서 제목 */
  title: string
  /** 할당된 구조 태그 */
  assignedTag?: string
  /** 태그 할당 이유 */
  reason?: string
  /** 선택 상태 */
  isSelected?: boolean
  /** 드래그 상태 */
  isDragging?: boolean
  /** 클릭 핸들러 */
  onClick?: () => void
  /** 드래그 시작 핸들러 (향후 DnD용) */
  onDragStart?: () => void
  /** 드래그 종료 핸들러 (향후 DnD용) */
  onDragEnd?: () => void
}

// =============================================================================
// [P4-03] 컴포넌트
// =============================================================================

/**
 * Document Card - 문서 구조 분석용 카드 컴포넌트
 *
 * @description
 * [UX/UI 전문가 주석]
 * - 순서 번호는 좌측 원형 배지로 표시
 * - 제목은 1줄로 제한 (truncate)
 * - 태그는 파란색 배지로 표시
 * - 이유는 2줄로 제한 (line-clamp-2)
 */
function DocumentCard({
  id,
  order,
  title,
  assignedTag,
  reason,
  isSelected = false,
  isDragging = false,
  onClick,
}: DocumentCardProps) {
  return (
    <div
      data-document-id={id}
      onClick={onClick}
      className={`
        flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
        ${isDragging
          ? 'opacity-50 scale-105 shadow-lg'
          : 'opacity-100 scale-100'
        }
        ${isSelected
          ? 'border-prism-primary bg-prism-primary/5 ring-2 ring-prism-primary/30'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {/* =====================================================================
          [P4-03-A] 순서 번호 배지
          ===================================================================== */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          font-bold text-sm transition-colors
          ${isSelected
            ? 'bg-prism-primary text-white'
            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }
        `}
      >
        {order}
      </div>

      {/* =====================================================================
          [P4-03-B] 문서 정보
          ===================================================================== */}
      <div className="flex-1 min-w-0">
        {/* 제목 */}
        <p
          className={`
            font-medium truncate
            ${isSelected
              ? 'text-prism-primary'
              : 'text-gray-800 dark:text-gray-200'
            }
          `}
        >
          {title || '제목 없음'}
        </p>

        {/* 태그 */}
        {assignedTag && (
          <p className="mt-1">
            <span
              className={`
                inline-block px-2 py-0.5 text-xs rounded
                ${isSelected
                  ? 'bg-prism-primary/20 text-prism-primary'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }
              `}
            >
              {assignedTag}
            </span>
          </p>
        )}

        {/* 이유 */}
        {reason && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {reason}
          </p>
        )}
      </div>

      {/* =====================================================================
          [P4-03-C] 드래그 핸들 (향후 DnD 구현용)
          ===================================================================== */}
      <div
        className="flex-shrink-0 text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing"
        title="드래그하여 순서 변경"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>
    </div>
  )
}

// =============================================================================
// [P4-03] Memoized Export
// =============================================================================
export default memo(DocumentCard)
