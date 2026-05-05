// =============================================================================
// PRISM Writer - LLM Costs Aggregation API (Phase 6)
// =============================================================================
// 파일: frontend/src/app/api/admin/llm-costs/route.ts
// 역할: llm_performance_logs를 모델/컨텍스트/기간별로 집계해 비용 정보를
//       관리자에게 제공한다.
// API 계약:
//   GET /api/admin/llm-costs?range=day|week|month
//     인증: Supabase auth + role=admin (401/403)
//     응답(200): { success, range, totals, byModel, byContext, byDay, requestId }
// 외부 의존성: Supabase Postgres (RLS: admin SELECT). 5xx 시 사용자에게 일반
//   메시지 노출.
// 설계 의도(왜 이 구조인가):
//   - 비용 집계는 클라이언트가 아닌 서버에서 수행해야 RLS와 캐시 무결성을
//     동시에 보장할 수 있다.
//   - 토큰 데이터가 비어 있을 때(로깅 누락)도 NaN/throw가 아닌 0으로 안전
//     처리하여 대시보드 안정성을 우선한다.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateCallCost } from '@/lib/llm/cost-calculator'
import { writeErrorLog } from '@/lib/error-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ErrorBody {
  success: false
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'BAD_REQUEST' | 'INTERNAL_ERROR'
    message: string
    requestId: string
  }
}

function createRequestId(): string {
  return `costs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
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

function rangeToSinceIso(range: string): string {
  const now = Date.now()
  const days = range === 'month' ? 30 : range === 'week' ? 7 : 1
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

interface PerfRow {
  context: string
  model_id: string
  used_fallback: boolean
  latency_ms: number
  input_tokens: number | null
  output_tokens: number | null
  is_success: boolean
  error_type: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Login is required.', requestId)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || (profile as { role?: string } | null)?.role !== 'admin') {
      return errorResponse(403, 'FORBIDDEN', 'Admin access required.', requestId)
    }

    const range = request.nextUrl.searchParams.get('range') || 'week'
    if (!['day', 'week', 'month'].includes(range)) {
      return errorResponse(
        400,
        'BAD_REQUEST',
        'range must be day | week | month.',
        requestId
      )
    }
    const sinceIso = rangeToSinceIso(range)

    const { data, error: queryError } = await supabase
      .from('llm_performance_logs')
      .select(
        'context, model_id, used_fallback, latency_ms, input_tokens, output_tokens, is_success, error_type, created_at'
      )
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (queryError) {
      // 마이그레이션 미적용 환경에서는 테이블이 없을 수 있음 → 빈 응답으로 안전 처리
      const message = queryError.message || ''
      if (
        message.toLowerCase().includes('relation') &&
        message.toLowerCase().includes('does not exist')
      ) {
        return NextResponse.json({
          success: true,
          range,
          totals: { calls: 0, totalCostUsd: 0, failures: 0, fallbackUsed: 0 },
          byModel: [],
          byContext: [],
          byDay: [],
          partial: true,
          degradedReason: 'TABLE_NOT_MIGRATED',
          requestId,
        })
      }
      await writeErrorLog({
        category: 'db',
        domain: 'llm-performance-logs',
        severity: 'error',
        source: 'GET /api/admin/llm-costs',
        operation: 'select',
        requestId,
        userId: user.id,
        message: 'Failed to query llm_performance_logs',
        error: queryError,
      })
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to query.', requestId)
    }

    const rows: PerfRow[] = (data ?? []) as PerfRow[]

    // -----------------------------------------------------------------
    // 집계: 모델별 / 컨텍스트별 / 일자별
    // -----------------------------------------------------------------
    let totalCalls = 0
    let totalCostUsd = 0
    let totalFailures = 0
    let totalFallbackUsed = 0

    const byModel = new Map<
      string,
      { calls: number; costUsd: number; failures: number; latencySumMs: number }
    >()
    const byContext = new Map<
      string,
      { calls: number; costUsd: number; failures: number }
    >()
    const byDay = new Map<
      string,
      { calls: number; costUsd: number; failures: number }
    >()

    for (const r of rows) {
      totalCalls += 1
      if (!r.is_success) totalFailures += 1
      if (r.used_fallback) totalFallbackUsed += 1

      const cost = calculateCallCost(
        r.model_id,
        r.input_tokens ?? 0,
        r.output_tokens ?? 0
      )
      totalCostUsd += cost.totalCostUsd

      const m = byModel.get(r.model_id) ?? {
        calls: 0,
        costUsd: 0,
        failures: 0,
        latencySumMs: 0,
      }
      m.calls += 1
      m.costUsd += cost.totalCostUsd
      m.latencySumMs += r.latency_ms
      if (!r.is_success) m.failures += 1
      byModel.set(r.model_id, m)

      const c = byContext.get(r.context) ?? { calls: 0, costUsd: 0, failures: 0 }
      c.calls += 1
      c.costUsd += cost.totalCostUsd
      if (!r.is_success) c.failures += 1
      byContext.set(r.context, c)

      const day = r.created_at.slice(0, 10)
      const d = byDay.get(day) ?? { calls: 0, costUsd: 0, failures: 0 }
      d.calls += 1
      d.costUsd += cost.totalCostUsd
      if (!r.is_success) d.failures += 1
      byDay.set(day, d)
    }

    return NextResponse.json({
      success: true,
      range,
      totals: {
        calls: totalCalls,
        totalCostUsd,
        failures: totalFailures,
        fallbackUsed: totalFallbackUsed,
      },
      byModel: Array.from(byModel.entries())
        .map(([modelId, v]) => ({
          modelId,
          calls: v.calls,
          costUsd: v.costUsd,
          failures: v.failures,
          avgLatencyMs: v.calls > 0 ? Math.round(v.latencySumMs / v.calls) : 0,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      byContext: Array.from(byContext.entries())
        .map(([context, v]) => ({ context, ...v }))
        .sort((a, b) => b.calls - a.calls),
      byDay: Array.from(byDay.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      requestId,
    })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'llm-costs',
      severity: 'error',
      source: 'GET /api/admin/llm-costs',
      operation: 'unhandled',
      requestId,
      message: 'Unhandled error',
      error,
    })
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal error.', requestId)
  }
}
