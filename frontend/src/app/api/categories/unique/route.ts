import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// [FIX] Vercel Build Error: Dynamic server usage in static export
export const dynamic = 'force-dynamic'

// [REMOVED] RAFT constants
// import { RAFT_CATEGORIES } from '@/constants/raft'

// =============================================================================
// PRISM Writer - Unique Category Fetch API
// =============================================================================
// 파일: frontend/src/app/api/categories/unique/route.ts
// 역할: user_documents 테이블의 유니크 카테고리 목록을 조회하여 반환
// 보안: SKIP_RAFT_AUTH 환경변수 또는 Admin 권한 체크
// =============================================================================

export async function GET() {
  try {
    // -------------------------------------------------------------------------
    // 1. 보안 및 권한 체크
    // -------------------------------------------------------------------------
    // 개발 모드에서 인증 우회 허용
    const isDevMode = process.env.SKIP_RAFT_AUTH === 'true'
    const supabase = await createClient()

    if (!isDevMode) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      // 로그인하지 않았거나 에러가 있는 경우
      if (authError || !user) {
        return NextResponse.json(
          { message: 'Unauthorized access', error: 'User not authenticated' },
          { status: 401 }
        )
      }

      // TODO: 실제 운영 환경에서는 Admin Role 체크 로직 추가 권장
      // if (user.role !== 'admin') { ... }
    }

    // ---------------------------------------------------------------------------
    // 2. DB에서 유니크 카테고리 조회
    // ---------------------------------------------------------------------------
    // [Phase P1-01] user_documents 테이블에서 category 컬럼만 가져옴
    const { data: documents, error: dbError } = await supabase
      .from('user_documents')
      .select('category')
      .not('category', 'is', null) // NULL 제외

    if (dbError) {
      console.error('[API/categories/unique] DB Error:', dbError)
      // DB 에러 시 500을 띄우기보다, 기본 카테고리만이라도 반환하여 UI 보호 (Graceful Degradation)
      // 하지만 개발자가 인지할 수 있도록 에러 로그는 남김
    }

    // -------------------------------------------------------------------------
    // 3. 데이터 정제 및 병합
    // -------------------------------------------------------------------------
    const dbCategories = documents?.map(d => d.category?.trim()) || []
    
    // 고정 카테고리 + DB 카테고리 병합 및 중복 제거
    // [FIX] RAFT 제거됨 -> DB에 있는 카테고리만 사용 (없으면 기본값 General)
    const uniqueCategoriesSet = new Set([
      'General', // Default Fallback
      ...dbCategories
    ])

    // 빈 문자열 제거 및 정렬 (가나다 순)
    const sortedCategories = Array.from(uniqueCategoriesSet)
      .filter(c => c && c.length > 0)
      .sort((a, b) => a.localeCompare(b, 'ko'))

    // -------------------------------------------------------------------------
    // 4. 응답 반환
    // -------------------------------------------------------------------------
    return NextResponse.json(sortedCategories)

  } catch (error: any) {
    console.error('[API/categories/unique] Unexpected Error:', error)
    // 치명적 오류 시 기본 카테고리 반환
    // 치명적 오류 시 기본 카테고리 반환
    return NextResponse.json(['General'])
  }
}
