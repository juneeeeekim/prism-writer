// =============================================================================
// PRISM Writer - Document Processor
// =============================================================================
// 파일: frontend/src/lib/rag/documentProcessor.ts
// 역할: 업로드된 문서를 자동으로 처리 (청킹, 임베딩 등)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { chunkDocument, type DocumentChunk } from './chunking'
import { embedBatch, estimateTokenCount, EMBEDDING_CONFIG } from './embedding'
import { validateDocumentSize, validateUsage, trackUsage } from './costGuard'
import { DocumentStatus } from '@/types/rag'

// =============================================================================
// PDF 파싱 라이브러리 - [Vercel Fix] 동적 import로 변경됨
// =============================================================================
// pdf-parse는 parsePDF() 함수 내에서 동적으로 import됩니다.
// 이는 Vercel Serverless 환경에서 DOMMatrix 오류를 방지하기 위함입니다.

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
  const supabase = await createClient()

  const updateData: {
    status: DocumentStatus
    updated_at: string
    started_at?: string
    metadata?: { error_message?: string }
    error_message?: string
  } = {
    status,
    updated_at: new Date().toISOString(),
  }

  // 처리 시작 시 started_at 기록
  if (status === DocumentStatus.PARSING) {
    updateData.started_at = new Date().toISOString()
  }

  // 에러 메시지가 있으면 저장 (사용자 노출용)
  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  const { error } = await supabase
    .from('user_documents')
    .update(updateData)
    .eq('id', documentId)

  if (error) {
    console.error('Failed to update document status:', error)
    // 상태 업데이트 실패는 치명적이지 않으므로 로그만 남기고 throw하지 않음
    // (이미 에러 처리 중일 수 있으므로)
  }
}

// =============================================================================
// [Phase 2] 파일 타입별 파싱 로직 (PDF, TXT, MD 지원)
// =============================================================================

/**
 * PDF 파일에서 텍스트 추출
 * 
 * [Vercel Fix] pdf2json 라이브러리 사용
 * - 순수 JavaScript로 작성됨, Canvas/DOM 의존성 없음
 * - v3.1.6부터 완전히 의존성 없음
 * - Vercel Serverless 환경에서 안정적으로 작동
 * 
 * @param buffer - PDF 파일 버퍼
 * @returns 추출된 텍스트
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // [Vercel Fix] pdf2json 동적 import
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const PDFParser = require('pdf2json')
      
      const pdfParser = new PDFParser()
      
      // 에러 핸들러
      pdfParser.on('pdfParser_dataError', (errData: { parserError: Error }) => {
        const errorMessage = errData.parserError?.message || 'PDF 파싱 오류'
        
        if (errorMessage.toLowerCase().includes('password')) {
          reject(new Error('암호화된 PDF는 지원되지 않습니다.'))
        } else {
          reject(new Error(`PDF 파싱 실패: ${errorMessage}`))
        }
      })
      
      // 성공 핸들러
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // =================================================================
          // [PDF PARSER] pdfData.Pages에서 직접 텍스트 추출
          // pdf2json의 getRawTextContent()가 한글 인코딩 문제가 있어
          // pdfData.Pages → Texts → R → T 구조에서 직접 추출 및 URL 디코딩
          // =================================================================
          let extractedText = ''
          
          if (pdfData && pdfData.Pages && Array.isArray(pdfData.Pages)) {
            for (const page of pdfData.Pages) {
              if (page.Texts && Array.isArray(page.Texts)) {
                for (const textItem of page.Texts) {
                  if (textItem.R && Array.isArray(textItem.R)) {
                    for (const run of textItem.R) {
                      if (run.T) {
                        // URL 인코딩된 텍스트 디코딩 (한글 지원)
                        try {
                          const decodedText = decodeURIComponent(run.T)
                          extractedText += decodedText + ' '
                        } catch {
                          // 디코딩 실패 시 원본 사용
                          extractedText += run.T + ' '
                        }
                      }
                    }
                  }
                }
              }
              extractedText += '\n' // 페이지 구분
            }
          }
          
          // Fallback: 직접 추출 실패 시 getRawTextContent 시도
          if (!extractedText.trim()) {
            extractedText = pdfParser.getRawTextContent() || ''
          }
          
          const text = extractedText.trim()
          
          // 스캔된 이미지 PDF 감지 (텍스트가 비어있는 경우)
          // [P10-OCR] 사용자에게 OCR/Vision 옵션 안내
          if (!text || text.length === 0) {
            reject(new Error('SCANNED_PDF:PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF인 경우 OCR 또는 Vision 추출 기능을 사용해 주세요.'))
            return
          }
          
          resolve(text)
        } catch (parseError) {
          console.error('[PDF Parser Error]:', parseError)
          reject(new Error('PDF 텍스트 추출 중 오류가 발생했습니다.'))
        }
      })
      
      // Buffer를 파싱 (parseBuffer 메서드 사용)
      pdfParser.parseBuffer(buffer)
      
    } catch (error) {
      if (error instanceof Error) {
        reject(error)
      } else {
        reject(new Error('PDF 파싱 중 예기치 않은 오류가 발생했습니다.'))
      }
    }
  })
}

/**
 * Storage에서 문서 내용 가져오기 (파일 타입별 파싱)
 * 
 * @param filePath - Storage 파일 경로
 * @param fileType - 파일 MIME 타입
 * @returns 문서 텍스트
 */
async function parseDocumentContent(filePath: string, fileType?: string): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('rag-documents')
    .download(filePath)

  if (error) {
    throw new Error(`파일 다운로드 실패: ${error.message}`)
  }

  // ---------------------------------------------------------------------------
  // 파일 타입별 분기 처리
  // ---------------------------------------------------------------------------
  
  // PDF 파일 처리
  if (fileType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
    const arrayBuffer = await data.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return await parsePDF(buffer)
  }
  
  // TXT, MD 파일 처리 (기존 로직 유지)
  if (
    fileType === 'text/plain' || 
    fileType === 'text/markdown' ||
    filePath.toLowerCase().endsWith('.txt') ||
    filePath.toLowerCase().endsWith('.md')
  ) {
    return await data.text()
  }
  
  // DOCX 파일 (현재 미지원)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filePath.toLowerCase().endsWith('.docx')
  ) {
    throw new Error('DOCX 파일은 현재 지원되지 않습니다. PDF, TXT, MD 파일을 사용해 주세요.')
  }
  
  // 알 수 없는 파일 타입 (기본: 텍스트로 시도)
  console.warn(`Unknown file type: ${fileType}, attempting text parse`)
  return await data.text()
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
  const supabase = await createClient()

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

  // [Fix] 기존 rag_chunks 테이블 사용 (기존 데이터와 일관성 유지)
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
 * @param fileType - 파일 MIME 타입 (옵션, PDF 파싱에 필요)
 * @param options - 처리 옵션
 * @returns 처리 결과
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  userId: string,
  fileType?: string,
  options: ProcessDocumentOptions = {}
): Promise<ProcessingResult> {
  try {
    console.log('[ProcessDocument] === STARTING DOCUMENT PROCESSING ===')
    console.log('[ProcessDocument] Document ID:', documentId)
    console.log('[ProcessDocument] File Path:', filePath)
    console.log('[ProcessDocument] File Type:', fileType)
    console.log('[ProcessDocument] User ID:', userId)

    // ---------------------------------------------------------------------------
    // 1. 상태를 'PARSING'으로 변경 (시작)
    // ---------------------------------------------------------------------------
    console.log('[ProcessDocument] Step 1: Updating status to PARSING')
    await updateDocumentStatus(documentId, DocumentStatus.PARSING)

    // ---------------------------------------------------------------------------
    // 2. Storage에서 문서 내용 가져오기 (파일 타입별 파싱)
    // [Phase 2] PDF, TXT, MD 파일 타입별 분기 처리
    // ---------------------------------------------------------------------------
    console.log('[ProcessDocument] Step 2: Parsing document content')
    const content = await parseDocumentContent(filePath, fileType)
    console.log('[ProcessDocument] Parsed content length:', content?.length || 0)

    if (!content || content.trim().length === 0) {
      throw new Error('문서 내용이 비어있습니다.')
    }

    // ---------------------------------------------------------------------------
    // 3. 문서 청킹
    // ---------------------------------------------------------------------------
    console.log('[ProcessDocument] Step 3: Chunking document')
    await updateDocumentStatus(documentId, DocumentStatus.CHUNKING)
    
    const chunks = chunkDocument(content, {
      chunkSize: options.chunkSize,
      overlap: options.overlap,
      preserveHeaders: options.preserveHeaders,
    })
    console.log('[ProcessDocument] Chunks created:', chunks.length)

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
    await updateDocumentStatus(documentId, DocumentStatus.EMBEDDING)

    let embeddings: number[][] | undefined
    let embeddingsGenerated = false

    try {
      const chunkTexts = chunks.map((chunk) => chunk.content)
      embeddings = await embedBatch(chunkTexts)
      embeddingsGenerated = true

      // 사용량 기록
      const supabase = await createClient()
      await trackUsage(userId, totalTokens, documentId, supabase)
    } catch (embeddingError) {
      console.error('Failed to generate embeddings:', embeddingError)
      // [수정] 임베딩 실패는 검색 불가로 이어지므로 에러로 처리
      throw new Error(`임베딩 생성 실패: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`)
    }

    // ---------------------------------------------------------------------------
    // 6. 청크 저장 (임베딩 포함)
    // ---------------------------------------------------------------------------
    await saveChunks(documentId, chunks, embeddings)

    // ---------------------------------------------------------------------------
    // 7. 상태를 'COMPLETED'로 변경
    // ---------------------------------------------------------------------------
    await updateDocumentStatus(documentId, DocumentStatus.COMPLETED)

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
    // 에러 처리: 상태를 'FAILED'로 변경
    // ---------------------------------------------------------------------------
    const internalErrorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // [DEBUG] 상세 에러 로깅 - Vercel Functions 로그에 출력
    console.error('=== DOCUMENT PROCESSING ERROR ===')
    console.error('Document ID:', documentId)
    console.error('File Path:', filePath)
    console.error('File Type:', fileType)
    if (error instanceof Error) {
      console.error('Error Name:', error.name)
      console.error('Error Message:', error.message)
      console.error('Error Stack:', error.stack)
    } else {
      console.error('Unknown Error:', JSON.stringify(error))
    }
    console.error('=================================')
    
    // 사용자에게 보여줄 메시지 Sanitization
    let userErrorMessage = '문서 처리 중 오류가 발생했습니다.'
    if (internalErrorMessage.includes('비어있습니다')) userErrorMessage = '문서 내용이 비어있습니다.'
    if (internalErrorMessage.includes('청크가 생성되지')) userErrorMessage = '텍스트를 추출할 수 없습니다.'
    if (internalErrorMessage.includes('Token limit')) userErrorMessage = '일일 사용량을 초과했습니다.'
    if (internalErrorMessage.includes('스캔된 이미지')) userErrorMessage = '스캔된 이미지 PDF는 지원되지 않습니다.'
    if (internalErrorMessage.includes('암호화된')) userErrorMessage = '암호화된 PDF는 지원되지 않습니다.'

    console.error(`Document processing failed for ${documentId}:`, error)

    try {
      await updateDocumentStatus(documentId, DocumentStatus.FAILED, userErrorMessage)
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return {
      success: false,
      documentId,
      error: userErrorMessage,
    }
  }
}

/**
 * 문서 처리 트리거 (업로드 후 자동 실행)
 * 
 * @param documentId - 문서 ID
 * @param filePath - Storage 파일 경로
 * @param userId - 사용자 ID
 */
export async function triggerDocumentProcessing(
  documentId: string,
  filePath: string,
  userId: string
): Promise<void> {
  try {
    // 백그라운드 처리를 위해 await 하지 않음 (Vercel Serverless 함수 시간 제한 고려)
    // 주의: Vercel Hobby 플랜에서는 백그라운드 작업이 보장되지 않을 수 있음.
    // 실제 프로덕션에서는 QStash나 Inngest 같은 큐 시스템 사용 권장.
    // 현재는 간단한 구현을 위해 비동기 호출만 함.
    processDocument(documentId, filePath, userId)
      .then(result => {
        if (result.success) {
          console.log(`Document processed successfully: ${result.documentId}`)
        } else {
          console.error(`Document processing failed: ${result.error}`)
        }
      })
      .catch(err => {
        console.error('Unhandled error in processDocument:', err)
      })
      
  } catch (error) {
    console.error('Unexpected error triggering processing:', error)
  }
}
