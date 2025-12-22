// =============================================================================
// PRISM Writer - Document Upload API Route
// =============================================================================
// 파일: frontend/src/app/api/documents/upload/route.ts
// 역할: 문서 파일 업로드 및 메타데이터 저장
// 메서드: POST
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// 상수 정의
// =============================================================================

/** 허용되는 파일 타입 및 MIME 타입 매핑 */
const ALLOWED_FILE_TYPES = {
  'application/pdf': { ext: 'pdf', name: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', name: 'Word' },
  'text/plain': { ext: 'txt', name: 'Text' },
  'text/markdown': { ext: 'md', name: 'Markdown' },
} as const

/** 최대 파일 크기 (50MB - Supabase Free Plan 최대치) */
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB in bytes

/** Supabase Storage 버킷 이름 */
const STORAGE_BUCKET = 'rag-documents'

// =============================================================================
// 타입 정의
// =============================================================================

interface UploadResponse {
  success: boolean
  documentId?: string
  message: string
  error?: string
}

// =============================================================================
// POST: 문서 업로드 핸들러
// =============================================================================

/**
 * 문서 파일 업로드 API
 * 
 * @param request - FormData with 'file' field
 * @returns JSON response with upload status
 * 
 * @example
 * ```typescript
 * const formData = new FormData()
 * formData.append('file', file)
 * 
 * const response = await fetch('/api/documents/upload', {
 *   method: 'POST',
 *   body: formData
 * })
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
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
    // 2. FormData에서 파일 추출
    // ---------------------------------------------------------------------------
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: '파일이 제공되지 않았습니다.',
          error: 'NO_FILE',
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------------------
    // 3. 파일 크기 검증 (10MB 제한)
    // ---------------------------------------------------------------------------
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / (1024 * 1024)}MB까지 업로드 가능합니다.`,
          error: 'FILE_TOO_LARGE',
        },
        { status: 413 }
      )
    }

    // ---------------------------------------------------------------------------
    // 4. 파일 타입 검증 (PDF, DOCX, TXT, MD만 허용)
    // ---------------------------------------------------------------------------
    const fileType = file.type
    if (!(fileType in ALLOWED_FILE_TYPES)) {
      const allowedTypes = Object.values(ALLOWED_FILE_TYPES)
        .map((t) => t.name)
        .join(', ')

      return NextResponse.json(
        {
          success: false,
          message: `지원되지 않는 파일 형식입니다. 허용된 형식: ${allowedTypes}`,
          error: 'UNSUPPORTED_FILE_TYPE',
        },
        { status: 415 }
      )
    }

    // ---------------------------------------------------------------------------
    // 5. 파일명 생성 (타임스탬프 + 원본 파일명)
    // ---------------------------------------------------------------------------
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${timestamp}_${sanitizedFileName}`
    const filePath = `${userId}/${fileName}`

    // ---------------------------------------------------------------------------
    // 6. Supabase Storage에 파일 업로드
    // ---------------------------------------------------------------------------
    const fileBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        {
          success: false,
          message: '파일 업로드 중 오류가 발생했습니다.',
          error: 'STORAGE_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 7. 데이터베이스에 메타데이터 저장
    // ---------------------------------------------------------------------------
    const { data: documentData, error: dbError } = await supabase
      .from('rag_documents')
      .insert({
        user_id: userId,
        title: file.name,
        file_path: uploadData.path,
        file_type: fileType,
        file_size: file.size,
        status: 'pending',
        metadata: {
          original_name: file.name,
          uploaded_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (dbError) {
      // 데이터베이스 저장 실패 시 Storage에서 파일 삭제 (롤백)
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath])

      console.error('Database insert error:', dbError)
      return NextResponse.json(
        {
          success: false,
          message: '메타데이터 저장 중 오류가 발생했습니다.',
          error: 'DATABASE_ERROR',
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------------------------
    // 8. 자동 청킹 + 임베딩 트리거 (Phase 3-4)
    // ---------------------------------------------------------------------------
    // 비동기로 문서 처리 시작 (업로드 응답을 블로킹하지 않음 -> Vercel 타임아웃 방지를 위해 await로 변경)
    const { triggerDocumentProcessing } = await import('@/lib/rag/documentProcessor')
    await triggerDocumentProcessing(documentData.id, uploadData.path, userId)

    // ---------------------------------------------------------------------------
    // 9. 성공 응답
    // ---------------------------------------------------------------------------
    return NextResponse.json(
      {
        success: true,
        documentId: documentData.id,
        message: '파일이 성공적으로 업로드되었습니다.',
      },
      { status: 201 }
    )
  } catch (error) {
    // ---------------------------------------------------------------------------
    // 예상치 못한 오류 처리
    // ---------------------------------------------------------------------------
    console.error('Unexpected error in upload API:', error)
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
