// =============================================================================
// Phase 11: Document Save API
// =============================================================================
// 파일: frontend/src/app/api/documents/save/route.ts
// 역할: 문서 저장 (INSERT/UPDATE)
// 생성일: 2025-12-28
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SaveDocumentRequest, SaveDocumentResponse } from '@/types/document'

export async function POST(req: NextRequest) {
  try {
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
    // 2. 요청 본문 파싱
    // -------------------------------------------------------------------------
    const body: SaveDocumentRequest = await req.json()
    const { id, title, content } = body

    if (!title && !content) {
      return NextResponse.json(
        { error: 'Title or content is required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. UPSERT: id 있으면 UPDATE, 없으면 INSERT
    // -------------------------------------------------------------------------
    if (id) {
      // UPDATE 기존 문서
      const { data, error } = await supabase
        .from('user_documents')
        .update({ title, content })
        .eq('id', id)
        .eq('user_id', user.id) // RLS 방어 + 명시적 확인
        .select('id, title, updated_at')
        .single()

      if (error) {
        console.error('[DocumentSave] Update error:', error)
        return NextResponse.json(
          { error: 'Failed to update document' },
          { status: 500 }
        )
      }

      return NextResponse.json(data as SaveDocumentResponse)
    } else {
      // INSERT 새 문서
      const { data, error } = await supabase
        .from('user_documents')
        .insert({
          user_id: user.id,
          title: title || '제목 없음',
          content: content || ''
        })
        .select('id, title, updated_at')
        .single()

      if (error) {
        console.error('[DocumentSave] Insert error:', error)
        return NextResponse.json(
          { error: 'Failed to create document' },
          { status: 500 }
        )
      }

      return NextResponse.json(data as SaveDocumentResponse)
    }
  } catch (error) {
    console.error('[DocumentSave] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
