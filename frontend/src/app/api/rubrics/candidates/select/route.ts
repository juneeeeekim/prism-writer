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

/** 최대 선택 가능 개수 */
const MAX_SELECT_COUNT = 20

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

    return NextResponse.json({
      success: true,
      action,
      status: newStatus,
      updated: updatedCount,
      requested: candidateIds.length,
      message: `Successfully ${action}ed ${updatedCount} candidates`
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
