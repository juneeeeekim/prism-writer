/**
 * =============================================================================
 * P4: GET /api/rag/preferences - 프로젝트별 RAG 임계값 조회
 * =============================================================================
 * 
 * @description 프로젝트의 개인화된 RAG 임계값을 조회합니다.
 * @module api/rag/preferences
 * @since 2026-01-06
 * @related 2601062127_Adaptive_Threshold_System_체크리스트.md P4-03-01
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { getProjectThreshold } from '@/lib/rag/projectPreferences'

// =============================================================================
// [P4-03-01] Next.js 동적 렌더링 설정
// =============================================================================
export const dynamic = 'force-dynamic'

// =============================================================================
// [P4-03-01] GET Handler
// =============================================================================

/**
 * 프로젝트별 RAG preferences 조회
 * 
 * @param req - NextRequest
 * @returns preferences 객체 또는 에러
 * 
 * @example
 * GET /api/rag/preferences?projectId=xxx
 * 
 * Response:
 * { preferences: { groundedness_threshold: 0.72, ... } }
 */
export async function GET(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. projectId 파라미터 확인
    // -------------------------------------------------------------------------
    const projectId = req.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'projectId 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. preferences 조회
    // -------------------------------------------------------------------------
    const preferences = await getProjectThreshold(supabase, user.id, projectId)

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (error) {
    logger.error('[API/RAG/Preferences]', 'Error occurred', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
