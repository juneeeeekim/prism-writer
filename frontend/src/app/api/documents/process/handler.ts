// 디렉토리 경로: frontend/src/app/api/documents/process/
// 파일명: handler.ts
// 파일 코드의 역할/설명: 문서 처리 API의 검증, idempotency claim, 안전한 응답 생성을 담당한다.

import { createClient } from '@/lib/supabase/server'
import { processDocument } from '@/lib/rag/documentProcessor'
import { DocumentStatus } from '@/types/rag'
import { NextRequest, NextResponse } from 'next/server'

type ProcessResponse = {
  success: boolean
  message: string
  error?: string
  requestId: string
  status?: string
  result?: unknown
}

type ProcessRouteDeps = {
  createClient: typeof createClient
  processDocument: typeof processDocument
}

const ACTIVE_OR_DONE_STATUSES = new Set<string>([
  DocumentStatus.COMPLETED,
  DocumentStatus.PARSING,
  DocumentStatus.CHUNKING,
  DocumentStatus.EMBEDDING,
])

const CLAIMABLE_STATUSES = [
  DocumentStatus.PENDING,
  DocumentStatus.QUEUED,
  DocumentStatus.FAILED,
] as const

function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  )
}

function jsonResponse(
  body: ProcessResponse,
  init: { status?: number } = {}
): NextResponse<ProcessResponse> {
  return NextResponse.json(body, {
    status: init.status,
    headers: {
      'x-request-id': body.requestId,
    },
  })
}

function errorResponse(
  requestId: string,
  status: number,
  error: string,
  message: string
): NextResponse<ProcessResponse> {
  return jsonResponse(
    {
      success: false,
      message,
      error,
      requestId,
    },
    { status }
  )
}

function getDocumentId(body: unknown): string {
  if (!body || typeof body !== 'object' || !('documentId' in body)) {
    return ''
  }

  const value = (body as { documentId?: unknown }).documentId
  return typeof value === 'string' ? value.trim() : ''
}

export async function handleProcessDocument(
  request: NextRequest,
  deps: ProcessRouteDeps = { createClient, processDocument }
): Promise<NextResponse<ProcessResponse>> {
  const requestId = getRequestId(request)

  try {
    const supabase = await deps.createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(requestId, 401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse(requestId, 400, 'BAD_REQUEST', '잘못된 JSON 요청입니다.')
    }

    const documentId = getDocumentId(body)
    if (!documentId) {
      return errorResponse(requestId, 400, 'BAD_REQUEST', '문서 ID가 필요합니다.')
    }

    const { data: documentData, error: lookupError } = await supabase
      .from('user_documents')
      .select('id, file_path, file_type, status, user_id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError || !documentData) {
      if (lookupError) {
        console.error('[DocumentsProcessAPI] lookup failed', {
          requestId,
          documentId,
          error: lookupError,
        })
      }

      return errorResponse(
        requestId,
        404,
        'NOT_FOUND',
        '문서를 찾을 수 없거나 접근 권한이 없습니다.'
      )
    }

    if (ACTIVE_OR_DONE_STATUSES.has(documentData.status)) {
      return jsonResponse({
        success: true,
        message: '문서가 이미 처리되었거나 처리 중입니다.',
        requestId,
        status: documentData.status,
      })
    }

    if (!CLAIMABLE_STATUSES.includes(documentData.status as (typeof CLAIMABLE_STATUSES)[number])) {
      return errorResponse(
        requestId,
        409,
        'DOCUMENT_NOT_PROCESSABLE',
        '현재 문서 상태에서는 처리를 시작할 수 없습니다.'
      )
    }

    const { data: claimedDocument, error: claimError } = await supabase
      .from('user_documents')
      .update({
        status: DocumentStatus.PARSING,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', documentId)
      .eq('user_id', user.id)
      .in('status', [...CLAIMABLE_STATUSES])
      .select('id, file_path, file_type, status, user_id')
      .maybeSingle()

    if (claimError) {
      console.error('[DocumentsProcessAPI] claim failed', {
        requestId,
        documentId,
        error: claimError,
      })

      return errorResponse(
        requestId,
        500,
        'DATABASE_ERROR',
        '문서 처리 준비 중 오류가 발생했습니다.'
      )
    }

    if (!claimedDocument) {
      return jsonResponse({
        success: true,
        message: '문서 처리 요청이 이미 접수되었습니다.',
        requestId,
        status: DocumentStatus.PARSING,
      })
    }

    const result = await deps.processDocument(
      documentId,
      claimedDocument.file_path,
      user.id,
      claimedDocument.file_type
    )

    if (!result.success) {
      console.error('[DocumentsProcessAPI] processing failed', {
        requestId,
        documentId,
        errorCode: 'PROCESSING_FAILED',
      })

      return errorResponse(
        requestId,
        500,
        'PROCESSING_FAILED',
        '문서 처리 중 오류가 발생했습니다.'
      )
    }

    return jsonResponse({
      success: true,
      message: '문서 처리가 완료되었습니다.',
      requestId,
      result,
    })
  } catch (error) {
    console.error('[DocumentsProcessAPI] unexpected failure', {
      requestId,
      error,
    })

    return errorResponse(
      requestId,
      500,
      'INTERNAL_SERVER_ERROR',
      '문서 처리 중 오류가 발생했습니다.'
    )
  }
}
