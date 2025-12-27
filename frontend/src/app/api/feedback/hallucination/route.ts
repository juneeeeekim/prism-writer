// =============================================================================
// PRISM Writer - Hallucination Feedback API
// =============================================================================
// 파일: frontend/src/app/api/feedback/hallucination/route.ts
// 역할: 환각 답변에 대한 사용자 피드백 수집 API
// 생성일: 2025-12-27
// 
// [RAG 환각 방지 업그레이드]
// - 사용자 명시적 피드백만 DB에 저장 (DB 부하 최소화)
// - 자동 탐지 결과는 콘솔 로그만 기록
// - 디렉터님 요청에 따라 코멘트 입력 기능 포함
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MemoryService } from '@/lib/rag/memory'

export const runtime = 'nodejs'

// =============================================================================
// 타입 정의
// =============================================================================

interface FeedbackRequest {
  /** 세션 ID */
  sessionId?: string
  /** 메시지 ID (있을 경우) */
  messageId?: string
  
  // ---------------------------------------------------------------------------
  // 컨텍스트 데이터
  // ---------------------------------------------------------------------------
  /** 사용자 질문 */
  userQuery: string
  /** 검색된 문서 정보 */
  retrievedDocs?: Array<{ title: string; chunkId: string }>
  /** 모델 응답 */
  modelResponse: string
  /** 사용한 모델 ID */
  modelId?: string
  
  // ---------------------------------------------------------------------------
  // 피드백 데이터
  // ---------------------------------------------------------------------------
  /** 긍정/부정 피드백 */
  isPositive: boolean
  /** 피드백 유형 */
  feedbackType?: 'hallucination' | 'quality' | 'other'
  /** 사용자 코멘트 (선택) */
  userComment?: string
  
  // ---------------------------------------------------------------------------
  // 자동 탐지 데이터 (로그용, DB 저장하지 않음)
  // ---------------------------------------------------------------------------
  /** 자동 탐지 결과 */
  autoDetected?: boolean
  /** 탐지 신뢰도 */
  detectionConfidence?: number
  /** 매칭된 패턴 */
  matchedPattern?: string
}

// =============================================================================
// POST 핸들러 - 피드백 저장
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. 요청 본문 파싱
    // -------------------------------------------------------------------------
    const body: FeedbackRequest = await req.json()
    
    // -------------------------------------------------------------------------
    // 2. 필수 필드 검증
    // -------------------------------------------------------------------------
    if (!body.userQuery || !body.modelResponse) {
      return NextResponse.json(
        { success: false, error: 'userQuery and modelResponse are required' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 자동 탐지 데이터는 로그만 기록 (DB 저장 안 함)
    // -------------------------------------------------------------------------
    if (body.autoDetected) {
      console.log('[Hallucination Feedback] Auto-detected (log only, not saved to DB)')
      console.log(`[Hallucination Feedback] - Query: "${body.userQuery.substring(0, 50)}..."`)
      console.log(`[Hallucination Feedback] - Confidence: ${body.detectionConfidence}`)
      console.log(`[Hallucination Feedback] - Pattern: ${body.matchedPattern}`)
      
      // 자동 탐지는 성공 응답만 반환 (DB 저장 안 함)
      return NextResponse.json({
        success: true,
        saved: false,
        message: 'Auto-detected feedback logged (not saved to DB)'
      })
    }

    // -------------------------------------------------------------------------
    // 5. 사용자 명시적 피드백 저장 & (Optimized) 선호 지식 메모리 저장
    // -------------------------------------------------------------------------
    console.log('[Hallucination Feedback] User explicit feedback - saving to DB')
    
    // 1) Feedback Insert Promise
    const feedbackPromise = supabase
      .from('hallucination_feedback')
      .insert({
        user_id: user.id,
        session_id: body.sessionId || null,
        message_id: body.messageId || null,
        
        // 컨텍스트
        user_query: body.userQuery,
        retrieved_docs: body.retrievedDocs || null,
        model_response: body.modelResponse,
        model_id: body.modelId || null,
        
        // 피드백
        is_positive: body.isPositive,
        feedback_type: body.feedbackType || 'other',
        user_comment: body.userComment || null,
        
        // 자동 탐지 결과 (참고용으로 저장)
        auto_detected_hallucination: false, 
        detection_confidence: null,
        matched_pattern: null,
      })

    // 2) Memory Save Promise (Condition: Positive Feedback)
    // [JeDebug Fix] Parallel execution using Promise.all for performance
    // Fail-open strategy: Memory save failure should NOT block feedback response
    const shouldSaveToMemory = body.isPositive && body.userQuery && body.modelResponse
    
    const memoryPromise = shouldSaveToMemory
      ? MemoryService.savePreference(user.id, body.userQuery, body.modelResponse)
          .catch(err => {
            console.error('[Feedback API] Memory save failed (non-blocking):', err)
            return null // Return null to proceed
          })
      : Promise.resolve(null)

    // 3) Await All
    // feedbackResult: { data, error, ... } from Supabase
    // memoryResult: null or void
    const [feedbackResult, _memoryResult] = await Promise.all([
      feedbackPromise,
      memoryPromise
    ])
    
    const { error: feedbackError } = feedbackResult

    if (feedbackError) {
      console.error('[Hallucination Feedback] DB insert error:', feedbackError)
      
      // 테이블이 없는 경우 (마이그레이션 안 됨)
      if (feedbackError.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'Feedback table not found. Migration required.',
          details: 'Please run migration 038_hallucination_feedback.sql'
        }, { status: 500 })
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to save feedback' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 6. 성공 응답
    // -------------------------------------------------------------------------
    console.log('[Hallucination Feedback] Saved successfully')
    
    return NextResponse.json({
      success: true,
      saved: true,
      message: 'Feedback saved successfully'
    })

  } catch (error: any) {
    console.error('[Hallucination Feedback] API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', details: error.message },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET 핸들러 - API 상태 확인 (디버깅용)
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/feedback/hallucination',
    version: '1.0.0',
    description: 'Hallucination feedback collection API',
    note: 'Auto-detected feedback is logged only. User explicit feedback is saved to DB.'
  })
}
