// =============================================================================
// PRISM Writer - Rubric Candidates Reset API
// =============================================================================
// 파일: frontend/src/app/api/rubrics/candidates/reset/route.ts
// 역할: 프로젝트의 모든 루브릭 후보 상태를 초기화 (draft로 변경)
// 생성일: 2026-01-03
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // 3. 소유권 확인 및 전체 업데이트
    // 해당 프로젝트의 모든 후보를 'draft'로 변경 (삭제된 것은 제외하려면 deleted_at 체크 필요하지만 현재는 hard delete 아님)
    const { data: updatedData, error: updateError } = await supabase
      .from('rag_rule_candidates')
      .update({ status: 'draft' })
      .eq('project_id', projectId)
      .eq('user_id', user.id) // 소유권 확인
      .in('status', ['selected', 'rejected']) // selected나 rejected인 것만 대상
      .select('id')

    if (updateError) {
      console.error('[RubricReset] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset candidates', details: updateError.message },
        { status: 500 }
      )
    }

    const count = updatedData?.length || 0
    console.log(`[RubricReset] Reset ${count} candidates to draft for project ${projectId}`)

    return NextResponse.json({
      success: true,
      resetCount: count,
      message: `Successfully reset ${count} candidates to draft`
    })

  } catch (error) {
    console.error('[RubricReset] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}
