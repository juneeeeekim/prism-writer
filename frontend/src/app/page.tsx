// =============================================================================
// PRISM Writer - Home Page
// =============================================================================
// 파일: frontend/src/app/page.tsx
// 역할: 홈 페이지 - 에디터 페이지로 리다이렉트 또는 랜딩 페이지
// =============================================================================

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-prism-light to-white dark:from-prism-dark dark:to-gray-900">
      {/* ---------------------------------------------------------------------
          Hero Section
          --------------------------------------------------------------------- */}
      <div className="text-center space-y-6 p-8">
        {/* Logo */}
        <h1 className="text-5xl font-bold bg-gradient-to-r from-prism-primary to-prism-secondary bg-clip-text text-transparent">
          💎 PRISM Writer
        </h1>
        
        {/* Tagline */}
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md">
          내 문서를 분석하여 글의 <strong>구조</strong>와 <strong>내용</strong>을 
          잡아주는 지능형 저작 도구
        </p>
        
        {/* CTA Button */}
        <Link 
          href="/editor"
          className="inline-block px-8 py-3 bg-prism-primary text-white font-semibold rounded-lg 
                     hover:bg-prism-accent transition-colors shadow-lg hover:shadow-xl"
          aria-label="에디터 시작하기"
        >
          🚀 에디터 시작하기
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
