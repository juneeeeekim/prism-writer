// =============================================================================
// PRISM Writer - AI Structurer API - Apply Structure Order
// =============================================================================
// 파일: frontend/src/app/api/rag/structure/apply/route.ts
// 역할: AI Structurer가 제안한 순서를 일괄 적용
// 메서드: POST
// Pipeline: AI Structurer (P3-02)
// 생성일: 2026-01-08
//
// [시니어 개발자 주석]
// - 기존 api/documents/reorder와 별도 API (인터페이스 다름)
// - 기존 API: { documents: [{ id, sort_order }] } - 클라이언트가 순서 계산
// - 이 API: { projectId, orderedDocIds: [id, ...] } - 서버가 순서 자동 계산
// - 083 격리 정책 준수: projectId 필수, 소유권 검증 필수
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// [P3-02] 타입 정의
// =============================================================================

/**
 * 요청 바디 인터페이스
 */
interface ApplyOrderRequest {
  /** 프로젝트 ID (필수) - 083 격리 정책 */
  projectId: string
  /** 문서 ID 배열 (순서대로) - [첫번째, 두번째, ...] */
  orderedDocIds: string[]
}

/**
 * 응답 인터페이스
 */
interface ApplyOrderResponse {
  /** 성공 여부 */
  success: boolean
  /** 업데이트된 문서 수 */
  updatedCount?: number
  /** 메시지 */
  message?: string
  /** 에러 코드 */
  error?: string
}

// =============================================================================
// [P3-02] POST: 순서 적용 API
// =============================================================================

/**
 * AI Structurer가 제안한 순서를 문서에 일괄 적용합니다.
 *
 * @description
 * [시니어 개발자 주석]
 * 1. 인증 확인
 * 2. projectId 필수 검증 (083 격리 정책)
 * 3. 프로젝트 소유권 검증
 * 4. 문서 ID 유효성 검증 (해당 프로젝트 소속인지)
 * 5. Batch Update로 sort_order 일괄 변경
 *
 * @param request - Next.js 요청 객체
 * @returns JSON 응답
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApplyOrderResponse>> {
  try {
    // -------------------------------------------------------------------------
    // [P3-02-00] Feature Flag 체크
    // -------------------------------------------------------------------------
    if (!FEATURE_FLAGS.ENABLE_AI_STRUCTURER) {
      return NextResponse.json(
        {
          success: false,
          message: 'AI Structurer 기능이 비활성화되어 있습니다.',
          error: 'FEATURE_DISABLED',
        },
        { status: 403 }
      )
    }

    // -------------------------------------------------------------------------
    // [P3-02-01] 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // [P3-02-02] 요청 바디 파싱 및 검증
    // -------------------------------------------------------------------------
    const body: ApplyOrderRequest = await request.json()
    const { projectId, orderedDocIds } = body

    // projectId 필수 (083 격리 정책)
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: 'projectId는 필수입니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // orderedDocIds 유효성 검사
    if (!Array.isArray(orderedDocIds) || orderedDocIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'orderedDocIds는 비어있지 않은 배열이어야 합니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // [P3-02-03] 프로젝트 소유권 검증 (Strict Isolation)
    // -------------------------------------------------------------------------
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      console.warn(
        '[StructureApply] 프로젝트 접근 거부:',
        projectId,
        user.id
      )
      return NextResponse.json(
        {
          success: false,
          message: '해당 프로젝트에 접근할 수 없습니다.',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      )
    }

    // -------------------------------------------------------------------------
    // [P3-02-04] 문서 ID 유효성 검증 (해당 프로젝트 소속인지)
    // -------------------------------------------------------------------------
    const { data: existingDocs, error: docsError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('project_id', projectId)
      .in('id', orderedDocIds)

    if (docsError) {
      console.error('[StructureApply] 문서 조회 실패:', docsError.message)
      return NextResponse.json(
        {
          success: false,
          message: '문서 조회 중 오류가 발생했습니다.',
          error: 'INTERNAL_ERROR',
        },
        { status: 500 }
      )
    }

    // 요청된 문서 ID 중 유효한 것만 필터링
    const validDocIds = new Set(existingDocs?.map((d) => d.id) || [])
    const validOrderedDocIds = orderedDocIds.filter((id) => validDocIds.has(id))

    if (validOrderedDocIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '유효한 문서 ID가 없습니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // [P3-02-05] Batch Update - sort_order 일괄 변경
    // -------------------------------------------------------------------------
    const updatePromises = validOrderedDocIds.map((docId, index) =>
      supabase
        .from('user_documents')
        .update({ sort_order: index + 1 }) // 1-based index
        .eq('id', docId)
        .eq('project_id', projectId) // 추가 안전 검증
    )

    const results = await Promise.all(updatePromises)

    // 에러 체크
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      console.error('[StructureApply] 일부 업데이트 실패:', errors)
      // 부분 성공도 허용
    }

    const successCount = results.filter((r) => !r.error).length

    // -------------------------------------------------------------------------
    // [P3-02-06] 응답 반환
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      updatedCount: successCount,
      message: `${successCount}/${validOrderedDocIds.length}개 문서 순서 업데이트 완료`,
    })
  } catch (error) {
    // -------------------------------------------------------------------------
    // [P3-02-99] 전역 에러 핸들링
    // -------------------------------------------------------------------------
    console.error('[StructureApply] 예상치 못한 오류:', error)

    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
