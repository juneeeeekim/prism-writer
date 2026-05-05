// =============================================================================
// PRISM Writer - Admin LLM Costs Page (Phase 6 완전 적용)
// =============================================================================
// 파일: frontend/src/app/(main)/admin/llm/costs/page.tsx
// 역할: /admin/llm/costs 라우트 — 비용 대시보드 컴포넌트를 페이지로 노출.
// 설계 의도(왜 이 구조인가):
//   - 페이지는 얇게 유지하고 데이터/UX 책임은 LLMCostDashboard에 위임한다.
//   - admin 권한 검증은 API 단(/api/admin/llm-costs)에서 일관되게 수행.
//   - 기존 admin 페이지(users 등)와 동일한 AuthHeader/네비 패턴을 따른다.
// =============================================================================

'use client'

import Link from 'next/link'
import AuthHeader from '@/components/auth/AuthHeader'
import LLMCostDashboard from '@/components/admin/LLMCostDashboard'

export default function AdminLLMCostsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                LLM 비용 대시보드
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                모델별 사용량·비용·실패율과 fallback 사용을 확인합니다.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              ← 관리자 홈
            </Link>
          </div>

          {/* LLM Admin 서브 네비 */}
          <nav className="flex gap-2 mb-4" aria-label="LLM 관리">
            <Link
              href="/admin/llm/costs"
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white"
            >
              비용
            </Link>
            <Link
              href="/admin/llm/experiments"
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              A/B 실험
            </Link>
          </nav>

          <LLMCostDashboard />
        </div>
      </div>
    </div>
  )
}
