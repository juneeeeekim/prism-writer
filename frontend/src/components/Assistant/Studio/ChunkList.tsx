
import { ChunkData } from '@/hooks/useChunks'
import { useState } from 'react'

// =============================================================================
// Chunk Type Configuration (UI Styling)
// =============================================================================
const CHUNK_TYPE_CONFIG = {
  rule: {
    label: '📜 Rule',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    description: '규칙/원칙'
  },
  example: {
    label: '💡 Example',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    description: '예시/사례'
  },
  general: {
    label: '📄 General',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    description: '일반 텍스트'
  }
} as const

type ChunkType = keyof typeof CHUNK_TYPE_CONFIG

// =============================================================================
// [R-10] Pin 제한 상수
// =============================================================================
/** 최대 핀 가능 청크 수 */
const MAX_PINNED_CHUNKS = 5

interface ChunkListProps {
  chunks: ChunkData[]
  onUpdateChunk: (chunkId: string, newContent?: string, isPinned?: boolean, chunkType?: ChunkType) => Promise<void>
}

/**
 * Intelligent Reference Studio - Chunk List
 * 
 * Displays list of chunks with inline editing and type classification support.
 * Phase 3: Chunk Editing + Type Classification
 */
export default function ChunkList({ chunks, onUpdateChunk }: ChunkListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // =============================================================================
  // Event Handlers
  // =============================================================================

  // Start Editing
  const handleEditStart = (chunk: ChunkData) => {
    setEditingId(chunk.id)
    setEditContent(chunk.content)
  }

  // Save Editing
  const handleSave = async (chunkId: string) => {
    if (!editContent.trim()) return
    
    setIsSaving(true)
    try {
      await onUpdateChunk(chunkId, editContent)
      setEditingId(null)
    } catch (err) {
      alert('저장 실패: ' + err)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel Editing
  const handleCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  // Change Chunk Type
  const handleTypeChange = async (chunkId: string, newType: ChunkType) => {
    try {
      await onUpdateChunk(chunkId, undefined, undefined, newType)
    } catch (err) {
      alert('타입 변경 실패: ' + err)
    }
  }

  // =========================================================================
  // [R-10] Pin/Unpin Handler with Max Limit
  // =========================================================================
  const handlePin = async (chunk: ChunkData) => {
    const isPinned = chunk.metadata?.isPinned === true
    
    // Unpin은 항상 허용
    if (isPinned) {
      try {
        await onUpdateChunk(chunk.id, undefined, false)
      } catch (err) {
        alert('고정 해제 실패: ' + err)
      }
      return
    }
    
    // Pin 시 최대 개수 체크
    const pinnedCount = chunks.filter(c => c.metadata?.isPinned === true).length
    if (pinnedCount >= MAX_PINNED_CHUNKS) {
      alert(`최대 ${MAX_PINNED_CHUNKS}개까지만 고정할 수 있습니다.`)
      return
    }
    
    try {
      await onUpdateChunk(chunk.id, undefined, true)
    } catch (err) {
      alert('고정 실패: ' + err)
    }
  }
  
  // =============================================================================
  // Render: Empty State
  // =============================================================================
  if (chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <span className="text-2xl mb-2">📄</span>
        <span>이 문서에는 분석된 내용(Chunk)이 없습니다.</span>
      </div>
    )
  }

  // =============================================================================
  // Render: Chunk List
  // =============================================================================
  return (
    <div className="space-y-4 pb-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2 px-1">
        <span>Total {chunks.length} chunks</span>
        <div className="flex gap-2">
          <span className="text-blue-600">{chunks.filter(c => c.chunk_type === 'rule').length} rules</span>
          <span className="text-green-600">{chunks.filter(c => c.chunk_type === 'example').length} examples</span>
        </div>
      </div>
      
      {chunks.map((chunk) => {
        const isEditing = editingId === chunk.id
        const isPinned = chunk.metadata?.isPinned === true
        const chunkType = chunk.chunk_type || 'general'
        const typeConfig = CHUNK_TYPE_CONFIG[chunkType]

        return (
          <div 
            key={chunk.id} 
            className={`
              group relative bg-white dark:bg-gray-800 border rounded-lg p-4 transition-all shadow-sm
              ${isEditing ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}
            `}
          >
            {/* ================================================================
                Metadata Header
                ================================================================ */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Chunk Index */}
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                  #{chunk.chunk_index + 1}
                </span>
                
                {/* Chunk Type Badge (Clickable to Change) */}
                <div className="relative group/type">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color} cursor-pointer`}>
                    {typeConfig.label}
                  </span>
                  
                  {/* Type Dropdown (on hover) */}
                  <div className="absolute left-0 top-full mt-1 hidden group-hover/type:block z-20">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                      {(Object.keys(CHUNK_TYPE_CONFIG) as ChunkType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => handleTypeChange(chunk.id, type)}
                          className={`
                            w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700
                            ${chunk.chunk_type === type ? 'font-bold' : ''}
                          `}
                        >
                          {CHUNK_TYPE_CONFIG[type].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Pin Badge */}
                {isPinned && (
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    📌 Pinned
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => handlePin(chunk)}
                      className={`
                        text-xs px-2 py-1 rounded transition-colors
                        ${isPinned 
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                          : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                        }
                      `}
                      title={isPinned ? '고정 해제' : '상단 고정'}
                    >
                      {isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={() => handleEditStart(chunk)}
                      className="text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* ================================================================
                Content Area
                ================================================================ */}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-32 p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(chunk.id)}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded flex items-center gap-1"
                  >
                    {isSaving && <div className="animate-spin h-3 w-3 border-b-2 border-white rounded-full"></div>}
                    Save & Re-embed
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3 rounded leading-relaxed whitespace-pre-wrap font-sans">
                {chunk.content}
              </div>
            )}
            
            {/* ================================================================
                Footer Metadata
                ================================================================ */}
            {!isEditing && (
               <div className="mt-2 flex gap-2 text-[10px] text-gray-300">
                  <span>Tokens: {chunk.metadata?.tokenCount || '?'}</span>
               </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
