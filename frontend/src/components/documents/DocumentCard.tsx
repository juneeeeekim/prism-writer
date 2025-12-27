// =============================================================================
// Phase 11: Document Card Component
// =============================================================================
// 파일: frontend/src/components/Documents/DocumentCard.tsx
// 역할: 문서 목록 카드 UI
// 생성일: 2025-12-28
// =============================================================================

'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { UserDocumentPreview } from '@/types/document'

// =============================================================================
// Types
// =============================================================================
interface DocumentCardProps extends UserDocumentPreview {
  onDelete: (id: string) => Promise<void>
}

// =============================================================================
// Component
// =============================================================================
export default function DocumentCard({
  id,
  title,
  preview,
  updated_at,
  onDelete
}: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ---------------------------------------------------------------------------
  // 날짜 포맷
  // ---------------------------------------------------------------------------
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return '오늘'
    } else if (diffDays === 1) {
      return '어제'
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 삭제 핸들러
  // ---------------------------------------------------------------------------
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
  }

  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDeleting(true)
    try {
      await onDelete(id)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(false)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Link
      href={`/editor?id=${id}`}
      className="block group"
      aria-label={`${title} 문서 열기`}
    >
      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 
                      hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg 
                      transition-all duration-200 h-full">
        {/* 삭제 버튼 */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 
                     opacity-0 group-hover:opacity-100 transition-opacity
                     rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label="문서 삭제"
        >
          {isDeleting ? (
            <span className="animate-spin text-sm">⏳</span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>

        {/* 삭제 확인 오버레이 */}
        {showConfirm && (
          <div className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 rounded-xl 
                          flex flex-col items-center justify-center gap-3 z-10">
            <p className="text-sm text-gray-700 dark:text-gray-300">정말 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 컨텐츠 */}
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 pr-8 
                       line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {title || '제목 없음'}
        </h3>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4">
          {preview || '내용 없음'}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span>{formatDate(updated_at)}</span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
            열기 →
          </span>
        </div>
      </div>
    </Link>
  )
}
