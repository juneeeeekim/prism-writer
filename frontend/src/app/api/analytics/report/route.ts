// =============================================================================
// PRISM Writer - Weekly/Monthly Report API (P2-03)
// =============================================================================
// 파일: frontend/src/app/api/analytics/report/route.ts
// 역할: 주간/월간 평가 리포트 생성 (현재 vs 이전 기간 비교)
// 생성일: 2026-03-19
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRubricById,
  getCategoryLabel,
  type RubricCategory,
} from '@/lib/rag/rubrics'

// =============================================================================
// Types
// =============================================================================

interface PeriodInfo {
  type: 'weekly' | 'monthly'
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
}

interface CategoryChange {
  category: string
  label: string
  currentAvg: number
  previousAvg: number
  change: number
}

// =============================================================================
// Helper: 기간 범위 계산
// =============================================================================
function calculatePeriodRanges(type: string): PeriodInfo {
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000

  if (type === 'monthly') {
    // 현재 기간: 최근 30일
    const currentEnd = now
    const currentStart = new Date(now.getTime() - 30 * msPerDay)
    // 이전 기간: 그 전 30일
    const previousEnd = new Date(currentStart.getTime())
    const previousStart = new Date(previousEnd.getTime() - 30 * msPerDay)

    return {
      type: 'monthly',
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
    }
  }

  // 기본값: weekly (최근 7일)
  const currentEnd = now
  const currentStart = new Date(now.getTime() - 7 * msPerDay)
  const previousEnd = new Date(currentStart.getTime())
  const previousStart = new Date(previousEnd.getTime() - 7 * msPerDay)

  return {
    type: 'weekly',
    currentStart: currentStart.toISOString(),
    currentEnd: currentEnd.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  }
}

// =============================================================================
// Helper: 평가 목록에서 평균 점수 계산
// =============================================================================
function calculateAverageScore(
  evaluations: Array<{ overall_score: number | null }>
): number {
  const validScores = evaluations
    .map((e) => e.overall_score)
    .filter((s): s is number => typeof s === 'number')

  if (validScores.length === 0) return 0

  return (
    Math.round(
      (validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 100
    ) / 100
  )
}

// =============================================================================
// Helper: 카테고리별 평균 점수 계산
// =============================================================================
function calculateCategoryAverages(
  evaluations: Array<{ result_data: unknown }>
): Map<string, number> {
  const categoryScores = new Map<string, number[]>()

  for (const evalRow of evaluations) {
    if (!evalRow.result_data || typeof evalRow.result_data !== 'object') continue

    const data = evalRow.result_data as Record<string, unknown>

    // holistic_result의 breakdown 우선
    const holisticResult = data.holistic_result as Record<string, unknown> | undefined
    if (holisticResult?.scoreC) {
      const scoreC = holisticResult.scoreC as Record<string, unknown>
      const breakdown = scoreC.breakdown as Record<string, number> | undefined
      if (breakdown) {
        for (const [key, value] of Object.entries(breakdown)) {
          if (typeof value === 'number') {
            if (!categoryScores.has(key)) categoryScores.set(key, [])
            categoryScores.get(key)!.push(value)
          }
        }
        continue
      }
    }

    // judgments 기반
    const judgments = data.judgments as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(judgments)) continue

    for (const judgment of judgments) {
      const criteriaId = judgment.criteria_id as string | undefined
      if (!criteriaId) continue

      const rubric = getRubricById(criteriaId)
      const category = rubric?.category || criteriaId.split('_')[0] || 'unknown'

      const status = judgment.status as string
      let score = 0
      if (status === 'pass') score = 100
      else if (status === 'partial') score = 50

      if (!categoryScores.has(category)) categoryScores.set(category, [])
      categoryScores.get(category)!.push(score)
    }
  }

  // 평균 계산
  const averages = new Map<string, number>()
  const entries = Array.from(categoryScores.entries())
  for (const [category, scores] of entries) {
    if (scores.length > 0) {
      averages.set(
        category,
        Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length)
      )
    }
  }

  return averages
}

// =============================================================================
// Helper: 카테고리 라벨 (rubrics + holistic 통합)
// =============================================================================
function getLabel(category: string): string {
  const rubricLabel = getCategoryLabel(category as RubricCategory)
  if (rubricLabel !== category) return rubricLabel

  const holisticLabels: Record<string, string> = {
    content: '내용',
    expression: '표현',
    logic: '논리',
  }
  return holisticLabels[category] || category
}

// =============================================================================
// GET: 주간/월간 리포트 조회
// =============================================================================
// URL: /api/analytics/report?projectId=xxx&type=weekly
// type: weekly | monthly (기본값: weekly)
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
    const type = searchParams.get('type') || 'weekly'

    console.log('[Analytics/Report] GET request:', { userId: user.id, projectId, type })

    // -------------------------------------------------------------------------
    // 기간 계산
    // -------------------------------------------------------------------------
    const periodInfo = calculatePeriodRanges(type)

    // -------------------------------------------------------------------------
    // 현재 기간 평가 조회
    // -------------------------------------------------------------------------
    let currentQuery = supabase
      .from('evaluation_logs')
      .select('id, overall_score, result_data, created_at')
      .eq('user_id', user.id)
      .gte('created_at', periodInfo.currentStart)
      .lte('created_at', periodInfo.currentEnd)
      .order('created_at', { ascending: true })

    if (projectId && projectId !== 'null') {
      currentQuery = currentQuery.eq('project_id', projectId)
    }

    // -------------------------------------------------------------------------
    // 이전 기간 평가 조회
    // -------------------------------------------------------------------------
    let previousQuery = supabase
      .from('evaluation_logs')
      .select('id, overall_score, result_data, created_at')
      .eq('user_id', user.id)
      .gte('created_at', periodInfo.previousStart)
      .lte('created_at', periodInfo.previousEnd)
      .order('created_at', { ascending: true })

    if (projectId && projectId !== 'null') {
      previousQuery = previousQuery.eq('project_id', projectId)
    }

    // 두 쿼리 병렬 실행
    const [currentResult, previousResult] = await Promise.all([
      currentQuery,
      previousQuery,
    ])

    if (currentResult.error) {
      console.error('[Analytics/Report] Current period DB error:', currentResult.error)
      return NextResponse.json(
        { success: false, error: 'Database error', message: currentResult.error.message },
        { status: 500 }
      )
    }

    if (previousResult.error) {
      console.error('[Analytics/Report] Previous period DB error:', previousResult.error)
      return NextResponse.json(
        { success: false, error: 'Database error', message: previousResult.error.message },
        { status: 500 }
      )
    }

    const currentEvaluations = currentResult.data || []
    const previousEvaluations = previousResult.data || []

    // -------------------------------------------------------------------------
    // 평균 점수 계산
    // -------------------------------------------------------------------------
    const averageScore = calculateAverageScore(currentEvaluations)
    const previousAverageScore = calculateAverageScore(previousEvaluations)

    // 변화율 계산 (division by zero 방지)
    let changePercent = 0
    if (previousAverageScore > 0) {
      changePercent =
        Math.round(
          ((averageScore - previousAverageScore) / previousAverageScore) * 10000
        ) / 100
    } else if (averageScore > 0) {
      // 이전 기간 데이터 없고 현재 데이터만 있으면 100% 증가로 표시
      changePercent = 100
    }

    // -------------------------------------------------------------------------
    // 카테고리별 변화 분석 → 가장 크게 향상된 카테고리 찾기
    // -------------------------------------------------------------------------
    const currentCategoryAvg = calculateCategoryAverages(currentEvaluations)
    const previousCategoryAvg = calculateCategoryAverages(previousEvaluations)

    const categoryChanges: CategoryChange[] = []
    const allCategories = new Set([
      ...Array.from(currentCategoryAvg.keys()),
      ...Array.from(previousCategoryAvg.keys()),
    ])

    for (const category of Array.from(allCategories)) {
      const currentAvg = currentCategoryAvg.get(category) || 0
      const previousAvg = previousCategoryAvg.get(category) || 0
      categoryChanges.push({
        category,
        label: getLabel(category),
        currentAvg,
        previousAvg,
        change: currentAvg - previousAvg,
      })
    }

    // 가장 크게 향상된 카테고리
    const sortedByImprovement = [...categoryChanges].sort(
      (a, b) => b.change - a.change
    )
    const topImprovement = sortedByImprovement[0] || null

    console.log('[Analytics/Report] Success:', {
      type: periodInfo.type,
      currentCount: currentEvaluations.length,
      previousCount: previousEvaluations.length,
      averageScore,
      previousAverageScore,
      changePercent,
      topImprovement: topImprovement?.category,
    })

    return NextResponse.json({
      success: true,
      period: periodInfo,
      evaluationCount: currentEvaluations.length,
      previousEvaluationCount: previousEvaluations.length,
      averageScore,
      previousAverageScore,
      changePercent,
      topImprovement: topImprovement
        ? {
            category: topImprovement.category,
            label: topImprovement.label,
            change: topImprovement.change,
            currentAvg: topImprovement.currentAvg,
            previousAvg: topImprovement.previousAvg,
          }
        : null,
      categoryChanges,
      message:
        currentEvaluations.length === 0
          ? `이번 ${periodInfo.type === 'weekly' ? '주' : '달'}에는 아직 평가가 없습니다.`
          : undefined,
    })
  } catch (err) {
    console.error('[Analytics/Report] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
