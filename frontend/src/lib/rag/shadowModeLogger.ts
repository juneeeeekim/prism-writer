
import { type EvaluationResult as LegacyEvaluationResult } from '@/lib/llm/parser'
import { type EvaluationResult as V3EvaluationResult } from '@/lib/judge/types'

/**
 * ShadowModeLogger
 * 
 * v2(Legacy)와 v3(New) 평가 결과를 병렬로 실행하고 비교하여 로깅합니다.
 * 이는 신규 시스템의 안정성과 정확성을 검증하기 위한 용도입니다.
 */
export async function logShadowModeComparison(
  v2Result: LegacyEvaluationResult,
  v3Result: V3EvaluationResult,
  context: {
    userId: string
    userText: string
    templateId?: string
  }
): Promise<void> {
  const diff = {
    score_diff: v3Result.overall_score - v2Result.overall_score,
    v2_score: v2Result.overall_score,
    v3_score: v3Result.overall_score,
    v2_summary: v2Result.overall_summary,
    v3_judgments_count: v3Result.judgments.length,
    v2_evaluations_count: v2Result.evaluations.length,
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[ShadowMode] Comparison Result:', {
      userId: context.userId,
      templateId: context.templateId,
      ...diff
    })
  }

  // Supabase 저장 (추후 구현)
  // try {
  //   const { createClient } = await import('@/lib/supabase/client')
  //   const supabase = createClient()
  //   await supabase.from('shadow_mode_logs').insert({
  //     user_id: context.userId,
  //     template_id: context.templateId,
  //     v2_result: v2Result,
  //     v3_result: v3Result,
  //     diff_metrics: diff,
  //     created_at: new Date().toISOString()
  //   })
  // } catch (error) {
  //   console.error('[ShadowMode] Failed to log comparison:', error)
  // }
}
