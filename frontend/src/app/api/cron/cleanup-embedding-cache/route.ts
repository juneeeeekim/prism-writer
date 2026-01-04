// =============================================================================
// [P-C01-03] 만료된 임베딩 캐시 정리 Cron Job
// =============================================================================
// 파일: frontend/src/app/api/cron/cleanup-embedding-cache/route.ts
// 역할: 만료된 임베딩 캐시 정리 (expires_at < now())
// 스케줄: 매일 1회 (외부 Cron 서비스로 호출)
// 생성일: 2026-01-04
// =============================================================================
//
// [아키텍처 설명]
// 임베딩 캐시 정리 목적:
// - 만료된(expires_at < now) 캐시 항목 삭제
// - DB 공간 효율화
// - 오래된 임베딩 버전 자동 정리
//
// 정리 방법:
// - SQL 함수 cleanup_expired_embedding_cache() 호출
// - 만료된 모든 항목 일괄 삭제
// - 삭제된 항목 수 반환
//
// [외부 Cron 설정 방법]
// 1. https://cron-job.org 무료 가입
// 2. 새 Cron Job 생성:
//    - URL: https://your-domain.vercel.app/api/cron/cleanup-embedding-cache?key=YOUR_CRON_SECRET
//    - 스케줄: 0 4 * * * (매일 04:00 UTC)
//    - Method: GET
//
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// =============================================================================
// 상수 정의
// =============================================================================

/** Cron 인증 시크릿 (Vercel 환경변수) */
const CRON_SECRET = process.env.CRON_SECRET

// =============================================================================
// Cron Job Handler
// =============================================================================

/**
 * GET /api/cron/cleanup-embedding-cache
 *
 * 외부 Cron 서비스에서 매일 새벽 4시에 호출됩니다.
 * 만료된 임베딩 캐시를 정리합니다.
 *
 * @security CRON_SECRET 헤더 또는 쿼리 파라미터로 인증
 *
 * @returns
 * - success: true/false
 * - deleted: 삭제된 항목 수
 * - duration: 실행 시간 (ms)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // -------------------------------------------------------------------------
    // [STEP 1] Cron 인증 확인 (헤더 또는 쿼리 파라미터)
    // - Vercel Pro: Authorization 헤더 자동 설정
    // - 외부 Cron 서비스: ?key=CRON_SECRET 쿼리 파라미터
    // -------------------------------------------------------------------------
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const queryKey = searchParams.get('key')

    const isAuthorized =
      !CRON_SECRET || // 시크릿 미설정 시 통과 (개발 환경)
      authHeader === `Bearer ${CRON_SECRET}` || // 헤더 인증
      queryKey === CRON_SECRET // 쿼리 파라미터 인증

    if (!isAuthorized) {
      console.warn('[EmbeddingCache Cleanup] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[EmbeddingCache Cleanup] Starting cleanup...')

    // -------------------------------------------------------------------------
    // [STEP 2] Supabase 클라이언트
    // -------------------------------------------------------------------------
    const supabase = await createClient()

    // -------------------------------------------------------------------------
    // [STEP 3] 만료된 캐시 정리 함수 호출
    // P-C01-01에서 생성한 cleanup_expired_embedding_cache() 함수 사용
    // -------------------------------------------------------------------------
    const { data: deletedCount, error: rpcError } = await supabase
      .rpc('cleanup_expired_embedding_cache')

    if (rpcError) {
      // RPC 함수가 없는 경우 (마이그레이션 미적용)
      // 직접 DELETE 쿼리로 fallback
      console.warn('[EmbeddingCache Cleanup] RPC failed, trying direct delete:', rpcError.message)

      // Fallback: 직접 DELETE 쿼리 실행
      // 삭제된 행 수를 정확히 알기 위해 먼저 ID 목록 조회 후 삭제
      const now = new Date().toISOString()

      // 만료된 항목 ID 조회
      const { data: expiredItems, error: queryError } = await supabase
        .from('embedding_cache')
        .select('id')
        .lt('expires_at', now)

      if (queryError) {
        console.error('[EmbeddingCache Cleanup] Query error:', queryError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to query expired cache',
            details: queryError.message,
            duration: Date.now() - startTime
          },
          { status: 500 }
        )
      }

      const expiredCount = expiredItems?.length || 0

      if (expiredCount > 0) {
        // 만료된 항목 삭제
        const { error: deleteError } = await supabase
          .from('embedding_cache')
          .delete()
          .lt('expires_at', now)

        if (deleteError) {
          console.error('[EmbeddingCache Cleanup] Delete error:', deleteError)
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to cleanup cache',
              details: deleteError.message,
              duration: Date.now() - startTime
            },
            { status: 500 }
          )
        }
      }

      const duration = Date.now() - startTime
      console.log(`[EmbeddingCache Cleanup] Completed (fallback). Deleted: ${expiredCount}, Duration: ${duration}ms`)

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${expiredCount} expired cache entries (fallback)`,
        deleted: expiredCount,
        method: 'direct_delete',
        duration
      })
    }

    // -------------------------------------------------------------------------
    // [STEP 4] 결과 반환
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime
    console.log(`[EmbeddingCache Cleanup] Completed. Deleted: ${deletedCount}, Duration: ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired cache entries`,
      deleted: deletedCount,
      method: 'rpc_function',
      duration
    })

  } catch (error) {
    console.error('[EmbeddingCache Cleanup] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
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
