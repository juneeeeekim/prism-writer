// =============================================================================
// PRISM Writer - Root Layout
// =============================================================================
// 파일: frontend/src/app/layout.tsx
// 역할: 전체 앱의 루트 레이아웃 (HTML 구조, 메타데이터)
// =============================================================================

import type { Metadata } from 'next'
import './globals.css'

// -----------------------------------------------------------------------------
// Metadata (SEO)
// -----------------------------------------------------------------------------
export const metadata: Metadata = {
  title: 'PRISM Writer - RAG 기반 글쓰기 도구',
  description: '내 문서를 분석하여 글의 구조와 내용을 잡아주는 지능형 저작 도구',
  keywords: ['RAG', '글쓰기', 'AI', '마크다운', '에디터'],
}

// -----------------------------------------------------------------------------
// Root Layout Component
// -----------------------------------------------------------------------------
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full antialiased">
        {/* 메인 컨텐츠 영역 */}
        <main className="h-full">
          {children}
        </main>
      </body>
    </html>
  )
}
