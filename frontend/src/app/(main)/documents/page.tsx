// =============================================================================
// Phase 11: Documents List Page
// =============================================================================
// 파일: frontend/src/app/documents/page.tsx
// 역할: 저장된 문서 목록 페이지
// 생성일: 2025-12-28
// 수정일: 2026-01-01 (카테고리 제거, 플랫 리스트로 변경)
// [P7-FIX] projectId 필터링 추가
// =============================================================================

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useDocuments } from '@/hooks/useDocuments'
import { useAuth } from '@/hooks/useAuth'
import { useEditorState } from '@/hooks/useEditorState'
import { AuthHeader } from '@/components/auth'
// [P7-FIX] 프로젝트 Context 추가
import { ProjectProvider, useProject } from '@/contexts/ProjectContext'

// =============================================================================
// Page Component (ProjectProvider 래핑)
// =============================================================================
export default function DocumentsPage() {
  return (
    <ProjectProvider>
      <DocumentsContent />
    </ProjectProvider>
  )
}

// =============================================================================
// Documents Content Component
// =============================================================================
function DocumentsContent() {
  // [P7-FIX] 프로젝트 Context에서 현재 프로젝트 ID 가져오기
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // [P7-FIX] projectId 전달하여 프로젝트별 문서만 조회
  const { documents, loading, error, fetchList, deleteDocument } = useDocuments(projectId)
  const { user, loading: authLoading } = useAuth()
  const { reset: resetEditor } = useEditorState()

  // ---------------------------------------------------------------------------
  // 문서 목록 로드
  // [P7-FIX] projectId가 있을 때만 fetchList 호출
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (user && !authLoading && projectId) {
      fetchList()
    }
  }, [user, authLoading, projectId, fetchList])

  // ---------------------------------------------------------------------------
  // 삭제 핸들러
  // ---------------------------------------------------------------------------
  const handleDelete = async (id: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    await deleteDocument(id)
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
                ? `총 ${documents.length}개의 문서`
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

        {/* Documents List (플랫 리스트) */}
        {!loading && !authLoading && user && documents.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <Link
                  href={`/editor?id=${doc.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {doc.title || '제목 없음'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {doc.preview || '내용 없음'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(doc.updated_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </Link>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="문서 삭제"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
