
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = createClient()

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
