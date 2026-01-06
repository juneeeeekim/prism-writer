/**
 * =============================================================================
 * P4: POST /api/rag/feedback - 학습 이벤트 제출
 * =============================================================================
 * 
 * @description 사용자 피드백/행동을 학습 이벤트로 처리하여 임계값을 조정합니다.
 * @module api/rag/feedback
 * @since 2026-01-06
 * @related 2601062127_Adaptive_Threshold_System_체크리스트.md P4-03-02
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'
import { 
  applyLearningEvent, 
  isValidSignalType, 
  SignalType,
  getSignalDescription 
} from '@/lib/rag/projectPreferences'

// =============================================================================
// [P4-03-02] Next.js 동적 렌더링 설정
// =============================================================================
export const dynamic = 'force-dynamic'

// =============================================================================
// [P4-03-02] Request Body 타입
// =============================================================================

interface FeedbackRequest {
  /** 프로젝트 ID (필수) */
  projectId: string
  /** 학습 신호 유형 (필수) */
  signalType: SignalType
  /** 대상 메시지 ID (채팅 피드백 시) */
  messageId?: string
  /** 추가 이벤트 데이터 */
  eventData?: Record<string, unknown>
}

// =============================================================================
// [P4-03-02] POST Handler
// =============================================================================

/**
 * 학습 이벤트 제출 및 임계값 조정
 * 
 * @param req - NextRequest
 * @returns 조정 결과 또는 에러
 * 
 * @example
 * POST /api/rag/feedback
 * Body: { projectId: "xxx", signalType: "chat_helpful", messageId: "yyy" }
 * 
 * Response:
 * { success: true, newThreshold: 0.68, message: "피드백이 반영되었습니다." }
 */
export async function POST(req: NextRequest) {
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
    // 2. Request Body 파싱
    // -------------------------------------------------------------------------
    let body: FeedbackRequest

    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Bad Request', message: '유효하지 않은 JSON 형식입니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 필수 필드 검증
    // -------------------------------------------------------------------------
    if (!body.projectId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'projectId가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!body.signalType) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'signalType이 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. signalType 유효성 검증
    // -------------------------------------------------------------------------
    if (!isValidSignalType(body.signalType)) {
      return NextResponse.json(
        { 
          error: 'Bad Request', 
          message: `유효하지 않은 signalType입니다: ${body.signalType}`,
          validTypes: [
            'eval_override', 'rubric_adopt', 'doc_reupload', 'example_pin',
            'chat_helpful', 'chat_not_helpful', 'chat_hallucination'
          ]
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 5. 학습 이벤트 적용
    // -------------------------------------------------------------------------
    const result = await applyLearningEvent(
      supabase,
      user.id,
      body.projectId,
      body.signalType,
      {
        messageId: body.messageId,
        ...body.eventData,
      }
    )

    // -------------------------------------------------------------------------
    // 6. 결과 반환
    // -------------------------------------------------------------------------
    if (result.success) {
      return NextResponse.json({
        success: true,
        newThreshold: result.newThreshold,
        adjustment: result.adjustment,
        signalDescription: getSignalDescription(body.signalType),
        message: '피드백이 반영되었습니다.',
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Processing Failed',
          message: result.error || '피드백 처리에 실패했습니다.',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('[API/RAG/Feedback]', 'Error occurred', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
