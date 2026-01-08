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
  /** [P3-01] DB에 저장된 제안 ID (DB 저장 실패 시 undefined) */
  suggestionId?: string
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

/** [Phase 2/3] 참고자료 최대 문자 수 (~7,500 토큰) */
const MAX_EVIDENCE_CHARS = 30000

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
    // [RAG-STRUCTURE] 적응형 참고자료 검색 (Phase 2/3)
    // - Phase 2: 프로젝트 전체 청크 조회
    // - Phase 3: 적응형 분기 (소규모=전체 사용, 대규모=벡터 검색)
    // -------------------------------------------------------------------------
    let evidenceContext = ''
    try {
      // -----------------------------------------------------------------------
      // [Phase 2] 프로젝트의 모든 참고자료 청크 조회
      // -----------------------------------------------------------------------
      const { data: allChunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select(`
          id,
          content,
          document_id,
          chunk_index,
          metadata,
          user_documents!inner(
            id,
            title,
            project_id
          )
        `)
        .eq('user_documents.project_id', projectId)
        .order('chunk_index', { ascending: true })
        .limit(100)

      if (chunksError) {
        throw new Error(`청크 조회 실패: ${chunksError.message}`)
      }

      // 전체 청크 문자 수 계산
      const totalChars = (allChunks || []).reduce((sum, c) => sum + (c.content?.length || 0), 0)
      let selectedChunks: Array<{ content: string; metadata?: Record<string, unknown> }> = []

      // -----------------------------------------------------------------------
      // [Phase 3] 적응형 분기
      // -----------------------------------------------------------------------
      if (totalChars <= MAX_EVIDENCE_CHARS) {
        // -------------------------------------------------------------------
        // [Case A] 전체 사용 가능 - 검색 불필요 (소규모 프로젝트)
        // -------------------------------------------------------------------
        selectedChunks = (allChunks || []).map(c => ({
          content: c.content || '',
          metadata: c.metadata as Record<string, unknown> | undefined
        }))
        console.log(`[StructureAnalyze] 전체 참고자료 사용 (${selectedChunks.length}개, ${totalChars}자)`)

      } else {
        // -------------------------------------------------------------------
        // [Case B] 벡터 검색으로 관련 청크 선별 (대규모 프로젝트)
        // -------------------------------------------------------------------
        const docContents = targetDocs
          .map(d => (d.content || '').substring(0, 200))
          .join(' ')

        // 하드코딩 없이 문서 내용만 사용
        const evidenceResults = await vectorSearch(docContents.substring(0, 300), {
          userId: session.user.id,
          topK: 20,
          minScore: 0.25,
          projectId: projectId,
        })

        // 토큰 제한 내에서 청크 선택
        let charCount = 0
        selectedChunks = evidenceResults
          .filter(r => {
            if (charCount + r.content.length > MAX_EVIDENCE_CHARS) return false
            charCount += r.content.length
            return true
          })
          .map(r => ({
            content: r.content,
            metadata: r.metadata as Record<string, unknown> | undefined
          }))

        console.log(`[StructureAnalyze] 벡터 검색 사용 (${selectedChunks.length}개, ${charCount}자)`)
      }

      // -----------------------------------------------------------------------
      // [Step 3] 컨텍스트 생성
      // -----------------------------------------------------------------------
      if (selectedChunks.length > 0) {
        evidenceContext = selectedChunks
          .map((c, i) => `[참고자료 ${i + 1}] ${c.content}`)
          .join('\n\n')
      } else {
        console.log('[StructureAnalyze] 참고자료 없음')
      }

    } catch (searchError) {
      // Graceful Degradation - 실패해도 기본 분석 계속
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

    // -------------------------------------------------------------------------
    // [P3-01-B] DB에 분석 결과 저장 (Adaptive RAG 피드백 연동용)
    // -------------------------------------------------------------------------
    let suggestionId: string | undefined

    try {
      const isSelectiveMode = Array.isArray(targetDocIds) && targetDocIds.length > 0

      const { data: savedSuggestion, error: saveError } = await supabase
        .from('structure_suggestions')
        .insert({
          project_id: projectId,
          user_id: session.user.id,
          template_id: templateId || null,
          target_doc_ids: targetDocIds || [],
          is_selective_mode: isSelectiveMode,
          suggested_order: suggestion.suggestedOrder,
          gaps: suggestion.gaps || [],
          overall_summary: null,  // StructureSuggestion에 overallSummary 없음, 추후 확장 대비
          doc_count: documents.length,
        })
        .select('id')
        .single()

      if (!saveError && savedSuggestion) {
        suggestionId = savedSuggestion.id
        console.log('[StructureAnalyze] DB 저장 성공:', suggestionId)
      } else {
        console.warn('[StructureAnalyze] DB 저장 실패 (분석은 계속):', saveError?.message)
      }
    } catch (dbError) {
      // DB 저장 실패해도 분석 결과는 정상 반환 (서비스 중단 방지)
      console.warn('[StructureAnalyze] DB 저장 예외 (분석은 계속):', dbError)
    }

    return NextResponse.json({
      success: true,
      suggestion,
      suggestionId,  // [P3-01] DB에 저장된 제안 ID (undefined일 수 있음)
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
