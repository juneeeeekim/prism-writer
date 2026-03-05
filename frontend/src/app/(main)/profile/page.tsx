// =============================================================================
// PRISM Writer - Profile Page (v2.0 회원등급 표시)
// =============================================================================
// 파일: frontend/src/app/profile/page.tsx
// 역할: 사용자 프로필, 등급, 사용량 상세 표시 페이지
// 담당: 주니어 개발자 + 시니어 개발자
// =============================================================================

'use client'

// Dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useLLMUsage } from '@/hooks/useLLMUsage'
import AuthHeader from '@/components/auth/AuthHeader'
import RoleBadge from '@/components/ui/RoleBadge'
import UsageGauge from '@/components/usage/UsageGauge'

// =============================================================================
// 등급별 혜택 설명
// =============================================================================

const ROLE_BENEFITS: Record<string, string[]> = {
  pending: [
    '계정 승인 대기 중',
    '승인 후 서비스 이용 가능',
  ],
  free: [
    '월간 30회 AI 질문',
    '기본 에디터 기능',
  ],
  premium: [
    '월간 300회 AI 질문',
    '고급 에디터 기능',
    '우선 지원',
  ],
  special: [
    '무제한 AI 질문',
    '모든 기능 이용 가능',
    'VIP 지원',
  ],
  admin: [
    '무제한 AI 질문',
    '관리자 대시보드 접근',
    '시스템 관리 권한',
  ],
}

// =============================================================================
// Profile Page Component
// =============================================================================

export default function ProfilePage() {
  const router = useRouter()
  
  // =============================================================================
  // Hooks
  // =============================================================================
  const {
    user,
    profile,
    loading,
    role,
    monthlyQuestionLimit
  } = useAuth()
  
  const { usage, loading: usageLoading, refetch } = useLLMUsage()

  // =============================================================================
  // 비로그인 시 리다이렉트
  // =============================================================================
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/profile')
    }
  }, [loading, user, router])

  // =============================================================================
  // 로딩 상태
  // =============================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthHeader showLogo showProjectSelector />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 비로그인 상태 (리다이렉트 전)
  if (!user) {
    return null
  }

  // =============================================================================
  // 가입일 포맷
  // =============================================================================
  const formatDate = (dateString?: string) => {
    if (!dateString) return '알 수 없음'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // =============================================================================
  // 리셋 시간 계산
  // =============================================================================
  const getMonthlyResetTime = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysLeft = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `${daysLeft}일 후 리셋 (다음 달 1일)`
  }

  // =============================================================================
  // Render
  // =============================================================================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AuthHeader showLogo showProjectSelector />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* =================================================================
              페이지 헤더
              ================================================================= */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              내 프로필
            </h1>
            <Link
              href="/editor"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← 에디터로 돌아가기
            </Link>
          </div>

          {/* =================================================================
              프로필 정보 카드
              ================================================================= */}
          <section 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            aria-labelledby="profile-info-heading"
          >
            <h2 id="profile-info-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              계정 정보
            </h2>
            
            <div className="space-y-4">
              {/* 이메일 */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">이메일</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.email}
                </span>
              </div>

              {/* 가입일 */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">가입일</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(user.created_at)}
                </span>
              </div>

              {/* 등급 */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">현재 등급</span>
                <RoleBadge role={role} size="md" />
              </div>

              {/* 승인 상태 */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">승인 상태</span>
                <span className={`text-sm font-medium ${
                  profile?.isApproved 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {profile?.isApproved ? '✓ 승인됨' : '⏳ 대기 중'}
                </span>
              </div>
            </div>
          </section>

          {/* =================================================================
              등급 혜택 카드
              ================================================================= */}
          <section 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            aria-labelledby="benefits-heading"
          >
            <h2 id="benefits-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              현재 등급 혜택
            </h2>
            
            <ul className="space-y-2">
              {(role && ROLE_BENEFITS[role] ? ROLE_BENEFITS[role] : []).map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </section>

          {/* =================================================================
              사용량 카드
              ================================================================= */}
          <section 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            aria-labelledby="usage-heading"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="usage-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
                사용량
              </h2>
              <button
                onClick={() => refetch()}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                aria-label="사용량 새로고침"
              >
                새로고침
              </button>
            </div>
            
            {usageLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* 월간 질문 사용량 */}
                <div>
                  <UsageGauge
                    current={usage?.monthlyQuestions.questionCount ?? 0}
                    limit={monthlyQuestionLimit}
                    label="이번 달 질문"
                    unit="회"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {getMonthlyResetTime()}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* =================================================================
              업그레이드 안내 (free 등급만)
              ================================================================= */}
          {role === 'free' && (
            <section 
              className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white"
              aria-labelledby="upgrade-heading"
            >
              <h2 id="upgrade-heading" className="text-lg font-semibold mb-3">
                🚀 프리미엄으로 업그레이드하세요!
              </h2>
              
              <ul className="space-y-2 mb-4">
                <li className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-300">✦</span>
                  월간 300회 AI 질문 (현재의 10배!)
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-300">✦</span>
                  고급 에디터 기능
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-300">✦</span>
                  우선 고객 지원
                </li>
              </ul>

              <button
                className="w-full py-2 px-4 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => {
                  alert('프리미엄 업그레이드를 원하시면 juneeee.kim@gmail.com으로 연락해 주세요.')
                }}
              >
                업그레이드 문의하기
              </button>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}
