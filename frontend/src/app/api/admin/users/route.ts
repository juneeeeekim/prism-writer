import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// GET: 모든 사용자 목록 조회 (관리자 전용)
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    // 1. 요청자 인증 및 관리자 권한 확인
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 프로필에서 역할 확인
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // 2. 관리자 클라이언트로 모든 사용자 정보 가져오기
    const adminSupabase = createAdminClient()
    
    // Auth Users 가져오기 (이메일 정보 필요)
    const { data: { users }, error: authError } = await adminSupabase.auth.admin.listUsers()
    if (authError) throw authError

    // Profiles 가져오기 (역할, 승인상태, 사용량)
    const { data: profiles, error: profileError } = await adminSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (profileError) throw profileError

    // 3. 데이터 병합 (Profile + Email)
    const usersWithProfiles = profiles.map((profile) => {
      const authUser = users.find((u) => u.id === profile.id)
      return {
        ...profile,
        email: authUser?.email || 'N/A',
        last_sign_in_at: authUser?.last_sign_in_at,
      }
    })

    return NextResponse.json({ users: usersWithProfiles })

  } catch (error: any) {
    console.error('[AdminAPI] Failed to fetch users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================================================
// PATCH: 사용자 정보 수정 (권한, 승인)
// =============================================================================
export async function PATCH(req: NextRequest) {
  try {
    // 1. 요청자 인증 및 관리자 권한 확인
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (requesterProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 2. 업데이트 요청 데이터 파싱
    const body = await req.json()
    const { userId, role, isApproved } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // 3. 관리자 클라이언트로 업데이트 수행
    const adminSupabase = createAdminClient()
    
    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (isApproved !== undefined) {
      updateData.is_approved = isApproved
      if (isApproved) {
        updateData.approved_at = new Date().toISOString()
        updateData.approved_by = session.user.id
      }
    }

    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[AdminAPI] Update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
