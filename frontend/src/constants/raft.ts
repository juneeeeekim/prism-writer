// =============================================================================
// PRISM Writer - RAFT Constants
// =============================================================================
// 파일: frontend/src/constants/raft.ts
// 역할: RAFT 합성 데이터 생성 및 관리에서 사용되는 상수 정의
// 생성일: 2025-12-28
// =============================================================================

/**
 * RAFT 데이터 카테고리 목록
 * - UI 드롭다운 및 데이터 필터링에 사용됨
 * - '미분류'는 기본값으로 항상 포함
 */
export const RAFT_CATEGORIES = [
  '미분류',
  '마케팅',
  '기술',
  '일반',
  '사내규정',
  '재무/회계',
  '인사/총무'
] as const;

/**
 * RAFT 카테고리 타입 정의
 */
export type RaftCategory = typeof RAFT_CATEGORIES[number];

/**
 * 기본 카테고리
 */
export const DEFAULT_RAFT_CATEGORY: RaftCategory = '미분류';
