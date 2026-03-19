// =============================================================================
// Phase A Track 1: P1-04 - Version Detail & Restore API
// =============================================================================
// 파일: frontend/src/app/api/documents/versions/[id]/route.ts
// 역할: 단일 버전 상세 조회 (content 포함) + 버전 복원
// 생성일: 2026-03-19
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createVersion } from '@/lib/services/versionService'

// =============================================================================
// GET: 단일 버전 상세 조회 (content 포함)
// =============================================================================
// URL: /api/documents/versions/[id]
// =============================================================================
export async function GET(
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
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 버전 ID 추출
    // -------------------------------------------------------------------------
    const { id: versionId } = await params

    if (!versionId) {
      return NextResponse.json(
        { error: 'Bad request', message: '버전 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 버전 상세 조회 (content 포함)
    // -------------------------------------------------------------------------
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('[Versions API] GET detail error:', error)
      return NextResponse.json(
        { error: 'Database error', message: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Not found', message: '버전을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      version: data,
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
// POST: 버전 복원 (Restore)
// =============================================================================
// URL: POST /api/documents/versions/[id]
// 동작:
//   1. 현재 문서 상태를 자동 스냅샷으로 저장 (복원 전 백업)
//   2. 선택한 버전의 content/title로 문서 업데이트
// =============================================================================
export async function POST(
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
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 복원할 버전 조회
    // -------------------------------------------------------------------------
    const { id: versionId } = await params

    const { data: version, error: versionError } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (versionError) {
      console.error('[Versions API] Restore - version fetch error:', versionError)
      return NextResponse.json(
        { error: 'Database error', message: versionError.message },
        { status: 500 }
      )
    }

    if (!version) {
      return NextResponse.json(
        { error: 'Not found', message: '복원할 버전을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 현재 문서 상태 조회 (복원 전 백업용)
    // -------------------------------------------------------------------------
    const { data: currentDoc, error: docError } = await supabase
      .from('user_documents')
      .select('id, title, content')
      .eq('id', version.document_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (docError) {
      console.error('[Versions API] Restore - document fetch error:', docError)
      return NextResponse.json(
        { error: 'Database error', message: docError.message },
        { status: 500 }
      )
    }

    if (!currentDoc) {
      return NextResponse.json(
        { error: 'Not found', message: '원본 문서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 현재 상태를 자동 스냅샷으로 저장 (복원 전 백업)
    // -------------------------------------------------------------------------
    try {
      await createVersion(supabase, {
        documentId: currentDoc.id,
        userId: user.id,
        title: currentDoc.title || '',
        content: currentDoc.content || '',
        snapshotType: 'auto',
      })
      console.log('[Versions API] Pre-restore snapshot created')
    } catch (snapshotError) {
      // 스냅샷 실패해도 복원은 계속 진행 (fail-safe)
      console.warn('[Versions API] Pre-restore snapshot failed, continuing:', snapshotError)
    }

    // -------------------------------------------------------------------------
    // 5. 문서를 선택한 버전으로 복원
    // -------------------------------------------------------------------------
    const { data: updatedDoc, error: updateError } = await supabase
      .from('user_documents')
      .update({
        title: version.title,
        content: version.content,
      })
      .eq('id', version.document_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select('id, title, updated_at')
      .maybeSingle()

    if (updateError) {
      console.error('[Versions API] Restore - update error:', updateError)
      return NextResponse.json(
        { error: 'Database error', message: updateError.message },
        { status: 500 }
      )
    }

    if (!updatedDoc) {
      return NextResponse.json(
        { error: 'Not found', message: '문서 업데이트에 실패했습니다.' },
        { status: 404 }
      )
    }

    console.log('[Versions API] Document restored:', {
      documentId: version.document_id,
      restoredFromVersion: version.version_number,
    })

    return NextResponse.json({
      success: true,
      document: updatedDoc,
      restoredFromVersion: version.version_number,
      message: `버전 ${version.version_number}으로 복원되었습니다.`,
    })
  } catch (err) {
    console.error('[Versions API] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
