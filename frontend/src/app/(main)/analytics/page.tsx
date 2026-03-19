// =============================================================================
// PRISM Writer - Analytics Dashboard Page (P2-07)
// =============================================================================
// 파일: frontend/src/app/(main)/analytics/page.tsx
// 역할: 글쓰기 성장 분석 대시보드 — 차트, 인사이트, 리포트 통합 뷰
// Phase B Track 2: Writing Growth Dashboard
// =============================================================================

'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useProject } from '@/contexts/ProjectContext'
import AuthHeader from '@/components/auth/AuthHeader'
import GrowthChart, { type Period, type TimeSeriesPoint } from '@/components/analytics/GrowthChart'
import InsightCards, { type Insights } from '@/components/analytics/InsightCards'
import ReportView, { type ReportType, type Report } from '@/components/analytics/ReportView'

// =============================================================================
// 타입 정의 (API 응답)
// =============================================================================

interface GrowthApiResponse {
  success: boolean
  timeSeries: Array<{
    date: string
    overallScore: number
    categoryScores: Record<string, number>
  }>
  summary: {
    totalEvaluations: number
    averageScore: number
    trend: string
  }
  message?: string
}

interface InsightsApiResponse {
  success: boolean
  strengths: Array<{
    category: string
    label: string
    averageScore: number
    evaluationCount: number
  }>
  weaknesses: Array<{
    category: string
    label: string
    averageScore: number
    evaluationCount: number
    tip: string
  }>
  totalEvaluations: number
  message?: string
}

interface ReportApiResponse {
  success: boolean
  period: {
    type: 'weekly' | 'monthly'
    currentStart: string
    currentEnd: string
  }
  evaluationCount: number
  previousEvaluationCount: number
  averageScore: number
  previousAverageScore: number
  changePercent: number
  topImprovement: {
    category: string
    label: string
    change: number
    currentAvg: number
    previousAvg: number
  } | null
  categoryChanges: Array<{
    category: string
    label: string
    currentAvg: number
    previousAvg: number
    change: number
  }>
  message?: string
}

// =============================================================================
// 로딩 스켈레톤 컴포넌트
// =============================================================================

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="w-full h-64 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
      <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-7 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-14 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// 에러 표시 컴포넌트
// =============================================================================

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-6 text-center">
      <p className="text-sm text-red-600 dark:text-red-400 mb-2">{message}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
      >
        다시 시도
      </button>
    </div>
  )
}

// =============================================================================
// 메인 페이지 컴포넌트
// =============================================================================

export default function AnalyticsPage() {
  return <AnalyticsContent />
}

function AnalyticsContent() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  // ---------------------------------------------------------------------------
  // Growth Chart 상태
  // ---------------------------------------------------------------------------
  const [period, setPeriod] = useState<Period>('30d')
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [growthLoading, setGrowthLoading] = useState(true)
  const [growthError, setGrowthError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Insight Cards 상태
  // ---------------------------------------------------------------------------
  const [insights, setInsights] = useState<Insights>({ strengths: [], weaknesses: [] })
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Report View 상태
  // ---------------------------------------------------------------------------
  const [reportType, setReportType] = useState<ReportType>('weekly')
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 인증 리다이렉트
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  // ---------------------------------------------------------------------------
  // Growth API 패치
  // ---------------------------------------------------------------------------
  const fetchGrowth = useCallback(async () => {
    setGrowthLoading(true)
    setGrowthError(null)
    try {
      const params = new URLSearchParams({ period })
      if (projectId) params.set('projectId', projectId)

      const res = await fetch(`/api/analytics/growth?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: GrowthApiResponse = await res.json()
      if (!data.success) throw new Error(data.message || '데이터를 불러올 수 없습니다.')

      // API 응답을 GrowthChart props 형식으로 변환
      const mapped: TimeSeriesPoint[] = data.timeSeries.map((point) => ({
        date: new Date(point.date).toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
        }),
        score: point.overallScore,
      }))

      setTimeSeries(mapped)
    } catch (err) {
      console.error('[Analytics] Growth fetch error:', err)
      setGrowthError(err instanceof Error ? err.message : '성장 데이터를 불러오는 데 실패했습니다.')
    } finally {
      setGrowthLoading(false)
    }
  }, [period, projectId])

  // ---------------------------------------------------------------------------
  // Insights API 패치
  // ---------------------------------------------------------------------------
  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)

      const res = await fetch(`/api/analytics/insights?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: InsightsApiResponse = await res.json()
      if (!data.success) throw new Error(data.message || '데이터를 불러올 수 없습니다.')

      setInsights({
        strengths: data.strengths.map((s) => ({
          category: s.label,
          score: s.averageScore,
        })),
        weaknesses: data.weaknesses.map((w) => ({
          category: w.label,
          score: w.averageScore,
          tip: w.tip,
        })),
      })
    } catch (err) {
      console.error('[Analytics] Insights fetch error:', err)
      setInsightsError(err instanceof Error ? err.message : '인사이트를 불러오는 데 실패했습니다.')
    } finally {
      setInsightsLoading(false)
    }
  }, [projectId])

  // ---------------------------------------------------------------------------
  // Report API 패치
  // ---------------------------------------------------------------------------
  const fetchReport = useCallback(async () => {
    setReportLoading(true)
    setReportError(null)
    try {
      const params = new URLSearchParams({ type: reportType })
      if (projectId) params.set('projectId', projectId)

      const res = await fetch(`/api/analytics/report?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: ReportApiResponse = await res.json()
      if (!data.success) throw new Error(data.message || '데이터를 불러올 수 없습니다.')

      // 평가 0건이면 report null로 설정 (ReportView가 빈 상태 표시)
      if (data.evaluationCount === 0) {
        setReport(null)
        return
      }

      // API 응답을 ReportView props 형식으로 변환
      const periodLabel =
        reportType === 'weekly'
          ? '주간 리포트'
          : reportType === 'monthly'
            ? '월간 리포트'
            : '종합 리포트'

      const startDate = new Date(data.period.currentStart)
      const endDate = new Date(data.period.currentEnd)
      const dateRange = `${startDate.toLocaleDateString('ko-KR')} ~ ${endDate.toLocaleDateString('ko-KR')}`

      setReport({
        periodLabel,
        dateRange,
        score: Math.round(data.averageScore),
        previousScore: data.previousAverageScore > 0 ? Math.round(data.previousAverageScore) : undefined,
        changePercent: Math.round(data.changePercent * 10) / 10,
        stats: {
          evaluationCount: data.evaluationCount,
          mostPracticedCategory: data.topImprovement?.label || '-',
          topImprovement: data.topImprovement
            ? `${data.topImprovement.label} (+${data.topImprovement.change}점)`
            : '-',
          activityDays: data.evaluationCount, // 근사값 (평가 횟수 ≈ 활동일수)
        },
      })
    } catch (err) {
      console.error('[Analytics] Report fetch error:', err)
      setReportError(err instanceof Error ? err.message : '리포트를 불러오는 데 실패했습니다.')
    } finally {
      setReportLoading(false)
    }
  }, [reportType, projectId])

  // ---------------------------------------------------------------------------
  // 초기 로딩: 3개 API 병렬 패치
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user || authLoading) return
    // 3개 API를 독립적으로 호출 (하나가 실패해도 나머지는 정상 동작)
    fetchGrowth()
    fetchInsights()
    fetchReport()
  }, [user, authLoading, fetchGrowth, fetchInsights, fetchReport])

  // ---------------------------------------------------------------------------
  // 기간 변경 시 Growth API만 재호출
  // ---------------------------------------------------------------------------
  const handlePeriodChange = useCallback(
    (newPeriod: Period) => {
      setPeriod(newPeriod)
      // fetchGrowth는 period 변경으로 useEffect에서 자동 재호출됨
    },
    []
  )

  // ---------------------------------------------------------------------------
  // 리포트 타입 변경 시 Report API만 재호출
  // ---------------------------------------------------------------------------
  const handleReportTypeChange = useCallback(
    (newType: ReportType) => {
      setReportType(newType)
      // fetchReport는 reportType 변경으로 useEffect에서 자동 재호출됨
    },
    []
  )

  // ---------------------------------------------------------------------------
  // 인증 로딩 중
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AuthHeader showProjectSelector />
        <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </div>
    )
  }

  // 비로그인 상태 (리다이렉트 대기)
  if (!user) return null

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <AuthHeader showProjectSelector />

      {/* 메인 콘텐츠 */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="대시보드로 돌아가기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                글쓰기 성장 분석
              </h1>
              {currentProject && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {currentProject.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 섹션 그리드 */}
        <div className="space-y-6">
          {/* 섹션 1: 성장 추이 차트 */}
          {growthLoading ? (
            <ChartSkeleton />
          ) : growthError ? (
            <SectionError message={growthError} onRetry={fetchGrowth} />
          ) : (
            <GrowthChart
              timeSeries={timeSeries}
              period={period}
              onPeriodChange={handlePeriodChange}
            />
          )}

          {/* 섹션 2 & 3: 인사이트 + 리포트 (2열 그리드) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 섹션 2: 인사이트 카드 */}
            <div>
              {insightsLoading ? (
                <InsightSkeleton />
              ) : insightsError ? (
                <SectionError message={insightsError} onRetry={fetchInsights} />
              ) : (
                <InsightCards insights={insights} />
              )}
            </div>

            {/* 섹션 3: 리포트 */}
            <div>
              {reportLoading ? (
                <ReportSkeleton />
              ) : reportError ? (
                <SectionError message={reportError} onRetry={fetchReport} />
              ) : (
                <ReportView
                  report={report}
                  reportType={reportType}
                  onTypeChange={handleReportTypeChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
