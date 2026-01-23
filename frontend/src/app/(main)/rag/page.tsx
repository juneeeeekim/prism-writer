// =============================================================================
// PRISM Writer - RAG Search Page Redirect (P2-03)
// =============================================================================
// 파일: frontend/src/app/rag/page.tsx
// 역할: /rag 페이지를 /documents로 리다이렉트 + 이전 안내 메시지
// 변경사항: Phase 2 - 스마트 검색 기능이 에디터 내 탭으로 이전됨
// =============================================================================

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthHeader from '@/components/auth/AuthHeader'

// =============================================================================
// [P2-03] RAG 페이지 리다이렉트 컴포넌트
// =============================================================================

export default function RAGSearchPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  // ---------------------------------------------------------------------------
  // [P2-03] 자동 리다이렉트 (5초 후)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/documents')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  // ---------------------------------------------------------------------------
  // [P2-03] 렌더링 - 이전 안내 메시지
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          {/* =================================================================
              아이콘 및 제목
              ================================================================= */}
          <div className="text-6xl mb-6">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            스마트 검색 기능이 이전되었습니다
          </h1>
          
          {/* =================================================================
              안내 메시지
              ================================================================= */}
          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            스마트 검색 기능이 <strong>에디터 내 탭</strong>으로 통합되었습니다.<br />
            문서를 열고 AssistantPanel의 <strong>"🔍 스마트 검색"</strong> 탭을 사용해주세요.
          </p>

          {/* =================================================================
              자동 리다이렉트 카운트다운
              ================================================================= */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              {countdown > 0 ? (
                <>⏳ {countdown}초 후 자동으로 문서 목록으로 이동합니다...</>
              ) : (
                <>✅ 이동 중...</>
              )}
            </p>
          </div>

          {/* =================================================================
              수동 이동 버튼
              ================================================================= */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/documents"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              📄 문서 목록으로 이동
            </Link>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              ← 이전 페이지
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
