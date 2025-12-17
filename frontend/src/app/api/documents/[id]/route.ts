// =============================================================================
// PRISM Writer - Document Delete API
// =============================================================================
// 파일: frontend/src/app/api/documents/[id]/route.ts
// 역할: 특정 문서 삭제
// 메서드: DELETE
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// 타입 정의
// =============================================================================

interface DeleteResponse {
  success: boolean
  message: string
  error?: string
}

// =============================================================================
// DELETE: 문서 삭제
// =============================================================================

/**
 * 문서 삭제 API
 * 
 * @param request - Next.js request object
 * @param params - Route parameters with document ID
 * @returns JSON response with deletion status
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<DeleteResponse>> {
  try {
    const documentId = params.id

    // ---------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // ---------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // ---------------------------------------------------------------------------
    // 2. 문서 조회 및 소유권 확인
    // ---------------------------------------------------------------------------
    const { data: document, error: fetchError } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !document) {
      return NextResponse.json(
        {
          success: false,
          message: '문서를 찾을 수 없거나 접근 권한이 없습니다.',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // ---------------------------------------------------------------------------
    // 3. Storage에서 파일 삭제
    // ---------------------------------------------------------------------------
    const { error: storageError } = await supabase.storage
      .from('rag-documents')
      .remove([document.file_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // 스토리지 삭제 실패는 경고만 하고 계속 진행 (DB 레코드는 삭제)
    }

    // ---------------------------------------------------------------------------
    // 4. 데이터베이스에서 문서 삭제
    // ---------------------------------------------------------------------------
    const { error: deleteError } = await supabase
      .from('rag_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Database deletion error:', deleteError)
      return NextResponse.json(
        {
          success: false,
          message: '문서 삭제 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 5. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: '문서가 성공적으로 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error in delete API:', error)
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    )
  }
}
