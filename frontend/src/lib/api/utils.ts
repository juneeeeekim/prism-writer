// =============================================================================
// PRISM Writer - API Utilities
// =============================================================================
// 파일: frontend/src/lib/api/utils.ts
// 역할: API 호출 시 공통으로 사용하는 유틸리티 함수
// 기능: 어드민 모드 모델 스위칭을 위한 헤더 추가 등
// =============================================================================

/**
 * API 호출을 위한 공통 헤더 생성
 * 
 * @description
 * localStorage에 저장된 어드민 선택 모델이 있으면 'x-prism-model-id' 헤더를 추가합니다.
 * 
 * @returns 헤더 객체
 */
export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 브라우저 환경에서만 localStorage 확인
  if (typeof window !== 'undefined') {
    const selectedModel = localStorage.getItem('prism_selected_model')
    if (selectedModel) {
      headers['x-prism-model-id'] = selectedModel
    }
  }

  return headers
}
