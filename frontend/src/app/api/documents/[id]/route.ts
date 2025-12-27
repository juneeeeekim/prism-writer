// =============================================================================
// Phase 11: Document Detail & Delete API
// =============================================================================
// 파일: frontend/src/app/api/documents/[id]/route.ts
// 역할: 문서 상세 조회 및 삭제 (user_documents 테이블)
// 수정일: 2025-12-28
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { UserDocument } from '@/types/document'

// =============================================================================
// GET: 문서 상세 조회 (P2-03)
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = session.user

    // -------------------------------------------------------------------------
    // 2. 문서 조회
    // -------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('user_documents')
      .select('id, title, content, created_at, updated_at')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      console.error('[DocumentGet] Query error:', error)
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data as UserDocument)
  } catch (error) {
    console.error('[DocumentGet] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE: 문서 삭제 (P2-04)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id

    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = session.user

    // -------------------------------------------------------------------------
    // 2. 문서 삭제
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id)

    if (error) {
      console.error('[DocumentDelete] Delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DocumentDelete] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
