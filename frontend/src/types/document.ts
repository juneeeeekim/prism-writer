// =============================================================================
// Phase 11: Document Types
// =============================================================================
// 파일: frontend/src/types/document.ts
// 역할: 문서 관련 타입 정의
// 생성일: 2025-12-28
// =============================================================================

/**
 * 전체 문서 정보 (상세 조회, 에디터용)
 */
export interface UserDocument {
  id: string
  title: string
  content: string
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
  updated_at: string
}

/**
 * 문서 저장 요청
 */
export interface SaveDocumentRequest {
  id?: string
  title: string
  content: string
}

/**
 * 문서 저장 응답
 */
export interface SaveDocumentResponse {
  id: string
  title: string
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
