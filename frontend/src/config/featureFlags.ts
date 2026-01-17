// =============================================================================
// PRISM Writer - Feature Flags Configuration
// =============================================================================
// 파일: frontend/src/config/featureFlags.ts
// 역할: 전역 Feature Flag 관리 (Pipeline v4/v5 전환, UI 레이아웃 등)
// 생성일: 2025-12-25
// 
// 주석(시니어 개발자): 이 파일은 모든 Feature Flag를 중앙 집중 관리합니다.
// 비상 시 환경 변수만 변경하여 기능을 끄거나 이전 버전으로 롤백할 수 있습니다.
// =============================================================================

// =============================================================================
// Feature Flags 정의
// =============================================================================

/**
 * 전역 Feature Flag 객체
 * 
 * @description
 * 모든 환경 변수 기반 Feature Flag를 한 곳에서 관리합니다.
 * 기본값은 모두 true (최신 기능 활성화)이며,
 * 환경 변수를 'false'로 설정하면 비활성화됩니다.
 */
export const FEATURE_FLAGS = {
  /**
   * Pipeline v4 활성화 (Gemini 3 Flash)
   * 환경 변수: ENABLE_PIPELINE_V4
   * 기본값: true
   */
  ENABLE_PIPELINE_V4: process.env.ENABLE_PIPELINE_V4 !== 'false',

  /**
   * Pipeline v5 활성화 (Shadow Workspace + Patch 시스템)
   * 환경 변수: ENABLE_PIPELINE_V5
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_PIPELINE_V5: process.env.ENABLE_PIPELINE_V5 !== 'false',

  /**
   * 3패널 UI 활성화 (에디터 + 부합도 + 제안 카드)
   * 환경 변수: NEXT_PUBLIC_USE_V3_TEMPLATES
   * 기본값: false (2패널 레이아웃 유지)
   */
  ENABLE_THREE_PANEL_UI: process.env.NEXT_PUBLIC_USE_V3_TEMPLATES === 'true',

  /**
   * Gemini LLM 사용 (OpenAI fallback 대신)
   * 환경 변수: ENABLE_GEMINI_LLM
   * 기본값: true
   */
  ENABLE_GEMINI_LLM: process.env.ENABLE_GEMINI_LLM !== 'false',

  /**
   * 듀얼 인덱스 검색 (Rule + Example 분리)
   * 환경 변수: ENABLE_DUAL_INDEX
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_DUAL_INDEX: process.env.ENABLE_DUAL_INDEX !== 'false',

  /**
   * Shadow Workspace 시뮬레이션
   * 환경 변수: ENABLE_SHADOW_WORKSPACE
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_SHADOW_WORKSPACE: process.env.ENABLE_SHADOW_WORKSPACE !== 'false',

  /**
   * 패치 제안 기능
   * 환경 변수: ENABLE_PATCH_SUGGESTIONS
   * 기본값: true (프로덕션 활성화됨)
   */
  ENABLE_PATCH_SUGGESTIONS: process.env.ENABLE_PATCH_SUGGESTIONS !== 'false',

  /**
   * 어시스턴트 세션 시스템 활성화 (Outline/Evaluation 탭)
   * 환경 변수: ENABLE_ASSISTANT_SESSIONS
   * 기본값: false (점진적 롤아웃)
   */
  ENABLE_ASSISTANT_SESSIONS: process.env.ENABLE_ASSISTANT_SESSIONS === 'true',

  // ==========================================================================
  // RAG 환각 답변 개선 Feature Flags (2025-12-27 추가)
  // ==========================================================================

  /**
   * 개선된 시스템 프롬프트 활성화
   * 환경 변수: ENABLE_IMPROVED_PROMPT
   * 기본값: true (환각 방지를 위해 기본 활성화)
   * 
   * @description
   * - 참고 자료 우선 지시 강화
   * - 회피형 환각 방지 규칙 추가
   * - Chain of Thought 사고 과정 유도
   */
  ENABLE_IMPROVED_PROMPT: process.env.ENABLE_IMPROVED_PROMPT !== 'false',

  /**
   * Query Expansion 활성화 (검색 쿼리 확장)
   * 환경 변수: ENABLE_QUERY_EXPANSION
   * 기본값: false (성능 테스트 후 활성화)
   * 
   * @description
   * - 사용자 쿼리를 동의어로 확장하여 검색 커버리지 향상
   * - 도메인 특화 용어 매핑 적용
   */
  ENABLE_QUERY_EXPANSION: process.env.ENABLE_QUERY_EXPANSION !== 'false',

  /**
   * 환각 탐지 기능 활성화
   * 환경 변수: ENABLE_HALLUCINATION_DETECTION
   * 기본값: false (수동 검증 기간 후 활성화)
   * 
   * @description
   * - LLM 응답에서 회피형 환각 패턴 탐지
   * - 자동 탐지 결과는 로그만 기록 (DB 저장 안 함)
   * - 롤백: OFF 시 탐지 로직 완전 비활성화
   */
  ENABLE_HALLUCINATION_DETECTION: process.env.ENABLE_HALLUCINATION_DETECTION !== 'false',

  /**
   * RAFT 파인튜닝 기능 활성화
   * 환경 변수: ENABLE_RAFT_FEATURES
   * 기본값: false (명시적 활성화 필요)
   * 
   * @description
   * - RAFT 데이터셋 관리 API 활성화
   * - 합성 데이터 생성 기능 활성화
   * - 관리자 RAFT 대시보드 활성화
   * - 롤백: OFF 시 모든 RAFT 기능 비활성화
   */
  ENABLE_RAFT_FEATURES: process.env.ENABLE_RAFT_FEATURES === 'true',

  /**
   * 단계형 패치 활성화 (1차 핵심 → 2차 표현 → 3차 디테일)
   * 환경 변수: FF_PATCH_STAGING
   * 기본값: false (점진적 롤아웃)
   */
  FF_PATCH_STAGING: process.env.FF_PATCH_STAGING === 'true',

  /**
   * 근거 강도 표시 (display_only)
   * 환경 변수: FF_EVIDENCE_QUALITY
   * 기본값: false
   */
  FF_EVIDENCE_QUALITY: process.env.FF_EVIDENCE_QUALITY === 'true',

  // ==========================================================================
  // [P3-01] Phase 3 Feature Flags (2025-12-29 추가)
  // ==========================================================================

  /**
   * 채팅에 Template 컨텍스트 사용 여부
   * 환경 변수: USE_TEMPLATE_FOR_CHAT
   * 기본값: false (점진적 롤아웃)
   * 
   * @description
   * - 채팅 RAG 검색 시 사용자 템플릿의 규칙/예시를 참고자료로 활용
   * - 활성화 시 시스템 프롬프트에 템플릿 컨텍스트 추가
   */
  USE_TEMPLATE_FOR_CHAT: process.env.USE_TEMPLATE_FOR_CHAT === 'true',

  /**
   * 평가 결과에 source_citations 포함 여부
   * 환경 변수: ENABLE_SOURCE_CITATIONS
   * 기본값: true (투명성 강화)
   * 
   * @description
   * - 평가 근거의 원문 인용을 결과에 포함
   * - Align Judge 응답에 citation 필드 추가
   */
  ENABLE_SOURCE_CITATIONS: process.env.ENABLE_SOURCE_CITATIONS !== 'false',

  /**
   * Shadow Mode (v2/v3 병렬 실행 및 비교 로깅)
   * 환경 변수: ENABLE_SHADOW_MODE
   * 기본값: false (성능 비용)
   * 
   * @description
   * - v2와 v3 평가를 동시에 실행하여 결과 비교
   * - 마이그레이션 검증용
   */
  ENABLE_SHADOW_MODE: process.env.ENABLE_SHADOW_MODE === 'true',

  // ==========================================================================
  // [P4-DoD] 코드 품질 Feature Flags (2025-12-31 추가)
  // ==========================================================================

  /**
   * 디버그 로그 활성화
   * 환경 변수: ENABLE_DEBUG_LOGS
   * 기본값: development에서만 true
   * 
   * @description
   * - Production에서는 자동 비활성화
   * - 텔레메트리 및 디버깅 로그 제어
   */
  ENABLE_DEBUG_LOGS: process.env.ENABLE_DEBUG_LOGS === 'true' || 
                     process.env.NODE_ENV === 'development',

  // ==========================================================================
  // [CITATION] RAG 인용 표기 Feature Flags (2026-01-03 추가)
  // ==========================================================================

  /**
   * AI 응답에 인용 마커 ([1], [2]) 및 참고문헌 목록 표시
   * 환경 변수: NEXT_PUBLIC_ENABLE_CITATION_MARKERS
   * 기본값: true (인용 표기 활성화)
   * 
   * @description
   * - 참고 자료 기반 답변에 [1], [2] 형식의 인용 마커 추가
   * - 답변 하단에 참고 자료 목록 (📚 참고 자료) 표시
   * - 롤백: OFF 시 기존 인용 마커 없는 답변으로 복귀
   */
  ENABLE_CITATION_MARKERS: process.env.NEXT_PUBLIC_ENABLE_CITATION_MARKERS !== 'false',

  // ==========================================================================
  // [PATTERN] 패턴 기반 루브릭 파이프라인 Feature Flags (2026-01-03 추가)
  // ==========================================================================

  /**
   * 패턴 추출 기능 활성화
   * 환경 변수: NEXT_PUBLIC_ENABLE_PATTERN_EXTRACTION
   * 기본값: false (명시적 활성화 필요)
   * 
   * @description
   * - 업로드 문서에서 형식 패턴(훅/CTA/비유 등)을 LLM으로 추출
   * - 롤백: OFF 시 패턴 추출 기능 비활성화
   */
  ENABLE_PATTERN_EXTRACTION: process.env.NEXT_PUBLIC_ENABLE_PATTERN_EXTRACTION !== 'false',

  /**
   * 패턴 기반 검색 활성화
   * 환경 변수: NEXT_PUBLIC_ENABLE_PATTERN_BASED_SEARCH
   * 기본값: false (명시적 활성화 필요)
   * 
   * @description
   * - pattern_type 컬럼을 활용한 패턴 기반 RAG 검색
   * - hybridSearch에서 patternType 필터 지원
   * - 롤백: OFF 시 기존 의미 기반 검색만 사용
   */
  ENABLE_PATTERN_BASED_SEARCH: process.env.NEXT_PUBLIC_ENABLE_PATTERN_BASED_SEARCH !== 'false',

  /**
   * 루브릭 후보 UI 활성화
   * 환경 변수: NEXT_PUBLIC_ENABLE_RUBRIC_CANDIDATE_UI
   * 기본값: false (명시적 활성화 필요)
   * 
   * @description
   * - 루브릭 후보 생성/채택/검수 UI 표시
   * - 관리자 기능으로 제한
   * - 롤백: OFF 시 루브릭 관리 UI 숨김
   */
  ENABLE_RUBRIC_CANDIDATE_UI: process.env.NEXT_PUBLIC_ENABLE_RUBRIC_CANDIDATE_UI !== 'false',

  // ==========================================================================
  // [R-11] 리트리벌 파이프라인 v2 Feature Flags (2026-01-03 추가)
  // ==========================================================================

  /**
   * Query Builder 활성화 (R-05)
   * 환경 변수: NEXT_PUBLIC_ENABLE_QUERY_BUILDER
   * 기본값: true (프로덕션 활성화)
   * 
   * @description
   * - 루브릭 기반 검색 쿼리 자동 생성 (rule/example/pattern)
   * - 롤백: OFF 시 기존 단순 쿼리 방식으로 복귀
   */
  ENABLE_QUERY_BUILDER: process.env.NEXT_PUBLIC_ENABLE_QUERY_BUILDER !== 'false',

  /**
   * Sufficiency Gate 활성화 (R-06)
   * 환경 변수: NEXT_PUBLIC_ENABLE_SUFFICIENCY_GATE
   * 기본값: true (프로덕션 활성화)
   * 
   * @description
   * - 검색 결과 근거 충분성 검사
   * - 부족 시 Judge에 '판정 보류' 상태 전달
   * - 롤백: OFF 시 충분성 검사 건너뜀
   */
  ENABLE_SUFFICIENCY_GATE: process.env.NEXT_PUBLIC_ENABLE_SUFFICIENCY_GATE !== 'false',

  /**
   * Criteria Pack 시스템 활성화 (R-07, R-08)
   * 환경 변수: NEXT_PUBLIC_ENABLE_CRITERIA_PACK
   * 기본값: true (프로덕션 활성화)
   * 
   * @description
   * - 구조화된 근거 패키지(CriteriaPackV2) 구축
   * - Query Builder → 검색 → Gate 검증 통합 파이프라인
   * - 롤백: OFF 시 기존 개별 검색 방식 사용
   */
  ENABLE_CRITERIA_PACK: process.env.NEXT_PUBLIC_ENABLE_CRITERIA_PACK !== 'false',

  /**
   * Pin/Unpin 기능 활성화 (R-10)
   * 환경 변수: NEXT_PUBLIC_ENABLE_PIN_UNPIN
   * 기본값: true (프로덕션 활성화)
   * 
   * @description
   * - 청크 고정 기능 (최대 5개 제한)
   * - 고정된 청크는 검색 결과 상단 고정
   * - 롤백: OFF 시 핀 버튼 숨김
   */
  ENABLE_PIN_UNPIN: process.env.NEXT_PUBLIC_ENABLE_PIN_UNPIN !== 'false',

  // ==========================================================================
  // [P2-01] Search Quality Enhancement Feature Flags (2026-01-05 추가)
  // ==========================================================================

  /**
   * 가중 하이브리드 검색 활성화 (P2-01)
   * 환경 변수: NEXT_PUBLIC_ENABLE_WEIGHTED_HYBRID_SEARCH
   * 기본값: false (점진적 롤아웃)
   * 
   * @description
   * - RRF 대신 가중 점수 합산(Weighted Score Fusion) 사용
   * - vectorWeight: 0.7, keywordWeight: 0.3 기본값
   * - 롤백: OFF 시 기존 RRF 로직 유지
   */
  ENABLE_WEIGHTED_HYBRID_SEARCH: process.env.NEXT_PUBLIC_ENABLE_WEIGHTED_HYBRID_SEARCH !== 'false',

  /**
   * Re-ranking 활성화 (P2-02)
   * 환경 변수: NEXT_PUBLIC_ENABLE_RERANKING
   * 기본값: false (LLM 비용 고려)
   * 
   * @description
   * - 1차 검색 결과 상위 20개를 LLM으로 재평가
   * - 쿼리-문서 관련도 정밀 재정렬
   * - 롤백: OFF 시 rerank 건너뜀
   */
  ENABLE_RERANKING: process.env.NEXT_PUBLIC_ENABLE_RERANKING !== 'false',

  /**
   * Re-ranking 사용 LLM 모델 (P2-02)
   * 환경 변수: NEXT_PUBLIC_RERANK_MODEL
   * 기본값: 'gemini'
   */
  RERANK_MODEL: (process.env.NEXT_PUBLIC_RERANK_MODEL || 'gemini') as 'gemini' | 'openai',

  /**
   * Re-ranking 대상 후보 수 (P2-02)
   * 환경 변수: NEXT_PUBLIC_RERANK_TOP_CANDIDATES
   * 기본값: 20
   */
  RERANK_TOP_CANDIDATES: parseInt(process.env.NEXT_PUBLIC_RERANK_TOP_CANDIDATES || '20'),

  // ==========================================================================
  // [P3-01] Agentic Chunking Feature Flags (2026-01-06 추가)
  // ==========================================================================

  /**
   * Agentic Chunking 활성화 (P3-01)
   * 환경 변수: NEXT_PUBLIC_ENABLE_AGENTIC_CHUNKING
   * 기본값: false (LLM 비용 고려)
   * 
   * @description
   * - LLM이 문서 구조를 분석하여 최적 분할 지점 결정
   * - 실패 시 기존 semanticChunk() fallback
   * - 롤백: OFF 시 기존 chunkDocument 로직 유지
   */
  ENABLE_AGENTIC_CHUNKING: process.env.NEXT_PUBLIC_ENABLE_AGENTIC_CHUNKING !== 'false',

  /**
   * Agentic Chunking 사용 LLM 모델 (P3-01)
   * 환경 변수: NEXT_PUBLIC_AGENTIC_CHUNKING_MODEL
   * 기본값: 'gemini'
   */
  AGENTIC_CHUNKING_MODEL: (process.env.NEXT_PUBLIC_AGENTIC_CHUNKING_MODEL || 'gemini') as 'gemini' | 'openai',

  // ==========================================================================
  // [P3-02] Self-RAG Feature Flags (2026-01-06 추가)
  // ==========================================================================

  /**
   * Self-RAG 활성화 (P3-02)
   * 환경 변수: NEXT_PUBLIC_ENABLE_SELF_RAG
   * 기본값: false (LLM 비용 고려)
   * 
   * @description
   * - 4단계 자기 검증 RAG: 검색 필요 판단 → 관련도 평가 → 생성 → 근거 검증
   * - 할루시네이션 탐지 및 경고 표시
   * - 롤백: OFF 시 기존 검색 로직 유지
   */
  ENABLE_SELF_RAG: process.env.NEXT_PUBLIC_ENABLE_SELF_RAG !== 'false',

  /**
   * Self-RAG 사용 LLM 모델 (P3-02)
   * 환경 변수: NEXT_PUBLIC_SELF_RAG_MODEL
   * 기본값: 'gemini'
   */
  SELF_RAG_MODEL: (process.env.NEXT_PUBLIC_SELF_RAG_MODEL || 'gemini') as 'gemini' | 'openai',

  /**
   * 검색 필요도 임계값 (P3-02)
   * 환경 변수: NEXT_PUBLIC_SELF_RAG_RETRIEVAL_THRESHOLD
   * 기본값: 0.5
   */
  SELF_RAG_RETRIEVAL_THRESHOLD: parseFloat(process.env.NEXT_PUBLIC_SELF_RAG_RETRIEVAL_THRESHOLD || '0.5'),

  /**
   * 관련도 필터 임계값 (P3-02)
   * 환경 변수: NEXT_PUBLIC_SELF_RAG_CRITIQUE_THRESHOLD
   * 기본값: 0.6
   */
  SELF_RAG_CRITIQUE_THRESHOLD: parseFloat(process.env.NEXT_PUBLIC_SELF_RAG_CRITIQUE_THRESHOLD || '0.6'),

  // ==========================================================================
  // [AI-STRUCTURER] AI Structurer Feature Flags (2026-01-08 추가)
  // ==========================================================================

  /**
   * AI Structurer 기능 활성화 (P1-01)
   * 환경 변수: NEXT_PUBLIC_ENABLE_AI_STRUCTURER
   * 기본값: false (명시적 활성화 필요)
   *
   * @description
   * - AI 기반 문서 구조화 기능 활성화
   * - 환경 변수 미설정 시 자동 비활성화 (안전한 기본값)
   * - 롤백: OFF 시 기존 수동 구조화 방식 유지
   */
  ENABLE_AI_STRUCTURER: process.env.NEXT_PUBLIC_ENABLE_AI_STRUCTURER !== 'false',

  // ==========================================================================
  // [SHADOW-WRITER] Shadow Writer Feature Flags (2026-01-09 추가)
  // ==========================================================================

  /**
   * Shadow Writer 기능 활성화 (실시간 문장 완성)
   * 환경 변수: NEXT_PUBLIC_ENABLE_SHADOW_WRITER
   * 기본값: false (명시적 활성화 필요)
   *
   * @description
   * - 에디터에서 Ghost Text로 다음 문장 제안
   * - Tab 키로 제안 수락, Escape로 취소
   * - 롤백: OFF 시 기존 TextEditor 사용
   */
  ENABLE_SHADOW_WRITER: process.env.NEXT_PUBLIC_ENABLE_SHADOW_WRITER !== 'false',

  /**
   * Shadow Writer Trigger Mode (비용 제어)
   * 환경 변수: NEXT_PUBLIC_SHADOW_WRITER_TRIGGER_MODE
   * 기본값: 'sentence-end' (문장 끝에서만 호출 - 권장)
   * 옵션: 'auto' | 'sentence-end' | 'manual'
   */
  SHADOW_WRITER_TRIGGER_MODE: (process.env.NEXT_PUBLIC_SHADOW_WRITER_TRIGGER_MODE || 'sentence-end') as 'auto' | 'sentence-end' | 'manual',

  /**
   * Rich Shadow Writer 활성화 (TipTap 기반 에디터)
   * 환경 변수: NEXT_PUBLIC_ENABLE_RICH_SHADOW_WRITER
   * 기본값: false (점진적 롤아웃)
   *
   * @description
   * - TipTap 기반 Rich Text Editor 사용
   * - Muted Text (비강조 텍스트) 마킹 기능 지원
   * - 기존 ShadowWriter의 Ghost Text 기능 유지
   * - 롤백: OFF 시 기존 ShadowWriter (textarea) 사용
   */
  ENABLE_RICH_SHADOW_WRITER: process.env.NEXT_PUBLIC_ENABLE_RICH_SHADOW_WRITER === 'true',

  // ==========================================================================
  // [DEEP-SCHOLAR] Deep Scholar Feature Flags (2026-01-09 추가)
  // ==========================================================================

  /**
   * Deep Scholar 기능 활성화 (외부 학술/정부 자료 검색)
   * 환경 변수: NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR
   * 기본값: false (명시적 활성화 필요)
   *
   * @description
   * - 학술 논문, 정부 통계 등 검증된 외부 자료 검색
   * - 인용 삽입 기능 (각주 형식)
   * - Tavily API 사용 (비용 발생)
   * - 롤백: OFF 시 Research 탭 숨김
   */
  ENABLE_DEEP_SCHOLAR: process.env.NEXT_PUBLIC_ENABLE_DEEP_SCHOLAR !== 'false',
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Feature Flag 활성화 여부 확인
 * 
 * @param flag - 확인할 플래그 이름 (boolean 플래그만)
 * @returns 플래그 활성화 여부
 * 
 * @example
 * ```typescript
 * if (isFeatureEnabled('ENABLE_PIPELINE_V5')) {
 *   // v5 전용 로직
 * }
 * ```
 */
// [P2-01] 타입 수정: boolean 플래그만 허용 (RERANK_MODEL, RERANK_TOP_CANDIDATES 제외)
type BooleanFeatureFlags = {
  [K in keyof typeof FEATURE_FLAGS]: typeof FEATURE_FLAGS[K] extends boolean ? K : never
}[keyof typeof FEATURE_FLAGS]

export function isFeatureEnabled(flag: BooleanFeatureFlags): boolean {
  return FEATURE_FLAGS[flag] as boolean
}

/**
 * 현재 Pipeline 버전 확인
 * 
 * @returns 'v3' | 'v4' | 'v5'
 */
export function getPipelineVersion(): 'v3' | 'v4' | 'v5' {
  if (FEATURE_FLAGS.ENABLE_PIPELINE_V5) return 'v5'
  if (FEATURE_FLAGS.ENABLE_PIPELINE_V4) return 'v4'
  return 'v3'
}

/**
 * UI 레이아웃 타입 확인
 * 
 * @returns 'dual' (2패널) | 'three' (3패널)
 */
export function getUILayoutType(): 'dual' | 'three' {
  return FEATURE_FLAGS.ENABLE_THREE_PANEL_UI ? 'three' : 'dual'
}

/**
 * LLM Provider 확인
 * 
 * @returns 'gemini' | 'openai'
 */
export function getLLMProvider(): 'gemini' | 'openai' {
  return FEATURE_FLAGS.ENABLE_GEMINI_LLM ? 'gemini' : 'openai'
}

// =============================================================================
// [P4-DoD] Debug Logging Helper - 프로덕션 자동 비활성화
// =============================================================================

/**
 * 조건부 디버그 로그
 * 
 * @param tag - 로그 태그 (예: '[FeatureFlags]', '[RAG]')
 * @param args - 로그 인자
 * 
 * @description
 * - ENABLE_DEBUG_LOGS가 true일 때만 출력
 * - Production에서는 자동 비활성화
 * - console.log의 drop-in replacement
 * 
 * @example
 * ```typescript
 * debugLog('[Search]', 'Query:', query, 'Results:', results.length)
 * ```
 */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (FEATURE_FLAGS.ENABLE_DEBUG_LOGS) {
    console.log(tag, ...args)
  }
}

/**
 * 모든 Feature Flag 상태를 로그 출력 (디버깅용)
 * 
 * @returns void
 */
export function logFeatureFlags(): void {
  // [P4-DoD] debugLog 사용으로 Production 자동 비활성화
  debugLog('[FeatureFlags] Current state:')
  debugLog('  Pipeline Version:', getPipelineVersion())
  debugLog('  UI Layout:', getUILayoutType())
  debugLog('  LLM Provider:', getLLMProvider())
  debugLog('  Flags:', FEATURE_FLAGS)
}

// =============================================================================
// Type Exports
// =============================================================================

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS
export type PipelineVersion = 'v3' | 'v4' | 'v5'
export type UILayoutType = 'dual' | 'three'
