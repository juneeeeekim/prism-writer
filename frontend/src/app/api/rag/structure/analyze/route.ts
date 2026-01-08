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
import { vectorSearch } from '@/lib/rag/search'
import {
  fetchProjectDocuments,
  fetchTemplateCriteria,
  fetchProjectTemplate,
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
  /** [S1-01] 분석 대상 문서 ID 목록 (선택) - 없으면 전체 분석 */
  targetDocIds?: string[]
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

/** LLM 최대 토큰 수 (2000 -> 8192 상향 조정) */
const LLM_MAX_TOKENS = 8192

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
    const { projectId, templateId, targetDocIds } = body

    // -------------------------------------------------------------------------
    // [S1-01] targetDocIds 유효성 검증
    // -------------------------------------------------------------------------
    if (targetDocIds !== undefined && !Array.isArray(targetDocIds)) {
      return NextResponse.json(
        {
          success: false,
          suggestion: null,
          message: 'targetDocIds는 문자열 배열이어야 합니다.',
          error: 'BAD_REQUEST',
        },
        { status: 400 }
      )
    }

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
    // [S1-01] Context-Aware 문서 분류 (선택 분석 모드)
    // -------------------------------------------------------------------------
    // targetDocIds가 있으면 '선택 분석', 없으면 '전체 분석'
    let targetDocs = documents
    let contextDocs: typeof documents = []

    if (targetDocIds && targetDocIds.length > 0) {
      // 선택 분석 모드: 선택된 문서 = 분석 대상, 나머지 = 배경 지식
      targetDocs = documents.filter((d) => targetDocIds.includes(d.id))
      contextDocs = documents.filter((d) => !targetDocIds.includes(d.id))

      // 선택한 문서가 실제로 존재하는지 확인
      if (targetDocs.length === 0) {
        return NextResponse.json(
          {
            success: false,
            suggestion: null,
            message: '선택한 문서가 프로젝트에 없습니다.',
            error: 'NOT_FOUND',
          },
          { status: 404 }
        )
      }

      console.log(
        `[StructureAnalyze] Selective Mode: ${targetDocs.length} targets, ${contextDocs.length} context`
      )
    } else {
      // 전체 분석 모드 (기존 동작 유지)
      console.log(
        `[StructureAnalyze] Full Mode: ${documents.length} documents`
      )
    }

    // -------------------------------------------------------------------------
    // [P2-01-05] 템플릿 기준 조회 (자동 + 수동)
    // [RAG-STRUCTURE] 프로젝트에 연결된 템플릿 자동 조회
    // -------------------------------------------------------------------------
    let rubricCriteria: (TemplateSchema | DefaultStructureItem)[] = []

    // 1. 명시적 templateId가 있으면 해당 템플릿 사용
    if (templateId) {
      rubricCriteria = await fetchTemplateCriteria(templateId, supabase)
    }

    // 2. templateId가 없으면 프로젝트에 연결된 템플릿 자동 조회
    if (rubricCriteria.length === 0) {
      const projectTemplate = await fetchProjectTemplate(projectId, supabase)
      if (projectTemplate) {
        rubricCriteria = projectTemplate
        console.log(`[StructureAnalyze] 프로젝트 템플릿 자동 적용: ${rubricCriteria.length}개 기준`)
      }
    }

    // 3. 템플릿 기준이 없으면 기본 구조 사용
    if (rubricCriteria.length === 0) {
      rubricCriteria = getDefaultStructure()
      console.log('[StructureAnalyze] 기본 구조(서론/본론/결론) 사용')
    }

    // -------------------------------------------------------------------------
    // [RAG-STRUCTURE] 참고자료 검색 (프로젝트 격리)
    // 문서 구조 관련 참고자료를 검색하여 LLM 컨텍스트에 포함
    // -------------------------------------------------------------------------
    let evidenceContext = ''
    try {
      // 검색 쿼리: 분석 대상 문서의 제목들 + "문서 구조" 키워드
      const docTitles = targetDocs.map(d => d.title).join(', ')
      const searchQuery = `문서 구조 순서 배치 ${docTitles}`.substring(0, 200)

      const evidenceResults = await vectorSearch(searchQuery, {
        userId: session.user.id,
        topK: 5,
        minScore: 0.5, // 구조 관련 참고자료는 넓게 검색
        projectId: projectId,
      })

      if (evidenceResults.length > 0) {
        evidenceContext = evidenceResults
          .map((r, i) => `[참고자료 ${i + 1}] ${r.content}`)
          .join('\n\n')
        console.log(`[StructureAnalyze] 참고자료 ${evidenceResults.length}개 검색 완료`)
      } else {
        console.log('[StructureAnalyze] 검색된 참고자료 없음')
      }
    } catch (searchError) {
      // RAG 검색 실패 시 Graceful Degradation (기본 분석 계속 진행)
      console.warn('[StructureAnalyze] 참고자료 검색 실패 (계속 진행):', searchError)
    }

    // -------------------------------------------------------------------------
    // [P2-01-06] LLM 프롬프트 생성 (with Context-Aware + RAG Evidence)
    // -------------------------------------------------------------------------
    // [S1-01] 기본 프롬프트 생성 (분석 대상 문서 + 참고자료 컨텍스트)
    let prompt = buildStructurePrompt(targetDocs, rubricCriteria, evidenceContext)

    // [S1-01] 배경 지식 섹션 추가 (선택 분석 모드일 때)
    if (contextDocs.length > 0) {
      const contextSection = contextDocs
        .map((d) => {
          const summary = d.content?.slice(0, 200) || '내용 없음'
          return `- ${d.title}: ${summary}...`
        })
        .join('\n')

      // 프롬프트 앞부분에 배경 지식 삽입
      prompt = `
[참고 배경 정보 - 분석 대상 아님]
아래는 분석 대상이 아닌 다른 문서들의 요약입니다. 전체 맥락을 파악하는 데 참고하세요.
${contextSection}

---
${prompt}

[중요 지시사항]
위 '참고 배경 정보'는 순서 변경 대상이 아닙니다. 
오직 '[집중 분석 대상]' 문서들의 순서만 조정하세요.
`
    }

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
        // [DEBUG] 에러 상세 내용을 메시지에 포함
        message: `LLM 분석 실패: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
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
