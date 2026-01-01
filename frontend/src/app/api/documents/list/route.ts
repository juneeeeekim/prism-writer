// =============================================================================
// Phase 11: Document List API
// =============================================================================
// 파일: frontend/src/app/api/documents/list/route.ts
// 역할: 문서 목록 조회 (페이지네이션)
// 생성일: 2025-12-28
// [P7-FIX] projectId 필터링 추가
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DocumentListResponse } from '@/types/document'

export async function GET(req: NextRequest) {
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
    
    const user = session.user

    // -------------------------------------------------------------------------
    // 2. 페이지네이션 파라미터 + [P7-FIX] projectId 추출
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
    const offset = (page - 1) * limit
    const projectId = searchParams.get('projectId')  // [P7-FIX]

    // -------------------------------------------------------------------------
    // 3. 문서 목록 조회 (미리보기 100자)
    // [P7-FIX] projectId가 있으면 해당 프로젝트의 문서만 조회
    // -------------------------------------------------------------------------
    let query = supabase
      .from('user_documents')
      .select('id, title, content, category, sort_order, updated_at', { count: 'exact' }) // Phase 13: sort_order 추가
      .eq('user_id', user.id)

    // [P7-FIX] projectId 필터링
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: documents, error: listError, count } = await query
      .order('sort_order', { ascending: true }) // Phase 13: 정렬 우선순위 1
      .order('updated_at', { ascending: false }) // Phase 13: 정렬 우선순위 2
      .range(offset, offset + limit - 1)

    if (listError) {
      console.error('[DocumentList] Query error:', listError)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // 미리보기 생성 (content 100자 제한)
    const documentsWithPreview = (documents || []).map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : ''),
      category: doc.category ?? '미분류',  // JeDebug: null 안전 처리
      sort_order: doc.sort_order ?? 0,    // Phase 13: sort_order 추가
      updated_at: doc.updated_at
    }))

    const response: DocumentListResponse = {
      documents: documentsWithPreview,
      total: count || 0,
      page,
      limit
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[DocumentList] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
