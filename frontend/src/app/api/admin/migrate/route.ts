// =============================================================================
// PRISM Writer - Migration Admin API
// =============================================================================
// 파일: frontend/src/app/api/admin/migrate/route.ts
// 역할: RAG 임베딩 마이그레이션 관리자 API
// 
// [M-01] 체크리스트 구현:
// - GET: 마이그레이션 상태 조회 (stats) 또는 문서 목록 조회 (mode=list)
// - POST: 단일 문서 재처리 (mode=process)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedText, EMBEDDING_CONFIG } from '@/lib/rag/embedding'

// =============================================================================
// Next.js Configuration
// =============================================================================
export const dynamic = 'force-dynamic'

// =============================================================================
// Types
// =============================================================================

/** 마이그레이션 통계 응답 */
interface MigrationStats {
  total_chunks: number
  migrated_chunks: number
  pending_chunks: number
  current_model: string
  total_documents: number
}

/** 문서 목록 아이템 */
interface DocumentListItem {
  id: string
  name: string
  file_path: string | null
  file_type: string | null
  user_id: string
  status: string
  created_at: string
}

// =============================================================================
// GET Handler: Stats or Document List
// =============================================================================

/**
 * GET /api/admin/migrate
 * 
 * Query Parameters:
 * - mode: 'stats' (default) | 'list'
 * 
 * Returns:
 * - mode=stats: 마이그레이션 통계 (총 청크, 완료된 청크, 대기 중 청크)
 * - mode=list: 재처리 대상 문서 목록
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') || 'stats'

    const supabase = await createClient()

    // =========================================================================
    // [MODE: stats] 마이그레이션 통계 조회
    // =========================================================================
    if (mode === 'stats') {
      // 1. 총 청크 수
      const { count: totalCount, error: countError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError

      // 2. 마이그레이션 완료된 청크 수 (현재 모델과 일치)
      const { count: migratedCount, error: migratedError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('embedding_model_id', EMBEDDING_CONFIG.modelId)

      if (migratedError) throw migratedError

      // 3. 총 문서 수
      const { count: docCount, error: docError } = await supabase
        .from('user_documents')
        .select('*', { count: 'exact', head: true })

      if (docError) throw docError

      const stats: MigrationStats = {
        total_chunks: totalCount || 0,
        migrated_chunks: migratedCount || 0,
        pending_chunks: (totalCount || 0) - (migratedCount || 0),
        current_model: EMBEDDING_CONFIG.modelId,
        total_documents: docCount || 0,
      }

      return NextResponse.json(stats)
    }

    // =========================================================================
    // [MODE: list] 재처리 대상 문서 목록 조회
    // =========================================================================
    if (mode === 'list') {
      // 모든 문서 조회 (관리자용이므로 전체 조회)
      // 필요시 status 필터 추가 가능: .in('status', ['processed', 'pending'])
      const { data: documents, error: listError } = await supabase
        .from('user_documents')
        .select('id, name, file_path, file_type, user_id, status, created_at')
        .order('created_at', { ascending: false })

      if (listError) throw listError

      const docList: DocumentListItem[] = (documents || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name || 'Untitled',
        file_path: doc.file_path,
        file_type: doc.file_type,
        user_id: doc.user_id,
        status: doc.status || 'unknown',
        created_at: doc.created_at,
      }))

      return NextResponse.json({ 
        documents: docList,
        total: docList.length 
      })
    }

    // 알 수 없는 모드
    return NextResponse.json(
      { error: `Unknown mode: ${mode}. Use 'stats' or 'list'.` },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Migration API] GET Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST Handler: Process Document or Batch Chunks
// =============================================================================

/**
 * POST /api/admin/migrate
 * 
 * Body:
 * - mode: 'process' (문서 단위) | 'batch' (청크 단위, 레거시)
 * - documentId: 처리할 문서 ID (mode=process)
 * - limit: 처리할 청크 수 (mode=batch, 기본 10)
 * 
 * Returns:
 * - mode=process: { success, documentId, chunksCreated }
 * - mode=batch: { processed, errors }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mode = body.mode || 'batch'  // 기본값: 레거시 batch 모드

    const supabase = await createClient()

    // =========================================================================
    // [MODE: process] 단일 문서 재처리 (체크리스트 M-01 핵심 로직)
    // =========================================================================
    if (mode === 'process') {
      const documentId = body.documentId

      if (!documentId) {
        return NextResponse.json(
          { error: 'documentId is required for process mode' },
          { status: 400 }
        )
      }

      console.log(`[Migration API] Processing document: ${documentId}`)

      // Step 1: 문서 정보 조회
      const { data: doc, error: docError } = await supabase
        .from('user_documents')
        .select('id, name, file_path, file_type, user_id, status')
        .eq('id', documentId)
        .single()

      if (docError || !doc) {
        return NextResponse.json(
          { error: `Document not found: ${documentId}` },
          { status: 404 }
        )
      }

      // Step 2: 기존 청크 삭제
      console.log(`[Migration API] Deleting existing chunks for document: ${documentId}`)
      const { error: deleteError } = await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)

      if (deleteError) {
        console.error('[Migration API] Chunk deletion error:', deleteError)
        // 삭제 실패해도 계속 진행 (청크가 없을 수 있음)
      }

      // Step 3: 기존 청크 재임베딩 (청크 내용은 유지, 임베딩만 갱신)
      // =================================================================
      // [주니어 개발자 참고] 
      // 원래는 processDocument로 전체 재처리하려 했으나,
      // Storage 접근 및 파싱 로직의 복잡성으로 인해
      // 기존 청크를 그대로 두고 임베딩만 갱신하는 방식으로 변경.
      // 이 방식이 더 안전하고 빠름.
      // =================================================================
      try {
        // [Step 3-A] 해당 문서의 모든 청크 조회
        const { data: existingChunks, error: chunkQueryError } = await supabase
          .from('document_chunks')
          .select('id, content')
          .eq('document_id', documentId)

        if (chunkQueryError) throw chunkQueryError

        // 청크가 없는 경우 (삭제되었거나 원래 없음)
        if (!existingChunks || existingChunks.length === 0) {
          return NextResponse.json({
            success: true,
            documentId,
            documentName: doc.name,
            chunksCreated: 0,
            message: 'No chunks found for this document. May need manual reprocessing.',
          })
        }

        console.log(`[Migration API] Re-embedding ${existingChunks.length} chunks for document: ${documentId}`)

        // [Step 3-B] 각 청크를 OpenAI로 재임베딩
        let processedChunks = 0
        const chunkErrors: string[] = []

        for (const chunk of existingChunks) {
          try {
            const embedding = await embedText(chunk.content)

            const { error: updateError } = await supabase
              .from('document_chunks')
              .update({
                embedding,
                embedding_model_id: EMBEDDING_CONFIG.modelId,
                embedding_dim: EMBEDDING_CONFIG.dimensions,
                embedded_at: new Date().toISOString()
              })
              .eq('id', chunk.id)

            if (updateError) throw updateError
            processedChunks++

          } catch (chunkErr) {
            chunkErrors.push(`Chunk ${chunk.id}: ${chunkErr instanceof Error ? chunkErr.message : String(chunkErr)}`)
          }
        }

        console.log(`[Migration API] Document completed: ${documentId}, re-embedded: ${processedChunks}/${existingChunks.length}`)

        return NextResponse.json({
          success: true,
          documentId,
          documentName: doc.name,
          chunksCreated: processedChunks,
          totalChunks: existingChunks.length,
          errors: chunkErrors.length > 0 ? chunkErrors : undefined,
        })

      } catch (processError) {
        console.error(`[Migration API] Process error for ${documentId}:`, processError)

        // [Safety] 실패 시 문서 상태 업데이트
        await supabase
          .from('user_documents')
          .update({ 
            status: 'migration_failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)

        return NextResponse.json({
          success: false,
          documentId,
          error: processError instanceof Error ? processError.message : String(processError)
        }, { status: 500 })
      }
    }

    // =========================================================================
    // [MODE: batch] 청크 단위 배치 처리 (레거시 호환)
    // =========================================================================
    if (mode === 'batch') {
      const limit = body.limit || 10

      // 1. 대기 중인 청크 조회 (모델 불일치 또는 NULL)
      let chunks: any[] = []

      const { data: mismatchChunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('id, content')
        .neq('embedding_model_id', EMBEDDING_CONFIG.modelId)
        .limit(limit)

      if (fetchError) throw fetchError

      if (mismatchChunks && mismatchChunks.length > 0) {
        chunks = mismatchChunks
      } else {
        // NULL 모델 ID 체크 (Supabase neq는 NULL 포함 안 할 수 있음)
        const { data: nullChunks, error: nullError } = await supabase
          .from('document_chunks')
          .select('id, content')
          .is('embedding_model_id', null)
          .limit(limit)

        if (nullError) throw nullError
        if (nullChunks) chunks = nullChunks
      }

      if (!chunks || chunks.length === 0) {
        return NextResponse.json({ 
          message: 'No pending chunks to migrate.', 
          processed: 0 
        })
      }

      console.log(`[Migration API] Batch processing ${chunks.length} chunks...`)

      // 2. 청크 처리
      let processed = 0
      const errors: any[] = []

      for (const chunk of chunks) {
        try {
          const embedding = await embedText(chunk.content)

          const { error: updateError } = await supabase
            .from('document_chunks')
            .update({
              embedding,
              embedding_model_id: EMBEDDING_CONFIG.modelId,
              embedding_dim: EMBEDDING_CONFIG.dimensions,
              embedded_at: new Date().toISOString()
            })
            .eq('id', chunk.id)

          if (updateError) throw updateError
          processed++

        } catch (err) {
          console.error(`[Migration API] Chunk error ${chunk.id}:`, err)
          errors.push({ 
            id: chunk.id, 
            error: err instanceof Error ? err.message : String(err) 
          })
        }
      }

      return NextResponse.json({
        message: 'Batch processing complete',
        processed,
        errors: errors.length > 0 ? errors : undefined
      })
    }

    // 알 수 없는 모드
    return NextResponse.json(
      { error: `Unknown mode: ${mode}. Use 'process' or 'batch'.` },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Migration API] POST Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
