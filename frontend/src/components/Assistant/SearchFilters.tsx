// =============================================================================
// PRISM Writer - Search Filters Component (P-B01-01)
// =============================================================================
// 파일: frontend/src/components/Assistant/SearchFilters.tsx
// 역할: 검색 필터 UI 컴포넌트 (파일 타입, 유사도 임계값)
// 작성일: 2026-01-04
// Phase: B - UX 개선
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'

// =============================================================================
// [P-B01-01] 타입 정의
// =============================================================================

/** 검색 필터 상태 */
export interface SearchFiltersState {
  /** 파일 타입 필터 ('pdf' | 'txt' | 'md' | null) */
  fileType: string | null
  /** 최소 유사도 (0.0 ~ 1.0) */
  minScore: number
  /** 날짜 범위 필터 (선택적) */
  dateRange: {
    from: Date | null
    to: Date | null
  }
}

/** SearchFilters 컴포넌트 Props */
export interface SearchFiltersProps {
  /** 현재 필터 상태 */
  filters: SearchFiltersState
  /** 필터 변경 핸들러 */
  onFilterChange: (filters: SearchFiltersState) => void
  /** 필터 패널 접기/펼치기 상태 (선택적) */
  collapsed?: boolean
  /** 접기/펼치기 토글 핸들러 (선택적) */
  onToggleCollapse?: () => void
  /** 비활성화 상태 */
  disabled?: boolean
  /** 추가 CSS 클래스 */
  className?: string
}

// =============================================================================
// [P-B01-01] 상수 정의
// =============================================================================

/** 지원하는 파일 타입 옵션 */
const FILE_TYPE_OPTIONS = [
  { value: '', label: '모든 유형' },
  { value: 'pdf', label: 'PDF' },
  { value: 'txt', label: '텍스트' },
  { value: 'md', label: '마크다운' },
  { value: 'docx', label: 'Word' },
] as const

/** 기본 필터 값 */
export const DEFAULT_FILTERS: SearchFiltersState = {
  fileType: null,
  minScore: 0.5,
  dateRange: {
    from: null,
    to: null,
  },
}

// =============================================================================
// [P-B01-01] SearchFilters 컴포넌트
// =============================================================================

/**
 * 검색 필터 UI 컴포넌트
 *
 * @description
 * SmartSearchTab에서 사용하는 검색 필터 패널입니다.
 * - 파일 타입 필터 (PDF, TXT, MD 등)
 * - 최소 유사도 슬라이더 (0~100%)
 * - 접기/펼치기 기능 지원
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useState(DEFAULT_FILTERS)
 *
 * <SearchFilters
 *   filters={filters}
 *   onFilterChange={setFilters}
 * />
 * ```
 */
export function SearchFilters({
  filters,
  onFilterChange,
  collapsed = false,
  onToggleCollapse,
  disabled = false,
  className,
}: SearchFiltersProps) {
  // ---------------------------------------------------------------------------
  // [P-B01-01] 핸들러
  // ---------------------------------------------------------------------------

  /**
   * 파일 타입 변경 핸들러
   */
  const handleFileTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value || null
      onFilterChange({
        ...filters,
        fileType: value,
      })
    },
    [filters, onFilterChange]
  )

  /**
   * 유사도 슬라이더 변경 핸들러
   */
  const handleScoreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10) / 100
      onFilterChange({
        ...filters,
        minScore: value,
      })
    },
    [filters, onFilterChange]
  )

  /**
   * 필터 초기화 핸들러
   */
  const handleReset = useCallback(() => {
    onFilterChange(DEFAULT_FILTERS)
  }, [onFilterChange])

  // ---------------------------------------------------------------------------
  // [P-B01-01] 렌더링
  // ---------------------------------------------------------------------------

  // 접힌 상태일 때는 헤더만 표시
  if (collapsed && onToggleCollapse) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 text-sm',
          'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span>🎚️</span>
          <span>필터 옵션</span>
          {/* 활성 필터 개수 표시 */}
          {(filters.fileType || filters.minScore !== 0.5) && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full">
              {(filters.fileType ? 1 : 0) + (filters.minScore !== 0.5 ? 1 : 0)}
            </span>
          )}
        </span>
        <span className="text-gray-400">▼</span>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        'rounded-lg p-3 space-y-3',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {/* =====================================================================
          [P-B01-01] 헤더 (접기 버튼 포함)
          ===================================================================== */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <span>🎚️</span>
          <span>필터 옵션</span>
        </span>
        <div className="flex items-center gap-2">
          {/* 초기화 버튼 */}
          {(filters.fileType || filters.minScore !== 0.5) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="필터 초기화"
            >
              초기화
            </button>
          )}
          {/* 접기 버튼 */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="필터 접기"
            >
              ▲
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          [P-B01-01] 필터 컨트롤
          ===================================================================== */}
      <div className="flex flex-wrap gap-3">
        {/* -----------------------------------------------------------------
            파일 타입 필터
            ----------------------------------------------------------------- */}
        <div className="flex-1 min-w-[120px]">
          <label
            htmlFor="filter-file-type"
            className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            파일 유형
          </label>
          <select
            id="filter-file-type"
            value={filters.fileType || ''}
            onChange={handleFileTypeChange}
            disabled={disabled}
            className={clsx(
              'w-full px-2 py-1.5 text-sm rounded-md',
              'bg-white dark:bg-gray-700',
              'border border-gray-300 dark:border-gray-600',
              'text-gray-900 dark:text-white',
              'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* -----------------------------------------------------------------
            최소 유사도 슬라이더
            ----------------------------------------------------------------- */}
        <div className="flex-1 min-w-[150px]">
          <label
            htmlFor="filter-min-score"
            className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            <span>최소 유사도</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {Math.round(filters.minScore * 100)}%
            </span>
          </label>
          <input
            id="filter-min-score"
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(filters.minScore * 100)}
            onChange={handleScoreChange}
            disabled={disabled}
            className={clsx(
              'w-full h-2 rounded-lg appearance-none cursor-pointer',
              'bg-gray-200 dark:bg-gray-600',
              'accent-blue-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          [P-B01-01] 활성 필터 태그
          ===================================================================== */}
      {(filters.fileType || filters.minScore !== 0.5) && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">적용됨:</span>

          {filters.fileType && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
              {FILE_TYPE_OPTIONS.find((o) => o.value === filters.fileType)?.label || filters.fileType}
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, fileType: null })}
                className="hover:text-blue-900 dark:hover:text-blue-100"
                aria-label="파일 타입 필터 제거"
              >
                ✕
              </button>
            </span>
          )}

          {filters.minScore !== 0.5 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full">
              유사도 ≥{Math.round(filters.minScore * 100)}%
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, minScore: 0.5 })}
                className="hover:text-green-900 dark:hover:text-green-100"
                aria-label="유사도 필터 초기화"
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Default Export
// =============================================================================

export default SearchFilters
