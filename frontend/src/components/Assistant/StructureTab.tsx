// =============================================================================
// PRISM Writer - Structure Tab (AI Structurer)
// =============================================================================
// 파일: frontend/src/components/Assistant/StructureTab.tsx
// 역할: AI 기반 문서 구조 분석 및 순서 제안 UI
// Pipeline: AI Structurer (P4-01)
// 생성일: 2026-01-08
//
// [시니어 개발자 주석]
// - currentProject?.id Null Check 필수
// - API 호출 실패 시 에러 UI 표시
// - 분석 중 로딩 상태 표시
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import { useToast } from '@/hooks/useToast'
import type {
  StructureSuggestion,
  DocumentSummary,
  OrderSuggestion,
  GapSuggestion,
} from '@/lib/rag/structureHelpers'
import DocumentCard from '@/components/structure/DocumentCard'

// =============================================================================
// [P4-01] 타입 정의
// =============================================================================

/**
 * 구조 분석 API 응답
 */
interface AnalyzeResponse {
  success: boolean
  suggestion: StructureSuggestion | null
  message?: string
  error?: string
}

/**
 * 순서 적용 API 응답
 */
interface ApplyResponse {
  success: boolean
  updatedCount?: number
  message?: string
  error?: string
}

// =============================================================================
// [P4-01] 컴포넌트
// =============================================================================

/**
 * Structure Tab - AI 문서 구조 분석 탭
 *
 * @description
 * [시니어 개발자 주석]
 * 1. 프로젝트 문서 로드
 * 2. AI 분석 요청 (api/rag/structure/analyze)
 * 3. 결과 시각화 (제안 순서 + 누락 요소)
 * 4. 순서 적용 (api/rag/structure/apply)
 */
export default function StructureTab() {
  // ===========================================================================
  // [P4-01-01] State
  // ===========================================================================
  const { currentProject } = useProject()
  const toast = useToast() // [S2-03] Toast 알림용

  // 문서 목록
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // AI 분석 결과
  const [suggestion, setSuggestion] = useState<StructureSuggestion | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 순서 적용 상태
  const [isApplying, setIsApplying] = useState(false)

  // 에러 상태
  const [error, setError] = useState<string | null>(null)

  // 성공 메시지
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ===========================================================================
  // [S2-01] 선택 분석 모드 상태
  // ===========================================================================
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])

  /** [S2-01] 선택 모드 토글 */
  const toggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev)
    setSelectedDocIds([]) // 모드 변경 시 선택 초기화
  }

  /** [S2-01] 문서 선택 토글 */
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  // ===========================================================================
  // [P4-01-02] 문서 로드
  // ===========================================================================
  const loadDocuments = useCallback(async () => {
    if (!currentProject?.id) return

    setIsLoadingDocs(true)
    setError(null)

    try {
      // 프로젝트 문서 목록 조회 (기존 API 사용)
      const res = await fetch(`/api/documents/list?projectId=${currentProject.id}`)
      if (!res.ok) {
        throw new Error('문서 목록을 불러오는데 실패했습니다.')
      }
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('[StructureTab] 문서 로드 실패:', err)
      setError(err instanceof Error ? err.message : '문서 로드 실패')
    } finally {
      setIsLoadingDocs(false)
    }
  }, [currentProject?.id])

  // 프로젝트 변경 시 문서 로드
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // ===========================================================================
  // [P4-01-03] AI 분석 요청
  // ===========================================================================
  const handleAnalyze = async () => {
    if (!currentProject?.id) {
      setError('프로젝트를 선택해주세요.')
      return
    }

    // [S2-03] Safety: 선택 모드인데 선택된 문서가 없을 때 Toast 경고
    if (isSelectionMode && selectedDocIds.length === 0) {
      toast.warning('분석할 문서를 선택해주세요.')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setSuggestion(null)
    setSuccessMessage(null)

    try {
      // [S2-01] 선택 모드일 때 targetDocIds 전달
      const payload: {
        projectId: string
        templateId?: string
        targetDocIds?: string[]
      } = {
        projectId: currentProject.id,
        // templateId: 선택된 템플릿 ID (향후 구현)
      }

      // 선택 분석 모드일 때만 targetDocIds 추가
      if (isSelectionMode && selectedDocIds.length > 0) {
        payload.targetDocIds = selectedDocIds
        console.log(`[StructureTab] Selective Mode: ${selectedDocIds.length} docs selected`)
      }

      const res = await fetch('/api/rag/structure/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data: AnalyzeResponse = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || '분석에 실패했습니다.')
      }

      setSuggestion(data.suggestion)
      if (data.message) {
        setSuccessMessage(data.message)
      }
    } catch (err) {
      console.error('[StructureTab] AI 분석 실패:', err)
      setError(err instanceof Error ? err.message : 'AI 분석 실패')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ===========================================================================
  // [P4-01-04] 순서 적용
  // ===========================================================================
  const handleApplyOrder = async () => {
    if (!currentProject?.id || !suggestion?.suggestedOrder?.length) {
      setError('적용할 제안이 없습니다.')
      return
    }

    setIsApplying(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // 제안된 순서대로 문서 ID 배열 생성
      const orderedDocIds = suggestion.suggestedOrder.map((item) => item.docId)

      const res = await fetch('/api/rag/structure/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          orderedDocIds,
        }),
      })

      const data: ApplyResponse = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || '순서 적용에 실패했습니다.')
      }

      setSuccessMessage(data.message || '순서가 적용되었습니다.')
      // 문서 목록 새로고침
      await loadDocuments()
    } catch (err) {
      console.error('[StructureTab] 순서 적용 실패:', err)
      setError(err instanceof Error ? err.message : '순서 적용 실패')
    } finally {
      setIsApplying(false)
    }
  }

  // ===========================================================================
  // [P4-01-05] 완성도 계산 (간단 버전)
  // ===========================================================================
  const calculateCompleteness = (): number => {
    if (!suggestion?.suggestedOrder?.length) return 0
    const gapsCount = suggestion.gaps?.length || 0
    const totalItems = suggestion.suggestedOrder.length + gapsCount
    if (totalItems === 0) return 100
    return Math.round((suggestion.suggestedOrder.length / totalItems) * 100)
  }

  // ===========================================================================
  // [P4-01-06] 렌더링
  // ===========================================================================
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* =====================================================================
          [P4-01-06-A] 헤더 영역
          ===================================================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            문서 구조 분석
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI가 문서 순서와 구조를 분석하여 최적의 배치를 제안합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* [S2-01] 선택 분석 모드 토글 버튼 */}
          <button
            onClick={toggleSelectionMode}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
              ${isSelectionMode
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {isSelectionMode ? '✅ 선택 모드' : '📋 전체 모드'}
          </button>
          
          {/* AI 분석 버튼 */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !currentProject?.id || documents.length === 0 || (isSelectionMode && selectedDocIds.length === 0)}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${isAnalyzing || !currentProject?.id || documents.length === 0 || (isSelectionMode && selectedDocIds.length === 0)
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-prism-primary text-white hover:bg-prism-primary/90'
              }
            `}
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                분석 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>🧩</span>
                {isSelectionMode ? `선택 분석 (${selectedDocIds.length})` : 'AI 분석'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          [P4-01-06-B] 상태 메시지
          ===================================================================== */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-600 dark:text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {/* =====================================================================
          [P4-01-06-C] 문서 목록 (로딩 / 빈 상태)
          ===================================================================== */}
      {isLoadingDocs && (
        <div className="flex items-center justify-center py-8">
          <span className="animate-spin text-2xl">⏳</span>
          <span className="ml-2 text-gray-500">문서 로딩 중...</span>
        </div>
      )}

      {!isLoadingDocs && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <span className="text-4xl mb-4">📄</span>
          <p className="text-lg font-medium">문서가 없습니다</p>
          <p className="text-sm">프로젝트에 문서를 추가한 후 구조 분석을 시작하세요.</p>
        </div>
      )}

      {/* =====================================================================
          [P4-01-06-D] 완성도 대시보드
          ===================================================================== */}
      {suggestion && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              구조 완성도
            </span>
            <span className="text-lg font-bold text-prism-primary">
              {calculateCompleteness()}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-prism-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${calculateCompleteness()}%` }}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          [P4-01-06-E] AI 제안 결과
          ===================================================================== */}
      {suggestion && suggestion.suggestedOrder.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 제안된 순서 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              제안된 문서 순서
            </h3>
            <div className="space-y-2">
              {suggestion.suggestedOrder.map((item: OrderSuggestion, index: number) => {
                const doc = documents.find((d) => d.id === item.docId)
                return (
                  <div
                    key={item.docId}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    {/* 순서 번호 */}
                    <div className="flex-shrink-0 w-8 h-8 bg-prism-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    {/* 문서 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {doc?.title || '제목 없음'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {item.assignedTag}
                        </span>
                      </p>
                      {item.reason && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {item.reason}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 누락 요소 (Gaps) */}
          {suggestion.gaps && suggestion.gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
                보완이 필요한 부분
              </h3>
              <div className="space-y-2">
                {suggestion.gaps.map((gap: GapSuggestion, index: number) => (
                  <div
                    key={index}
                    className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                  >
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      누락: {gap.missingElement}
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      {gap.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 적용 버튼 */}
          <div className="sticky bottom-0 pt-4 bg-gradient-to-t from-white dark:from-gray-900">
            <button
              onClick={handleApplyOrder}
              disabled={isApplying}
              className={`
                w-full px-4 py-3 rounded-lg font-medium transition-colors
                ${isApplying
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }
              `}
            >
              {isApplying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  적용 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>✅</span>
                  이 순서로 적용
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          [P4-01-06-F] 분석 전 상태 - 문서 목록 표시 (선택 가능)
          ===================================================================== */}
      {!isLoadingDocs && documents.length > 0 && !suggestion && !isAnalyzing && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 안내 메시지 */}
          <div className="text-center py-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-4xl mb-2">🧩</span>
            <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
              {isSelectionMode 
                ? `분석할 문서를 선택하세요 (${selectedDocIds.length}/${documents.length})`
                : 'AI 분석을 시작하세요'
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {documents.length}개의 문서가 있습니다.
              {isSelectionMode && ' 원하는 문서를 클릭하여 선택하세요.'}
            </p>
          </div>

          {/* [S2-02] 문서 카드 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {documents.map((doc, index) => (
              <DocumentCard
                key={doc.id}
                id={doc.id}
                order={index + 1}
                title={doc.title}
                isSelectionMode={isSelectionMode}
                isSelected={selectedDocIds.includes(doc.id)}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleDocumentSelection(doc.id)
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
