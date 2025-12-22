// =============================================================================
// PRISM Writer - Document Processor
// =============================================================================
// 파일: frontend/src/lib/rag/documentProcessor.ts
// 역할: 업로드된 문서를 자동으로 처리 (청킹, 임베딩 등)
// =============================================================================

import { createClient } from '@/lib/supabase/client'
import { chunkDocument, type DocumentChunk } from './chunking'
import { embedBatch, estimateTokenCount, EMBEDDING_CONFIG } from './embedding'
import { validateDocumentSize, validateUsage, trackUsage } from './costGuard'

// =============================================================================
// 타입 정의
// =============================================================================

export interface ProcessDocumentOptions {
  /** 청크 크기 (토큰) */
  chunkSize?: number
  /** 오버랩 (토큰) */
  overlap?: number
  /** 마크다운 헤더 보존 */
  preserveHeaders?: boolean
}

export interface ProcessingResult {
  success: boolean
  documentId: string
  chunksCreated?: number
  embeddingsGenerated?: boolean
  tokensUsed?: number
  error?: string
}

type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 문서 상태 업데이트
 * 
 * @param documentId - 문서 ID
 * @param status - 새로운 상태
 * @param errorMessage - 에러 메시지 (옵션)
 */
async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  errorMessage?: string
): Promise<void> {
  const supabase = createClient()

  const updateData: {
    status: DocumentStatus
    updated_at: string
    metadata?: { error_message?: string }
  } = {
    status,
    updated_at: new Date().toISOString(),
  }

  // 에러 메시지가 있으면 metadata에 저장
  if (errorMessage) {
    updateData.metadata = { error_message: errorMessage }
  }

  const { error } = await supabase
    .from('rag_documents')
    .update(updateData)
    .eq('id', documentId)

  if (error) {
    console.error('Failed to update document status:', error)
    throw new Error(`문서 상태 업데이트 실패: ${error.message}`)
  }
}

/**
 * Storage에서 문서 내용 가져오기
 * 
 * @param filePath - Storage 파일 경로
 * @returns 문서 텍스트
 */
async function fetchDocumentContent(filePath: string): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from('rag-documents')
    .download(filePath)

  if (error) {
    throw new Error(`파일 다운로드 실패: ${error.message}`)
  }

  // Blob을 텍스트로 변환
  const text = await data.text()
  return text
}

/**
 * 청크를 데이터베이스에 저장 (임베딩 포함)
 * 
 * @param documentId - 문서 ID
 * @param chunks - 청크 배열
 * @param embeddings - 임베딩 벡터 배열 (옵션)
 */
async function saveChunks(
  documentId: string,
  chunks: DocumentChunk[],
  embeddings?: number[][]
): Promise<void> {
  const supabase = createClient()

  // ---------------------------------------------------------------------------
  // 청크 데이터 변환 (임베딩 버전 메타데이터 포함)
  // ---------------------------------------------------------------------------
  const chunksData = chunks.map((chunk, index) => ({
    document_id: documentId,
    chunk_index: chunk.index,
    content: chunk.content,
    embedding: embeddings ? embeddings[index] : null,
    metadata: chunk.metadata,
    // 임베딩 버전 관리 필드 (Phase 1 추가)
    embedding_model_id: EMBEDDING_CONFIG.modelId,
    embedding_dim: EMBEDDING_CONFIG.dimensions,
    embedded_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('rag_chunks')
    .insert(chunksData)

  if (error) {
    throw new Error(`청크 저장 실패: ${error.message}`)
  }
}

// =============================================================================
// Main Processing Function
// =============================================================================

/**
 * 문서 처리 (청킹 + 임베딩 생성)
 * 
 * @param documentId - 문서 ID
 * @param filePath - Storage 파일 경로
 * @param userId - 사용자 ID (비용 관리)
 * @param options - 처리 옵션
 * @returns 처리 결과
 * 
 * @example
 * ```typescript
 * const result = await processDocument(docId, filePath, userId, {
 *   chunkSize: 512,
 *   overlap: 50
 * })
 * 
 * if (result.success) {
 *   console.log(`Created ${result.chunksCreated} chunks`)
 * }
 * ```
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  userId: string,
  options: ProcessDocumentOptions = {}
): Promise<ProcessingResult> {
  try {
    // ---------------------------------------------------------------------------
    // 1. 상태를 'processing'으로 변경
    // ---------------------------------------------------------------------------
    await updateDocumentStatus(documentId, 'processing')

    // ---------------------------------------------------------------------------
    // 2. Storage에서 문서 내용 가져오기
    // ---------------------------------------------------------------------------
    const content = await fetchDocumentContent(filePath)

    if (!content || content.trim().length === 0) {
      throw new Error('문서 내용이 비어있습니다.')
    }

    // ---------------------------------------------------------------------------
    // 3. 문서 청킹
    // ---------------------------------------------------------------------------
    const chunks = chunkDocument(content, {
      chunkSize: options.chunkSize,
      overlap: options.overlap,
      preserveHeaders: options.preserveHeaders,
    })

    if (chunks.length === 0) {
      throw new Error('청크가 생성되지 않았습니다.')
    }

    // ---------------------------------------------------------------------------
    // 4. 사용량 검증 (Phase 4 비용 관리)
    // ---------------------------------------------------------------------------
    const totalTokens = chunks.reduce((sum, chunk) => {
      return sum + estimateTokenCount(chunk.content)
    }, 0)

    await validateDocumentSize(userId, totalTokens)
    await validateUsage(userId, totalTokens)

    // ---------------------------------------------------------------------------
    // 5. 임베딩 생성 (Phase 4)
    // ---------------------------------------------------------------------------
    let embeddings: number[][] | undefined
    let embeddingsGenerated = false

    try {
      const chunkTexts = chunks.map((chunk) => chunk.content)
      embeddings = await embedBatch(chunkTexts)
      embeddingsGenerated = true

      // 사용량 기록
      await trackUsage(userId, totalTokens, documentId)
    } catch (embeddingError) {
      console.error('Failed to generate embeddings:', embeddingError)
      // 임베딩 실패해도 청크는 저장 (임베딩 없이)
      embeddings = undefined
      embeddingsGenerated = false
    }

    // ---------------------------------------------------------------------------
    // 6. 청크 저장 (임베딩 포함)
    // ---------------------------------------------------------------------------
    await saveChunks(documentId, chunks, embeddings)

    // ---------------------------------------------------------------------------
    // 7. 상태를 'ready'로 변경
    // ---------------------------------------------------------------------------
    await updateDocumentStatus(documentId, 'ready')

    // ---------------------------------------------------------------------------
    // 8. 성공 결과 반환
    // ---------------------------------------------------------------------------
    return {
      success: true,
      documentId,
      chunksCreated: chunks.length,
      embeddingsGenerated,
      tokensUsed: embeddingsGenerated ? totalTokens : undefined,
    }
  } catch (error) {
    // ---------------------------------------------------------------------------
    // 에러 처리: 상태를 'error'로 변경
    // ---------------------------------------------------------------------------
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

    try {
      await updateDocumentStatus(documentId, 'error', errorMessage)
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return {
      success: false,
      documentId,
      error: errorMessage,
    }
  }
}

/**
 * 문서 처리 트리거 (업로드 후 자동 실행)
 * 
 * @param documentId - 문서 ID
 * @param filePath - Storage 파일 경로
 * @param userId - 사용자 ID
 * 
 * @example
 * ```typescript
 * // 업로드 완료 후 호출
 * triggerDocumentProcessing(documentId, filePath, userId)
 * ```
 */
export async function triggerDocumentProcessing(
  documentId: string,
  filePath: string,
  userId: string
): Promise<void> {
  try {
    const result = await processDocument(documentId, filePath, userId)
    
    if (result.success) {
      console.log(
        `Document processed successfully: ${result.chunksCreated} chunks created, ` +
        `embeddings: ${result.embeddingsGenerated ? 'yes' : 'no'}` +
        (result.tokensUsed ? `, tokens used: ${result.tokensUsed}` : '')
      )
    } else {
      console.error(`Document processing failed: ${result.error}`)
    }
  } catch (error) {
    console.error('Unexpected error during document processing:', error)
  }
}
