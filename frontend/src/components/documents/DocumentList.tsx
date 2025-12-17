// =============================================================================
// PRISM Writer - Document List Component
// =============================================================================
// 파일: frontend/src/components/documents/DocumentList.tsx
// 역할: 업로드된 문서 목록 표시
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'

// =============================================================================
// 타입 정의
// =============================================================================

interface Document {
  id: string
  title: string
  file_path: string
  file_type: string
  file_size: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  created_at: string
  updated_at: string
}

interface DocumentListProps {
  onDocumentDeleted?: () => void
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export default function DocumentList({ onDocumentDeleted, className = '' }: DocumentListProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const toast = useToast()

  // ---------------------------------------------------------------------------
  // 문서 목록 조회
  // ---------------------------------------------------------------------------
  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '문서 목록을 불러오는데 실패했습니다.')
      }

      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Fetch documents error:', error)
      toast.error(error instanceof Error ? error.message : '문서 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  // ---------------------------------------------------------------------------
  // 문서 삭제
  // ---------------------------------------------------------------------------
  const handleDelete = async (documentId: string, title: string) => {
    if (!confirm(`"${title}" 문서를 삭제하시겠습니까?`)) {
      return
    }

    setDeletingId(documentId)

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '문서 삭제에 실패했습니다.')
      }

      toast.success('문서가 성공적으로 삭제되었습니다.')
      
      // 목록에서 제거
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
      
      if (onDocumentDeleted) {
        onDocumentDeleted()
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : '문서 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // 헬퍼 함수
  // ---------------------------------------------------------------------------
  const getStatusBadge = (status: Document['status']) => {
    const badges = {
      pending: {
        label: '대기 중',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      },
      processing: {
        label: '처리 중',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      },
      ready: {
        label: '준비됨',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      },
      error: {
        label: '오류',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      },
    }

    const badge = badges[status]
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.className}`}>
        {badge.label}
      </span>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className={`flex justify-center items-center p-8 ${className}`}>
        <div className="text-gray-500 dark:text-gray-400">문서 목록을 불러오는 중...</div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="text-gray-400 dark:text-gray-500 mb-2">📄</div>
        <div className="text-gray-600 dark:text-gray-400">업로드된 문서가 없습니다.</div>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          {/* 문서 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {doc.title}
              </h3>
              {getStatusBadge(doc.status)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-x-3">
              <span>{formatFileSize(doc.file_size)}</span>
              <span>•</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
          </div>

          {/* 삭제 버튼 */}
          <button
            onClick={() => handleDelete(doc.id, doc.title)}
            disabled={deletingId === doc.id}
            className="ml-4 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`${doc.title} 삭제`}
          >
            {deletingId === doc.id ? '삭제 중...' : '삭제'}
          </button>
        </div>
      ))}
    </div>
  )
}
