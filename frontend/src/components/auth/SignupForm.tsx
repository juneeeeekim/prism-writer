// =============================================================================
// PRISM Writer - Signup Form Component
// =============================================================================
// 파일: frontend/src/components/auth/SignupForm.tsx
// 역할: 재사용 가능한 회원가입 폼 컴포넌트
// 사용처: 회원가입 페이지, 모달 등
// =============================================================================

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =============================================================================
// Props Interface
// =============================================================================
interface SignupFormProps {
  /** 회원가입 성공 시 호출되는 콜백 (이메일 인증 필요 메시지 표시용) */
  onSuccess?: (email: string) => void
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * 회원가입 폼 컴포넌트
 * 
 * @example
 * ```tsx
 * <SignupForm onSuccess={(email) => showConfirmationMessage(email)} />
 * ```
 */
export default function SignupForm({ onSuccess, className = '' }: SignupFormProps) {
  // =============================================================================
  // State Management
  // =============================================================================
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // =============================================================================
  // 비밀번호 강도 계산
  // =============================================================================
  const getPasswordStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (!pwd) return { level: 0, text: '', color: '' }
    
    let strength = 0
    if (pwd.length >= 8) strength++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
    if (/\d/.test(pwd)) strength++
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++

    if (strength <= 1) return { level: 1, text: '약함', color: 'bg-red-500' }
    if (strength === 2) return { level: 2, text: '보통', color: 'bg-yellow-500' }
    if (strength === 3) return { level: 3, text: '강함', color: 'bg-green-500' }
    return { level: 4, text: '매우 강함', color: 'bg-green-600' }
  }

  const passwordStrength = getPasswordStrength(password)

  // =============================================================================
  // 회원가입 처리 함수
  // =============================================================================
  const handleSignup = async (e: React.FormEvent) => {
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        // 에러 메시지 한글화
        if (signUpError.message.includes('already registered')) {
          setError('이미 등록된 이메일입니다.')
        } else if (signUpError.message.includes('Invalid email')) {
          setError('올바른 이메일 형식이 아닙니다.')
        } else if (signUpError.message.includes('Password should be at least')) {
          setError('비밀번호는 최소 6자 이상이어야 합니다.')
        } else {
          setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.')
        }
        return
      }

      if (data.user) {
        // 회원가입 성공 콜백 호출
        onSuccess?.(email)
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
    <form onSubmit={handleSignup} className={`space-y-5 ${className}`}>
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
          htmlFor="signup-email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          이메일
        </label>
        <input
          id="signup-email"
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
          htmlFor="signup-password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          비밀번호
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-label="비밀번호"
          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-colors"
          placeholder="최소 6자 이상"
          disabled={loading}
        />
        {/* 비밀번호 강도 표시 */}
        {password && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${passwordStrength.color} transition-all`}
                  style={{ width: `${passwordStrength.level * 25}%` }}
                />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {passwordStrength.text}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 비밀번호 확인 */}
      <div>
        <label
          htmlFor="signup-confirm-password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
        >
          비밀번호 확인
        </label>
        <input
          id="signup-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          aria-label="비밀번호 확인"
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

      {/* 회원가입 버튼 */}
      <button
        type="submit"
        disabled={loading || (confirmPassword !== '' && password !== confirmPassword)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
        aria-label="회원가입"
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
            가입 중...
          </span>
        ) : (
          '회원가입'
        )}
      </button>
    </form>
  )
}
