// =============================================================================
// PRISM Writer - LLM Usage Map (중앙화된 서비스-모델 매핑)
// =============================================================================
// 파일: frontend/src/config/llm-usage-map.ts
// 역할: 서비스별 LLM 모델 매핑을 한 곳에서 중앙 관리
// 근거: 2512281121_LLM_Centralization_Expert_Meeting.md "🏆 최종 아키텍처 제안"
// =============================================================================

import { getDefaultModelId, isValidModelId, MODEL_REGISTRY } from './models';

// =============================================================================
// [2026-05-03] Phase 2: 환경 변수 오버라이드 지원
// 설계 의도(왜 이 구조인가):
//   - 운영 중 특정 컨텍스트의 모델을 코드 변경 없이 빠르게 교체할 수 있어야
//     한다(쿼터 이슈·실험·티어별 정책 등).
//   - 코드(LLM_USAGE_MAP)는 기본값을 보유하고, 환경 변수가 있을 때만
//     해당 컨텍스트를 덮어쓴다. 잘못된 모델 ID는 무시되고 경고만 남긴다
//     → 잘못된 ENV 설정이 즉시 장애로 이어지지 않도록 안전 측면 우선.
//   - 환경 변수 키 규칙: MODEL_<CONTEXT>  (예: rag.answer → MODEL_RAG_ANSWER)
// =============================================================================

/**
 * 컨텍스트 → 환경 변수 키 변환.
 *
 * @example
 *   contextToEnvKey('rag.answer')  // 'MODEL_RAG_ANSWER'
 *   contextToEnvKey('coach.persona.feedback') // 'MODEL_COACH_PERSONA_FEEDBACK'
 */
function contextToEnvKey(context: string): string {
  return `MODEL_${context.toUpperCase().replace(/[.\-]/g, '_')}`;
}

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * LLM 사용 컨텍스트 타입
 * 
 * @description
 * 서비스에서 LLM을 사용하는 모든 컨텍스트를 정의합니다.
 * 새로운 LLM 사용처가 추가되면 이 타입에 추가해야 합니다.
 */
export type LLMUsageContext =
  // ---------------------------------------------------------------------------
  // 기존 컨텍스트 (변경 금지)
  // ---------------------------------------------------------------------------
  | 'rag.answer'           // RAG 답변 생성
  | 'rag.reviewer'         // RAG 검토자
  | 'rag.reranker'         // 검색 결과 재순위
  | 'template.consistency' // 템플릿 일관성 검증 (Consistency Gate)
  | 'template.hallucination' // 환각 검증 (Hallucination Gate)
  | 'template.regression'  // 템플릿 회귀 검사 (Regression Gate)
  | 'example.mining'       // 예시 마이닝
  | 'rule.mining'          // 규칙 마이닝
  | 'premium.answer'       // 프리미엄 답변
  | 'premium.reviewer'     // 프리미엄 검토
  | 'raft.generation'      // RAFT 합성 데이터 생성
  // ---------------------------------------------------------------------------
  // 신규 컨텍스트 (P1-01-A, 2026-01-10 추가)
  // ---------------------------------------------------------------------------
  | 'suggest.completion'   // Shadow Writer 자동완성 제안
  | 'rag.selfrag'          // Self-RAG 검증
  | 'rag.chunking'         // Agentic Chunking
  | 'rag.rerank'           // rerank.ts 전용 (기존 reranker와 구분)
  | 'research.query'       // Deep Scholar 쿼리 생성
  | 'research.summarize'   // Deep Scholar 요약
  | 'pattern.extraction'   // 패턴 추출
  | 'judge.align'          // 개별 평가
  | 'judge.holistic'       // 종합 평가
  | 'outline.generation'   // 목차 생성
  | 'ocr.vision'           // OCR 비전
  // ---------------------------------------------------------------------------
  // AI Coach Persona (P3-04~06, 2026-03-19 추가)
  // ---------------------------------------------------------------------------
  | 'coach.style.analysis'   // 문서 스타일 분석 (코치 생성)
  | 'coach.persona.feedback'; // 코치 페르소나 기반 피드백

/**
 * 사용 설정 인터페이스
 * 
 * @description
 * 각 컨텍스트별 LLM 설정을 정의합니다.
 */
export interface UsageConfig {
  /** 기본 사용 모델 ID */
  modelId: string;
  /** 폴백 모델 ID (기본 모델 실패 시 사용) */
  fallback?: string;
  /** 최대 출력 토큰 수 */
  maxTokens?: number;
  /** 컨텍스트 설명 (한글) */
  description: string;
  /**
   * [v3.0] 생성 파라미터 (Jemiel Ensemble Strategy)
   * 중앙에서 제어하는 결정론적(Deterministic) vs 확률적(Probabilistic) 설정
   */
  generationConfig?: {
    temperature: number;
    topP: number;
    topK?: number;
  };
}

// =============================================================================
// LLM 사용 매핑 데이터
// =============================================================================

/**
 * 🎯 서비스별 LLM 모델 매핑 - 한눈에 확인 가능!
 * 
 * @description
 * 이 파일 하나로 모든 기능의 LLM 모델을 관리합니다.
 * 모델 변경이 필요하면 이 파일만 수정하세요.
 * 
 * @example
 * // 모델 변경 예시: RAG 답변 모델을 Pro로 변경
 * 'rag.answer': {
 *   modelId: 'gemini-3-pro-preview', // 변경
 *   ...
 * }
 */
export const LLM_USAGE_MAP: Record<LLMUsageContext, UsageConfig> = {
  // ---------------------------------------------------------------------------
  // RAG Pipeline
  // ---------------------------------------------------------------------------
  
  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  [현재 사용] Google Gemini 3.0 Flash Preview                            │
  // │  - 장점: 빠른 속도, 큰 컨텍스트 (1M), Thinking 기능, 저렴한 비용          │
  // │  - 비용: $0.50/1M input, $3.00/1M output (가장 저렴)                     │
  // │  - 환경변수: GOOGLE_API_KEY 필수                                        │
  // └─────────────────────────────────────────────────────────────────────────┘
  'rag.answer': {
    modelId: 'gemini-3-flash-preview',
    fallback: 'gpt-5-mini',
    maxTokens: 2700,
    description: 'RAG 기반 답변 생성',
    // [Creative] 창의적 생성 구간
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    },
  },

  /* ===========================================================================
  // [ALTERNATIVE MODELS] 대체 모델 설정 (주석 해제하여 사용)
  // 사용법: 위의 rag.answer 설정을 주석 처리하고, 아래 중 하나를 주석 해제
  // ===========================================================================
  //
  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  [Option 1] OpenAI GPT-5.2                                              │
  // │  - 장점: 최신 Reasoning 능력, 긴 컨텍스트 (400K)                         │
  // │  - 단점: 비용 높음 ($1.75/1M input, $14/1M output)                      │
  // │  - 환경변수: OPENAI_API_KEY 필수                                        │
  // └─────────────────────────────────────────────────────────────────────────┘
  */ 
  
  
  /* 'rag.answer': {
       modelId: 'gpt-5.2-2025-12-11',
       fallback: 'gemini-3-flash-preview',
       maxTokens: 2700,
       description: 'RAG 기반 답변 생성 (OpenAI GPT-5.2)',
       generationConfig: {
         temperature: 0.9,
         topP: 0.95,
         // topK: OpenAI 미지원 - 자동 무시됨
       },
     },
  */  
  
  
  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  [Option 2] Anthropic Claude 4.5 Sonnet                                 │
  // │  - 장점: 높은 안정성, 좋은 한국어 지원                                    │
  // │  - 단점: Gemini 대비 비용 높음 ($3/1M input, $15/1M output)              │
  // │  - 환경변수: ANTHROPIC_API_KEY 필수                                     │
  // └─────────────────────────────────────────────────────────────────────────┘
  

  /* 'rag.answer': {
       modelId: 'claude-sonnet-4-5-20250929',
       fallback: 'gemini-3-flash-preview',
       maxTokens: 2700,
       description: 'RAG 기반 답변 생성 (Claude 4.5 Sonnet)',
       generationConfig: {
         temperature: 0.9,
         topP: 0.95,
         topK: 40,  // Anthropic은 topK 지원
       },
     },
  */
  
     //===========================================================================
  

  'rag.reviewer': {
    modelId: 'gemma-3-27b-it',
    maxTokens: 500,
    description: 'RAG 답변 품질 검토',
    // [Lossless] 무손실 검증 구간
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'rag.reranker': {
    modelId: 'gemma-3-2b-it',
    // 주석(시니어, 2026-05-04 Phase 3 완전 적용): 같은 Gemini 패밀리 내 fallback.
    // cross-provider fallback은 응답 포맷 차이로 위험하므로 같은 SDK가 처리할 수
    // 있는 모델로 한정한다. 27B는 비용이 더 높지만 reranker는 호출 빈도가 낮아
    // fallback 시점의 비용 영향이 제한적이다.
    fallback: 'gemma-3-27b-it',
    description: '검색 결과 재순위 지정',
    // [Lossless] 순위 매기기는 결정적이어야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // Template System (Gates)
  // ---------------------------------------------------------------------------
  // 주석(시니어, 2026-05-04 Phase 3 완전 적용): 모든 template gate에 같은
  // Gemini 패밀리 fallback을 정의한다. JSON 응답 포맷이 동일한 SDK 내에서만
  // 보장되므로 fallback도 Gemini/Gemma 안에서 결정한다.
  'template.consistency': {
    modelId: 'gemini-3-flash-preview',
    fallback: 'gemma-3-27b-it',
    description: '템플릿 일관성 검증 (Consistency Gate)',
    // [Lossless] 검증은 결정적이어야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'template.hallucination': {
    modelId: 'gemma-3-27b-it',
    fallback: 'gemini-3-flash-preview',
    description: '환각 검증 (Hallucination Gate)',
    // [Lossless] 할루시네이션 탐지는 팩트 기반이므로 결정적
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'template.regression': {
    modelId: 'gemma-3-2b-it',
    fallback: 'gemma-3-12b-it',
    description: '템플릿 회귀 검사 (Regression Gate)',
    // [Lossless] 회귀 테스트는 언제나 결과가 같아야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // Mining Features
  // ---------------------------------------------------------------------------
  'example.mining': {
    modelId: 'gemini-3-flash-preview',
    description: '예시 문장 마이닝 및 생성',
    // [Creative/Lossless Hybrid] 마이닝은 다양한 예시 필요할 수도 있으나, 추출 위주면 낮게 설정
    // 현재는 패턴 추출이므로 낮게 설정
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 30,
    },
  },
  'rule.mining': {
    modelId: 'gemma-3-27b-it',
    description: '문법/스타일 규칙 마이닝',
    // [Lossless] 규칙은 정확해야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // Premium Tier Models
  // ---------------------------------------------------------------------------
  // ==========================================================================
  // [v3.0] Jemiel Ensemble Strategy - Premium Tier
  // P1-01, P1-02: generationConfig 추가 (2026-01-14)
  // ==========================================================================
  'premium.answer': {
    modelId: 'gemini-3-pro-preview',
    fallback: 'gemini-3-flash-preview',
    description: '프리미엄 사용자용 고품질 답변',
    // [Creative] 고품질 창의적 답변 생성
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    },
  },
  'premium.reviewer': {
    modelId: 'gemini-3-pro-preview',
    fallback: 'gemini-3-flash-preview',
    description: '프리미엄 사용자용 고품질 검토',
    // [Lossless] 엄격하고 일관된 검토
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // RAFT Synthetic Data
  // ---------------------------------------------------------------------------
  // ==========================================================================
  // [v3.0] Jemiel Ensemble Strategy - RAFT
  // P1-03: generationConfig 추가 (2026-01-14)
  // ==========================================================================
  'raft.generation': {
    modelId: 'gemma-3-12b-it',
    fallback: 'gemini-3-flash-preview',
    description: 'RAFT 합성 데이터 생성',
    // [Semi-Creative] 학습 데이터 다양성 필요
    generationConfig: {
      temperature: 0.6,
      topP: 0.95,
      topK: 30,
    },
  },

  // ===========================================================================
  // 신규 컨텍스트 (P1-02-A, 2026-01-10 스펙 반영)
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Shadow Writer (자동완성)
  // ---------------------------------------------------------------------------
  'suggest.completion': {
    modelId: 'gemma-3-4b-it',
    maxTokens: 100,
    description: 'Shadow Writer 문장 완성 제안',
    // [Creative] 다양한 표현을 제안해야 함
    generationConfig: {
      temperature: 0.8, // 너무 높으면 문맥 파괴, 0.8 적절
      topP: 0.9,
      topK: 40,
    },
  },

  // ---------------------------------------------------------------------------
  // RAG Extended Pipeline
  // ---------------------------------------------------------------------------
  'rag.selfrag': {
    modelId: 'gemini-3-flash-preview',
    description: 'Self-RAG 검색 필요도/관련도/근거 검증',
    // [Lossless] 논리적 판단은 결정적이어야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'rag.chunking': {
    modelId: 'gemini-3-flash-preview',
    description: 'Agentic Chunking 분할점 분석',
    // [Lossless] 분석은 정확해야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  // [v3.0] P1-04: rag.rerank generationConfig 추가 (2026-01-14)
  'rag.rerank': {
    modelId: 'gemma-3-2b-it',
    description: '검색 결과 재순위 (rerank.ts 전용)',
    // [Lossless] 순위 결정은 결정론적이어야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // Deep Scholar (Research)
  // ---------------------------------------------------------------------------
  'research.query': {
    modelId: 'gemma-3-4b-it',
    maxTokens: 50,
    description: 'Deep Scholar 검색 쿼리 생성',
    // [Creative] 다양한 검색어 조합 시도
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
    },
  },
  'research.summarize': {
    modelId: 'gemma-3-12b-it',
    maxTokens: 200,
    description: 'Deep Scholar 검색 결과 요약',
    // [Lossless] 요약은 사실 왜곡 없이
    generationConfig: {
      temperature: 0.2, // 약간의 유연성 허용
      topP: 0.95,
      topK: 20,
    },
  },

  // ---------------------------------------------------------------------------
  // Pattern & Mining Extended
  // ---------------------------------------------------------------------------
  // [v3.0] P1-05: pattern.extraction generationConfig 추가 (2026-01-14)
  'pattern.extraction': {
    modelId: 'gemini-3-flash-preview',
    description: '문서 패턴 추출',
    // [Lossless] 패턴 추출은 정확해야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // Judge System (평가)
  // ---------------------------------------------------------------------------
  'judge.align': {
    modelId: 'gemma-3-27b-it',
    description: '개별 항목 평가 (Align Judge)',
    // [Lossless] 평가는 엄격하게 결정적 (재현성 중요)
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'judge.holistic': {
    modelId: 'gemini-3-flash-preview',
    description: '종합 평가 (Holistic Advisor)',
    // [Lossless] 종합 조언도 팩트/논리 기반
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 10,
    },
  },

  // ---------------------------------------------------------------------------
  // Outline & OCR
  // ---------------------------------------------------------------------------
  // ==========================================================================
  // [v3.0] Jemiel Ensemble Strategy - Outline & OCR
  // P1-06, P1-07: generationConfig 추가 (2026-01-14)
  // ==========================================================================
  'outline.generation': {
    modelId: 'gemma-3-2b-it',
    description: '목차 생성',
    // [Semi-Creative] 다양한 목차 구조 제안
    generationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 20,
    },
  },
  'ocr.vision': {
    modelId: 'gemma-3-4b-it',
    description: 'OCR 이미지 텍스트 추출',
    // [Lossless] 정확한 텍스트 추출
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },

  // ---------------------------------------------------------------------------
  // AI Coach Persona (P3-04~06, 2026-03-19 추가)
  // ---------------------------------------------------------------------------
  'coach.style.analysis': {
    modelId: 'gemini-3-flash-preview',
    fallback: 'gpt-5-mini',
    maxTokens: 1500,
    description: '문서 스타일 분석 (코치 생성)',
    // [Semi-Lossless] 스타일 분석은 정확하되 약간의 해석 여지
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
    },
  },
  'coach.persona.feedback': {
    modelId: 'gemini-3-flash-preview',
    fallback: 'gpt-5-mini',
    maxTokens: 2000,
    description: '코치 페르소나 기반 피드백',
    // [Creative] 페르소나에 맞는 자연스러운 피드백 생성
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
    },
  },
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 서비스 컨텍스트에 맞는 LLM 모델 ID 반환
 *
 * 우선순위(상위가 더 우선):
 *   0) 사용자 선호 모델 (Phase 5) — Premium 컨텍스트(`premium.*`)에 한해서만
 *      적용. 그 외 컨텍스트는 보안/일관성을 위해 무시.
 *   1) 환경 변수 (예: MODEL_RAG_ANSWER) — 유효한 모델 ID일 때만 적용
 *   2) LLM_USAGE_MAP 기본값
 *   3) 시스템 기본값 (방어)
 *
 * @description
 * - 사용자 선호 모델은 Premium 사용자 권한 검증을 호출 측에서 마친 후 전달해야
 *   안전하다. 본 함수는 컨텍스트 prefix(`premium.`)와 모델 유효성만 확인한다.
 * - 환경 변수/사용자 모델에 잘못된 값이 들어오면 무시하고 경고만 남긴다.
 *
 * @param context - LLM 사용 컨텍스트
 * @param userPreference - 사용자 선호 모델 ID (선택, Premium 전용)
 * @returns 모델 ID
 */
export function getModelForUsage(
  context: LLMUsageContext,
  userPreference?: string | null
): string {
  // 0) 사용자 선호 모델 — Premium 컨텍스트에만 적용 (Phase 5)
  if (userPreference && context.startsWith('premium.')) {
    if (isValidModelId(userPreference)) {
      console.log(
        `[LLM-USAGE-MAP] User preference applied for ${context}: ${userPreference}`
      );
      return userPreference;
    }
    console.warn(
      `[LLM-USAGE-MAP] Invalid userPreference="${userPreference}" for ${context}; ignored`
    );
  }

  // 1) 환경 변수 우선 (서버 사이드만 의미 있음 — process.env는 클라이언트에서
  //    NEXT_PUBLIC_ 접두사 없으면 비어 있으므로 클라이언트 호출 시 자동으로
  //    아래 기본값 경로로 진행된다)
  const envKey = contextToEnvKey(context);
  const envModel = process.env[envKey];
  if (envModel) {
    if (isValidModelId(envModel)) {
      console.log(
        `[LLM-USAGE-MAP] Env override applied for ${context}: ${envModel}`
      );
      return envModel;
    }
    console.warn(
      `[LLM-USAGE-MAP] Env ${envKey}=${envModel} is not a valid model ID; ignored`
    );
  }

  // 2) 중앙 매핑
  const config = LLM_USAGE_MAP[context];

  // 3) 방어 로직: 잘못된 context 전달 시 기본값 반환 + 경고 로그
  if (!config) {
    console.warn(`[LLM-USAGE-MAP] Unknown context: ${context}, using default`);
    return getDefaultModelId();
  }

  return config.modelId;
}

/**
 * 환경 변수로 설정된 모델 ID들이 모두 유효한지 검증.
 *
 * @description
 * 서버 시작 시 호출하여 잘못된 ENV 설정을 빠르게 감지한다. 검증 실패는 경고
 * 수준으로만 보고하며, 런타임에서는 isValidModelId로 자동 필터되므로 본
 * 함수는 운영 가시성을 위한 도구다.
 *
 * @returns 유효성 결과와 오류 목록
 * @example
 * const { valid, errors } = validateEnvModels();
 * if (!valid) console.warn('Invalid env models:', errors);
 */
export function validateEnvModels(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const context of getAllUsageContexts()) {
    const envKey = contextToEnvKey(context);
    const envModel = process.env[envKey];

    if (envModel && !MODEL_REGISTRY[envModel as keyof typeof MODEL_REGISTRY]) {
      errors.push(`${envKey}=${envModel} is not a valid model ID`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 컨텍스트의 폴백 모델 ID 반환
 * 
 * @param context - LLM 사용 컨텍스트
 * @returns 폴백 모델 ID (없으면 undefined)
 * 
 * @example
 * const fallback = getFallbackModel('rag.answer');
 * // Returns: 'gpt-5-mini-2025-08-07'
 */
export function getFallbackModel(context: LLMUsageContext): string | undefined {
  return LLM_USAGE_MAP[context]?.fallback;
}

/**
 * 컨텍스트의 사용 설정 전체 반환
 * 
 * @param context - LLM 사용 컨텍스트
 * @returns UsageConfig 객체 (없으면 undefined)
 */
export function getUsageConfig(context: LLMUsageContext): UsageConfig | undefined {
  return LLM_USAGE_MAP[context];
}

// =============================================================================
// 디버그 유틸리티
// =============================================================================

/**
 * 모든 사용 컨텍스트 목록 반환
 * 
 * @returns LLMUsageContext 배열
 */
export function getAllUsageContexts(): LLMUsageContext[] {
  return Object.keys(LLM_USAGE_MAP) as LLMUsageContext[];
}

// =============================================================================
// [v2.0] 런타임 검증 함수
// =============================================================================

/**
 * [v2.0] LLM_USAGE_MAP의 모든 모델 ID 유효성 검증
 * [v3.0] generationConfig 범위 검증 추가 (Jemiel Strategy)
 * 
 * @description
 * 서버 시작 시 또는 설정 변경 시 호출하여 모델 ID가 유효한지 확인합니다.
 * 
 * @returns { valid: boolean, errors: string[] }
 * @example
 * const { valid, errors } = validateUsageMap();
 * if (!valid) console.error('Invalid models:', errors);
 */
export function validateUsageMap(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [context, config] of Object.entries(LLM_USAGE_MAP)) {
    const cfg = config as UsageConfig;
    // Primary modelId 검증
    if (!isValidModelId(cfg.modelId)) {
      errors.push(`[❌ ${context}] Invalid modelId: "${cfg.modelId}"`);
    }
    // Fallback modelId 검증 (있는 경우)
    if (cfg.fallback && !isValidModelId(cfg.fallback)) {
      errors.push(`[❌ ${context}] Invalid fallback: "${cfg.fallback}"`);
    }

    // =========================================================================
    // [v3.0] Jemiel Ensemble Strategy - P4-01 (2026-01-14)
    // generationConfig 범위 검증 추가
    // =========================================================================
    const gen = cfg.generationConfig;
    if (gen) {
      // Temperature 범위: 0-2
      if (gen.temperature < 0 || gen.temperature > 2) {
        errors.push(`[❌ ${context}] temperature out of range (0-2): ${gen.temperature}`);
      }
      // Top-P 범위: 0-1
      if (gen.topP < 0 || gen.topP > 1) {
        errors.push(`[❌ ${context}] topP out of range (0-1): ${gen.topP}`);
      }
      // Top-K 범위: 1-100 (optional)
      if (gen.topK !== undefined && (gen.topK < 1 || gen.topK > 100)) {
        errors.push(`[❌ ${context}] topK out of range (1-100): ${gen.topK}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * 현재 LLM 사용 매핑 상태를 콘솔에 출력 (v2.0 검증 포함)
 * [v3.0] generationConfig 출력 추가 (Jemiel Strategy)
 * 
 * @description
 * 개발 환경에서 현재 모델 매핑 상태와 유효성을 확인할 때 사용합니다.
 * 
 * @example
 * // 브라우저 콘솔에서 호출
 * printUsageMap();
 */
export function printUsageMap(): void {
  const { valid, errors } = validateUsageMap();
  
  console.log('\n📋 LLM Usage Map (v3.0 - Jemiel Ensemble):');
  console.log('============================================');
  
  for (const [ctx, cfg] of Object.entries(LLM_USAGE_MAP)) {
    const config = cfg as UsageConfig;
    const fallbackInfo = config.fallback ? ` (fallback: ${config.fallback})` : '';
    const status = isValidModelId(config.modelId) ? '✅' : '❌';

    // =========================================================================
    // [v3.0] Jemiel Ensemble Strategy - P4-02 (2026-01-14)
    // generationConfig 출력 추가
    // =========================================================================
    const genInfo = config.generationConfig
      ? ` | temp=${config.generationConfig.temperature}, topP=${config.generationConfig.topP}, topK=${config.generationConfig.topK ?? 'N/A'}`
      : ' | (no generationConfig)';

    console.log(`  ${status} ${ctx}: ${config.modelId}${fallbackInfo}${genInfo}`);
  }
  
  console.log('============================================');
  
  if (!valid) {
    console.warn('\n⚠️ Validation Errors:');
    errors.forEach(e => console.warn(`  - ${e}`));
  } else {
    console.log('✅ All configurations are valid.\n');
  }
}
