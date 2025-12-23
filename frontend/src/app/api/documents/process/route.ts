// =============================================================================
// PRISM Writer - Document Process API Route
// =============================================================================
// 파일: frontend/src/app/api/documents/process/route.ts
// 역할: 문서 처리(청킹, 임베딩)를 트리거하고 완료될 때까지 대기 (Vercel Timeout 방지)
// 메서드: POST
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/rag/documentProcessor'
import { DocumentStatus } from '@/types/rag'

export async function POST(request: NextRequest): Promise<NextResponse> {
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
        { success: false, message: '로그인이 필요합니다.', error: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // ---------------------------------------------------------------------------
    // 2. Request Body 검증
    // ---------------------------------------------------------------------------
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json(
        { success: false, message: '문서 ID가 필요합니다.', error: 'BAD_REQUEST' },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------------------
    // 3. 문서 정보 조회 및 소유권 검증 (Security: IDOR 방지)
    // ---------------------------------------------------------------------------
    const { data: documentData, error: dbError } = await supabase
      .from('rag_documents')
      .select('id, file_path, status, user_id')
      .eq('id', documentId)
      .eq('user_id', userId) // 본인 소유 확인
      .single()

    if (dbError || !documentData) {
      console.error('Document lookup error:', dbError)
      return NextResponse.json(
        { success: false, message: '문서를 찾을 수 없거나 접근 권한이 없습니다.', error: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. 중복 처리 방지 (Idempotency)
    // ---------------------------------------------------------------------------
    // 이미 완료되었거나 처리 중인 경우 (단, 실패한 경우는 재시도 허용)
    if (
      documentData.status === DocumentStatus.COMPLETED ||
      documentData.status === DocumentStatus.PARSING ||
      documentData.status === DocumentStatus.CHUNKING ||
      documentData.status === DocumentStatus.EMBEDDING
    ) {
      // 이미 처리 중이거나 완료된 경우 성공으로 간주하고 리턴
      return NextResponse.json({
        success: true,
        message: '문서가 이미 처리되었거나 처리 중입니다.',
        status: documentData.status
      })
    }

    // ---------------------------------------------------------------------------
    // 5. 문서 처리 실행 (Await to keep Vercel alive)
    // ---------------------------------------------------------------------------
    // Vercel Serverless Function은 응답을 보내면 실행을 멈출 수 있으므로,
    // 처리가 완료될 때까지(또는 에러가 날 때까지) 기다립니다.
    
    // TODO: Vercel Pro(60s) vs Hobby(10s) 제한 고려.
    // 긴 문서의 경우 10초를 넘길 수 있으므로, 추후에는 QStash 등을 도입해야 함.
    // 현재는 "Client-Triggered" 방식으로 클라이언트가 연결을 유지하는 동안 최대한 처리.
    
    const result = await processDocument(documentId, documentData.file_path, userId)

    if (!result.success) {
      throw new Error(result.error || '문서 처리 실패')
    }

    // ---------------------------------------------------------------------------
    // 6. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: '문서 처리가 완료되었습니다.',
      result
    })

  } catch (error) {
    console.error('Process API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: '문서 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    )
  }
}
