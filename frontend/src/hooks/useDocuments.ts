// =============================================================================
// Phase 11: useDocuments Hook
// =============================================================================
// 파일: frontend/src/hooks/useDocuments.ts
// 역할: 문서 CRUD 작업용 훅
// 생성일: 2025-12-28
// [P7-FIX] projectId 파라미터 추가로 프로젝트별 문서 격리
// =============================================================================

'use client'

import { useState, useCallback } from 'react'
import type { 
  UserDocument, 
  UserDocumentPreview, 
  SaveDocumentResponse,
  DocumentListResponse 
} from '@/types/document'

// =============================================================================
// Types
// =============================================================================
interface UseDocumentsReturn {
  documents: UserDocumentPreview[]
  loading: boolean
  error: string | null
  fetchList: () => Promise<void>
  saveDocument: (doc: { id?: string; title: string; content: string }) => Promise<SaveDocumentResponse>
  deleteDocument: (id: string) => Promise<{ success: boolean }>
  loadDocument: (id: string) => Promise<UserDocument>
  reorderDocuments: (items: { id: string; sort_order: number }[]) => Promise<void>
  clearError: () => void
}

// =============================================================================
// Hook Implementation
// =============================================================================
/**
 * [P7-FIX] 문서 CRUD 훅 - projectId 필수
 *
 * @param projectId - 조회할 프로젝트 ID (없으면 조회하지 않음)
 */
export function useDocuments(projectId?: string | null): UseDocumentsReturn {
  const [documents, setDocuments] = useState<UserDocumentPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 문서 목록 조회
  // [P7-FIX] projectId가 없으면 조회하지 않음
  // ---------------------------------------------------------------------------
  const fetchList = useCallback(async () => {
    // [P7-FIX] projectId가 없으면 빈 목록 반환
    if (!projectId) {
      setDocuments([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // [P7-FIX] projectId 쿼리 파라미터 추가
      const res = await fetch(`/api/documents/list?projectId=${projectId}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('로그인이 필요합니다.')
        }
        throw new Error('문서 목록을 불러오는데 실패했습니다.')
      }
      
      const data: DocumentListResponse = await res.json()
      setDocuments(data.documents)
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(message)
      console.error('[useDocuments] fetchList error:', e)
    } finally {
      setLoading(false)
    }
  }, [projectId])  // [P7-FIX] projectId 의존성 추가

  // ---------------------------------------------------------------------------
  // 문서 저장 (생성 또는 수정)
  // [P7-FIX] projectId를 요청에 포함
  // ---------------------------------------------------------------------------
  const saveDocument = useCallback(async (doc: {
    id?: string
    title: string
    content: string
  }): Promise<SaveDocumentResponse> => {
    const res = await fetch('/api/documents/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...doc,
        projectId  // [P7-FIX] 프로젝트 ID 포함
      })
    })

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('로그인이 필요합니다.')
      }
      throw new Error('문서 저장에 실패했습니다.')
    }

    return res.json()
  }, [projectId])  // [P7-FIX] projectId 의존성 추가

  // ---------------------------------------------------------------------------
  // 문서 삭제
  // ---------------------------------------------------------------------------
  const deleteDocument = useCallback(async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/documents/${id}`, { 
      method: 'DELETE' 
    })
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('로그인이 필요합니다.')
      }
      if (res.status === 404) {
        throw new Error('문서를 찾을 수 없습니다.')
      }
      throw new Error('문서 삭제에 실패했습니다.')
    }
    
    return res.json()
  }, [])

  // ---------------------------------------------------------------------------
  // 문서 상세 조회
  // ---------------------------------------------------------------------------
  const loadDocument = useCallback(async (id: string): Promise<UserDocument> => {
    const res = await fetch(`/api/documents/${id}`)
    
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('로그인이 필요합니다.')
      }
      if (res.status === 404) {
        throw new Error('문서를 찾을 수 없습니다.')
      }
      throw new Error('문서를 불러오는데 실패했습니다.')
    }
    
    return res.json()
  }, [])

  // ---------------------------------------------------------------------------
  // 문서 순서 변경 (Phase 13)
  // [P7-FIX] projectId 포함
  // ---------------------------------------------------------------------------
  const reorderDocuments = useCallback(async (items: { id: string; sort_order: number }[]) => {
    // 1. Optimistic Update (UI 즉시 반영)
    setDocuments(prev => {
      const newDocs = [...prev]
      items.forEach(item => {
        const doc = newDocs.find(d => d.id === item.id)
        if (doc) doc.sort_order = item.sort_order
      })
      // sort_order 기준 재정렬
      return newDocs.sort((a, b) => {
        if (a.sort_order === b.sort_order) {
          // 정렬값 같으면 최신순
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        }
        return a.sort_order - b.sort_order
      })
    })

    // 2. API 호출
    try {
      const res = await fetch('/api/documents/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: items,
          projectId  // [P7-FIX] 프로젝트 ID 포함
        })
      })
      
      if (!res.ok) {
        throw new Error('순서 변경에 실패했습니다.')
      }
    } catch (e) {
      console.error('[useDocuments] Reorder error:', e)
      fetchList() // 실패 시 롤백 (목록 새로고침)
      throw e
    }
  }, [fetchList, projectId])  // [P7-FIX] projectId 의존성 추가

  // ---------------------------------------------------------------------------
  // 에러 초기화
  // ---------------------------------------------------------------------------
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    documents,
    loading,
    error,
    fetchList,
    saveDocument,
    deleteDocument,
    loadDocument,
    reorderDocuments,
    clearError
  }
}
