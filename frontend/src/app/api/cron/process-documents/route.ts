// =============================================================================
// [P9-CRON-01] Pending 문서 자동 처리 Cron Job
// =============================================================================
// 파일: frontend/src/app/api/cron/process-documents/route.ts
// 역할: 5분마다 pending 상태 문서를 찾아서 처리
// 스케줄: */5 * * * * (매 5분)
// 생성일: 2026-01-01
// =============================================================================
//
// [아키텍처 설명]
// 기존 문제점:
// - 클라이언트가 업로드 후 process API를 동기 호출
// - Vercel Hobby 플랜 10초 타임아웃으로 대용량 문서 처리 실패
// - 클라이언트 연결 끊김 시 처리 중단
//
// 해결책 (Vercel Cron):
// - 업로드 시 status='pending'으로만 저장
// - 5분마다 Cron이 pending 문서를 찾아 처리
// - 한 번에 최대 3개씩 순차 처리 (타임아웃 방지)
// - 실패 시 retry_count 증가, 3회 초과 시 failed 처리
//
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/rag/documentProcessor'
import { DocumentStatus } from '@/types/rag'

// =============================================================================
// 상수 정의
// =============================================================================

/** Cron 인증 시크릿 (Vercel 환경변수) */
const CRON_SECRET = process.env.CRON_SECRET

/** 한 번에 처리할 최대 문서 수 (Vercel 타임아웃 방지) */
const BATCH_SIZE = 3

/** 최대 재시도 횟수 */
const MAX_RETRIES = 3

/** 처리 중 상태로 남아있을 수 있는 최대 시간 (분) - stuck 문서 복구용 */
const STUCK_THRESHOLD_MINUTES = 30

// =============================================================================
// Cron Job Handler
// =============================================================================

/**
 * GET /api/cron/process-documents
 *
 * Vercel Cron에서 5분마다 호출됩니다.
 * pending 상태의 문서를 찾아 순차적으로 처리합니다.
 *
 * @security CRON_SECRET 헤더로 인증 (Vercel이 자동 설정)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // -------------------------------------------------------------------------
    // 1. Cron 인증 확인 (Vercel에서 자동으로 Authorization 헤더 설정)
    // -------------------------------------------------------------------------
    const authHeader = request.headers.get('authorization')

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[Cron] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron] Starting pending document processing...')

    // -------------------------------------------------------------------------
    // 2. Supabase 클라이언트 (서비스 롤 권한 필요)
    // -------------------------------------------------------------------------
    const supabase = createClient()

    // -------------------------------------------------------------------------
    // 3. Pending 문서 조회 (가장 오래된 것부터, BATCH_SIZE개)
    // -------------------------------------------------------------------------
    const { data: pendingDocs, error: queryError } = await supabase
      .from('user_documents')
      .select('id, file_path, file_type, user_id, retry_count, status, started_at')
      .or(`status.eq.${DocumentStatus.PENDING},status.eq.${DocumentStatus.PARSING},status.eq.${DocumentStatus.CHUNKING},status.eq.${DocumentStatus.EMBEDDING}`)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE * 2) // Stuck 문서 필터링 후에도 충분히 남도록

    if (queryError) {
      console.error('[Cron] Query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      console.log('[Cron] No pending documents found')
      return NextResponse.json({
        success: true,
        message: 'No pending documents',
        processed: 0,
        duration: Date.now() - startTime
      })
    }

    // -------------------------------------------------------------------------
    // 4. Stuck 문서 필터링 (처리 중 상태가 30분 이상 지속된 경우)
    // -------------------------------------------------------------------------
    const now = new Date()
    const docsToProcess = pendingDocs.filter(doc => {
      // pending 상태는 항상 처리
      if (doc.status === DocumentStatus.PENDING) {
        return true
      }

      // 처리 중 상태인데 started_at이 STUCK_THRESHOLD_MINUTES 이상 지난 경우
      // → 이전 처리가 실패했을 가능성이 높으므로 재처리
      if (doc.started_at) {
        const startedAt = new Date(doc.started_at)
        const minutesElapsed = (now.getTime() - startedAt.getTime()) / (1000 * 60)

        if (minutesElapsed >= STUCK_THRESHOLD_MINUTES) {
          console.log(`[Cron] Recovering stuck document: ${doc.id} (stuck for ${Math.round(minutesElapsed)} minutes)`)
          return true
        }
      }

      return false
    }).slice(0, BATCH_SIZE)

    if (docsToProcess.length === 0) {
      console.log('[Cron] All documents are currently being processed')
      return NextResponse.json({
        success: true,
        message: 'All documents currently processing',
        processed: 0,
        duration: Date.now() - startTime
      })
    }

    console.log(`[Cron] Processing ${docsToProcess.length} documents...`)

    // -------------------------------------------------------------------------
    // 5. 순차 처리 (병렬 처리 시 타임아웃 위험)
    // -------------------------------------------------------------------------
    const results: Array<{
      documentId: string
      success: boolean
      error?: string
    }> = []

    for (const doc of docsToProcess) {
      const docId = doc.id
      const retryCount = doc.retry_count ?? 0

      try {
        // 재시도 횟수 초과 체크
        if (retryCount >= MAX_RETRIES) {
          console.warn(`[Cron] Document ${docId} exceeded max retries (${retryCount})`)

          await supabase
            .from('user_documents')
            .update({
              status: DocumentStatus.FAILED,
              error_message: `최대 재시도 횟수(${MAX_RETRIES}회) 초과`,
              updated_at: new Date().toISOString()
            })
            .eq('id', docId)

          results.push({
            documentId: docId,
            success: false,
            error: 'Max retries exceeded'
          })
          continue
        }

        // retry_count 증가 (처리 시작 전)
        await supabase
          .from('user_documents')
          .update({
            retry_count: retryCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', docId)

        // 문서 처리 실행
        console.log(`[Cron] Processing document: ${docId} (attempt ${retryCount + 1}/${MAX_RETRIES})`)

        const result = await processDocument(
          docId,
          doc.file_path,
          doc.user_id,
          doc.file_type
        )

        results.push({
          documentId: docId,
          success: result.success,
          error: result.error
        })

        if (result.success) {
          console.log(`[Cron] Successfully processed: ${docId}`)
        } else {
          console.warn(`[Cron] Failed to process: ${docId} - ${result.error}`)
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Cron] Error processing ${docId}:`, error)

        results.push({
          documentId: docId,
          success: false,
          error: errorMessage
        })
      }
    }

    // -------------------------------------------------------------------------
    // 6. 결과 반환
    // -------------------------------------------------------------------------
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const duration = Date.now() - startTime

    console.log(`[Cron] Completed. Success: ${successCount}, Failed: ${failCount}, Duration: ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} documents`,
      processed: results.length,
      successCount,
      failCount,
      duration,
      results
    })

  } catch (error) {
    console.error('[Cron] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// Next.js App Router 설정
// =============================================================================

/** Vercel Edge Runtime에서 실행하지 않음 (Node.js 필요) */
export const runtime = 'nodejs'

/** 최대 실행 시간 (Vercel Pro: 60s, Hobby: 10s) */
export const maxDuration = 60

/** 동적 렌더링 강제 (Cron은 항상 동적) */
export const dynamic = 'force-dynamic'
