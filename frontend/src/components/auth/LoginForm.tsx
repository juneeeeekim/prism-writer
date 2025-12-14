// =============================================================================
// PRISM Writer - Login Form Component
// =============================================================================
// 파일: frontend/src/components/auth/LoginForm.tsx
// 역할: 재사용 가능한 로그인 폼 컴포넌트
// 사용처: 로그인 페이지, 모달 등
// =============================================================================

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =============================================================================
// Props Interface
// =============================================================================
interface LoginFormProps {
  /** 로그인 성공 시 호출되는 콜백 */
  onSuccess?: () => void
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * 로그인 폼 컴포넌트
 * 
 * @example
 * ```tsx
 * <LoginForm onSuccess={() => router.push('/editor')} />
 * ```
 */
export default function LoginForm({ onSuccess, className = '' }: LoginFormProps) {
  // =============================================================================
  // State Management
  // =============================================================================
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // =============================================================================
  // 로그인 처리 함수
  // =============================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // 에러 메시지 한글화
        if (signInError.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 필요합니다. 이메일을 확인해주세요.')
        } else {
          setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
        }
        return
      }

      if (data.session) {
        // 로그인 성공 콜백 호출
        onSuccess?.()
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // UI Rendering
  // =============================================================================
  return (
    <form onSubmit={handleLogin} className={`space-y-5 ${className}`}>
      {/* 에러 메시지 */}
      {error && (
        <div
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 이메일 입력 */}
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          이메일
        </label>
        <input
          id="login-email"
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

      {/* 비밀번호 입력 */}
      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          비밀번호
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="비밀번호"
          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors"
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      {/* 로그인 버튼 */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
        aria-label="로그인"
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
            로그인 중...
          </span>
        ) : (
          '로그인'
        )}
      </button>
    </form>
  )
}
