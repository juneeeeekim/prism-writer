// 디렉토리 경로: frontend/src/lib/api/
// 파일명: adminAuth.ts
// 파일 코드의 역할/설명: 서버 API 라우트에서 Supabase 세션과 관리자 권한을 공통으로 검증한다.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type AdminAuthResult =
  | {
      ok: true
      supabase: ServerSupabaseClient
      userId: string
    }
  | {
      ok: false
      response: NextResponse
    }

export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
  }
}
