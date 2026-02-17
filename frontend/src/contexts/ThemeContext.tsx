// =============================================================================
// [P1-01] Theme Context - 전역 테마 상태 관리
// =============================================================================
// 파일: frontend/src/contexts/ThemeContext.tsx
// 역할: 다크/라이트 모드 전역 상태 및 토글 기능 제공
// 생성일: 2026-01-24
// =============================================================================
// 주요 기능:
// - 시스템 테마 자동 감지 (prefers-color-scheme)
// - localStorage 기반 사용자 선호도 저장
// - 수동 테마 토글 기능
// - Hydration Mismatch 방지 (SSR 대응)
// =============================================================================

'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'

// =============================================================================
// 타입 정의
// =============================================================================

/** 테마 타입: 라이트 또는 다크 */
export type Theme = 'light' | 'dark'

/** ThemeContext 값 타입 */
export interface ThemeContextValue {
  /** 현재 테마 (null = 아직 클라이언트 마운트 전) */
  theme: Theme | null
  /** 테마 토글 함수 */
  toggleTheme: () => void
  /** 특정 테마로 설정 */
  setTheme: (theme: Theme) => void
  /** 테마가 로드되었는지 여부 */
  isThemeLoaded: boolean
}

// =============================================================================
// Context 생성
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// =============================================================================
// Provider 컴포넌트
// =============================================================================

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * 테마 전역 상태 Provider
 *
 * @description
 * 앱 전체에서 다크/라이트 테마 상태와 토글 기능을 제공합니다.
 * localStorage를 통해 사용자 선호도를 기억합니다.
 * 시스템 테마 변경 시 자동으로 반영됩니다.
 *
 * @example
 * // layout.tsx에서 사용
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 *
 * // 컴포넌트에서 사용
 * const { theme, toggleTheme } = useTheme()
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  // =========================================================================
  // State
  // - 초기값 null: SSR에서는 테마 결정 불가 (Hydration Mismatch 방지)
  // =========================================================================
  const [theme, setThemeState] = useState<Theme | null>(null)

  // =========================================================================
  // 테마 초기화 Effect
  // - 클라이언트 마운트 시 실행
  // - localStorage 또는 시스템 테마 기반으로 초기값 설정
  // =========================================================================
  useEffect(() => {
    // 1. SSR 환경 체크
    if (typeof window === 'undefined') return

    // 2. localStorage에서 저장된 테마 확인
    const storedTheme = localStorage.getItem('theme') as Theme | null

    // 3. 시스템 테마 확인
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const systemTheme: Theme = systemPrefersDark ? 'dark' : 'light'

    // 4. 최종 테마 결정 (localStorage 우선, 없으면 시스템 테마)
    const finalTheme = storedTheme || systemTheme

    // 5. 상태 업데이트
    setThemeState(finalTheme)

    // 6. HTML 클래스 적용 (Tailwind dark mode)
    document.documentElement.classList.toggle('dark', finalTheme === 'dark')

    // 7. data-color-mode 속성 설정 (@uiw/react-md-editor 라이브러리 지원)
    document.documentElement.setAttribute('data-color-mode', finalTheme)
  }, [])

  // =========================================================================
  // 시스템 테마 변경 감지 Effect
  // - 사용자가 OS 테마를 변경하면 자동 반영
  // - localStorage에 저장된 값이 없을 때만 시스템 테마 따라감
  // =========================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // localStorage에 저장된 테마가 없을 때만 시스템 테마 반영
      const storedTheme = localStorage.getItem('theme')
      if (!storedTheme) {
        const newTheme: Theme = e.matches ? 'dark' : 'light'
        setThemeState(newTheme)
        document.documentElement.classList.toggle('dark', newTheme === 'dark')
        document.documentElement.setAttribute('data-color-mode', newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  // =========================================================================
  // 테마 토글 함수
  // - 현재 테마의 반대로 전환
  // - localStorage에 저장
  // =========================================================================
  const toggleTheme = useCallback(() => {
    if (theme === null) return // 아직 초기화 안됨

    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark'

    // 상태 업데이트
    setThemeState(newTheme)

    // localStorage에 저장
    localStorage.setItem('theme', newTheme)

    // HTML 클래스 업데이트
    document.documentElement.classList.toggle('dark', newTheme === 'dark')

    // data-color-mode 속성 업데이트 (@uiw/react-md-editor 지원)
    document.documentElement.setAttribute('data-color-mode', newTheme)
  }, [theme])

  // =========================================================================
  // 특정 테마로 설정하는 함수
  // =========================================================================
  const setTheme = useCallback((newTheme: Theme) => {
    // 상태 업데이트
    setThemeState(newTheme)

    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      document.documentElement.setAttribute('data-color-mode', newTheme)
    }
  }, [])

  // =========================================================================
  // Context Value
  // =========================================================================
  const value: ThemeContextValue = {
    theme,
    toggleTheme,
    setTheme,
    isThemeLoaded: theme !== null,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// =============================================================================
// Custom Hook
// =============================================================================

/**
 * 테마 Context 사용 Hook
 *
 * @throws ThemeProvider 외부에서 사용 시 에러
 *
 * @example
 * const { theme, toggleTheme, isThemeLoaded } = useTheme()
 *
 * if (!isThemeLoaded) return <Skeleton />
 *
 * return (
 *   <button onClick={toggleTheme}>
 *     현재: {theme === 'dark' ? '다크 모드' : '라이트 모드'}
 *   </button>
 * )
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}

// =============================================================================
// Export
// =============================================================================

export { ThemeContext }
