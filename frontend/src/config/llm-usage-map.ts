// =============================================================================
// PRISM Writer - LLM Usage Map (중앙화된 서비스-모델 매핑)
// =============================================================================
// 파일: frontend/src/config/llm-usage-map.ts
// 역할: 서비스별 LLM 모델 매핑을 한 곳에서 중앙 관리
// 근거: 2512281121_LLM_Centralization_Expert_Meeting.md "🏆 최종 아키텍처 제안"
// =============================================================================

import { getDefaultModelId, isValidModelId } from './models';

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
  | 'ocr.vision';          // OCR 비전

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
  'rag.answer': {
    modelId: 'gemini-3-flash-preview',
    fallback: 'gemma-3-27b-it',
    maxTokens: 2000,
    description: 'RAG 기반 답변 생성',
    // [Creative] 창의적 생성 구간
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
    },
  },
  'rag.reviewer': {
    modelId: 'gemma-3-12b-it',
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
  'template.consistency': {
    modelId: 'gemini-3-flash-preview',
    description: '템플릿 일관성 검증 (Consistency Gate)',
    // [Lossless] 검증은 결정적이어야 함
    generationConfig: {
      temperature: 0.0,
      topP: 1.0,
      topK: 1,
    },
  },
  'template.hallucination': {
    modelId: 'gemma-3-12b-it',
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
    modelId: 'gemini-3-flash-preview',
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
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * 서비스 컨텍스트에 맞는 LLM 모델 ID 반환
 * 
 * @param context - LLM 사용 컨텍스트
 * @returns 모델 ID (없으면 시스템 기본값)
 * 
 * @example
 * const model = getModelForUsage('rag.answer');
 * // Returns: 'gemini-3-flash-preview'
 */
export function getModelForUsage(context: LLMUsageContext): string {
  const config = LLM_USAGE_MAP[context];
  
  // 방어 로직: 잘못된 context 전달 시 기본값 반환 + 경고 로그
  if (!config) {
    console.warn(`[LLM-USAGE-MAP] Unknown context: ${context}, using default`);
    return getDefaultModelId();
  }
  
  return config.modelId;
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
