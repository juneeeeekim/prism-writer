// =============================================================================
// PRISM Writer - AI Structurer Helper Functions
// =============================================================================
// 파일: frontend/src/lib/rag/structureHelpers.ts
// 역할: 문서 구조 분석 API의 헬퍼 함수 모음
// Pipeline: AI Structurer (P2-02 ~ P2-04)
// 생성일: 2026-01-08
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TemplateSchema } from './templateTypes'

// =============================================================================
// [P2-02] 타입 정의
// =============================================================================

/**
 * 문서 요약 정보
 *
 * @description
 * 시니어 개발자 주석: DB에서 조회한 문서 정보의 간략 버전
 * sort_order는 null일 수 있으므로 nullable로 정의
 */
export interface DocumentSummary {
  /** 문서 ID */
  id: string
  /** 문서 제목 */
  title: string
  /** 문서 내용 */
  content: string
  /** 생성 일시 */
  created_at: string
  /** 정렬 순서 (nullable) */
  sort_order: number | null
}

/**
 * 구조 제안 - 개별 문서 순서
 *
 * @description
 * 주니어 개발자 주석: LLM이 제안한 각 문서의 순서 및 태그 정보
 */
export interface OrderSuggestion {
  /** 문서 ID */
  docId: string
  /** 할당된 구조 태그 (e.g., "서론", "본론", "결론" 또는 루브릭 기준명) */
  assignedTag: string
  /** 해당 태그를 할당한 이유 */
  reason: string
}

/**
 * 구조 제안 - 누락 요소
 *
 * @description
 * UX/UI 전문가 주석: 문서 흐름에서 누락된 요소를 표시
 * afterDocId가 null이면 맨 처음에 누락된 요소
 */
export interface GapSuggestion {
  /** 이 문서 다음에 누락된 요소가 있음 (null이면 맨 처음) */
  afterDocId: string | null
  /** 누락된 요소 유형 */
  missingElement: string
  /** 보완 제안 */
  suggestion: string
}

/**
 * 구조 분석 결과
 *
 * @description
 * 시니어 개발자 주석: LLM 분석의 최종 결과 객체
 */
export interface StructureSuggestion {
  /** 제안된 문서 순서 */
  suggestedOrder: OrderSuggestion[]
  /** 발견된 구조적 누락 (Gaps) */
  gaps: GapSuggestion[]
}

/**
 * 기본 구조 기준 (템플릿이 없을 때 사용)
 *
 * @description
 * 시니어 개발자 주석: fallback용 기본 구조
 */
export interface DefaultStructureItem {
  /** 카테고리명 */
  category: string
  /** 설명 */
  rationale: string
}

// =============================================================================
// [P2-02] fetchProjectDocuments - 프로젝트 문서 조회
// =============================================================================

/**
 * 프로젝트에 속한 문서들을 조회합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - sort_order 기준 오름차순 정렬
 * - null 값은 마지막에 배치
 * - RLS 정책으로 인해 해당 프로젝트 소유자만 조회 가능
 *
 * @param projectId - 프로젝트 ID
 * @param supabase - Supabase 클라이언트
 * @returns 문서 요약 목록
 * @throws Error - DB 조회 실패 시
 */
export async function fetchProjectDocuments(
  projectId: string,
  supabase: SupabaseClient
): Promise<DocumentSummary[]> {
  // ---------------------------------------------------------------------------
  // [P2-02-01] 문서 조회 쿼리 실행
  // [BUG FIX] documents → user_documents (실제 테이블명)
  // ---------------------------------------------------------------------------
  const { data, error } = await supabase
    .from('user_documents')
    .select('id, title, content, created_at, sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true, nullsFirst: false })

  // ---------------------------------------------------------------------------
  // [P2-02-02] 에러 처리
  // ---------------------------------------------------------------------------
  if (error) {
    console.error('[fetchProjectDocuments] DB 조회 실패:', error.message)
    throw new Error(`Document fetch failed: ${error.message}`)
  }

  // ---------------------------------------------------------------------------
  // [P2-02-03] 결과 반환 (null 안전 처리)
  // ---------------------------------------------------------------------------
  return (data || []) as DocumentSummary[]
}

// =============================================================================
// [P2-03] getDefaultStructure - 기본 구조 기준 반환
// =============================================================================

/**
 * 템플릿이 없을 때 사용할 기본 구조 기준을 반환합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - 일반적인 글쓰기 구조 (서론/본론/결론)
 * - templateId가 없을 때 fallback으로 사용
 *
 * @returns 기본 구조 기준 배열
 */
export function getDefaultStructure(): DefaultStructureItem[] {
  return [
    {
      category: '서론 (Introduction)',
      rationale: '독자의 관심을 끌고 주제를 소개하는 도입부',
    },
    {
      category: '본론 (Body)',
      rationale: '핵심 내용을 전개하고 근거를 제시하는 중심부',
    },
    {
      category: '결론 (Conclusion)',
      rationale: '내용을 요약하고 마무리하는 마침부',
    },
  ]
}

// =============================================================================
// [P2-03] fetchTemplateCriteria - 템플릿 기준 조회
// =============================================================================

/**
 * 템플릿에서 구조 관련 기준(criteria)을 조회합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - rag_templates 테이블에서 criteria_json 조회
 * - 'structure' 카테고리의 기준만 필터링 (있는 경우)
 * - 없으면 전체 기준 반환
 *
 * @param templateId - 템플릿 ID
 * @param supabase - Supabase 클라이언트
 * @returns 템플릿 기준 배열
 */
export async function fetchTemplateCriteria(
  templateId: string,
  supabase: SupabaseClient
): Promise<TemplateSchema[]> {
  // ---------------------------------------------------------------------------
  // [P2-03-01] 템플릿 조회
  // ---------------------------------------------------------------------------
  const { data, error } = await supabase
    .from('rag_templates')
    .select('criteria_json')
    .eq('id', templateId)
    .single()

  if (error || !data) {
    console.warn('[fetchTemplateCriteria] 템플릿 조회 실패, 기본 구조 사용:', error?.message)
    return []
  }

  // ---------------------------------------------------------------------------
  // [P2-03-02] 구조 카테고리 필터링 (선택적)
  // ---------------------------------------------------------------------------
  const criteria = (data.criteria_json || []) as TemplateSchema[]

  // 'structure' 카테고리가 있으면 우선 사용, 없으면 전체 반환
  const structureCriteria = criteria.filter(c => c.category === 'structure')
  return structureCriteria.length > 0 ? structureCriteria : criteria
}

// =============================================================================
// [RAG-STRUCTURE] fetchProjectTemplate - 프로젝트 연결 템플릿 자동 조회
// =============================================================================

/**
 * 프로젝트에 연결된 템플릿의 구조 기준을 조회합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - rag_templates 테이블에서 project_id로 템플릿 조회
 * - 가장 최근 승인된 템플릿 또는 가장 최근 생성된 템플릿 사용
 * - 없으면 null 반환 (기본 구조 사용하도록)
 *
 * @param projectId - 프로젝트 ID
 * @param supabase - Supabase 클라이언트
 * @returns 템플릿 기준 배열 또는 null
 */
export async function fetchProjectTemplate(
  projectId: string,
  supabase: SupabaseClient
): Promise<TemplateSchema[] | null> {
  // ---------------------------------------------------------------------------
  // [RAG-STRUCTURE-01] 프로젝트의 템플릿 조회 (승인된 것 우선)
  // - rejected 템플릿은 아예 제외 (거부된 템플릿 사용 방지)
  // - 정렬: approved → draft → pending (알파벳 오름차순)
  // - 동일 status 내에서는 최신 생성순
  // ---------------------------------------------------------------------------
  const { data: template, error: templateError } = await supabase
    .from('rag_templates')
    .select('criteria_json, name, status')
    .eq('project_id', projectId)
    .in('status', ['approved', 'pending', 'draft']) // rejected 제외
    .order('status', { ascending: true }) // approved(a) > draft(d) > pending(p)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (templateError) {
    console.warn('[fetchProjectTemplate] 템플릿 조회 실패:', templateError.message)
    return null
  }

  if (!template) {
    // 프로젝트에 템플릿이 없는 경우
    return null
  }

  console.log(`[fetchProjectTemplate] 템플릿 "${template.name}" (${template.status}) 적용`)

  // ---------------------------------------------------------------------------
  // [RAG-STRUCTURE-02] 구조 카테고리 우선 필터링
  // ---------------------------------------------------------------------------
  const criteria = (template.criteria_json || []) as TemplateSchema[]
  const structureCriteria = criteria.filter(c => c.category === 'structure')

  return structureCriteria.length > 0 ? structureCriteria : criteria
}

// =============================================================================
// [P2-03] buildStructurePrompt - LLM 프롬프트 생성
// =============================================================================

/**
 * 구조 분석을 위한 LLM 프롬프트를 생성합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - 문서 내용을 500자로 제한하여 토큰 절약
 * - JSON 출력 형식을 명시하여 파싱 용이성 확보
 * - 루브릭 기준이 있으면 해당 기준으로, 없으면 기본 구조로 분석
 * - [RAG-STRUCTURE] 참고자료 컨텍스트를 활용하여 더 정확한 분석
 *
 * @param documents - 분석할 문서 목록
 * @param rubricCriteria - 루브릭 기준 (TemplateSchema 또는 DefaultStructureItem)
 * @param evidenceContext - [RAG-STRUCTURE] 참고자료 컨텍스트 (선택)
 * @returns LLM 프롬프트 문자열
 */
export function buildStructurePrompt(
  documents: DocumentSummary[],
  rubricCriteria: (TemplateSchema | DefaultStructureItem)[],
  evidenceContext?: string
): string {
  // ---------------------------------------------------------------------------
  // [P2-03-01] 문서 목록 포맷팅 (500자 제한)
  // ---------------------------------------------------------------------------
  const docList = documents
    .map((d, i) => {
      // content가 null/undefined일 경우 빈 문자열 처리
      const content = (d.content || '').substring(0, 500)
      const truncated = content.length >= 500 ? '...(생략)' : ''
      return `[문서 ${i + 1}: ${d.title || '제목 없음'}] (ID: ${d.id})\n${content}${truncated}`
    })
    .join('\n---\n')

  // ---------------------------------------------------------------------------
  // [P2-03-02] 루브릭 기준 포맷팅
  // ---------------------------------------------------------------------------
  const rubricDescription = rubricCriteria
    .map((c) => {
      // TemplateSchema와 DefaultStructureItem 모두 지원
      const category = c.category
      const rationale = c.rationale
      return `- ${category}: ${rationale}`
    })
    .join('\n')

  // ---------------------------------------------------------------------------
  // [P2-03-03] 참고자료 기반 프롬프트 vs 기본 구조 프롬프트 분기
  // [핵심 수정] 참고자료가 있으면 기본 구조(서론/본론/결론)를 사용하지 않음
  // ---------------------------------------------------------------------------

  if (evidenceContext && evidenceContext.trim().length > 0) {
    // =========================================================================
    // [케이스 A] 참고자료가 있는 경우 - 참고자료 청크 기반으로만 분석
    // =========================================================================
    return `당신은 글 구조 전문가입니다.

**핵심 지시사항:**
- 아래 [참고자료]에서 문서 구조에 관한 기준, 용어, 개념을 추출하여 분석에 사용하세요.
- **일반적인 "서론/본론/결론" 분류를 사용하지 마세요.**
- 반드시 참고자료에 언급된 구조 관련 용어를 assignedTag로 사용하세요.

[참고자료]
${evidenceContext}

---

[분석 대상 문서]
${docList}

[출력 형식 (JSON)]
반드시 아래 형식의 JSON으로만 응답하세요.

\`\`\`json
{
  "suggestedOrder": [
    { "docId": "문서ID", "assignedTag": "참고자료에서 추출한 구조 태그", "reason": "참고자료 근거 인용" }
  ],
  "gaps": [
    { "afterDocId": "문서ID 또는 null", "missingElement": "참고자료 기준 누락 요소", "suggestion": "참고자료 기반 보완 제안" }
  ]
}
\`\`\`

주의사항:
1. docId는 반드시 위 문서 목록의 실제 ID를 사용하세요.
2. assignedTag는 반드시 [참고자료]에서 추출한 구조 용어를 사용하세요.
3. gaps가 없으면 빈 배열 []로 표시하세요.
4. reason에는 참고자료의 내용을 직접 인용하세요.`
  }

  // =========================================================================
  // [케이스 B] 참고자료가 없는 경우 - 기본 구조 또는 템플릿 기준 사용
  // =========================================================================
  return `당신은 글 구조 전문가입니다.
아래 문서들을 분석하고, 주어진 '구조 기준(Rubric)'에 따라 최적의 순서를 제안하세요.

[구조 기준 (Rubric)]
${rubricDescription}

[분석 대상 문서]
${docList}

[출력 형식 (JSON)]
반드시 아래 형식의 JSON으로만 응답하세요.

\`\`\`json
{
  "suggestedOrder": [
    { "docId": "문서ID", "assignedTag": "기준명", "reason": "이 기준을 선택한 이유" }
  ],
  "gaps": [
    { "afterDocId": "문서ID 또는 null", "missingElement": "누락된 요소", "suggestion": "보완 제안" }
  ]
}
\`\`\`

주의사항:
1. docId는 반드시 위 문서 목록의 실제 ID를 사용하세요.
2. assignedTag는 반드시 [구조 기준]에 있는 카테고리명을 사용하세요.
3. gaps가 없으면 빈 배열 []로 표시하세요.`
}

// =============================================================================
// [P2-04] parseAnalysisResult - LLM 응답 파싱
// =============================================================================

/**
 * LLM 응답에서 구조 분석 결과를 파싱합니다.
 *
 * @description
 * 시니어 개발자 주석:
 * - JSON 코드 블록 (```json ... ```) 추출 시도
 * - 실패 시 전체 응답을 JSON으로 파싱 시도
 * - 최종 실패 시 빈 결과 반환 (Graceful Degradation)
 *
 * @param llmResponse - LLM 응답 문자열
 * @returns 구조 분석 결과
 */
export function parseAnalysisResult(llmResponse: string): StructureSuggestion {
  // ---------------------------------------------------------------------------
  // [P2-04-01] JSON 블록 추출 시도
  // ---------------------------------------------------------------------------
  try {
    // ```json ... ``` 블록 추출
    const jsonMatch = llmResponse.match(/```json\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : llmResponse.trim()

    // ---------------------------------------------------------------------------
    // [P2-04-02] JSON 파싱
    // ---------------------------------------------------------------------------
    const parsed = JSON.parse(jsonStr)

    // ---------------------------------------------------------------------------
    // [P2-04-03] 결과 검증 및 반환
    // ---------------------------------------------------------------------------
    return {
      suggestedOrder: Array.isArray(parsed.suggestedOrder)
        ? parsed.suggestedOrder
        : [],
      gaps: Array.isArray(parsed.gaps)
        ? parsed.gaps
        : [],
    }
  } catch (e) {
    // ---------------------------------------------------------------------------
    // [P2-04-04] Graceful Degradation - 파싱 실패 시 빈 결과
    // ---------------------------------------------------------------------------
    console.error('[parseAnalysisResult] JSON 파싱 실패:', e)
    console.error('[parseAnalysisResult] 원본 응답:', llmResponse.substring(0, 200))

    return {
      suggestedOrder: [],
      gaps: []
    }
  }
}

// =============================================================================
// [P2-04] Type Exports
// =============================================================================

export type { TemplateSchema }
