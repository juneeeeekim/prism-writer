// =============================================================================
// PRISM Writer - Usage Gauge Component
// =============================================================================
// 파일: frontend/src/components/usage/UsageGauge.tsx
// 역할: 일일/월간 사용량을 시각적 게이지로 표시
// 담당: UX/UI 디자인 전문가
// =============================================================================

'use client'

// =============================================================================
// Props Interface
// =============================================================================

interface UsageGaugeProps {
  /** 현재 사용량 */
  current: number
  /** 최대 한도 */
  limit: number
  /** 표시 라벨 */
  label: string
  /** 게이지 유형 */
  type: 'daily' | 'monthly'
  /** 단위 (회, 토큰 등) */
  unit?: string
  /** 추가 CSS 클래스 */
  className?: string
}

// =============================================================================
// 색상 로직
// =============================================================================

function getGaugeColor(percentage: number): {
  bar: string
  text: string
  darkBar: string
  darkText: string
} {
  if (percentage >= 100) {
    // 100% 도달: 빨간색 (위험)
    return {
      bar: 'bg-red-500',
      text: 'text-red-600',
      darkBar: 'dark:bg-red-500',
      darkText: 'dark:text-red-400',
    }
  } else if (percentage >= 80) {
    // 80% 이상: 노란색 (경고)
    return {
      bar: 'bg-yellow-500',
      text: 'text-yellow-600',
      darkBar: 'dark:bg-yellow-500',
      darkText: 'dark:text-yellow-400',
    }
  } else {
    // 일반: 초록색
    return {
      bar: 'bg-green-500',
      text: 'text-green-600',
      darkBar: 'dark:bg-green-500',
      darkText: 'dark:text-green-400',
    }
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * 사용량 게이지 컴포넌트
 * 
 * 일일 요청 횟수 또는 월간 토큰 사용량을 시각적으로 표시
 * 
 * @example
 * ```tsx
 * <UsageGauge
 *   current={3}
 *   limit={5}
 *   label="오늘 사용량"
 *   type="daily"
 *   unit="회"
 * />
 * ```
 */
export default function UsageGauge({
  current,
  limit,
  label,
  type,
  unit = '',
  className = '',
}: UsageGaugeProps) {
  // =============================================================================
  // 퍼센트 계산
  // =============================================================================
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const colors = getGaugeColor(percentage)

  // =============================================================================
  // 표시 텍스트 포맷
  // =============================================================================
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return num.toLocaleString()
    }
    return num.toString()
  }

  const displayText = `${formatNumber(current)}/${formatNumber(limit)}${unit ? ` ${unit}` : ''}`

  // =============================================================================
  // Render
  // =============================================================================
  return (
    <div className={`space-y-2 ${className}`}>
      {/* ===================================================================
          라벨 및 수치
          =================================================================== */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className={`text-sm font-semibold ${colors.text} ${colors.darkText}`}>
          {displayText}
        </span>
      </div>

      {/* ===================================================================
          게이지 바
          =================================================================== */}
      <div 
        className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${displayText}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colors.bar} ${colors.darkBar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* ===================================================================
          상태 메시지 (80% 이상 또는 100% 도달 시)
          =================================================================== */}
      {percentage >= 100 && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {type === 'daily' ? '오늘 한도에 도달했습니다' : '이번 달 한도에 도달했습니다'}
        </p>
      )}
      {percentage >= 80 && percentage < 100 && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          {type === 'daily' ? `오늘 ${limit - current}회 남음` : `${formatNumber(limit - current)} 토큰 남음`}
        </p>
      )}
    </div>
  )
}

// Named export
export { UsageGauge }
