// =============================================================================
// PRISM Writer - Growth Chart Component (P2-04)
// =============================================================================
// 파일: frontend/src/components/Analytics/GrowthChart.tsx
// 역할: 성장 추이 차트 — 기간별 점수 변화를 시각화
// Phase B Track 2: Writing Growth Dashboard
// =============================================================================

'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

// =============================================================================
// 타입 정의
// =============================================================================

export type Period = '7d' | '30d' | '90d' | 'all'

export interface TimeSeriesPoint {
  date: string
  score: number
  label?: string
}

export interface GrowthChartProps {
  timeSeries: TimeSeriesPoint[]
  period: Period
  onPeriodChange: (period: Period) => void
}

// =============================================================================
// 상수
// =============================================================================

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: 'all', label: '전체' },
]

// =============================================================================
// 유틸
// =============================================================================

function computeTrend(data: TimeSeriesPoint[]): '상승세' | '유지' | '하락세' {
  if (data.length < 2) return '유지'
  const half = Math.floor(data.length / 2)
  const firstHalfAvg =
    data.slice(0, half).reduce((s, d) => s + d.score, 0) / half
  const secondHalfAvg =
    data.slice(half).reduce((s, d) => s + d.score, 0) / (data.length - half)
  const diff = secondHalfAvg - firstHalfAvg
  if (diff > 2) return '상승세'
  if (diff < -2) return '하락세'
  return '유지'
}

function trendColor(trend: string): string {
  switch (trend) {
    case '상승세':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
    case '하락세':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
  }
}

function trendIcon(trend: string): string {
  switch (trend) {
    case '상승세':
      return '\u2191' // ↑
    case '하락세':
      return '\u2193' // ↓
    default:
      return '\u2192' // →
  }
}

// =============================================================================
// 커스텀 툴팁
// =============================================================================

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {entry.name}: {entry.value}점
        </p>
      ))}
    </div>
  )
}

// =============================================================================
// GrowthChart 컴포넌트
// =============================================================================

export default function GrowthChart({
  timeSeries,
  period,
  onPeriodChange,
}: GrowthChartProps) {
  const averageScore = useMemo(() => {
    if (timeSeries.length === 0) return 0
    return Math.round(
      timeSeries.reduce((sum, d) => sum + d.score, 0) / timeSeries.length
    )
  }, [timeSeries])

  const trend = useMemo(() => computeTrend(timeSeries), [timeSeries])

  // ---------------------------------------------------------------------------
  // 빈 상태
  // ---------------------------------------------------------------------------
  if (timeSeries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        {/* 기간 탭 (비활성 상태에서도 표시) */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            성장 추이
          </h3>
          <PeriodTabs period={period} onChange={onPeriodChange} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            아직 평가 데이터가 없습니다
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            글을 평가하면 성장 추이가 여기에 표시됩니다
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 차트 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            성장 추이
          </h3>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendColor(trend)}`}
          >
            {trendIcon(trend)} {trend}
          </span>
        </div>
        <PeriodTabs period={period} onChange={onPeriodChange} />
      </div>

      {/* 차트 */}
      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={timeSeries}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-gray-400 dark:text-gray-500"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-gray-400 dark:text-gray-500"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
            />
            <ReferenceLine
              y={averageScore}
              stroke="#9ca3af"
              strokeDasharray="6 4"
              label={{
                value: `평균 ${averageScore}점`,
                position: 'right',
                fontSize: 11,
                fill: '#9ca3af',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              name="종합 점수"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5, fill: '#6366f1' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// =============================================================================
// PeriodTabs 서브 컴포넌트
// =============================================================================

function PeriodTabs({
  period,
  onChange,
}: {
  period: Period
  onChange: (p: Period) => void
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            period === opt.value
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
