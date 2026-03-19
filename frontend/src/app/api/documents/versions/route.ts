// =============================================================================
// Phase A Track 1: P1-03 - Version List API
// =============================================================================
// 파일: frontend/src/app/api/documents/versions/route.ts
// 역할: 문서 버전 목록 조회 (content 제외 — 성능 최적화)
// 생성일: 2026-03-19
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createVersion } from '@/lib/services/versionService'

// =============================================================================
// GET: 문서 버전 목록 조회
// =============================================================================
// URL: /api/documents/versions?documentId=xxx&limit=50
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
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 쿼리 파라미터 추출
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 50)

    if (!documentId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'documentId가 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 버전 목록 조회 (content 제외 — 성능 최적화)
    // -------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('document_versions')
      .select('id, document_id, user_id, title, version_number, content_hash, byte_size, snapshot_type, created_at')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .order('version_number', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Versions API] GET error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      versions: data || [],
      count: data?.length || 0,
    })
  } catch (err) {
    console.error('[Versions API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: 새 버전 스냅샷 생성
// =============================================================================
// Body: { documentId, title, content, snapshotType: 'auto' | 'manual' }
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
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 요청 바디 파싱
    // -------------------------------------------------------------------------
    const body = await request.json()
    const { documentId, title, content, snapshotType } = body

    if (!documentId || content === undefined) {
      return NextResponse.json(
        { error: 'Bad request', message: 'documentId와 content가 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 버전 생성
    // -------------------------------------------------------------------------
    const version = await createVersion(supabase, {
      documentId,
      userId: user.id,
      title: title || '',
      content: content || '',
      snapshotType: snapshotType || 'auto',
    })

    if (!version) {
      // 중복 해시 — 스킵됨 (정상 응답)
      return NextResponse.json({
        success: true,
        skipped: true,
        message: '동일한 내용이므로 스냅샷을 건너뛰었습니다.',
      })
    }

    return NextResponse.json({
      success: true,
      version,
    })
  } catch (err) {
    console.error('[Versions API] POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
