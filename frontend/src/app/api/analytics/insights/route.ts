// =============================================================================
// PRISM Writer - Strengths/Weaknesses Insights API (P2-02)
// =============================================================================
// 파일: frontend/src/app/api/analytics/insights/route.ts
// 역할: 최근 평가 기반 강점/약점 분석 및 개선 팁 생성
// 생성일: 2026-03-19
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRubricById,
  getCategoryLabel,
  type RubricCategory,
} from '@/lib/rag/rubrics'

export const dynamic = 'force-dynamic'

// =============================================================================
// Types
// =============================================================================

interface CategoryInsight {
  category: string
  label: string
  averageScore: number
  evaluationCount: number
}

interface StrengthItem extends CategoryInsight {
  // 강점 항목 (추가 필드 확장 가능)
}

interface WeaknessItem extends CategoryInsight {
  tip: string
}

// =============================================================================
// Helper: result_data에서 카테고리별 점수 집계
// =============================================================================
function aggregateCategoryScores(
  evaluations: Array<{ result_data: unknown }>
): Map<string, number[]> {
  const categoryScoresMap = new Map<string, number[]>()

  for (const evalRow of evaluations) {
    if (!evalRow.result_data || typeof evalRow.result_data !== 'object') continue

    const data = evalRow.result_data as Record<string, unknown>

    // holistic_result의 breakdown 점수 사용
    const holisticResult = data.holistic_result as Record<string, unknown> | undefined
    if (holisticResult?.scoreC) {
      const scoreC = holisticResult.scoreC as Record<string, unknown>
      const breakdown = scoreC.breakdown as Record<string, number> | undefined
      if (breakdown) {
        for (const [key, value] of Object.entries(breakdown)) {
          if (typeof value === 'number') {
            if (!categoryScoresMap.has(key)) categoryScoresMap.set(key, [])
            categoryScoresMap.get(key)!.push(value)
          }
        }
        continue // holistic이 있으면 judgments는 건너뜀
      }
    }

    // judgments 기반 카테고리별 점수 계산
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

      if (!categoryScoresMap.has(category)) categoryScoresMap.set(category, [])
      categoryScoresMap.get(category)!.push(score)
    }
  }

  return categoryScoresMap
}

// =============================================================================
// Helper: 카테고리별 개선 팁 생성
// =============================================================================
function getImprovementTip(category: string, averageScore: number): string {
  const tips: Record<string, string[]> = {
    structure: [
      '글의 도입부에 독자의 관심을 끄는 훅(Hook)을 추가해보세요.',
      '문단 간 논리적 연결 고리를 강화하면 흐름이 자연스러워집니다.',
      '결론에서 핵심 메시지를 다시 한번 정리해보세요.',
    ],
    tone: [
      '글 전체에서 일관된 어투를 유지하고 있는지 확인해보세요.',
      '독자의 수준에 맞는 전문성 있는 표현을 사용해보세요.',
      '너무 딱딱하거나 너무 가벼운 표현이 섞이지 않았는지 점검해보세요.',
    ],
    persuasion: [
      'Before/After 대비 구조를 활용하면 설득력이 높아집니다.',
      '독자의 예상 반론을 미리 다루면 신뢰도가 올라갑니다.',
      '구체적인 사례나 비유를 통해 주장을 뒷받침해보세요.',
    ],
    rhythm: [
      '짧은 문장과 긴 문장을 번갈아 사용하면 리듬감이 생깁니다.',
      '적절한 위치에 질문을 배치하면 독자의 몰입도가 높아집니다.',
      '동일한 문장 구조가 3번 이상 반복되지 않도록 주의하세요.',
    ],
    trust: [
      '주장에 대한 구체적인 근거(데이터, 출처)를 제시해보세요.',
      '모든 상황에 적용되지 않을 수 있음을 솔직히 인정하면 오히려 신뢰가 높아집니다.',
      '"근거 → 해석 → 적용" 순서로 논증을 전개해보세요.',
    ],
    cta: [
      'CTA(행동 유도)에 "언제", "어디서", "무엇을"을 구체적으로 명시해보세요.',
      '"단 3분만", "지금 바로" 같은 마찰 감소 표현을 활용해보세요.',
      '독자가 다음 행동을 쉽게 취할 수 있도록 장벽을 낮춰보세요.',
    ],
    // holistic breakdown 카테고리용
    content: [
      '핵심 메시지를 명확하게 전달하고 있는지 확인해보세요.',
      '주제에 대한 깊이 있는 분석을 추가하면 내용이 풍부해집니다.',
      '불필요한 내용을 줄이고 핵심에 집중해보세요.',
    ],
    expression: [
      '같은 단어의 반복 사용을 줄이고 다양한 표현을 시도해보세요.',
      '문장을 더 간결하게 다듬어보세요.',
      '비유나 예시를 활용하면 표현이 생동감 있어집니다.',
    ],
    logic: [
      '논리적 비약이 없는지 각 문단의 연결을 점검해보세요.',
      '원인과 결과의 관계를 명확하게 서술해보세요.',
      '반례나 예외 상황도 함께 다루면 논리가 탄탄해집니다.',
    ],
  }

  const categoryTips = tips[category] || [
    '이 영역의 점수를 높이려면 관련 글쓰기 기법을 학습해보세요.',
    '잘 쓴 글의 해당 영역을 분석하고 패턴을 파악해보세요.',
  ]

  // 점수에 따라 다른 팁 선택
  if (averageScore < 30) return categoryTips[0]
  if (averageScore < 60) return categoryTips[1] || categoryTips[0]
  return categoryTips[2] || categoryTips[1] || categoryTips[0]
}

// =============================================================================
// Helper: 카테고리 라벨 (rubrics 카테고리 + holistic 카테고리 통합)
// =============================================================================
function getLabel(category: string): string {
  // 먼저 rubrics의 getCategoryLabel 시도
  const rubricLabel = getCategoryLabel(category as RubricCategory)
  if (rubricLabel !== category) return rubricLabel

  // holistic breakdown 카테고리
  const holisticLabels: Record<string, string> = {
    content: '내용',
    expression: '표현',
    logic: '논리',
  }
  return holisticLabels[category] || category
}

// =============================================================================
// GET: 강점/약점 인사이트 조회
// =============================================================================
// URL: /api/analytics/insights?projectId=xxx
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

    console.log('[Analytics/Insights] GET request:', {
      projectScoped: Boolean(projectId && projectId !== 'null'),
    })

    // -------------------------------------------------------------------------
    // 최근 10개 평가 조회
    // -------------------------------------------------------------------------
    let query = supabase
      .from('evaluation_logs')
      .select('id, result_data, overall_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (projectId && projectId !== 'null') {
      query = query.eq('project_id', projectId)
    }

    const { data: evaluations, error: dbError } = await query

    if (dbError) {
      console.error('[Analytics/Insights] DB error:', dbError)
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
        strengths: [],
        weaknesses: [],
        totalEvaluations: 0,
        message: '아직 평가 데이터가 없습니다. 글을 작성하고 평가를 받아보세요!',
      })
    }

    // -------------------------------------------------------------------------
    // 카테고리별 점수 집계
    // -------------------------------------------------------------------------
    const categoryScoresMap = aggregateCategoryScores(evaluations)

    // 카테고리별 평균 계산
    const categoryInsights: CategoryInsight[] = []
    const entries = Array.from(categoryScoresMap.entries())
    for (const [category, scores] of entries) {
      if (scores.length === 0) continue
      const avg = Math.round(scores.reduce((s: number, v: number) => s + v, 0) / scores.length)
      categoryInsights.push({
        category,
        label: getLabel(category),
        averageScore: avg,
        evaluationCount: scores.length,
      })
    }

    // 점수 기준 정렬
    const sorted = [...categoryInsights].sort((a, b) => b.averageScore - a.averageScore)

    // -------------------------------------------------------------------------
    // 강점 Top 3 / 약점 Bottom 3
    // -------------------------------------------------------------------------
    const strengths: StrengthItem[] = sorted.slice(0, 3).map((item) => ({
      ...item,
    }))

    const weaknesses: WeaknessItem[] = sorted
      .slice(-3)
      .reverse() // 가장 낮은 것부터
      .map((item) => ({
        ...item,
        tip: getImprovementTip(item.category, item.averageScore),
      }))

    console.log('[Analytics/Insights] Success:', {
      totalEvaluations: evaluations.length,
      categories: categoryInsights.length,
      topStrength: strengths[0]?.category,
      topWeakness: weaknesses[0]?.category,
    })

    return NextResponse.json({
      success: true,
      strengths,
      weaknesses,
      totalEvaluations: evaluations.length,
      allCategories: categoryInsights,
    })
  } catch (err) {
    console.error('[Analytics/Insights] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
