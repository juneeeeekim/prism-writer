// =============================================================================
// PRISM Writer - Report View Component (P2-06)
// =============================================================================
// 파일: frontend/src/components/Analytics/ReportView.tsx
// 역할: 기간별 리포트 뷰 — 종합 점수, 변화율, 활동 통계
// Phase B Track 2: Writing Growth Dashboard
// =============================================================================

'use client'

// =============================================================================
// 타입 정의
// =============================================================================

export type ReportType = 'weekly' | 'monthly' | 'overall'

export interface ReportStats {
  evaluationCount: number
  mostPracticedCategory: string
  topImprovement: string
  activityDays: number
}

export interface Report {
  periodLabel: string
  dateRange: string
  score: number
  previousScore?: number
  changePercent: number
  stats: ReportStats
}

export interface ReportViewProps {
  report: Report | null
  reportType: ReportType
  onTypeChange: (type: ReportType) => void
}

// =============================================================================
// 상수
// =============================================================================

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'overall', label: '종합' },
]

// =============================================================================
// 유틸
// =============================================================================

function formatChange(pct: number): {
  text: string
  colorClass: string
} {
  if (pct > 0) {
    return {
      text: `+${pct}%`,
      colorClass: 'text-green-600 dark:text-green-400',
    }
  }
  if (pct < 0) {
    return {
      text: `${pct}%`,
      colorClass: 'text-red-600 dark:text-red-400',
    }
  }
  return {
    text: '0%',
    colorClass: 'text-gray-500 dark:text-gray-400',
  }
}

// =============================================================================
// ReportView 컴포넌트
// =============================================================================

export default function ReportView({
  report,
  reportType,
  onTypeChange,
}: ReportViewProps) {
  // ---------------------------------------------------------------------------
  // 빈 상태
  // ---------------------------------------------------------------------------
  if (!report) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        {/* 타입 셀렉터 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            리포트
          </h3>
          <TypeTabs reportType={reportType} onChange={onTypeChange} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            이번 기간에 평가 데이터가 없습니다
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            글을 평가하면 리포트가 자동으로 생성됩니다
          </p>
        </div>
      </div>
    )
  }

  const change = formatChange(report.changePercent)

  // ---------------------------------------------------------------------------
  // 리포트 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {report.periodLabel}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {report.dateRange}
          </p>
        </div>
        <TypeTabs reportType={reportType} onChange={onTypeChange} />
      </div>

      {/* 종합 점수 */}
      <div className="flex items-end gap-3 mb-6">
        <span className="text-5xl font-bold text-gray-900 dark:text-gray-50 leading-none">
          {report.score}
        </span>
        <div className="flex flex-col pb-1">
          <span className="text-sm text-gray-400 dark:text-gray-500">/ 100</span>
          <span className={`text-sm font-semibold ${change.colorClass}`}>
            {change.text}
          </span>
        </div>
      </div>

      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="평가 횟수"
          value={`${report.stats.evaluationCount}회`}
          icon="📝"
        />
        <StatCard
          label="주 연습 분야"
          value={report.stats.mostPracticedCategory}
          icon="🎯"
        />
        <StatCard
          label="최대 향상"
          value={report.stats.topImprovement}
          icon="🚀"
        />
        <StatCard
          label="활동일수"
          value={`${report.stats.activityDays}일`}
          icon="📅"
        />
      </div>
    </div>
  )
}

// =============================================================================
// StatCard 서브 컴포넌트
// =============================================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
        {value}
      </p>
    </div>
  )
}

// =============================================================================
// TypeTabs 서브 컴포넌트
// =============================================================================

function TypeTabs({
  reportType,
  onChange,
}: {
  reportType: ReportType
  onChange: (t: ReportType) => void
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {REPORT_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            reportType === opt.value
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
