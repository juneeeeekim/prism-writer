// =============================================================================
// PRISM Writer - Growth Time-Series API (P2-01)
// =============================================================================
// 파일: frontend/src/app/api/analytics/growth/route.ts
// 역할: 사용자의 평가 점수 시계열 데이터 및 성장 트렌드 분석
// 생성일: 2026-03-19
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRubricById, type RubricCategory } from '@/lib/rag/rubrics'

export const dynamic = 'force-dynamic'

// =============================================================================
// Types
// =============================================================================

interface TimeSeriesPoint {
  date: string
  overallScore: number
  categoryScores: Record<string, number>
}

interface GrowthSummary {
  totalEvaluations: number
  averageScore: number
  trend: 'improving' | 'declining' | 'stable'
}

// =============================================================================
// Helper: period 파라미터를 날짜 범위로 변환
// =============================================================================
function getPeriodStartDate(period: string): Date | null {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case 'all':
      return null
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

// =============================================================================
// Helper: result_data에서 카테고리별 점수 추출
// =============================================================================
// judgments 배열의 각 항목에서 criteria_id를 통해 카테고리를 식별하고,
// status를 점수로 변환 (pass=100, partial=50, fail=0)
// =============================================================================
function extractCategoryScores(resultData: unknown): Record<string, number> {
  const scores: Record<string, number[]> = {}

  if (!resultData || typeof resultData !== 'object') return {}

  const data = resultData as Record<string, unknown>

  // holistic_result의 scoreC.breakdown이 있으면 우선 사용
  const holisticResult = data.holistic_result as Record<string, unknown> | undefined
  if (holisticResult?.scoreC) {
    const scoreC = holisticResult.scoreC as Record<string, unknown>
    const breakdown = scoreC.breakdown as Record<string, number> | undefined
    if (breakdown) {
      const result: Record<string, number> = {}
      for (const [key, value] of Object.entries(breakdown)) {
        if (typeof value === 'number') {
          result[key] = value
        }
      }
      if (Object.keys(result).length > 0) return result
    }
  }

  // judgments 배열에서 카테고리별 점수 계산
  const judgments = data.judgments as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(judgments) || judgments.length === 0) return {}

  for (const judgment of judgments) {
    const criteriaId = judgment.criteria_id as string | undefined
    if (!criteriaId) continue

    // criteria_id에서 카테고리 추출 (예: 'structure_hook' → 'structure')
    const rubric = getRubricById(criteriaId)
    const category: string = rubric?.category || criteriaId.split('_')[0] || 'unknown'

    // status를 점수로 변환
    const status = judgment.status as string
    let score = 0
    if (status === 'pass') score = 100
    else if (status === 'partial') score = 50

    if (!scores[category]) scores[category] = []
    scores[category].push(score)
  }

  // 카테고리별 평균 계산
  const result: Record<string, number> = {}
  for (const [category, categoryScores] of Object.entries(scores)) {
    if (categoryScores.length > 0) {
      result[category] = Math.round(
        categoryScores.reduce((sum, s) => sum + s, 0) / categoryScores.length
      )
    }
  }

  return result
}

// =============================================================================
// Helper: 트렌드 계산 (전반부 vs 후반부 평균 비교)
// =============================================================================
function calculateTrend(
  timeSeries: TimeSeriesPoint[]
): 'improving' | 'declining' | 'stable' {
  if (timeSeries.length < 2) return 'stable'

  const mid = Math.floor(timeSeries.length / 2)
  const firstHalf = timeSeries.slice(0, mid)
  const secondHalf = timeSeries.slice(mid)

  const firstAvg =
    firstHalf.reduce((sum, p) => sum + p.overallScore, 0) / firstHalf.length
  const secondAvg =
    secondHalf.reduce((sum, p) => sum + p.overallScore, 0) / secondHalf.length

  const diff = secondAvg - firstAvg

  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

// =============================================================================
// GET: 성장 시계열 데이터 조회
// =============================================================================
// URL: /api/analytics/growth?projectId=xxx&period=30d
// period: 7d | 30d | 90d | all (기본값: 30d)
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // URL 파라미터 추출
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const period = searchParams.get('period') || '30d'

    console.log('[Analytics/Growth] GET request:', {
      projectScoped: Boolean(projectId && projectId !== 'null'),
      period,
    })

    // -------------------------------------------------------------------------
    // 쿼리 구성
    // -------------------------------------------------------------------------
    let query = supabase
      .from('evaluation_logs')
      .select('id, overall_score, result_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    // projectId 필터
    if (projectId && projectId !== 'null') {
      query = query.eq('project_id', projectId)
    }

    // period 필터
    const startDate = getPeriodStartDate(period)
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }

    const { data: evaluations, error: dbError } = await query

    if (dbError) {
      console.error('[Analytics/Growth] DB error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 평가 0건인 경우
    // -------------------------------------------------------------------------
    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({
        success: true,
        timeSeries: [],
        summary: {
          totalEvaluations: 0,
          averageScore: 0,
          trend: 'stable' as const,
        },
        message: '해당 기간에 평가 데이터가 없습니다.',
      })
    }

    // -------------------------------------------------------------------------
    // 시계열 데이터 구성
    // -------------------------------------------------------------------------
    const timeSeries: TimeSeriesPoint[] = evaluations.map((eval_row) => {
      const overallScore =
        typeof eval_row.overall_score === 'number'
          ? eval_row.overall_score
          : 0

      const categoryScores = extractCategoryScores(eval_row.result_data)

      return {
        date: eval_row.created_at,
        overallScore,
        categoryScores,
      }
    })

    // -------------------------------------------------------------------------
    // 요약 통계
    // -------------------------------------------------------------------------
    const validScores = timeSeries.filter((p) => p.overallScore > 0)
    const averageScore =
      validScores.length > 0
        ? Math.round(
            (validScores.reduce((sum, p) => sum + p.overallScore, 0) /
              validScores.length) *
              100
          ) / 100
        : 0

    const trend = calculateTrend(timeSeries)

    const summary: GrowthSummary = {
      totalEvaluations: evaluations.length,
      averageScore,
      trend,
    }

    console.log('[Analytics/Growth] Success:', {
      totalPoints: timeSeries.length,
      averageScore,
      trend,
    })

    return NextResponse.json({
      success: true,
      timeSeries,
      summary,
    })
  } catch (err) {
    console.error('[Analytics/Growth] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
