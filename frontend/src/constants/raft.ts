// =============================================================================
// PRISM Writer - RAFT Constants
// =============================================================================
// 파일: frontend/src/constants/raft.ts
// 역할: RAFT 합성 데이터 관련 전역 상수 정의
// 생성일: 2025-12-28
// =============================================================================

// [Phase P1-02] RAFT 데이터 카테고리 목록 (DB 기본값 '미분류' 호환)
export const RAFT_CATEGORIES = [
  '미분류',     // DB 기본값 - user_documents.category DEFAULT '미분류'
  '마케팅',
  '기술/개발',
  '일반/상식',
  '비즈니스',
  '금융/경제',
  '기타',
] as const;

/** 카테고리 타입 정의 */
export type RaftCategory = typeof RAFT_CATEGORIES[number];

// [Phase P1-03] 기본 카테고리 (DB 기본값과 통일)
export const DEFAULT_RAFT_CATEGORY = '미분류' as const;

/** '전체 보기'용 상수 */
export const ALL_CATEGORIES_FILTER = 'ALL' as const;

/**
 * RAFT 생성에 사용 가능한 LLM 모델 목록
 * - Model Selector UI에서 사용됨
 */
export const RAFT_AVAILABLE_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
  { id: 'gpt-4o', name: 'GPT-4o (High Quality)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Alternative)' },
] as const;
