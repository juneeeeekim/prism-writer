// =============================================================================
// PRISM Writer - Documents Test Page
// =============================================================================
// 파일: frontend/src/app/documents-test/page.tsx
// 역할: Phase 2 컴포넌트 테스트 페이지
// =============================================================================

'use client'

import { useState } from 'react'
import DocumentUploader from '@/components/documents/DocumentUploader'
import DocumentList from '@/components/documents/DocumentList'

export default function DocumentsTestPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleUploadSuccess = (documentId: string) => {
    console.log('Document uploaded:', documentId)
    // Refresh document list
    setRefreshKey((prev) => prev + 1)
  }

  const handleDocumentDeleted = () => {
    console.log('Document deleted')
    // Optional: could refresh again if needed
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            문서 관리 테스트
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Phase 2: 문서 업로드 파이프라인 테스트 페이지
          </p>
        </div>

        {/* Upload Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📤 파일 업로드
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <DocumentUploader onUploadSuccess={handleUploadSuccess} />
          </div>
        </section>

        {/* Document List Section */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📄 업로드된 문서
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <DocumentList
              key={refreshKey}
              onDocumentDeleted={handleDocumentDeleted}
            />
          </div>
        </section>

        {/* Testing Instructions */}
        <section className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
            ℹ️ 테스트 방법
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-400 text-sm">
            <li>로그인 후 이 페이지에 접근하세요</li>
            <li>드래그 앤 드롭 또는 클릭하여 파일을 업로드하세요</li>
            <li>허용 파일: PDF, DOCX, TXT, MD (최대 10MB)</li>
            <li>업로드 진행 상태와 토스트 알림을 확인하세요</li>
            <li>업로드된 문서 목록에서 상태 배지를 확인하세요</li>
            <li>삭제 버튼을 클릭하여 문서를 삭제하세요</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
