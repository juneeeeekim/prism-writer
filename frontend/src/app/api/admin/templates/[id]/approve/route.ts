
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// [P4-05-02] Adaptive Threshold - 학습 이벤트 지원
import { applyLearningEvent } from '@/lib/rag/projectPreferences'

/**
 * POST /api/admin/templates/[id]/approve
 * 역할: 관리자가 템플릿을 승인합니다.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()

    // 1. 관리자 권한 확인
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ success: false, message: '관리자 권한이 없습니다.' }, { status: 403 })
    }

    // =========================================================================
    // [P4-05-02] 템플릿 소유자 및 프로젝트 정보 조회 (학습 이벤트용)
    // =========================================================================
    const { data: templateData } = await supabase
      .from('rag_templates')
      .select('user_id, project_id, name')
      .eq('id', id)
      .single()

    // 2. 템플릿 상태 업데이트
    const { error: updateError } = await supabase
      .from('rag_templates')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: session.user.id,
        rejection_reason: null
      })
      .eq('id', id)

    if (updateError) {
      throw updateError
    }

    // =========================================================================
    // [P4-05-02] 학습 이벤트 발생 - rubric_adopt
    // =========================================================================
    // 템플릿이 승인되면 해당 소유자에게 학습 이벤트 적용
    if (templateData?.user_id && templateData?.project_id) {
      try {
        await applyLearningEvent(
          supabase,
          templateData.user_id,
          templateData.project_id,
          'rubric_adopt',
          {
            templateId: id,
            templateName: templateData.name,
            approvedBy: session.user.id,
          }
        )
        console.log('[Admin Approve API] P4: Learning event applied for rubric_adopt')
      } catch (learningError) {
        // 학습 이벤트 실패는 승인 처리에 영향 없음 (fail-safe)
        console.warn('[Admin Approve API] P4: Learning event failed, continuing:', learningError)
      }
    }

    return NextResponse.json({
      success: true,
      message: '템플릿이 승인되었습니다.'
    })

  } catch (error: any) {
    console.error('[Admin Approve API] Error:', error)
    return NextResponse.json({
      success: false,
      message: '승인 처리 중 오류가 발생했습니다.',
      error: error.message
    }, { status: 500 })
  }
}
