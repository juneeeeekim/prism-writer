// =============================================================================
// PRISM Writer - Update Password Page
// =============================================================================
// 파일: frontend/src/app/update-password/page.tsx
// 역할: 새 비밀번호 설정 페이지
// 기능: 비밀번호 재설정 링크를 통해 접근, 새 비밀번호 설정
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  // =============================================================================
  // State Management
  // =============================================================================
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  // =============================================================================
  // 세션 확인 (재설정 링크로 접근했는지)
  // =============================================================================
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      // 세션이 없으면 비밀번호 재설정 페이지로 리다이렉트
      if (!session) {
        router.push('/reset-password')
      }
    }
    
    checkSession()
  }, [router])

  // =============================================================================
  // 비밀번호 업데이트 처리
  // =============================================================================
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 비밀번호 일치 검증
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      setLoading(false)
      return
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        if (updateError.message.includes('same password')) {
          setError('이전 비밀번호와 동일합니다. 다른 비밀번호를 입력해주세요.')
        } else {
          setError('비밀번호 변경 중 오류가 발생했습니다. 다시 시도해주세요.')
        }
        return
      }

      setSuccess(true)
      
      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/login')
      }, 3000)
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
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
              비밀번호가 변경되었습니다!
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              새 비밀번호로 로그인해주세요.
              <br />
              3초 후 로그인 페이지로 이동합니다...
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
            새 비밀번호 설정
          </p>
        </div>

        {/* 비밀번호 변경 카드 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">
            새 비밀번호 입력
          </h2>

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

          {/* 비밀번호 변경 폼 */}
          <form onSubmit={handleUpdatePassword} className="space-y-5">
            {/* 새 비밀번호 입력 */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                새 비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="새 비밀번호"
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors"
                placeholder="최소 6자 이상"
                disabled={loading}
              />
            </div>

            {/* 새 비밀번호 확인 */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                새 비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                aria-label="새 비밀번호 확인"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                placeholder="비밀번호 재입력"
                disabled={loading}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* 비밀번호 변경 버튼 */}
            <button
              type="submit"
              disabled={loading || (confirmPassword !== '' && password !== confirmPassword)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              aria-label="비밀번호 변경"
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
                  변경 중...
                </span>
              ) : (
                '비밀번호 변경'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
