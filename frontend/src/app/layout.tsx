// =============================================================================
// PRISM Writer - Root Layout
// =============================================================================
// 파일: frontend/src/app/layout.tsx
// 역할: 전체 앱의 루트 레이아웃 (HTML 구조, 메타데이터)
// =============================================================================

import type { Metadata } from 'next'
import './globals.css'
import ToastContainer from '@/components/ui/ToastContainer'
// =============================================================================
// [P-A03-02] Vercel Analytics 컴포넌트 import
// 페이지뷰, 사용자 행동 분석을 위한 Vercel Analytics
// - 개발 환경에서는 자동 비활성화됨 (Vercel 환경 아니면 noop)
// =============================================================================
import { Analytics } from '@vercel/analytics/react'

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
        
        {/* Toast 알림 컨테이너 (Phase 2) */}
        <ToastContainer />

        {/* =====================================================================
            [P-A03-02] Vercel Analytics
            - Vercel 배포 환경에서 자동으로 페이지뷰 및 사용자 행동 추적
            - 개발 환경(localhost)에서는 noop (데이터 수집 안함)
            - Vercel 대시보드에서 실시간 분석 확인 가능
            ===================================================================== */}
        <Analytics />
      </body>
    </html>
  )
}
