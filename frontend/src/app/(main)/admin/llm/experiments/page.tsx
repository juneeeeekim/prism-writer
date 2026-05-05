// =============================================================================
// PRISM Writer - Admin A/B Experiments Page (Phase 7 완전 적용)
// =============================================================================
// 파일: frontend/src/app/(main)/admin/llm/experiments/page.tsx
// 역할: /admin/llm/experiments 라우트 — 실험 결과 패널을 페이지로 노출.
// 설계 의도(왜 이 구조인가):
//   - 실험 활성/비활성 토글은 코드(AB_EXPERIMENTS)로만 가능 → UI는 관찰 전용.
//   - 마이그레이션 미적용/실험 없음 안내는 LLMExperimentsPanel 내부에서 처리.
// =============================================================================

'use client'

import Link from 'next/link'
import AuthHeader from '@/components/auth/AuthHeader'
import LLMExperimentsPanel from '@/components/admin/LLMExperimentsPanel'

export default function AdminLLMExperimentsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                LLM A/B 실험
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                최근 30일 데이터 기준의 변종별 성공률·지연을 확인합니다.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              ← 관리자 홈
            </Link>
          </div>

          <nav className="flex gap-2 mb-4" aria-label="LLM 관리">
            <Link
              href="/admin/llm/costs"
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              비용
            </Link>
            <Link
              href="/admin/llm/experiments"
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white"
            >
              A/B 실험
            </Link>
          </nav>

          <LLMExperimentsPanel />
        </div>
      </div>
    </div>
  )
}
