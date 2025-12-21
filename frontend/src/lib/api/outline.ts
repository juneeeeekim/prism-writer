// =============================================================================
// PRISM Writer Frontend - Outline API Client
// =============================================================================
// 파일: frontend/src/lib/api/outline.ts
// 역할: 목차 생성 API 호출 클라이언트
// =============================================================================

import { getApiHeaders } from './utils'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface OutlineItem {
  title: string
  depth: number
}

export interface OutlineGenerateRequest {
  topic: string
  document_ids?: string[]
  max_depth?: number
}

export interface OutlineGenerateResponse {
  outline: OutlineItem[]
  topic: string
  sources_used: number
}

export interface OutlineTemplate {
  id: string
  name: string
  outline: OutlineItem[]
}

// -----------------------------------------------------------------------------
// API Base URL
// -----------------------------------------------------------------------------
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * 목차 생성 API 호출
 */
export async function generateOutline(
  request: OutlineGenerateRequest
): Promise<OutlineGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/outline/generate`, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({
      topic: request.topic,
      document_ids: request.document_ids || [],
      max_depth: request.max_depth || 3,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '알 수 없는 오류' }))
    throw new Error(error.detail || `API 오류: ${response.status}`)
  }

  return response.json()
}

/**
 * 목차 템플릿 목록 조회
 */
export async function getOutlineTemplates(): Promise<OutlineTemplate[]> {
  const response = await fetch(`${API_BASE_URL}/v1/outline/templates`, {
    method: 'GET',
    headers: getApiHeaders(),
  })

  if (!response.ok) {
    throw new Error(`템플릿 조회 실패: ${response.status}`)
  }

  const data = await response.json()
  return data.templates
}
