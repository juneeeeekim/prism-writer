// =============================================================================
// Phase 11: Document Save API
// =============================================================================
// 파일: frontend/src/app/api/documents/save/route.ts
// 역할: 문서 저장 (INSERT/UPDATE)
// 생성일: 2025-12-28
// [P7-FIX] projectId 저장 추가
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SaveDocumentRequest, SaveDocumentResponse } from '@/types/document'

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()  // [FIX] getSession -> getUser
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 요청 본문 파싱
    // [P7-FIX] projectId 추출
    // -------------------------------------------------------------------------
    const body = await req.json()
    const { id, title, content, projectId } = body as SaveDocumentRequest & { projectId?: string }

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
        .eq('user_id', user.id)
        .is('deleted_at', null)  // [FIX] 휴지통에 있는 문서는 업데이트 불가
        .select('id, title, updated_at')
        .maybeSingle()  // [FIX] single() → maybeSingle()로 변경하여 PGRST116 방지

      if (error) {
        console.error('[DocumentSave] Update error:', error)
        return NextResponse.json(
          { error: 'Failed to update document' },
          { status: 500 }
        )
      }

      // [FIX] 문서를 찾지 못한 경우 404 반환
      if (!data) {
        console.warn('[DocumentSave] Document not found:', id)
        return NextResponse.json(
          { error: 'Document not found or you do not have permission to edit it' },
          { status: 404 }
        )
      }

      return NextResponse.json(data as SaveDocumentResponse)
    } else {
      // INSERT 새 문서
      // [P7-FIX] projectId 포함하여 저장
      const insertData: {
        user_id: string
        title: string
        content: string
        source: string  // [FIX] 에디터 저장 구분
        project_id?: string
      } = {
        user_id: user.id,
        title: title || '제목 없음',
        content: content || '',
        source: 'editor'  // [FIX] 참고자료(upload)와 구분하기 위해 editor로 설정
      }

      // [P7-FIX] projectId가 있으면 추가
      if (projectId) {
        insertData.project_id = projectId
      }

      const { data, error } = await supabase
        .from('user_documents')
        .insert(insertData)
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
