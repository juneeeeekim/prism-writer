// =============================================================================
// PRISM Writer - Reset Password Page
// =============================================================================
// 파일: frontend/src/app/reset-password/page.tsx
// 역할: 비밀번호 재설정 요청 페이지
// 기능: 이메일 입력 → 재설정 링크 발송
// =============================================================================

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  // =============================================================================
  // State Management
  // =============================================================================
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  // =============================================================================
  // 비밀번호 재설정 요청 처리
  // =============================================================================
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (resetError) {
        if (resetError.message.includes('Invalid email')) {
          setError('올바른 이메일 형식이 아닙니다.')
        } else {
          setError('오류가 발생했습니다. 다시 시도해주세요.')
        }
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // 성공 화면
  // =============================================================================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">📧</div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              이메일을 확인해주세요!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              <strong>{email}</strong>로 비밀번호 재설정 링크를 발송했습니다.
              <br />
              이메일의 링크를 클릭하여 비밀번호를 재설정해주세요.
            </p>
            <Link
              href="/login"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              로그인 페이지로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // =============================================================================
  // UI Rendering
  // =============================================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-12">
      <div className="w-full max-w-md">
        {/* 로고 및 제목 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            💎 PRISM Writer
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            비밀번호 재설정
          </p>
        </div>

        {/* 재설정 카드 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
            비밀번호를 잊으셨나요?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
          </p>

          {/* 에러 메시지 */}
          {error && (
            <div
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* 재설정 폼 */}
          <form onSubmit={handleResetPassword} className="space-y-5">
            {/* 이메일 입력 */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="이메일 주소"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors"
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            {/* 재설정 링크 발송 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              aria-label="재설정 링크 발송"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  발송 중...
                </span>
              ) : (
                '재설정 링크 발송'
              )}
            </button>
          </form>

          {/* 로그인 링크 */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold transition-colors"
            >
              ← 로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
