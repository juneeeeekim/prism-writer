// =============================================================================
// Phase 13: Document Reorder API
// =============================================================================
// 파일: frontend/src/app/api/documents/reorder/route.ts
// 역할: 문서 순서 일괄 변경 (Batch Update)
// 생성일: 2025-12-28
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReorderRequest } from '@/types/document'

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // -------------------------------------------------------------------------
    // 2. 요청 본문 파싱
    // -------------------------------------------------------------------------
    const body: ReorderRequest = await req.json()
    const { documents } = body

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents provided' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. Batch Update (Upsert 사용)
    // Supabase(PostgreSQL)에서는 upsert를 사용하여 일괄 업데이트 가능
    // 단, 보안상 user_id 확인이 필요하므로 RPC를 사용하거나 반복문 사용
    // 여기서는 안전하게 Promise.all + update 호출 (건수가 적으므로)
    // -------------------------------------------------------------------------
    
    const updatePromises = documents.map(doc => 
      supabase
        .from('user_documents')
        .update({ sort_order: doc.sort_order })
        .eq('id', doc.id)
        .eq('user_id', session.user.id) // RLS: 본인 문서만 수정 가능
    )

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DocumentReorder] Update error:', error)
    return NextResponse.json(
      { error: 'Failed to reorder documents' },
      { status: 500 }
    )
  }
}
