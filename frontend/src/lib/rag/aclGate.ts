// =============================================================================
// PRISM Writer - ACL Gate
// =============================================================================
// 파일: frontend/src/lib/rag/aclGate.ts
// 역할: 검색 전 ACL(Access Control List) 검증 게이트
// =============================================================================

import { createClient } from '@/lib/supabase/client'
import type { ACLFilter, ACLValidationResult } from '@/types/rag'

// =============================================================================
// 상수
// =============================================================================

/** ACL 검증 실패 메시지 */
const ACL_ERROR_MESSAGES = {
  NO_USER: '사용자 ID가 필요합니다.',
  NO_DOCUMENTS: '접근 가능한 문서가 없습니다.',
  FETCH_ERROR: '문서 목록 조회 중 오류가 발생했습니다.',
} as const

// =============================================================================
// ACL 검증 함수
// =============================================================================

/**
 * ACL 검증 함수
 * 
 * @description
 * 검색 전 사용자의 문서 접근 권한을 검증합니다.
 * 사용자가 소유한 문서 ID 목록을 반환합니다.
 * 
 * @param filter - ACL 필터 옵션
 * @returns ACL 검증 결과 (valid, allowedDocumentIds, error)
 * 
 * @example
 * ```typescript
 * const result = await validateACL({ userId: 'user-123' })
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * // result.allowedDocumentIds 사용
 * ```
 */
export async function validateACL(filter: ACLFilter): Promise<ACLValidationResult> {
  const { userId, documentIds, isAdmin } = filter

  // ---------------------------------------------------------------------------
  // 1. 사용자 ID 필수 검증
  // ---------------------------------------------------------------------------
  if (!userId) {
    console.warn('[ACL] 검증 실패: 사용자 ID 없음')
    return {
      valid: false,
      allowedDocumentIds: [],
      error: ACL_ERROR_MESSAGES.NO_USER,
    }
  }

  // ---------------------------------------------------------------------------
  // 2. 관리자 권한 체크 (관리자는 모든 문서 접근 가능)
  // ---------------------------------------------------------------------------
  if (isAdmin) {
    console.log('[ACL] 관리자 권한으로 전체 접근 허용')
    // 관리자는 모든 문서 ID를 반환하지 않고 빈 배열 반환 (필터 없음 의미)
    return {
      valid: true,
      allowedDocumentIds: [],
    }
  }

  // ---------------------------------------------------------------------------
  // 3. 사용자 소유 문서 목록 조회
  // ---------------------------------------------------------------------------
  try {
    const supabase = createClient()

    let query = supabase
      .from('rag_documents')
      .select('id')
      .eq('user_id', userId)

    // 특정 문서 ID 필터가 있으면 적용
    if (documentIds && documentIds.length > 0) {
      query = query.in('id', documentIds)
    }

    const { data, error } = await query

    if (error) {
      console.error('[ACL] 문서 조회 실패:', error.message)
      return {
        valid: false,
        allowedDocumentIds: [],
        error: `${ACL_ERROR_MESSAGES.FETCH_ERROR}: ${error.message}`,
      }
    }

    // ---------------------------------------------------------------------------
    // 4. 접근 가능한 문서 목록 반환
    // ---------------------------------------------------------------------------
    const allowedDocumentIds = (data || []).map((doc) => doc.id)

    if (allowedDocumentIds.length === 0) {
      console.log('[ACL] 접근 가능한 문서 없음 (userId:', userId, ')')
      // 문서가 없어도 valid는 true (검색 결과가 빈 것일 뿐)
      return {
        valid: true,
        allowedDocumentIds: [],
      }
    }

    console.log('[ACL] 검증 성공:', allowedDocumentIds.length, '개 문서 접근 가능')
    return {
      valid: true,
      allowedDocumentIds,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[ACL] 예외 발생:', errorMessage)
    return {
      valid: false,
      allowedDocumentIds: [],
      error: `${ACL_ERROR_MESSAGES.FETCH_ERROR}: ${errorMessage}`,
    }
  }
}
