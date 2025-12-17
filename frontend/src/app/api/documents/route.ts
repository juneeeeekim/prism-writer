// =============================================================================
// PRISM Writer - Documents API (GET)
// =============================================================================
// 파일: frontend/src/app/api/documents/route.ts
// 역할: 사용자의 문서 목록 조회
// 메서드: GET
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// =============================================================================
// 타입 정의
// =============================================================================

interface Document {
  id: string
  title: string
  file_path: string
  file_type: string
  file_size: number
  status: 'pending' | 'processing' | 'ready' | 'error'
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
 * @returns JSON response with documents array
 */
export async function GET(): Promise<NextResponse<GetDocumentsResponse>> {
  try {
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
    // 2. 데이터베이스에서 문서 목록 조회
    // ---------------------------------------------------------------------------
    const { data: documents, error } = await supabase
      .from('rag_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

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
    return NextResponse.json({
      success: true,
      documents: documents || [],
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
