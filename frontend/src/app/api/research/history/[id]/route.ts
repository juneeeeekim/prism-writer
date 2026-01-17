// =============================================================================
// Search History Sync: 개별 기록 삭제 API
// =============================================================================
// 파일: frontend/src/app/api/research/history/[id]/route.ts
// 역할: 특정 검색 기록 삭제 API
// 생성일: 2026-01-17
// 
// [Search History Sync]
// 주석(시니어 개발자): 개별 검색 기록을 ID로 삭제하는 엔드포인트입니다.
// RLS가 적용되어 본인 기록만 삭제 가능합니다.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// [P2-03] DELETE: 개별 기록 삭제
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. URL 파라미터에서 ID 추출
    // -------------------------------------------------------------------------
    const { id: historyId } = await params

    if (!historyId) {
      return NextResponse.json(
        { success: false, error: 'History ID is required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. DB Delete (RLS가 본인 기록만 삭제 허용)
    // [Search History Sync] RLS 정책으로 타인 기록 삭제 방지됨
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('search_histories')
      .delete()
      .eq('id', historyId)

    if (error) {
      console.error('[SearchHistoryAPI] DELETE [id] error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete history item' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
    })

  } catch (error) {
    console.error('[SearchHistoryAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
