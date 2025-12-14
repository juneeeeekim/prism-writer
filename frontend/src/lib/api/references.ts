// =============================================================================
// PRISM Writer Frontend - References API Client
// =============================================================================
// 파일: frontend/src/lib/api/references.ts
// 역할: 참조 관련 API 호출 클라이언트
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface Reference {
  id: string
  draft_id: string
  chunk_id: string
  paragraph_index: number
  reference_type: 'citation' | 'summary' | 'quote'
  created_at: string
  chunk_content?: string
  chunk_source?: string
}

export interface CreateReferenceRequest {
  chunk_id: string
  paragraph_index: number
  reference_type?: 'citation' | 'summary' | 'quote'
}

// -----------------------------------------------------------------------------
// API Base URL
// -----------------------------------------------------------------------------
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * 참조 추가
 */
export async function createReference(
  draftId: string,
  request: CreateReferenceRequest
): Promise<Reference> {
  const response = await fetch(
    `${API_BASE_URL}/v1/drafts/${draftId}/references`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chunk_id: request.chunk_id,
        paragraph_index: request.paragraph_index,
        reference_type: request.reference_type || 'citation',
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '참조 추가 실패' }))
    throw new Error(error.detail || `API 오류: ${response.status}`)
  }

  return response.json()
}

/**
 * 참조 목록 조회
 */
export async function getReferences(draftId: string): Promise<Reference[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/drafts/${draftId}/references`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`참조 목록 조회 실패: ${response.status}`)
  }

  return response.json()
}

/**
 * 참조 삭제
 */
export async function deleteReference(
  draftId: string,
  referenceId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/v1/drafts/${draftId}/references/${referenceId}`,
    {
      method: 'DELETE',
    }
  )

  if (!response.ok) {
    throw new Error(`참조 삭제 실패: ${response.status}`)
  }
}
