// =============================================================================
// PRISM Writer - RAFT API Client
// =============================================================================
// 파일: frontend/src/lib/api/raft.ts
// 역할: RAFT 합성 데이터 생성 API 호출 유틸리티
// 생성일: 2025-12-28
//
// [Phase 3] P3-01: RAFT API 호출 유틸 함수 생성
// - Supabase 세션에서 access_token 획득
// - Bearer Token으로 API 인증
// - 에러 핸들링 및 한글 메시지 제공
//
// [Q&A Review UI] 목록 조회 및 삭제 API 추가
// - fetchRAFTDataset: 생성된 Q&A 목록 조회
// - deleteRAFTDataset: 항목 삭제
//
// [JeDebug Critical-03 반영]
// - createBrowserClient 사용하여 토큰 획득
// =============================================================================

import { createBrowserClient } from '@supabase/ssr'

// =============================================================================
// 타입 정의
// =============================================================================

/**
 * 합성 데이터 생성 API 응답 타입
 */
export interface GenerationAPIResponse {
  success: boolean
  generated: number
  saved?: number
  data?: Array<{ question: string; answer: string }>
  errors?: string[]
  message?: string
}

/**
 * RAFT 데이터셋 항목 타입
 */
export interface RAFTDatasetItem {
  id: string
  user_query: string
  context: string
  gold_answer: string
  bad_answer?: string
  source: 'synthetic' | 'user_feedback' | 'manual' | 'ab_test'
  verified: boolean
  created_at: string

  model_id?: string
  category?: string // [P3-03]
}

/**
 * RAFT 데이터셋 목록 조회 응답 타입
 */
export interface RAFTDatasetListResponse {
  data: RAFTDatasetItem[]
  count: number
}

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * Supabase 토큰 획득 헬퍼
 */
async function getAuthToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

// =============================================================================
// API 함수
// =============================================================================

/**
 * 합성 데이터 생성 API 호출
 */
export async function generateSyntheticDataAPI(
  context: string,
  count: number,
  category?: string, // [P3-03]
  modelId?: string   // [P3-04] Model Select
): Promise<GenerationAPIResponse> {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('로그인이 필요합니다')
  }

  const res = await fetch('/api/raft/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      context, 
      count,
      category, // [P3-03]
      modelId   // [P3-04]
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
    }
    if (res.status === 429) {
      throw new Error('일일 생성 한도(500개)를 초과했습니다.')
    }
    if (res.status === 400) {
      throw new Error(data.message || '잘못된 요청입니다.')
    }
    throw new Error(data.message || '생성에 실패했습니다.')
  }

  return data
}

/**
 * RAFT 데이터셋 목록 조회 API
 * 
 * @param options - 필터 옵션
 * @returns RAFTDatasetListResponse
 */
export async function fetchRAFTDataset(options?: {
  source?: string
  verified?: boolean
  category?: string // [P3-03]
  limit?: number
  offset?: number
}): Promise<RAFTDatasetListResponse> {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('로그인이 필요합니다')
  }

  // 쿼리 파라미터 구성
  const params = new URLSearchParams()
  if (options?.source) params.set('source', options.source)
  if (options?.category && options?.category !== 'ALL') params.set('category', options.category) // [P3-03]
  if (options?.verified !== undefined) params.set('verified', String(options.verified))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const url = `/api/raft/dataset${params.toString() ? `?${params}` : ''}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message || '데이터 조회에 실패했습니다.')
  }

  return data
}

/**
 * RAFT 데이터셋 항목 삭제 API
 * 
 * @param id - 삭제할 항목 ID
 */
export async function deleteRAFTDataset(id: string): Promise<void> {
  const token = await getAuthToken()

  if (!token) {
    throw new Error('로그인이 필요합니다')
  }

  const res = await fetch(`/api/raft/dataset?id=${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.message || '삭제에 실패했습니다.')
  }
}

