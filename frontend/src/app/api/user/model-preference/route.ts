// =============================================================================
// PRISM Writer - User Model Preference API (Phase 5)
// =============================================================================
// 파일: frontend/src/app/api/user/model-preference/route.ts
// 역할: 사용자(주로 Premium tier)가 선호 모델을 저장/조회한다.
// API 계약:
//   GET /api/user/model-preference
//     인증: Supabase auth 필수 (401 UNAUTHORIZED)
//     응답(200): { success: true, preferredModel: string | null }
//   PUT /api/user/model-preference
//     인증: Supabase auth 필수 (401 UNAUTHORIZED)
//     권한: tier >= 1 (Premium 이상)  → 403 FORBIDDEN 시 사유 명시
//     본문: { preferredModel: string | null }
//     응답(200): { success: true, preferredModel: string | null }
// 에러 코드: UNAUTHORIZED | FORBIDDEN | BAD_REQUEST | INTERNAL_ERROR
// 외부 의존성: Supabase Postgres. 장애 시 본 API는 5xx로 자연 응답하며,
//   호출자에서 사용자에게 일반 메시지를 노출하면 됨. error-log/api/* 기록.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidModelId } from '@/config/models'
import { writeErrorLog } from '@/lib/error-log'
import { createRequestId, errorResponse } from '@/lib/api/error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 주석(API/Integration): 허용된 모델 ID는 DB CHECK 제약과 동일해야 한다.
// 한쪽만 변경하면 INSERT가 거부되므로 주석으로 동기화 의무를 명시한다.
const ALLOWED_PREFERRED_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemma-3-27b-it',
  'gpt-5-mini',
  'gpt-5.2-2025-12-11',
  'claude-sonnet-4-5-20250929',
] as const

// -----------------------------------------------------------------------------
// GET: 현재 선호 모델 조회
// -----------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  const requestId = createRequestId('mpref')
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
      .select('preferred_model')
      .eq('id', user.id)
      .single()

    if (profileError) {
      await writeErrorLog({
        category: 'db',
        domain: 'profiles',
        severity: 'error',
        source: 'GET /api/user/model-preference',
        operation: 'select',
        requestId,
        userId: user.id,
        message: 'Failed to read preferred_model',
        error: profileError,
      })
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'Failed to read preference.',
        requestId
      )
    }

    return NextResponse.json({
      success: true,
      preferredModel: profile?.preferred_model ?? null,
      allowedModels: ALLOWED_PREFERRED_MODELS,
      requestId,
    })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'user-model-preference',
      severity: 'error',
      source: 'GET /api/user/model-preference',
      operation: 'unhandled',
      requestId,
      message: 'Unhandled error',
      error,
    })
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal error.', requestId)
  }
}

// -----------------------------------------------------------------------------
// PUT: 선호 모델 저장
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  const requestId = createRequestId('mpref')
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Login is required.', requestId)
    }

    // 본문 파싱
    let body: { preferredModel?: unknown }
    try {
      body = await request.json()
    } catch {
      return errorResponse(400, 'BAD_REQUEST', 'Invalid JSON body.', requestId)
    }

    const raw = body.preferredModel
    const preferredModel = raw === null ? null : typeof raw === 'string' ? raw : undefined

    if (preferredModel === undefined) {
      return errorResponse(
        400,
        'BAD_REQUEST',
        'preferredModel must be string or null.',
        requestId
      )
    }

    // 모델 ID 화이트리스트 검증 (DB CHECK 제약과 동기화)
    if (
      preferredModel !== null &&
      !ALLOWED_PREFERRED_MODELS.includes(preferredModel as never)
    ) {
      return errorResponse(
        400,
        'BAD_REQUEST',
        'preferredModel is not in the allowed list.',
        requestId
      )
    }

    if (preferredModel !== null && !isValidModelId(preferredModel)) {
      // ALLOWED 목록에는 있지만 코드 등록(MODEL_REGISTRY)에 누락된 경우의
      // 안전망. 거의 일어나지 않지만 DB 제약 통과 후 런타임 호출에서 실패하는
      // 시나리오를 사전 차단한다.
      return errorResponse(
        400,
        'BAD_REQUEST',
        'preferredModel is not registered in MODEL_REGISTRY.',
        requestId
      )
    }

    // tier 권한 검증 (Premium 이상)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    if (profileError) {
      await writeErrorLog({
        category: 'db',
        domain: 'profiles',
        severity: 'error',
        source: 'PUT /api/user/model-preference',
        operation: 'select-tier',
        requestId,
        userId: user.id,
        message: 'Failed to read tier for preference update',
        error: profileError,
      })
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'Failed to verify permission.',
        requestId
      )
    }

    const tier = (profile as { tier?: number } | null)?.tier ?? 0
    if (tier < 1) {
      return errorResponse(
        403,
        'FORBIDDEN',
        'Premium tier is required to set preferred model.',
        requestId
      )
    }

    // UPDATE
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ preferred_model: preferredModel })
      .eq('id', user.id)

    if (updateError) {
      await writeErrorLog({
        category: 'db',
        domain: 'profiles',
        severity: 'error',
        source: 'PUT /api/user/model-preference',
        operation: 'update',
        requestId,
        userId: user.id,
        message: 'Failed to update preferred_model',
        error: updateError,
        metadata: { preferredModel },
      })
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'Failed to update preference.',
        requestId
      )
    }

    return NextResponse.json({ success: true, preferredModel, requestId })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'user-model-preference',
      severity: 'error',
      source: 'PUT /api/user/model-preference',
      operation: 'unhandled',
      requestId,
      message: 'Unhandled error',
      error,
    })
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal error.', requestId)
  }
}
