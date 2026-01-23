// =============================================================================
// PRISM Writer - Main Layout
// =============================================================================
// 파일: frontend/src/app/(main)/layout.tsx
// 역할: 메인 페이지들의 공통 레이아웃 (ProjectProvider 제공)
// 생성일: 2026-01-23
// =============================================================================

import { ProjectProvider } from '@/contexts/ProjectContext'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectProvider>
      {children}
    </ProjectProvider>
  )
}
