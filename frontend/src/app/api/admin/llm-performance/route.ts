// =============================================================================
// PRISM Writer - LLM Performance Logs Query API (Phase 4 완전 적용)
// =============================================================================
// 파일: frontend/src/app/api/admin/llm-performance/route.ts
// 역할: llm_performance_logs 테이블의 원시 로그를 페이지 단위로 조회한다.
//       비용 집계는 /api/admin/llm-costs가 담당하고, 본 API는 raw 행 자체.
// API 계약:
//   GET /api/admin/llm-performance?
//     context=...&modelId=...&isSuccess=true|false&limit=1..200(default 50)
//     인증: Supabase auth + role=admin
//     응답: { success, logs: PerfRow[], partial?, degradedReason?, requestId }
// 외부 의존성: Supabase. 마이그레이션 미적용 시 빈 응답 + degraded 표시.
// 설계 의도(왜 이 구조인가):
//   - 디버깅/감사 목적이므로 원시 컬럼을 그대로 반환하되 RLS는 admin으로 제한.
//   - 인덱스(context/model_id/created_at)와 일치하는 필터만 노출하여 성능 보장.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  return `perf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
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

export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams
    const context = sp.get('context') || undefined
    const modelId = sp.get('modelId') || undefined
    const isSuccessParam = sp.get('isSuccess')
    const limitParam = sp.get('limit')

    const limit = limitParam === null ? 50 : Number(limitParam)
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return errorResponse(
        400,
        'BAD_REQUEST',
        'limit must be 1..200.',
        requestId
      )
    }

    let query = supabase
      .from('llm_performance_logs')
      .select(
        'id, context, model_id, used_fallback, latency_ms, input_tokens, output_tokens, is_success, error_type, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (context) query = query.eq('context', context)
    if (modelId) query = query.eq('model_id', modelId)
    if (isSuccessParam === 'true') query = query.eq('is_success', true)
    if (isSuccessParam === 'false') query = query.eq('is_success', false)

    const { data, error: queryError } = await query

    if (queryError) {
      const msg = (queryError.message || '').toLowerCase()
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          logs: [],
          partial: true,
          degradedReason: 'TABLE_NOT_MIGRATED',
          requestId,
        })
      }
      await writeErrorLog({
        category: 'db',
        domain: 'llm-performance-logs',
        severity: 'error',
        source: 'GET /api/admin/llm-performance',
        operation: 'select',
        requestId,
        userId: user.id,
        message: 'Failed to query',
        error: queryError,
      })
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to query.', requestId)
    }

    return NextResponse.json({
      success: true,
      logs: data ?? [],
      requestId,
    })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'llm-performance',
      severity: 'error',
      source: 'GET /api/admin/llm-performance',
      operation: 'unhandled',
      requestId,
      message: 'Unhandled error',
      error,
    })
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal error.', requestId)
  }
}
