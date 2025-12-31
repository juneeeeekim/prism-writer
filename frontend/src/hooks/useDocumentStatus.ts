// =============================================================================
// useDocumentStatus Hook
// =============================================================================
// 파일: frontend/src/hooks/useDocumentStatus.ts
// 역할: 문서 처리 상태 실시간 조회 (SWR 기반 폴링)
// [P7-FIX] projectId 파라미터 추가로 프로젝트별 문서 격리
// =============================================================================

import useSWR from 'swr'
import { DocumentStatus } from '@/types/rag'

interface Document {
  id: string
  title: string
  file_path: string
  file_type: string
  file_size: number
  status: DocumentStatus
  error_message?: string
  created_at: string
  updated_at: string
}

interface UseDocumentStatusResult {
  documents: Document[]
  isLoading: boolean
  isError: any
  mutate: () => Promise<any>
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

/**
 * [P7-FIX] 문서 상태 조회 훅 - projectId 필수
 *
 * @param projectId - 조회할 프로젝트 ID (없으면 조회하지 않음)
 */
export function useDocumentStatus(projectId?: string | null): UseDocumentStatusResult {
  // [P7-FIX] projectId가 있을 때만 API 호출, 없으면 null (SWR이 요청 안 함)
  const apiUrl = projectId ? `/api/documents?projectId=${projectId}` : null

  const { data, error, mutate } = useSWR<{ success: boolean; documents: Document[] }>(
    apiUrl,
    fetcher,
    {
      // 1. 기본적으로 3초마다 폴링 (실시간성 확보)
      refreshInterval: (data) => {
        // 데이터가 없거나 에러인 경우 폴링 중단 (또는 기본값)
        if (!data || !data.success || !data.documents) return 0

        // 2. 'processing_*' 또는 'queued' 상태인 문서가 하나라도 있으면 폴링 유지
        const hasProcessingDocs = data.documents.some((doc) =>
          [
            DocumentStatus.QUEUED,
            DocumentStatus.PARSING,
            DocumentStatus.CHUNKING,
            DocumentStatus.EMBEDDING,
            'pending', // 호환성
            'processing' // 호환성
          ].includes(doc.status)
        )

        return hasProcessingDocs ? 3000 : 0
      },
      revalidateOnFocus: true,
    }
  )

  return {
    documents: data?.documents || [],
    isLoading: !error && !data && !!projectId,  // [P7-FIX] projectId 없으면 로딩 아님
    isError: error,
    mutate,
  }
}
