// =============================================================================
// Phase 11: Documents List Page (Phase 12: Category Accordion)
// =============================================================================
// 파일: frontend/src/app/documents/page.tsx
// 역할: 저장된 문서 목록 페이지 (카테고리별 그룹핑)
// 생성일: 2025-12-28
// 수정일: 2025-12-28 (Phase 12 - 카테고리 아코디언)
// =============================================================================

'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useDocuments } from '@/hooks/useDocuments'
import { useAuth } from '@/hooks/useAuth'
import { useEditorState } from '@/hooks/useEditorState'
import { AuthHeader } from '@/components/auth'
import CategoryAccordion from '@/components/documents/CategoryAccordion'  // Phase 12
import type { UserDocumentPreview } from '@/types/document'

// =============================================================================
// Page Component
// =============================================================================
export default function DocumentsPage() {
  const { documents, loading, error, fetchList, deleteDocument } = useDocuments()
  const { user, loading: authLoading } = useAuth()
  const { reset: resetEditor } = useEditorState()

  // ---------------------------------------------------------------------------
  // 문서 목록 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (user && !authLoading) {
      fetchList()
    }
  }, [user, authLoading, fetchList])

  // ---------------------------------------------------------------------------
  // Phase 12: 카테고리별 그룹핑
  // ---------------------------------------------------------------------------
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, UserDocumentPreview[]> = {}
    
    documents.forEach((doc) => {
      const cat = doc.category ?? '미분류'  // JeDebug: null 안전 처리
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(doc)
    })
    
    // 카테고리 정렬 (미분류는 항상 마지막)
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === '미분류') return 1
      if (b[0] === '미분류') return -1
      return a[0].localeCompare(b[0])
    })
  }, [documents])

  // ---------------------------------------------------------------------------
  // 삭제 핸들러
  // ---------------------------------------------------------------------------
  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    // 목록 새로고침
    await fetchList()
  }

  // ---------------------------------------------------------------------------
  // 새 문서 생성
  // ---------------------------------------------------------------------------
  const handleNewDocument = () => {
    resetEditor()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <AuthHeader showLogo />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              내 문서
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {documents.length > 0 
                ? `총 ${documents.length}개의 문서 · ${groupedDocuments.length}개의 카테고리`
                : '저장된 문서가 없습니다'}
            </p>
          </div>
          
          {/* 새 문서 버튼 */}
          <Link
            href="/editor"
            onClick={handleNewDocument}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg
                       hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 글 작성
          </Link>
        </div>

        {/* Loading State */}
        {(loading || authLoading) && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">불러오는 중...</p>
            </div>
          </div>
        )}

        {/* Not Logged In */}
        {!authLoading && !user && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              로그인이 필요합니다
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              문서를 저장하고 관리하려면 로그인해주세요.
            </p>
            <Link
              href="/login"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              로그인하기
            </Link>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchList()}
              className="text-sm text-red-700 dark:text-red-300 underline mt-2"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !authLoading && user && documents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              아직 저장된 글이 없습니다
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              첫 번째 글을 작성해보세요!
            </p>
            <Link
              href="/editor"
              onClick={handleNewDocument}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg
                         hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 글 작성하기
            </Link>
          </div>
        )}

        {/* Phase 12: Documents Accordion (카테고리별 그룹) */}
        {!loading && !authLoading && user && documents.length > 0 && (
          <div className="space-y-2">
            {groupedDocuments.map(([category, docs]) => (
              <CategoryAccordion
                key={category}
                category={category}
                documents={docs}
                onDelete={handleDelete}
                defaultOpen={true}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

