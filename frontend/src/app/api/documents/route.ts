// =============================================================================
// PRISM Writer - Documents API (GET)
// =============================================================================
// 파일: frontend/src/app/api/documents/route.ts
// 역할: 사용자의 문서 목록 조회
// 메서드: GET
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DocumentStatus } from '@/types/rag'

// =============================================================================
// 타입 정의
// =============================================================================

interface Document {
  id: string
  title: string
  file_path: string
  file_type: string
  file_size: number
  status: DocumentStatus
  error_message?: string
  created_at: string
  updated_at: string
}

interface GetDocumentsResponse {
  success: boolean
  documents?: Document[]
  message?: string
  error?: string
}

// =============================================================================
// GET: 문서 목록 조회
// =============================================================================

/**
 * 사용자의 문서 목록 조회 API
 * 
 * @query projectId - 필터링할 프로젝트 ID (선택, 없으면 전체 문서)
 * @returns JSON response with documents array
 */
export async function GET(request: Request): Promise<NextResponse<GetDocumentsResponse>> {
  try {
    // ---------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // ---------------------------------------------------------------------------
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    const userId = user.id

    // ---------------------------------------------------------------------------
    // [P5-04-A] 2. 쿼리 파라미터에서 projectId 추출
    // ---------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // ---------------------------------------------------------------------------
    // 3. 데이터베이스에서 문서 목록 조회
    // ---------------------------------------------------------------------------
    let query = supabase
      .from('user_documents')
      .select('id, title, file_path, file_type, file_size, status, error_message, created_at, updated_at, project_id')
      .eq('user_id', userId)
      .is('deleted_at', null) // [P7-FIX] 휴지통에 있는 문서 제외 (보안/정합성)
    
    // [P5-04-A] projectId가 있으면 해당 프로젝트의 문서만 조회
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    
    const { data: documents, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        {
          success: false,
          message: '문서 목록을 불러오는 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 3. 성공 응답
    // ---------------------------------------------------------------------------
    // DB에서 가져온 데이터의 status가 Enum과 일치한다고 가정 (마이그레이션으로 보장)
    const typedDocuments = documents as unknown as Document[]

    return NextResponse.json({
      success: true,
      documents: typedDocuments || [],
    })
  } catch (error) {
    console.error('Unexpected error in documents API:', error)
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

/**
 * 문서 삭제 API
 * 
 * @param request - URL with query param ?id={documentId}
 * @returns JSON response
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    // 1. 사용자 인증 확인
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.', error: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // 2. Query Parameter에서 ID 추출
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { success: false, message: '문서 ID가 필요합니다.', error: 'BAD_REQUEST' },
        { status: 400 }
      )
    }

    // 3. DB에서 문서 삭제 (Cascade 설정으로 인해 chunks도 자동 삭제됨)
    // 본인 소유의 문서인지 확인하는 조건(eq('user_id', ...)) 필수
    const { error } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database delete error:', error)
      return NextResponse.json(
        { success: false, message: '문서 삭제 중 오류가 발생했습니다.', error: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    // 4. (Optional) Storage에서 파일 삭제 로직 추가 가능
    // 현재는 DB 삭제만으로 프로세스 중단(Processor가 DB 체크 시 실패) 및 목록 제거 효과 있음.

    return NextResponse.json({
      success: true,
      message: '문서가 삭제되었습니다.',
    })
  } catch (error) {
    console.error('Unexpected error in delete document API:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.', error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    )
  }
}
