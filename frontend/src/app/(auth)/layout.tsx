// =============================================================================
// PRISM Writer - Auth Layout (without Header)
// =============================================================================
// 파일: frontend/src/app/(auth)/layout.tsx
// 역할: 로그인/회원가입 등 인증 페이지의 레이아웃 (헤더 없음)
// 생성일: 2026-01-23
// =============================================================================

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full">
      {children}
    </div>
  )
}
