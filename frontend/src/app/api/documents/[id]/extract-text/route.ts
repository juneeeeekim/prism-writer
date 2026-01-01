// =============================================================================
// [P10-OCR-03] 문서 텍스트 추출 API
// =============================================================================
// 파일: frontend/src/app/api/documents/[id]/extract-text/route.ts
// 역할: 스캔 PDF/이미지에서 텍스트 추출 (OCR 또는 Vision)
// 메서드: POST
// 생성일: 2026-01-01
// =============================================================================
//
// [사용법]
// POST /api/documents/{id}/extract-text
// Body: { method: 'ocr' | 'vision', options?: {...} }
//
// [추출 방법]
// - ocr: Tesseract.js 무료 OCR (오프라인, 느림)
// - vision: Gemini 1.5 Flash Vision (API 호출, 빠르고 정확)
//
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromImage } from '@/lib/ocr/tesseractOCR'
import { extractTextWithVision, isVisionAvailable } from '@/lib/ocr/geminiVision'

// =============================================================================
// 타입 정의
// =============================================================================

interface ExtractTextRequest {
  method: 'ocr' | 'vision'
  options?: {
    mode?: 'text-only' | 'structured' | 'detailed'
    languages?: string[]
  }
}

interface ExtractTextResponse {
  success: boolean
  text?: string
  confidence?: number
  tokensUsed?: number
  processingTime?: number
  message?: string
  error?: string
}

// =============================================================================
// POST: 텍스트 추출
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ExtractTextResponse>> {
  const startTime = Date.now()

  try {
    // -------------------------------------------------------------------------
    // 1. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. 요청 파라미터 파싱
    // -------------------------------------------------------------------------
    const { id: documentId } = await params

    let body: ExtractTextRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'BAD_REQUEST', message: '잘못된 요청 형식입니다.' },
        { status: 400 }
      )
    }

    const { method, options = {} } = body

    if (!method || !['ocr', 'vision'].includes(method)) {
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'method는 "ocr" 또는 "vision"이어야 합니다.',
        },
        { status: 400 }
      )
    }

    // Vision 사용 시 API 키 확인
    if (method === 'vision' && !isVisionAvailable()) {
      return NextResponse.json(
        {
          success: false,
          error: 'VISION_UNAVAILABLE',
          message: 'Vision 기능을 사용하려면 GOOGLE_API_KEY가 필요합니다.',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 문서 조회 및 소유권 확인
    // -------------------------------------------------------------------------
    const { data: document, error: docError } = await supabase
      .from('user_documents')
      .select('id, file_path, file_type, user_id, title')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: '문서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. Storage에서 파일 다운로드
    // -------------------------------------------------------------------------
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rag-documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { success: false, error: 'FILE_NOT_FOUND', message: '파일을 다운로드할 수 없습니다.' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 5. 파일 타입에 따른 처리
    // -------------------------------------------------------------------------
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileType = document.file_type || 'application/octet-stream'

    let extractedText = ''
    let confidence: number | undefined
    let tokensUsed: number | undefined

    // PDF인 경우 이미지로 변환 필요 (현재는 첫 페이지만 처리)
    // TODO: PDF를 이미지로 변환하는 로직 추가 (pdf-poppler 또는 pdfjs)
    if (fileType === 'application/pdf') {
      // 현재는 PDF 직접 처리 미지원 - 이미지 업로드 안내
      return NextResponse.json(
        {
          success: false,
          error: 'PDF_NOT_SUPPORTED',
          message:
            'PDF OCR은 현재 준비 중입니다. 스캔된 페이지를 이미지(PNG/JPG)로 저장하여 업로드해주세요.',
        },
        { status: 400 }
      )
    }

    // 이미지 파일 처리
    if (fileType.startsWith('image/')) {
      if (method === 'ocr') {
        // Tesseract.js OCR
        const result = await extractTextFromImage(buffer, {
          languages: options.languages,
        })

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: 'OCR_FAILED', message: result.error },
            { status: 500 }
          )
        }

        extractedText = result.text
        confidence = result.confidence
      } else {
        // Gemini Vision
        const result = await extractTextWithVision(buffer, fileType, {
          mode: options.mode,
        })

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: 'VISION_FAILED', message: result.error },
            { status: 500 }
          )
        }

        extractedText = result.text
        tokensUsed = result.tokensUsed
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'UNSUPPORTED_TYPE',
          message: '지원되지 않는 파일 형식입니다. 이미지 파일(PNG, JPG)을 사용해주세요.',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 6. 추출된 텍스트로 문서 업데이트 (선택적)
    // -------------------------------------------------------------------------
    // 추출된 텍스트는 반환만 하고, 사용자가 확인 후 처리할 수 있도록 함
    // 자동 업데이트가 필요하면 아래 주석 해제
    /*
    await supabase
      .from('user_documents')
      .update({
        content: extractedText,
        metadata: {
          ...document.metadata,
          extraction_method: method,
          extraction_time: new Date().toISOString(),
        },
      })
      .eq('id', documentId)
    */

    // -------------------------------------------------------------------------
    // 7. 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      text: extractedText,
      confidence,
      tokensUsed,
      processingTime: Date.now() - startTime,
      message: `${method === 'ocr' ? 'OCR' : 'Vision'}으로 텍스트를 추출했습니다.`,
    })
  } catch (error) {
    console.error('[Extract API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: '텍스트 추출 중 오류가 발생했습니다.',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// Next.js 설정
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
