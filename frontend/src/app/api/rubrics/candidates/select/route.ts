// =============================================================================
// PRISM Writer - Rubric Candidates Selection API
// =============================================================================
// 파일: frontend/src/app/api/rubrics/candidates/select/route.ts
// 역할: 루브릭 후보 채택/거부 API
// 생성일: 2026-01-03
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// [PATTERN] POST: 루브릭 후보 채택 (status = 'selected')
// =============================================================================

export const dynamic = 'force-dynamic'

// =============================================================================
// [P2-01] 루브릭 개수 제한 상수
// - MAX_SELECT_COUNT: 하드 리밋 (절대 초과 불가)
// - RECOMMENDED_COUNT: 권장 개수 (Soft Limit - 초과 시 경고)
// =============================================================================
/** 최대 선택 가능 개수 (하드 리밋) */
const MAX_SELECT_COUNT = 20
/** 권장 선택 개수 (Soft Limit) */
const RECOMMENDED_COUNT = 12

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. 요청 파싱
    const body = await req.json()
    const { candidateIds, action = 'select' } = body

    // [SAFETY] candidateIds 검증
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'candidateIds array is required' },
        { status: 400 }
      )
    }

    // [SAFETY] 최대 개수 제한
    if (candidateIds.length > MAX_SELECT_COUNT) {
      return NextResponse.json(
        { error: `Maximum ${MAX_SELECT_COUNT} candidates can be selected at once` },
        { status: 400 }
      )
    }

    // 3. 액션에 따른 상태 결정 (select/reject/reset)
    let newStatus: 'selected' | 'rejected' | 'draft'
    if (action === 'reject') {
      newStatus = 'rejected'
    } else if (action === 'reset') {
      newStatus = 'draft'
    } else {
      newStatus = 'selected'
    }

    // 4. 소유권 확인 및 상태 업데이트
    const { data: updatedData, error: updateError } = await supabase
      .from('rag_rule_candidates')
      .update({ status: newStatus })
      .in('id', candidateIds)
      .eq('user_id', user.id) // 소유권 확인
      .select('id')

    if (updateError) {
      console.error('[RubricCandidates] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update candidates', details: updateError.message },
        { status: 500 }
      )
    }

    const updatedCount = updatedData?.length || 0

    console.log(`[RubricCandidates] ${action}: ${updatedCount} candidates -> ${newStatus}`)

    // =========================================================================
    // [P2-02] 권장 초과 경고 정보 계산
    // - action이 'select'인 경우에만 현재 선택된 총 개수 조회
    // - 권장 개수(12개) 초과 시 exceedsRecommended = true
    // =========================================================================
    let totalSelected = 0
    let exceedsRecommended = false

    if (action === 'select') {
      const { count } = await supabase
        .from('rag_rule_candidates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'selected')

      totalSelected = count ?? 0
      exceedsRecommended = totalSelected > RECOMMENDED_COUNT
    }

    // =========================================================================
    // [P2-02] 응답 - 권장 초과 정보 포함
    // =========================================================================
    return NextResponse.json({
      success: true,
      action,
      status: newStatus,
      updated: updatedCount,
      requested: candidateIds.length,
      // [P2-02] 권장 초과 정보 (하위 호환성 유지 - 새 필드 추가)
      totalSelected,
      exceedsRecommended,
      recommendedCount: RECOMMENDED_COUNT,
      message: exceedsRecommended
        ? `⚠️ 선택된 기준이 ${totalSelected}개입니다. ${RECOMMENDED_COUNT}개 이하 권장.`
        : `Successfully ${action}ed ${updatedCount} candidates`
    })

  } catch (error) {
    console.error('[RubricCandidates] Selection Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// =============================================================================
// [PATTERN] DELETE: 루브릭 후보 삭제
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. 요청 파싱
    const body = await req.json()
    const { candidateIds } = body

    // [SAFETY] candidateIds 검증
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'candidateIds array is required' },
        { status: 400 }
      )
    }

    // 3. 소유권 확인 및 삭제
    const { data: deletedData, error: deleteError } = await supabase
      .from('rag_rule_candidates')
      .delete()
      .in('id', candidateIds)
      .eq('user_id', user.id) // 소유권 확인
      .select('id')

    if (deleteError) {
      console.error('[RubricCandidates] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete candidates', details: deleteError.message },
        { status: 500 }
      )
    }

    const deletedCount = deletedData?.length || 0

    console.log(`[RubricCandidates] Deleted ${deletedCount} candidates`)

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Successfully deleted ${deletedCount} candidates`
    })

  } catch (error) {
    console.error('[RubricCandidates] Delete Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}
