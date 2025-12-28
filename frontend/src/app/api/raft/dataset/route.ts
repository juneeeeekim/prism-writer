// =============================================================================
// PRISM Writer - RAFT Dataset API
// =============================================================================
// 파일: frontend/src/app/api/raft/dataset/route.ts
// 역할: RAFT 파인튜닝용 데이터셋 관리 API
// 생성일: 2025-12-27
// 
// [Risk 해결]
// - Risk 2: 피드백 → RAFT 변환 시 데이터 무결성 손실 방지
// - 필수 필드 검증 + 누락 시 400 에러 반환
// - Feature Flag 체크로 기능 비활성화 가능
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// 타입 정의
// =============================================================================

interface RAFTDatasetEntry {
  id?: string
  userQuery: string
  context: string
  goldAnswer: string
  badAnswer?: string
  source: 'synthetic' | 'user_feedback' | 'manual' | 'ab_test'
  verified?: boolean
  originalFeedbackId?: string
  modelId?: string
}

// =============================================================================
// Supabase 클라이언트 (Service Role)
// =============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// =============================================================================
// [Risk 9] 관리자 인증 검증
// =============================================================================

/**
 * API 접근 권한 검증
 * 
 * @description
 * - RAFT API는 관리자만 접근 가능
 * - Authorization 헤더에서 토큰 추출
 * - Supabase에서 사용자 정보 확인
 * 
 * @returns { authorized: boolean, userId?: string, error?: string }
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  authorized: boolean
  userId?: string
  error?: string
}> {
  try {
    // 1. Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('Authorization')
    
    // 개발 환경에서는 인증 생략 가능 (환경 변수로 제어)
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RAFT_AUTH === 'true') {
      console.log('[RAFT API] Auth skipped in development mode')
      return { authorized: true, userId: 'dev-admin' }
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, error: 'Authorization header missing' }
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    // 2. Supabase에서 사용자 정보 확인
    const supabase = getSupabaseAdmin()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { authorized: false, error: 'Invalid or expired token' }
    }
    
    // 3. 사용자 인증 성공 (추후 관리자 역할 검증 추가 가능)
    // TODO: user_roles 테이블에서 관리자 역할 확인
    console.log(`[RAFT API] Authorized user: ${user.id}`)
    
    return { authorized: true, userId: user.id }
    
  } catch (error: any) {
    console.error('[RAFT API] Auth error:', error)
    return { authorized: false, error: 'Authentication failed' }
  }
}

// =============================================================================
// GET: RAFT 데이터셋 조회
// =============================================================================

/**
 * RAFT 데이터셋 목록 조회
 * 
 * @query source - 필터: synthetic, user_feedback, manual, ab_test
 * @query verified - 필터: true, false
 * @query limit - 조회 개수 (기본 50, 최대 100)
 * @query offset - 오프셋 (페이지네이션)
 * 
 * @returns { data: [], count: number }
 */
export async function GET(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // [Risk 9] 관리자 인증 검증
  // ---------------------------------------------------------------------------
  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error || '인증이 필요합니다.' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const verified = searchParams.get('verified')
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = getSupabaseAdmin()

    // 기본 쿼리
    let query = supabase
      .from('raft_dataset')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 필터 적용
    if (source) {
      query = query.eq('source', source)
    }
    if (category && category !== 'ALL') { // [P3-02] 카테고리 필터
      query = query.eq('category', category)
    }
    if (verified !== null) {
      query = query.eq('verified', verified === 'true')
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[RAFT API] GET Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch RAFT dataset' },
        { status: 500 }
      )
    }

    console.log(`[RAFT API] GET: ${data?.length || 0} entries fetched`)

    return NextResponse.json({
      data: data || [],
      count: count || 0,
    })

  } catch (error: any) {
    console.error('[RAFT API] GET Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: RAFT 데이터셋에 추가
// =============================================================================

/**
 * RAFT 데이터셋에 새 항목 추가
 * 
 * @body userQuery - (필수) 사용자 질문
 * @body context - (필수) 참고 자료 내용
 * @body goldAnswer - (필수) 정답 (참고 자료 인용)
 * @body badAnswer - (선택) 오답 예시
 * @body source - (필수) 데이터 출처
 * @body originalFeedbackId - (선택) 원본 피드백 ID
 * @body modelId - (선택) 모델 ID
 * 
 * @returns { success: true, id: string }
 * 
 * [Risk 2 해결]
 * - 필수 필드 검증: userQuery, context, goldAnswer, source
 * - 누락 시 400 에러 + 상세 메시지 반환
 * - 중복 변환 체크: originalFeedbackId 기준
 */
export async function POST(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // [Risk 9] 관리자 인증 검증
  // ---------------------------------------------------------------------------
  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error || '인증이 필요합니다.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    // -------------------------------------------------------------------------
    // [Risk 2] 필수 필드 검증
    // -------------------------------------------------------------------------
    const requiredFields = ['userQuery', 'context', 'goldAnswer', 'source']
    const missingFields: string[] = []

    for (const field of requiredFields) {
      if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
        missingFields.push(field)
      }
    }

    if (missingFields.length > 0) {
      console.warn(`[RAFT API] POST: Missing required fields: ${missingFields.join(', ')}`)
      return NextResponse.json(
        { 
          error: 'Required fields missing',
          missingFields,
          message: `다음 필드가 필요합니다: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // source 값 검증
    // -------------------------------------------------------------------------
    const validSources = ['synthetic', 'user_feedback', 'manual', 'ab_test']
    if (!validSources.includes(body.source)) {
      return NextResponse.json(
        { 
          error: 'Invalid source value',
          validSources,
          message: `source는 다음 중 하나여야 합니다: ${validSources.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 데이터 길이 검증
    // -------------------------------------------------------------------------
    if (body.userQuery.length < 10) {
      return NextResponse.json(
        { error: 'userQuery must be at least 10 characters', message: 'userQuery는 최소 10자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    if (body.goldAnswer.length < 50) {
      return NextResponse.json(
        { error: 'goldAnswer must be at least 50 characters', message: 'goldAnswer는 최소 50자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // -------------------------------------------------------------------------
    // 중복 변환 체크 (originalFeedbackId 기준)
    // -------------------------------------------------------------------------
    if (body.originalFeedbackId) {
      const { data: existing } = await supabase
        .from('raft_dataset')
        .select('id')
        .eq('original_feedback_id', body.originalFeedbackId)
        .single()

      if (existing) {
        return NextResponse.json(
          { 
            error: 'Duplicate conversion',
            existingId: existing.id,
            message: '이 피드백은 이미 RAFT 데이터셋에 존재합니다.',
          },
          { status: 409 }
        )
      }
    }

    // -------------------------------------------------------------------------
    // 데이터 삽입
    // -------------------------------------------------------------------------
    const insertData = {
      user_query: body.userQuery,
      context: body.context,
      gold_answer: body.goldAnswer,
      bad_answer: body.badAnswer || null,
      source: body.source,
      verified: body.verified || false,
      original_feedback_id: body.originalFeedbackId || null,
      model_id: body.modelId || null,
    }

    const { data, error } = await supabase
      .from('raft_dataset')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[RAFT API] POST Insert Error:', error)
      return NextResponse.json(
        { error: 'Failed to insert RAFT data', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[RAFT API] POST: New entry created with id ${data.id}`)

    return NextResponse.json(
      { success: true, id: data.id },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('[RAFT API] POST Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE: RAFT 데이터셋에서 삭제
// =============================================================================

/**
 * RAFT 데이터셋에서 항목 삭제
 * 
 * @query id - 삭제할 항목 ID
 * 
 * @returns { success: true }
 */
export async function DELETE(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // [Risk 9] 관리자 인증 검증
  // ---------------------------------------------------------------------------
  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error || '인증이 필요합니다.' },
      { status: 403 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter', message: 'id 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // 존재 여부 확인
    const { data: existing } = await supabase
      .from('raft_dataset')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Entry not found', message: '해당 항목을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 삭제 실행
    const { error } = await supabase
      .from('raft_dataset')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[RAFT API] DELETE Error:', error)
      return NextResponse.json(
        { error: 'Failed to delete RAFT data', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[RAFT API] DELETE: Entry ${id} deleted`)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[RAFT API] DELETE Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// PATCH: RAFT 데이터셋 수정 (품질 평점 등)
// =============================================================================

/**
 * RAFT 데이터셋 항목 수정
 * 
 * @body id - 수정할 항목 ID
 * @body qualityScore - (선택) 품질 평점 (1~5)
 * 
 * @returns { success: true }
 */
export async function PATCH(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // [Risk 9] 관리자 인증 검증
  // ---------------------------------------------------------------------------
  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error || '인증이 필요합니다.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { id, qualityScore } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id', message: 'id 필드가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const updateData: any = {}

    // 품질 평점 업데이트
    if (qualityScore !== undefined) {
      const score = Number(qualityScore)
      if (isNaN(score) || score < 1 || score > 5) {
        return NextResponse.json(
          { error: 'Invalid quality_score', message: '평점은 1~5 사이의 숫자여야 합니다.' },
          { status: 400 }
        )
      }
      updateData.quality_score = score
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update', message: '수정할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    // 업데이트 실행
    const { error } = await supabase
      .from('raft_dataset')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('[RAFT API] PATCH Error:', error)
      return NextResponse.json(
        { error: 'Failed to update RAFT data', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[RAFT API] PATCH: Entry ${id} updated with ${JSON.stringify(updateData)}`)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[RAFT API] PATCH Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
