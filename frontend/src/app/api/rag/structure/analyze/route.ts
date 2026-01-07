// =============================================================================
// PRISM Writer - AI Structurer API - Structure Analysis
// =============================================================================
// 파일: frontend/src/app/api/rag/structure/analyze/route.ts
// 역할: 프로젝트 문서들을 분석하여 최적의 구조/순서를 제안
// 메서드: POST
// Pipeline: AI Structurer (P2-01)
// 생성일: 2026-01-08
//
// [시니어 개발자 주석]
// - Critical Constraint: 기존 api/outline, api/rag/evaluate는 수정하지 않음
// - 083 격리 정책 준수: projectId 필수, 소유권 검증 필수
// - LLM 호출 실패 시 Graceful Degradation (빈 제안 반환)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/llm/gateway'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import {
  fetchProjectDocuments,
  fetchTemplateCriteria,
  getDefaultStructure,
  buildStructurePrompt,
  parseAnalysisResult,
  type StructureSuggestion,
  type DefaultStructureItem,
  type TemplateSchema,
} from '@/lib/rag/structureHelpers'

// =============================================================================
// [P2-01] 타입 정의
// =============================================================================

/**
 * 요청 바디 인터페이스
 */
interface AnalyzeRequest {
  /** 프로젝트 ID (필수) - 083 격리 정책 */
  projectId: string
  /** 템플릿 ID (선택) - 없으면 기본 구조 사용 */
  templateId?: string
}

/**
 * 응답 인터페이스
 */
interface AnalyzeResponse {
  /** 성공 여부 */
  success: boolean
  /** 구조 제안 결과 (null이면 문서 없음) */
  suggestion: StructureSuggestion | null
  /** 메시지 */
  message?: string
  /** 에러 코드 */
  error?: string
}

// =============================================================================
// [P2-01] 상수
// =============================================================================

/** LLM 호출 타임아웃 (30초) */
const LLM_TIMEOUT_MS = 30000

/** LLM 최대 토큰 수 */
const LLM_MAX_TOKENS = 2000

// =============================================================================
// [P2-01] POST: 구조 분석 API
// =============================================================================

/**
 * 프로젝트 문서를 분석하여 최적의 구조를 제안합니다.
 *
 * @description
 * [시니어 개발자 주석]
 * 1. 인증 확인
 * 2. projectId 필수 검증 (083 격리 정책)
 * 3. 프로젝트 소유권 검증
 * 4. 문서 조회
 * 5. 템플릿 기준 조회 (선택)
 * 6. LLM 프롬프트 생성 및 호출
 * 7. 결과 파싱 및 반환
 *
 * @param request - Next.js 요청 객체
 * @returns JSON 응답
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // -------------------------------------------------------------------------
    // [P2-01-00] Feature Flag 체크
    // -------------------------------------------------------------------------
    if (!FEATURE_FLAGS.ENABLE_AI_STRUCTURER) {
      return NextResponse.json(
        {
          success: false,
          suggestion: null,
          message: 'AI Structurer 기능이 비활성화되어 있습니다.',
          error: 'FEATURE_DISABLED',
        },
        { status: 403 }
      )
    }

    // -------------------------------------------------------------------------
    // [P2-01-01] 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          suggestion: null,
          message: '로그인이 필요합니다.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // -------------------------------------------------------------------------
    // [P2-01-02] 요청 바디 파싱 및 검증
    // -------------------------------------------------------------------------
    const body: AnalyzeRequest = await request.json()
    const { projectId, templateId } = body

    // projectId 필수 (083 격리 정책)
    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          suggestion: null,
          message: 'projectId는 필수입니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // [P2-01-03] 프로젝트 소유권 검증 (Strict Isolation)
    // -------------------------------------------------------------------------
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .single()

    if (projectError || !project) {
      console.warn(
        '[StructureAnalyze] 프로젝트 접근 거부:',
        projectId,
        session.user.id
      )
      return NextResponse.json(
        {
          success: false,
          suggestion: null,
          message: '해당 프로젝트에 접근할 수 없습니다.',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      )
    }

    // -------------------------------------------------------------------------
    // [P2-01-04] 프로젝트 문서 조회
    // -------------------------------------------------------------------------
    const documents = await fetchProjectDocuments(projectId, supabase)

    // 문서가 없는 경우
    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        suggestion: null,
        message: '분석할 문서가 없습니다.',
      })
    }

    // -------------------------------------------------------------------------
    // [P2-01-05] 템플릿 기준 조회 (선택)
    // -------------------------------------------------------------------------
    let rubricCriteria: (TemplateSchema | DefaultStructureItem)[] = templateId
      ? await fetchTemplateCriteria(templateId, supabase)
      : []

    // 템플릿 기준이 없으면 기본 구조 사용
    if (rubricCriteria.length === 0) {
      rubricCriteria = getDefaultStructure()
    }

    // -------------------------------------------------------------------------
    // [P2-01-06] LLM 프롬프트 생성
    // -------------------------------------------------------------------------
    const prompt = buildStructurePrompt(documents, rubricCriteria)

    // -------------------------------------------------------------------------
    // [P2-01-07] LLM 호출 (Graceful Degradation)
    // -------------------------------------------------------------------------
    let llmResponse: string

    try {
      const result = await generateText(prompt, {
        maxOutputTokens: LLM_MAX_TOKENS,
        temperature: 0.3, // 낮은 온도로 일관성 확보
      })

      llmResponse = result.text
    } catch (llmError) {
      // LLM 호출 실패 시 빈 제안 반환 (서비스 중단 방지)
      console.error('[StructureAnalyze] LLM 호출 실패:', llmError)

      return NextResponse.json({
        success: true,
        suggestion: {
          suggestedOrder: [],
          gaps: [],
        },
        message: 'LLM 분석에 실패했습니다. 나중에 다시 시도해주세요.',
      })
    }

    // -------------------------------------------------------------------------
    // [P2-01-08] 결과 파싱 및 반환
    // -------------------------------------------------------------------------
    const suggestion = parseAnalysisResult(llmResponse)

    return NextResponse.json({
      success: true,
      suggestion,
      message: `${documents.length}개 문서 분석 완료`,
    })
  } catch (error) {
    // -------------------------------------------------------------------------
    // [P2-01-99] 전역 에러 핸들링
    // -------------------------------------------------------------------------
    console.error('[StructureAnalyze] 예상치 못한 오류:', error)

    return NextResponse.json(
      {
        success: false,
        suggestion: null,
        message: '서버 오류가 발생했습니다.',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }
}
