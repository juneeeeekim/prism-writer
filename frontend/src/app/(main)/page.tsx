// =============================================================================
// PRISM Writer - Home Page
// =============================================================================
// 파일: frontend/src/app/page.tsx
// 역할: 홈 페이지 - 에디터 페이지로 리다이렉트 또는 랜딩 페이지
// =============================================================================

'use client'

import Link from 'next/link'
import AuthHeader from '@/components/auth/AuthHeader'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900">
      <AuthHeader showLogo />

      {/* ---------------------------------------------------------------------
          Hero Section
          --------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col items-center justify-center">
      <div className="text-center space-y-6 p-8">
        {/* Logo */}
        <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">
          💎 PRISM Writer
        </h1>
        
        {/* Tagline - [UI/UX Update] RAG 우선 정체성 반영 */}
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md">
          내 문서를 기반으로 <strong>AI 글쓰기 코치</strong>를 만들고
          <strong> 평가</strong>와 <strong>피드백</strong>을 받아보세요
        </p>
        
        {/* =================================================================
            [P5-08-A] CTA Button - 대시보드로 이동 (멀티 프로젝트 지원)
            ================================================================= */}
        <Link 
          href="/dashboard"
          className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg 
                     hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
          aria-label="내 자료로 AI 코치 만들기"
        >
          📚 내 자료로 AI 코치 만들기
        </Link>
      </div>
      
      {/* ---------------------------------------------------------------------
          Feature Cards
          --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 max-w-4xl">
        <FeatureCard 
          icon="📝"
          title="Dual Pane Editor"
          description="왼쪽은 글쓰기, 오른쪽은 AI 어시스턴트"
        />
        <FeatureCard 
          icon="🗂️"
          title="Outline Generator"
          description="내 문서를 분석해 목차 자동 생성"
        />
        <FeatureCard
          icon="📚"
          title="Reference Linking"
          description="문단별 출처 매핑으로 신뢰성 확보"
        />
      </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Feature Card Component
// -----------------------------------------------------------------------------
function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: string
  title: string
  description: string 
}) {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md 
                    hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {description}
      </p>
    </div>
  )
}

