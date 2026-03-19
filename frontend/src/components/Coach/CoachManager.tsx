// =============================================================================
// PRISM Writer - Coach Manager UI
// =============================================================================
// 파일: frontend/src/components/Coach/CoachManager.tsx
// 역할: AI 글쓰기 코치 관리 패널 (목록, 생성, 수정, 삭제)
// 생성일: 2026-03-19
// Phase C: P3-08
// =============================================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCoach, type Coach, type CreateCoachInput } from '@/hooks/useCoach'
import { useProject } from '@/contexts/ProjectContext'

// =============================================================================
// 상수
// =============================================================================

const EMOJI_OPTIONS = [
  '🎓', '📝', '✍️', '📚', '🎯', '💡', '🔬', '📖',
  '🧠', '✨', '🏆', '📊', '🎨', '🔥', '💪', '🌟',
]

// =============================================================================
// Types
// =============================================================================

interface CoachManagerProps {
  /** 외부에서 패널 닫기 콜백 (옵션) */
  onClose?: () => void
}

// =============================================================================
// Component
// =============================================================================

export default function CoachManager({ onClose }: CoachManagerProps) {
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? null

  const {
    coaches,
    activeCoach,
    isLoading,
    isAnalyzing,
    createCoach,
    activateCoach,
    deleteCoach,
    updateCoach,
  } = useCoach(projectId)

  // ---------------------------------------------------------------------------
  // UI 상태
  // ---------------------------------------------------------------------------
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null)
  const [editTarget, setEditTarget] = useState<Coach | null>(null)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* ===================================================================
          헤더
          =================================================================== */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          AI 글쓰기 코치
        </h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          + 새 코치 만들기
        </button>
      </div>

      {/* ===================================================================
          활성 코치 배너
          =================================================================== */}
      {activeCoach && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg flex-shrink-0">{activeCoach.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                  {activeCoach.name}
                </p>
                {activeCoach.description && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
                    {activeCoach.description}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => activateCoach(null)}
              className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              비활성화
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          분석 중 스피너
          =================================================================== */}
      {isAnalyzing && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              글쓰기 스타일 분석 중...
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================
          코치 목록
          =================================================================== */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">아직 코치가 없습니다.</p>
            <p className="text-xs mt-1">새 코치를 만들어 맞춤형 피드백을 받아보세요.</p>
          </div>
        ) : (
          coaches.map((coach) => (
            <CoachCard
              key={coach.id}
              coach={coach}
              isActive={activeCoach?.id === coach.id}
              onActivate={() => activateCoach(coach)}
              onEdit={() => setEditTarget(coach)}
              onDelete={() => setDeleteTarget(coach)}
            />
          ))
        )}
      </div>

      {/* ===================================================================
          생성 다이얼로그
          =================================================================== */}
      {showCreateDialog && (
        <CreateCoachDialog
          projectId={projectId}
          onSubmit={async (input) => {
            const result = await createCoach(input)
            if (result) {
              setShowCreateDialog(false)
            }
            return !!result
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* ===================================================================
          수정 다이얼로그
          =================================================================== */}
      {editTarget && (
        <EditCoachDialog
          coach={editTarget}
          onSubmit={async (updates) => {
            const ok = await updateCoach(editTarget.id, updates)
            if (ok) setEditTarget(null)
            return ok
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ===================================================================
          삭제 확인 다이얼로그
          =================================================================== */}
      {deleteTarget && (
        <DeleteConfirmDialog
          coach={deleteTarget}
          onConfirm={async () => {
            const ok = await deleteCoach(deleteTarget.id)
            if (ok) setDeleteTarget(null)
            return ok
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// =============================================================================
// CoachCard - 코치 카드
// =============================================================================

function CoachCard({
  coach,
  isActive,
  onActivate,
  onEdit,
  onDelete,
}: {
  coach: Coach
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const docCount = coach.source_document_ids?.length || 0

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isActive
          ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl flex-shrink-0 mt-0.5">{coach.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {coach.name}
          </p>
          {coach.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {coach.description}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            참고 문서 {docCount}개
          </p>
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        {!isActive ? (
          <button
            onClick={onActivate}
            className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
          >
            활성화
          </button>
        ) : (
          <span className="px-2 py-1 text-xs rounded bg-blue-600 text-white">
            사용 중
          </span>
        )}
        <button
          onClick={onEdit}
          className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          수정
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 text-xs rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// CreateCoachDialog - 코치 생성 다이얼로그
// =============================================================================

function CreateCoachDialog({
  projectId,
  onSubmit,
  onClose,
}: {
  projectId: string | null
  onSubmit: (input: CreateCoachInput) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🎓')
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 문서 목록 로드
  const [documents, setDocuments] = useState<Array<{ id: string; title: string }>>([])
  const [docsLoading, setDocsLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return
    setDocsLoading(true)
    fetch(`/api/documents/list?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.documents) {
          setDocuments(
            data.documents.map((d: any) => ({ id: d.id, title: d.title || '제목 없음' }))
          )
        }
      })
      .catch((err) => console.error('[CreateCoachDialog] docs fetch error:', err))
      .finally(() => setDocsLoading(false))
  }, [projectId])

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('코치 이름을 입력해주세요.')
      return
    }
    if (selectedDocIds.length === 0) {
      setError('참고 문서를 최소 1개 이상 선택해주세요.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      const ok = await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        documentIds: selectedDocIds,
        projectId,
      })
      if (!ok) {
        setError('코치 생성에 실패했습니다. 다시 시도해주세요.')
      }
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            새 코치 만들기
          </h3>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              코치 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 논리 마스터, 감성 작가"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              maxLength={50}
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명 (선택)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 코치의 특징을 간략히 설명하세요"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              maxLength={100}
            />
          </div>

          {/* 아이콘 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              아이콘
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center transition-colors ${
                    icon === emoji
                      ? 'bg-blue-100 dark:bg-blue-800 ring-2 ring-blue-500'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 문서 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              참고 문서 선택 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              이 문서들의 글쓰기 스타일을 분석하여 코치 페르소나를 생성합니다.
            </p>

            {docsLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                문서 목록 로딩 중...
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">
                프로젝트에 업로드된 문서가 없습니다. 먼저 참고 문서를 업로드해주세요.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {doc.title}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedDocIds.length > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {selectedDocIds.length}개 문서 선택됨
              </p>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || selectedDocIds.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '생성 중...' : '생성 및 분석 시작'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}

// =============================================================================
// EditCoachDialog - 코치 수정 다이얼로그
// =============================================================================

function EditCoachDialog({
  coach,
  onSubmit,
  onClose,
}: {
  coach: Coach
  onSubmit: (updates: { name?: string; description?: string; icon?: string }) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(coach.name)
  const [description, setDescription] = useState(coach.description || '')
  const [icon, setIcon] = useState(coach.icon)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            코치 수정
          </h3>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              코치 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              설명
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              아이콘
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center transition-colors ${
                    icon === emoji
                      ? 'bg-blue-100 dark:bg-blue-800 ring-2 ring-blue-500'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}

// =============================================================================
// DeleteConfirmDialog - 삭제 확인 다이얼로그
// =============================================================================

function DeleteConfirmDialog({
  coach,
  onConfirm,
  onClose,
}: {
  coach: Coach
  onConfirm: () => Promise<boolean>
  onClose: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
            코치 삭제
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{coach.icon} {coach.name}</span> 코치를 삭제하시겠습니까?
            이 작업은 취소할 수 없습니다.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  )
}

// =============================================================================
// DialogOverlay - 공통 다이얼로그 오버레이
// =============================================================================

function DialogOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* 배경 클릭으로 닫기 */}
      <div className="absolute inset-0" onClick={onClose} />
      {/* 다이얼로그 본체 */}
      <div className="relative z-10 mx-4">
        {children}
      </div>
    </div>
  )
}
