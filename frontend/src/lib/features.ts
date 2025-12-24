// =================================================================
// [CHAT HISTORY] Feature Flags Configuration
// 채팅 기록 관리 기능의 점진적 롤아웃을 위한 Feature Flag
// =================================================================

/**
 * Feature Flags for ChatHistoryManagement
 *
 * 사용법:
 * import { FEATURES } from '@/lib/features'
 * if (FEATURES.CHAT_HISTORY_SAVE) { ... }
 *
 * 롤아웃 순서:
 * Stage 1: CHAT_HISTORY_SAVE = true (DB 저장만)
 * Stage 2: CHAT_HISTORY_UI = true (기본 UI)
 * Stage 3: CHAT_SESSION_LIST = true (세션 목록)
 */

export const FEATURES = {
  // =================================================================
  // [Stage 1] 채팅 메시지 DB 저장 활성화
  // 기능: 사용자/AI 메시지를 Supabase에 저장
  // 위험도: Low - 기존 UI에 영향 없음
  // =================================================================
  CHAT_HISTORY_SAVE: process.env.NEXT_PUBLIC_ENABLE_CHAT_HISTORY === "true",

  // =================================================================
  // [Stage 2] 채팅 히스토리 UI 활성화
  // 기능: 세션 기반 ChatTabWithHistory 컴포넌트 사용
  // 위험도: Mid - UI 변경
  // =================================================================
  CHAT_HISTORY_UI: process.env.NEXT_PUBLIC_ENABLE_CHAT_HISTORY_UI === "true",

  // =================================================================
  // [Stage 3] 세션 목록 사이드바 활성화
  // 기능: 좌측에 대화 세션 목록 표시
  // 위험도: Mid - 레이아웃 변경
  // =================================================================
  CHAT_SESSION_LIST:
    process.env.NEXT_PUBLIC_ENABLE_CHAT_SESSION_LIST === "true",
} as const;

// Type for feature names
export type FeatureName = keyof typeof FEATURES;

/**
 * Check if a feature is enabled
 * @param featureName - Name of the feature to check
 * @returns boolean indicating if the feature is enabled
 */
export function isFeatureEnabled(featureName: FeatureName): boolean {
  return FEATURES[featureName] ?? false;
}

/**
 * Get all enabled features (for debugging)
 * @returns Array of enabled feature names
 */
export function getEnabledFeatures(): FeatureName[] {
  return (Object.keys(FEATURES) as FeatureName[]).filter(
    (key) => FEATURES[key]
  );
}
