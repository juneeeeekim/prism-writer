// =============================================================================
// [P9-CRON-02] 고아 파일 정리 Cron Job
// =============================================================================
// 파일: frontend/src/app/api/cron/cleanup-orphans/route.ts
// 역할: 매일 새벽 3시에 7일 이상 pending 상태인 고아 파일 정리
// 스케줄: 0 3 * * * (매일 03:00 UTC)
// 생성일: 2026-01-01
// =============================================================================
//
// [아키텍처 설명]
// 고아 파일 발생 원인:
// - 업로드 후 처리 중 사용자가 브라우저를 닫음
// - 처리 API 호출 전에 클라이언트 오류 발생
// - 네트워크 오류로 처리 트리거가 누락됨
// - 처리 실패 후 재시도하지 않고 방치됨
//
// 정리 기준:
// - pending/failed 상태이면서 7일 이상 경과한 문서
// - Storage 파일 + DB 레코드 모두 삭제
// - 관련 chunks도 cascade 삭제됨 (FK 설정)
//
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentStatus } from '@/types/rag'

// =============================================================================
// 상수 정의
// =============================================================================

/** Cron 인증 시크릿 (Vercel 환경변수) */
const CRON_SECRET = process.env.CRON_SECRET

/** 고아 파일로 간주하는 경과 일수 */
const ORPHAN_THRESHOLD_DAYS = 7

/** 한 번에 삭제할 최대 파일 수 */
const DELETE_BATCH_SIZE = 50

// =============================================================================
// Cron Job Handler
// =============================================================================

/**
 * GET /api/cron/cleanup-orphans
 *
 * Vercel Cron에서 매일 새벽 3시에 호출됩니다.
 * 7일 이상 pending/failed 상태인 고아 파일을 정리합니다.
 *
 * @security CRON_SECRET 헤더로 인증 (Vercel이 자동 설정)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // -------------------------------------------------------------------------
    // 1. Cron 인증 확인
    // -------------------------------------------------------------------------
    const authHeader = request.headers.get('authorization')

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[Cleanup] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cleanup] Starting orphan file cleanup...')

    // -------------------------------------------------------------------------
    // 2. Supabase 클라이언트
    // -------------------------------------------------------------------------
    const supabase = createClient()

    // -------------------------------------------------------------------------
    // 3. 고아 문서 조회 (7일 이상 pending 또는 failed 상태)
    // -------------------------------------------------------------------------
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - ORPHAN_THRESHOLD_DAYS)
    const thresholdISO = thresholdDate.toISOString()

    const { data: orphanDocs, error: queryError } = await supabase
      .from('user_documents')
      .select('id, file_path, user_id, status, created_at')
      .or(`status.eq.${DocumentStatus.PENDING},status.eq.${DocumentStatus.FAILED}`)
      .lt('created_at', thresholdISO)
      .order('created_at', { ascending: true })
      .limit(DELETE_BATCH_SIZE)

    if (queryError) {
      console.error('[Cleanup] Query error:', queryError)
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      )
    }

    if (!orphanDocs || orphanDocs.length === 0) {
      console.log('[Cleanup] No orphan files found')
      return NextResponse.json({
        success: true,
        message: 'No orphan files',
        deleted: 0,
        duration: Date.now() - startTime
      })
    }

    console.log(`[Cleanup] Found ${orphanDocs.length} orphan documents`)

    // -------------------------------------------------------------------------
    // 4. 순차 삭제 (Storage 파일 + DB 레코드)
    // -------------------------------------------------------------------------
    const results: Array<{
      documentId: string
      success: boolean
      error?: string
    }> = []

    for (const doc of orphanDocs) {
      const docId = doc.id
      const filePath = doc.file_path

      try {
        // 4-1. Storage 파일 삭제
        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('rag-documents')
            .remove([filePath])

          if (storageError) {
            // Storage 삭제 실패해도 DB 레코드는 삭제 진행
            // (파일이 이미 없는 경우일 수 있음)
            console.warn(`[Cleanup] Storage delete warning for ${docId}:`, storageError.message)
          }
        }

        // 4-2. rag_chunks 삭제 (FK cascade가 없는 경우를 대비)
        const { error: chunksError } = await supabase
          .from('rag_chunks')
          .delete()
          .eq('document_id', docId)

        if (chunksError) {
          console.warn(`[Cleanup] Chunks delete warning for ${docId}:`, chunksError.message)
        }

        // 4-3. user_documents 레코드 삭제
        const { error: dbError } = await supabase
          .from('user_documents')
          .delete()
          .eq('id', docId)

        if (dbError) {
          throw new Error(`DB delete failed: ${dbError.message}`)
        }

        results.push({
          documentId: docId,
          success: true
        })

        console.log(`[Cleanup] Deleted orphan: ${docId} (created: ${doc.created_at})`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Cleanup] Error deleting ${docId}:`, error)

        results.push({
          documentId: docId,
          success: false,
          error: errorMessage
        })
      }
    }

    // -------------------------------------------------------------------------
    // 5. 결과 반환
    // -------------------------------------------------------------------------
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const duration = Date.now() - startTime

    console.log(`[Cleanup] Completed. Deleted: ${successCount}, Failed: ${failCount}, Duration: ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${successCount} orphan files`,
      deleted: successCount,
      failed: failCount,
      thresholdDays: ORPHAN_THRESHOLD_DAYS,
      duration,
      results
    })

  } catch (error) {
    console.error('[Cleanup] Unexpected error:', error)
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

/** 최대 실행 시간 */
export const maxDuration = 60

/** 동적 렌더링 강제 */
export const dynamic = 'force-dynamic'
