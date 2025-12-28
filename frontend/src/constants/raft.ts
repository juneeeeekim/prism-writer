// =============================================================================
// PRISM Writer - RAFT Constants
// =============================================================================
// 파일: frontend/src/constants/raft.ts
// 역할: RAFT 합성 데이터 관련 전역 상수 정의
// 생성일: 2025-12-28
// =============================================================================

/**
 * RAFT 데이터 카테고리 목록
 * - UI 드롭다운 및 DB 필터링에 사용됨
 */
export const RAFT_CATEGORIES = [
  '마케팅',
  '기술/개발',
  '일반/상식',
  '비즈니스',
  '금융/경제',
  '기타',
] as const;

/** 카테고리 타입 정의 */
export type RaftCategory = typeof RAFT_CATEGORIES[number];

/** 기본 카테고리 (데이터 누락 시 폴백용) */
export const DEFAULT_RAFT_CATEGORY = '기타' as const;

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
