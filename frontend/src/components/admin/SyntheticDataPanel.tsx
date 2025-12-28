// =============================================================================
// PRISM Writer - Synthetic Data Panel Component
// =============================================================================
// 파일: frontend/src/components/admin/SyntheticDataPanel.tsx
// 역할: RAFT 파인튜닝용 합성 Q&A 데이터 생성 UI
// 생성일: 2025-12-28
//
// [Phase 2] P2-01 ~ P2-05: UI 컴포넌트 개발
// - P2-01: 컴포넌트 골격 및 상태 변수
// - P2-02: 2단계 확인 모달 (window.confirm)
// - P2-03: 로딩 및 결과 표시 UI
// - P2-05: 오늘 생성량 조회 (MVP: 로컬 카운트)
//
// [Phase 3] P3-02: API 연동
// - generateSyntheticDataAPI 호출
//
// [JeDebug 반영]
// - Critical-01: context textarea UI 추가
// - Critical-02: useAuth 훅 사용
// - High-01: context 최소 100자 검증
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { generateSyntheticDataAPI } from '@/lib/api/raft'
import { RAFT_CATEGORIES, DEFAULT_RAFT_CATEGORY } from '@/constants/raft'

// =============================================================================
// 타입 정의
// =============================================================================

interface GenerationResult {
  success: boolean
  generated: number
  errors: string[]
}

interface SyntheticDataPanelProps {
  /** 개발 모드 여부 (인증 우회) */
  isDevMode?: boolean
  /** 초기 카테고리 (URL 파라미터 등) */
  initialCategory?: string
}

// =============================================================================
// 상수 정의
// =============================================================================

const MIN_CONTEXT_LENGTH = 100
const MAX_COUNT = 50
const MIN_COUNT = 1
const DEFAULT_COUNT = 10
const DAILY_LIMIT = 500

// =============================================================================
// 메인 컴포넌트
// =============================================================================

/**
 * 합성 데이터 생성 패널
 * 
 * @description
 * - RAFT 파인튜닝용 Q&A 데이터를 LLM으로 생성
 * - 참고 자료(context) 입력 필수 (100자 이상)
 * - 일일 생성 한도 500개
 */
export default function SyntheticDataPanel({ 
  isDevMode = false, 
  initialCategory 
}: SyntheticDataPanelProps) {
  // ---------------------------------------------------------------------------
  // 상태 변수 (P2-01)
  // ---------------------------------------------------------------------------
  
  /** 선택된 카테고리 [P2-02] */
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || DEFAULT_RAFT_CATEGORY
  )
  
  /** 생성할 Q&A 개수 (1-50) */
  const [count, setCount] = useState<number>(DEFAULT_COUNT)
  
  /** 참고 자료 입력 [JeDebug Critical-01] */
  const [context, setContext] = useState<string>('')
  
  /** 로딩 상태 */
  const [isLoading, setIsLoading] = useState<boolean>(false)
  
  /** 생성 결과 */
  const [result, setResult] = useState<GenerationResult | null>(null)
  
  /** 오늘 생성량 (MVP: 로컬 카운트) [P2-05] */
  const [todayCount, setTodayCount] = useState<number>(0)

  // ---------------------------------------------------------------------------
  // 인증 상태 [JeDebug Critical-02] & Hotfix [P2-01]
  // ---------------------------------------------------------------------------
  
  const { user, loading: authLoading } = useAuth()
  
  // 인증 로딩 중일 때 스피너 표시 (깜빡임 방지) - 렌더링 시점에 처리
  // if (authLoading) return ... (Hooks Rule 위반으로 아래 JSX에서 처리)

  // 로그인 상태 또는 개발 모드 우회
  const isAuthorized = user !== null || isDevMode

  // ---------------------------------------------------------------------------
  // 입력 검증 [JeDebug High-01]
  // ---------------------------------------------------------------------------
  
  /** context 최소 100자 + 로그인 상태 확인 */
  const isContextValid = context.trim().length >= MIN_CONTEXT_LENGTH
  const isValid = isContextValid && isAuthorized && !isLoading
  
  /** 남은 글자 수 (100자 미만일 때만 표시) */
  const remainingChars = MIN_CONTEXT_LENGTH - context.trim().length

  // ---------------------------------------------------------------------------
  // 개수 입력 핸들러 (범위 제한)
  // ---------------------------------------------------------------------------
  
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || DEFAULT_COUNT
    // 범위 제한: 1-50
    const clampedValue = Math.max(MIN_COUNT, Math.min(MAX_COUNT, value))
    setCount(clampedValue)
  }

  // ---------------------------------------------------------------------------
  // 생성 버튼 클릭 핸들러 [P2-02: 2단계 확인]
  // ---------------------------------------------------------------------------
  
  const handleClick = () => {
    // 2단계 확인 모달 (MVP: window.confirm)
    const contextPreview = context.substring(0, 50) + (context.length > 50 ? '...' : '')
    const confirmed = window.confirm(
      `정말 ${count}개의 합성 데이터를 생성하시겠습니까?\n\n` +
      `참고 자료 미리보기:\n"${contextPreview}"`
    )
    
    if (confirmed) {
      handleGenerate()
    }
  }

  // ---------------------------------------------------------------------------
  // 생성 실행 함수 [P3-02: API 연동]
  // ---------------------------------------------------------------------------
  
  const handleGenerate = async () => {
    setIsLoading(true)
    setResult(null)
    
    try {
      // [P3-02] 실제 API 호출
      // [P3-04] 카테고리 정보 전달
      const response = await generateSyntheticDataAPI(context, count, selectedCategory)
      
      // 성공 시 상태 업데이트
      setResult({
        success: response.success,
        generated: response.generated,
        errors: response.errors || []
      })
      
      // 오늘 생성량 업데이트
      setTodayCount(prev => prev + response.generated)
      
    } catch (err: any) {
      // 에러 처리
      setResult({
        success: false,
        generated: 0,
        errors: [err.message || '알 수 없는 오류가 발생했습니다.']
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 결과 메시지 자동 숨김 (5초 후) [P2-03]
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [result])

  // ---------------------------------------------------------------------------
  // 오늘 생성량 조회 [P2-05] - MVP: 로컬 카운트 사용
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    // MVP: 0으로 초기화 (추후 API 연동 필요)
    // 실제 구현 시 GET /api/raft/stats 호출
    setTodayCount(0)
  }, [])

  // ---------------------------------------------------------------------------
  // JSX 렌더링
  // ---------------------------------------------------------------------------
  
  if (authLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-10 shadow-sm flex justify-center items-center h-[600px]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">사용자 권한 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
      {/* ===================================================================== */}
      {/* 헤더 */}
      {/* ===================================================================== */}
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
        ⚙️ 합성 데이터 생성 (RAFT Training Data)
      </h2>
      
      {/* ===================================================================== */}
      {/* 로그인 필요 안내 */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* 로그인 필요 안내 */}
      {/* ===================================================================== */}
      {!isAuthorized && (
        <div 
          className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          role="alert"
        >
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            ⚠️ 로그인이 필요합니다. 합성 데이터를 생성하려면 먼저 로그인해주세요.
          </p>
        </div>
      )}
      
      {/* ===================================================================== */}
      {/* 카테고리 선택 [P2-02] */}
      {/* ===================================================================== */}
      <div className="mb-4">
        <label 
          htmlFor="category-select" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          카테고리 (Knowledge Domain)
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="
            w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            dark:bg-gray-700 dark:text-gray-100
          "
          disabled={isLoading}
        >
          {RAFT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      
      {/* ===================================================================== */}
      {/* 참고 자료 입력 [JeDebug Critical-01] */}
      {/* ===================================================================== */}
      <div className="mb-4">
        <label 
          htmlFor="context-input" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          참고 자료 (Context) *
        </label>
        <textarea
          id="context-input"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Q&A 생성에 사용할 참고 자료를 입력하세요 (최소 100자)"
          aria-label="참고 자료 입력"
          rows={6}
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            dark:bg-gray-700 dark:text-gray-100
            ${!isContextValid && context.length > 0 
              ? 'border-red-300 dark:border-red-600' 
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
          disabled={isLoading}
        />
        {/* 글자 수 안내 */}
        <div className="mt-1 flex justify-between text-sm">
          <span className={`${
            remainingChars > 0 
              ? 'text-red-500 dark:text-red-400' 
              : 'text-green-600 dark:text-green-400'
          }`}>
            {remainingChars > 0 
              ? `${remainingChars}자 더 입력해주세요` 
              : `✓ ${context.trim().length}자 입력됨`
            }
          </span>
          <span className="text-gray-400">
            최소 {MIN_CONTEXT_LENGTH}자
          </span>
        </div>
      </div>
      
      {/* ===================================================================== */}
      {/* 생성 개수 입력 */}
      {/* ===================================================================== */}
      <div className="mb-4">
        <label 
          htmlFor="count-input" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          생성 개수
        </label>
        <div className="flex items-center gap-2">
          <input
            id="count-input"
            type="number"
            value={count}
            onChange={handleCountChange}
            min={MIN_COUNT}
            max={MAX_COUNT}
            aria-label="생성할 Q&A 개수"
            className="
              w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-gray-700 dark:text-gray-100
            "
            disabled={isLoading}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            개 (최대 {MAX_COUNT}개)
          </span>
        </div>
      </div>
      
      {/* ===================================================================== */}
      {/* 생성 버튼 [P2-02] */}
      {/* ===================================================================== */}
      <button
        onClick={handleClick}
        disabled={!isValid}
        aria-label="합성 데이터 생성 시작"
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-white
          transition-all duration-200
          ${isValid
            ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            : 'bg-gray-400 cursor-not-allowed'
          }
          ${isLoading ? 'animate-pulse' : ''}
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4"
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            생성 중... (예상 소요: 약 {count * 3}초)
          </span>
        ) : (
          '🏭 합성 데이터 생성 시작'
        )}
      </button>
      
      {/* ===================================================================== */}
      {/* 오늘 생성량 표시 [P2-05] */}
      {/* ===================================================================== */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            📊 오늘 생성량
          </span>
          <span className={`font-medium ${
            todayCount >= DAILY_LIMIT 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-800 dark:text-gray-200'
          }`}>
            {todayCount} / {DAILY_LIMIT}
          </span>
        </div>
        {/* 프로그레스 바 */}
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              todayCount >= DAILY_LIMIT 
                ? 'bg-red-500' 
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, (todayCount / DAILY_LIMIT) * 100)}%` }}
          />
        </div>
      </div>
      
      {/* ===================================================================== */}
      {/* 결과 메시지 표시 [P2-03] */}
      {/* ===================================================================== */}
      {result && (
        <div 
          role="alert"
          className={`
            mt-4 p-4 rounded-lg
            ${result.success 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }
          `}
        >
          {result.success ? (
            <p className="text-green-800 dark:text-green-200">
              ✅ {result.generated}개 Q&A 생성 완료!
            </p>
          ) : (
            <div>
              <p className="text-red-800 dark:text-red-200 font-medium">
                ❌ 생성 실패
              </p>
              {result.errors.map((error, index) => (
                <p key={index} className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
