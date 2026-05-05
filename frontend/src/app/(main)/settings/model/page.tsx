// =============================================================================
// PRISM Writer - User Model Preference Settings Page (Phase 5 완전 적용)
// =============================================================================
// 파일: frontend/src/app/(main)/settings/model/page.tsx
// 역할: /settings/model 라우트 — 사용자 선호 LLM 모델 설정 페이지.
// 설계 의도(왜 이 구조인가):
//   - ModelSelector 컴포넌트가 권한 부족(403)을 자체 안내하므로 페이지에서는
//     별도 권한 검증을 두지 않는다(중복 검증 제거).
//   - 기존 admin 페이지 패턴(AuthHeader + max-w-6xl)을 따라 일관된 레이아웃.
// =============================================================================

'use client'

import Link from 'next/link'
import AuthHeader from '@/components/auth/AuthHeader'
import ModelSelector from '@/components/settings/ModelSelector'

export default function UserModelSettingsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      <div className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                AI 모델 설정
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                프리미엄 사용자는 답변/검토에 사용할 AI 모델을 직접 선택할 수
                있습니다.
              </p>
            </div>
            <Link
              href="/"
              className="text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              ← 홈
            </Link>
          </div>

          <ModelSelector />
        </div>
      </div>
    </div>
  )
}
