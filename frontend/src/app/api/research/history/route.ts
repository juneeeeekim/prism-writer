// =============================================================================
// Search History Sync: 검색 기록 API
// =============================================================================
// 파일: frontend/src/app/api/research/history/route.ts
// 역할: 검색 히스토리 CRUD API (GET/POST/DELETE)
// 생성일: 2026-01-17
// 
// [Search History Sync]
// 주석(시니어 개발자): Deep Scholar 검색 기록을 서버 DB에 저장/조회/삭제하는
// API 엔드포인트입니다. RLS가 적용되어 본인 기록만 접근 가능합니다.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// Types
// =============================================================================

interface SearchHistoryItem {
  id: string
  query: string
  result_count: number
  results_summary: { title: string; url: string; keyFact: string }[] | null
  created_at: string
}

interface PostRequestBody {
  projectId: string
  query: string
  results: { title?: string; url?: string; keyFact?: string }[]
  resultCount: number
}

// =============================================================================
// [P2-01] GET: 히스토리 목록 조회
// =============================================================================

export async function GET(request: NextRequest) {
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
    // 2. Query Parameters 파싱
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // [Search History Sync] projectId 필수 검증
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. DB 조회 (최신순 정렬, RLS 자동 적용)
    // -------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('search_histories')
      .select('id, query, result_count, results_summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[SearchHistoryAPI] GET error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch history' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      histories: data as SearchHistoryItem[],
    })

  } catch (error) {
    console.error('[SearchHistoryAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// [P2-02] POST: 검색 기록 저장
// =============================================================================

export async function POST(request: NextRequest) {
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
    // 2. Request Body 파싱
    // -------------------------------------------------------------------------
    const body: PostRequestBody = await request.json()
    const { projectId, query, results, resultCount } = body

    // [Search History Sync] 필수 필드 검증
    if (!projectId || !query) {
      return NextResponse.json(
        { success: false, error: 'projectId and query are required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 결과 경량화 (10개 제한, 문자열 길이 제한)
    // [Search History Sync] JSONB 크기 관리
    // -------------------------------------------------------------------------
    const summary = (results || []).slice(0, 10).map((r) => ({
      title: r.title?.substring(0, 200) || '',
      url: r.url || '',
      keyFact: r.keyFact?.substring(0, 500) || '',
    }))

    // -------------------------------------------------------------------------
    // 4. DB Insert
    // -------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('search_histories')
      .insert({
        user_id: user.id,
        project_id: projectId,
        query,
        results_summary: summary,
        result_count: resultCount || 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[SearchHistoryAPI] POST error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save history' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 5. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      id: data.id,
    })

  } catch (error) {
    console.error('[SearchHistoryAPI] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// [P2-04] DELETE: 프로젝트 전체 기록 삭제
// =============================================================================

export async function DELETE(request: NextRequest) {
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
    // 2. Request Body 파싱
    // -------------------------------------------------------------------------
    const body = await request.json()
    const { projectId } = body

    // [Search History Sync] projectId 필수 검증
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId is required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. DB Delete (RLS가 본인 기록만 삭제 허용)
    // -------------------------------------------------------------------------
    const { error } = await supabase
      .from('search_histories')
      .delete()
      .eq('project_id', projectId)

    if (error) {
      console.error('[SearchHistoryAPI] DELETE error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete history' },
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
