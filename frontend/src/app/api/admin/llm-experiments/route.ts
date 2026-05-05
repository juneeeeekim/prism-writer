// =============================================================================
// PRISM Writer - LLM A/B Experiments API (Phase 7)
// =============================================================================
// 파일: frontend/src/app/api/admin/llm-experiments/route.ts
// 역할: AB_EXPERIMENTS의 정의를 노출하고, llm_performance_logs를 모델별로
//       분리해 실험 비교 통계를 반환한다.
// API 계약:
//   GET /api/admin/llm-experiments
//     인증: Supabase auth + role=admin
//     응답(200): { success, experiments: [{context, enabled, variants, results: [...] }] }
// 외부 의존성: Supabase. 마이그레이션 미적용 시 결과 배열은 빈 값.
// 설계 의도(왜 이 구조인가):
//   - 실험 결과 분석은 코드 변경 없이 SQL/집계로 수행되어야 비용이 낮다.
//     본 API는 이미 기록된 perf 로그를 컨텍스트·모델 단위로 카운트만 한다.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AB_EXPERIMENTS } from '@/lib/llm/ab-test'
import { writeErrorLog } from '@/lib/error-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ErrorBody {
  success: false
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INTERNAL_ERROR'
    message: string
    requestId: string
  }
}

function createRequestId(): string {
  return `expr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function errorResponse(
  status: number,
  code: ErrorBody['error']['code'],
  message: string,
  requestId: string
) {
  return NextResponse.json<ErrorBody>(
    { success: false, error: { code, message, requestId } },
    { status }
  )
}

interface PerfRow {
  model_id: string
  is_success: boolean
  latency_ms: number
}

export async function GET(_request: NextRequest) {
  const requestId = createRequestId()
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Login required.', requestId)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || (profile as { role?: string } | null)?.role !== 'admin') {
      return errorResponse(403, 'FORBIDDEN', 'Admin required.', requestId)
    }

    // 30일 윈도우로 충분한 표본 확보
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const enrichedExperiments = await Promise.all(
      AB_EXPERIMENTS.map(async (e) => {
        const { data, error } = await supabase
          .from('llm_performance_logs')
          .select('model_id, is_success, latency_ms')
          .eq('context', e.context)
          .gte('created_at', sinceIso)
          .limit(10000)

        // 마이그레이션 미적용 / 쿼리 실패 시 빈 결과로 안전 처리
        const rows: PerfRow[] = error ? [] : ((data ?? []) as PerfRow[])

        const results = e.variants.map((v) => {
          const matched = rows.filter((r) => r.model_id === v.modelId)
          const calls = matched.length
          const failures = matched.filter((r) => !r.is_success).length
          const latencyAvg =
            calls > 0
              ? Math.round(
                  matched.reduce((s, r) => s + r.latency_ms, 0) / calls
                )
              : 0
          return {
            modelId: v.modelId,
            weight: v.weight,
            calls,
            failures,
            successRate: calls > 0 ? (calls - failures) / calls : 0,
            avgLatencyMs: latencyAvg,
          }
        })

        return {
          context: e.context,
          enabled: e.enabled,
          variants: e.variants,
          results,
        }
      })
    )

    return NextResponse.json({
      success: true,
      experiments: enrichedExperiments,
      requestId,
    })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'llm-experiments',
      severity: 'error',
      source: 'GET /api/admin/llm-experiments',
      operation: 'unhandled',
      requestId,
      message: 'Unhandled error',
      error,
    })
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal error.', requestId)
  }
}
