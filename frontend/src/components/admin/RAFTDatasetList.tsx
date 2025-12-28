// =============================================================================
// PRISM Writer - RAFT Dataset List Component
// =============================================================================
// 파일: frontend/src/components/admin/RAFTDatasetList.tsx
// 역할: 생성된 Q&A 목록 표시 및 삭제 기능
// 생성일: 2025-12-28
//
// [Q&A Review UI]
// - 생성된 Q&A 목록을 카드 형태로 표시
// - 각 항목에 삭제 버튼 제공
// - 삭제 시 확인 모달 표시
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchRAFTDataset, deleteRAFTDataset, RAFTDatasetItem } from '@/lib/api/raft'
import { useAuth } from '@/hooks/useAuth'
import { RAFT_CATEGORIES } from '@/constants/raft'

// =============================================================================
// 상수 정의
// =============================================================================

const ITEMS_PER_PAGE = 10

// =============================================================================
// 메인 컴포넌트
// =============================================================================

/**
 * RAFT 데이터셋 목록 컴포넌트
 * 
 * @description
 * - 생성된 Q&A 목록을 표시
 * - 각 항목 삭제 기능 제공
 * - 페이지네이션 지원
 */
export default function RAFTDatasetList() {
  // ---------------------------------------------------------------------------
  // 상태 변수
  // ---------------------------------------------------------------------------
  
  /** Q&A 목록 */
  const [items, setItems] = useState<RAFTDatasetItem[]>([])
  
  /** 전체 개수 */
  const [totalCount, setTotalCount] = useState<number>(0)
  
  /** 로딩 상태 */
  const [isLoading, setIsLoading] = useState<boolean>(false)
  
  /** 에러 메시지 */
  const [error, setError] = useState<string | null>(null)
  
  /** 삭제 중인 항목 ID */
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  /** 현재 페이지 (0-indexed) */
  const [page, setPage] = useState<number>(0)

  /** 선택된 카테고리 필터 [P2-03] */
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  // ---------------------------------------------------------------------------
  // 인증 상태 확인
  // ---------------------------------------------------------------------------
  
  const { user, loading: authLoading } = useAuth()
  const isLoggedIn = user !== null

  // ---------------------------------------------------------------------------
  // 데이터 조회 함수
  // ---------------------------------------------------------------------------
  
  const loadData = useCallback(async () => {
    // 로그인하지 않은 경우 데이터 조회 안함
    if (!isLoggedIn) {
      setItems([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      // [P4-02] 카테고리 필터를 API에 전달
      const response = await fetchRAFTDataset({
        source: 'synthetic',
        category: selectedCategory, // 'ALL'일 경우 API에서 필터 생략됨
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
      })
      
      setItems(response.data || [])
      setTotalCount(response.count || 0)
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.')
      setItems([])
    } finally {
      setIsLoading(false)
    }

  }, [page, isLoggedIn, selectedCategory])

  // ---------------------------------------------------------------------------
  // 초기 로드 및 페이지 변경 시 데이터 조회
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    // 인증 로딩 완료 후에만 데이터 로드
    if (!authLoading) {
      loadData()
    }
  }, [loadData, authLoading])

  // ---------------------------------------------------------------------------
  // 삭제 핸들러
  // ---------------------------------------------------------------------------
  
  const handleDelete = async (item: RAFTDatasetItem) => {
    // 삭제 확인
    const confirmed = window.confirm(
      `정말 이 Q&A를 삭제하시겠습니까?\n\n` +
      `Q: ${item.user_query.substring(0, 50)}...`
    )
    
    if (!confirmed) return
    
    setDeletingId(item.id)
    
    try {
      await deleteRAFTDataset(item.id)
      
      // 목록에서 제거
      setItems(prev => prev.filter(i => i.id !== item.id))
      setTotalCount(prev => prev - 1)
    } catch (err: any) {
      alert(err.message || '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // 새로고침 핸들러
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    setPage(0)
    loadData()
  }

  // ---------------------------------------------------------------------------
  // 페이지네이션
  // ---------------------------------------------------------------------------
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const canPrev = page > 0
  const canNext = page < totalPages - 1

  // ---------------------------------------------------------------------------
  // JSX 렌더링
  // ---------------------------------------------------------------------------
  
  return (
    <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
      {/* ===================================================================== */}
      {/* 헤더 */}
      {/* ===================================================================== */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          📋 생성된 Q&A 목록
        </h2>
        <div className="flex items-center gap-2">
          {/* 카테고리 필터 [P2-03] */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              setPage(0) // 필터 변경 시 첫 페이지로 이동
            }}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            disabled={isLoading}
          >
            <option value="ALL">전체 카테고리</option>
            {RAFT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            총 {totalCount}개
          </span>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="새로고침"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 로딩 상태 */}
      {/* ===================================================================== */}
      {isLoading && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" cy="12" r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          데이터를 불러오는 중...
        </div>
      )}

      {/* ===================================================================== */}
      {/* 에러 상태 */}
      {/* ===================================================================== */}
      {error && (
        <div className="py-4 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 로그인 필요 안내 */}
      {/* ===================================================================== */}
      {!authLoading && !isLoggedIn && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <p>🔒 로그인이 필요합니다.</p>
          <p className="text-sm mt-2">Q&A 목록을 보려면 먼저 로그인해주세요.</p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 빈 상태 (로그인 후) */}
      {/* ===================================================================== */}
      {!isLoading && !error && isLoggedIn && items.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <p>📭 생성된 Q&A가 없습니다.</p>
          <p className="text-sm mt-2">위의 "합성 데이터 생성" 기능을 사용해 Q&A를 생성해보세요.</p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Q&A 목록 */}
      {/* ===================================================================== */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`
                p-4 border rounded-lg transition-all
                ${deletingId === item.id 
                  ? 'opacity-50 pointer-events-none border-gray-300 dark:border-gray-600' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                }
              `}
            >
              {/* 질문 */}
              <div className="mb-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
                  Question
                </span>
                <p className="text-gray-800 dark:text-gray-200 mt-1">
                  {item.user_query}
                </p>
              </div>
              
              {/* 답변 */}
              <div className="mb-3">
                <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">
                  Answer
                </span>
                <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm line-clamp-3">
                  {item.gold_answer}
                </p>
              </div>
              
              {/* 메타 정보 및 삭제 버튼 [P4-03 카테고리 폴백 처리] */}
              <div className="flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-medium">
                    {/* 카테고리가 없거나 상수에 없으면 '미분류' 표시 */}
                    {item.category && RAFT_CATEGORIES.includes(item.category as any) 
                      ? item.category 
                      : '미분류'}
                  </span>
                  <span>
                    {new Date(item.created_at).toLocaleDateString('ko-KR')} | 
                    {item.verified ? ' ✅ 검증됨' : ' ⏳ 미검증'}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="px-3 py-1 text-red-500 hover:text-white hover:bg-red-500 border border-red-300 dark:border-red-700 rounded transition-colors"
                  aria-label="삭제"
                >
                  🗑️ 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 페이지네이션 */}
      {/* ===================================================================== */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={!canPrev}
            className={`
              px-4 py-2 rounded transition-colors
              ${canPrev 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            ← 이전
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {page + 1} / {totalPages} 페이지
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!canNext}
            className={`
              px-4 py-2 rounded transition-colors
              ${canNext 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
