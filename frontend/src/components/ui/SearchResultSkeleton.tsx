// =============================================================================
// PRISM Writer - Search Result Skeleton Component (P-A01-02)
// =============================================================================
// 파일: frontend/src/components/ui/SearchResultSkeleton.tsx
// 역할: 검색 결과 로딩 시 표시되는 스켈레톤 카드 컴포넌트
// 작성일: 2026-01-04
// Phase: A - Quick Wins (UX 개선)
// =============================================================================

'use client'

import { Skeleton } from './Skeleton'

// =============================================================================
// 타입 정의
// =============================================================================

export interface SearchResultSkeletonProps {
  /** 스켈레톤 카드 개수 (기본: 3) */
  count?: number
  /** 추가 CSS 클래스 */
  className?: string
}

// =============================================================================
// SearchResultSkeleton 컴포넌트
// =============================================================================

/**
 * 검색 결과 로딩 시 표시되는 스켈레톤 컴포넌트
 *
 * @description
 * SmartSearchTab에서 검색 API 호출 중에 표시됩니다.
 * 실제 검색 결과 카드와 동일한 레이아웃을 유지합니다.
 *
 * @example
 * ```tsx
 * {isLoading && <SearchResultSkeleton count={5} />}
 * ```
 */
export function SearchResultSkeleton({
  count = 3,
  className = '',
}: SearchResultSkeletonProps) {
  // ---------------------------------------------------------------------------
  // [P-A01-02] count 유효성 검사 (음수 방지)
  // ---------------------------------------------------------------------------
  const safeCount = Math.max(0, Math.min(count, 10)) // 최대 10개로 제한

  // ---------------------------------------------------------------------------
  // [P-A01-02] 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="검색 결과 로딩 중">
      {Array.from({ length: safeCount }).map((_, index) => (
        // =====================================================================
        // [P-A01-02] 개별 검색 결과 카드 스켈레톤
        // SmartSearchTab.tsx의 결과 카드 레이아웃과 동일하게 구성
        // =====================================================================
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border border-gray-200 dark:border-gray-700"
        >
          {/* 상단: 번호 + 유사도 */}
          <div className="flex items-center justify-between mb-2">
            <Skeleton width={40} height={16} />
            <Skeleton width={80} height={16} />
          </div>

          {/* 본문: 2줄 텍스트 */}
          <div className="space-y-2 mb-2">
            <Skeleton height={16} width="100%" />
            <Skeleton height={16} width="85%" />
          </div>

          {/* 하단: 출처 정보 */}
          <Skeleton height={12} width="60%" className="mt-2" />
        </div>
      ))}

      {/* 스크린 리더용 로딩 메시지 */}
      <span className="sr-only">검색 결과를 불러오는 중입니다...</span>
    </div>
  )
}

// =============================================================================
// 평가 결과용 스켈레톤 (EvaluationTab용)
// =============================================================================

export interface EvaluationSkeletonProps {
  /** 추가 CSS 클래스 */
  className?: string
}

/**
 * 평가 결과 로딩 시 표시되는 스켈레톤 컴포넌트
 *
 * @description
 * EvaluationTab에서 평가 API 호출 중에 표시됩니다.
 */
export function EvaluationSkeleton({ className = '' }: EvaluationSkeletonProps) {
  return (
    <div className={`p-4 space-y-4 ${className}`} role="status" aria-label="평가 결과 로딩 중">
      {/* 상단: 점수 영역 */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" width={60} height={60} />
        <div className="flex-1 space-y-2">
          <Skeleton height={20} width="40%" />
          <Skeleton height={14} width="60%" />
        </div>
      </div>

      {/* 평가 항목 카드들 */}
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton height={18} width="50%" />
            <Skeleton height={24} width={60} />
          </div>
          <div className="space-y-2">
            <Skeleton height={14} width="100%" />
            <Skeleton height={14} width="90%" />
          </div>
        </div>
      ))}

      {/* 스크린 리더용 로딩 메시지 */}
      <span className="sr-only">평가 결과를 분석하는 중입니다...</span>
    </div>
  )
}

// Default export
export default SearchResultSkeleton
