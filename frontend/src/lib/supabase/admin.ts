import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // throw new Error('Supabase URL or Service Role Key is missing')
  console.warn('Supabase URL or Service Role Key is missing. Admin features may not work.')
}

/**
 * 관리자 권한을 가진 Supabase 클라이언트 생성
 * - RLS를 우회합니다.
 * - auth.admin API에 접근 가능합니다.
 * - API Route에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
