// =============================================================================
// Phase 11: Document Types (Phase 12: Category 추가)
// =============================================================================
// 파일: frontend/src/types/document.ts
// 역할: 문서 관련 타입 정의
// 생성일: 2025-12-28
// 수정일: 2025-12-28 (Phase 12 - category 필드 추가)
// =============================================================================

/**
 * 전체 문서 정보 (상세 조회, 에디터용)
 */
export interface UserDocument {
  id: string
  title: string
  content: string
  category: string  // Phase 12 추가
  created_at: string
  updated_at: string
}

/**
 * 문서 미리보기 (목록용)
 */
export interface UserDocumentPreview {
  id: string
  title: string
  preview: string
  category: string  // Phase 12 추가
  updated_at: string
}

/**
 * 문서 저장 요청
 */
export interface SaveDocumentRequest {
  id?: string
  title: string
  content: string
  category?: string  // Phase 12 추가 (옵셔널, 미입력 시 '미분류')
}

/**
 * 문서 저장 응답
 */
export interface SaveDocumentResponse {
  id: string
  title: string
  category: string  // Phase 12 추가
  updated_at: string
}

/**
 * 문서 목록 응답
 */
export interface DocumentListResponse {
  documents: UserDocumentPreview[]
  total: number
  page: number
  limit: number
}

