
import { ChunkData } from '@/hooks/useChunks'
import { useState } from 'react'

interface ChunkListProps {
  chunks: ChunkData[]
  onUpdateChunk: (chunkId: string, newContent?: string, isPinned?: boolean) => Promise<void>
}

/**
 * Intelligent Reference Studio - Chunk List
 * 
 * Displays list of chunks with inline editing support (Phase 3).
 */
export default function ChunkList({ chunks, onUpdateChunk }: ChunkListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
  
  if (chunks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <span className="text-2xl mb-2">📄</span>
        <span>이 문서에는 분석된 내용(Chunk)이 없습니다.</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2 px-1">
        <span>Total {chunks.length} chunks</span>
        {/* Phase 3: Sort/Filter options */}
      </div>
      
      {chunks.map((chunk) => {
        const isEditing = editingId === chunk.id
        const isPinned = chunk.metadata?.isPinned === true

        return (
          <div 
            key={chunk.id} 
            className={`
              group relative bg-white dark:bg-gray-800 border rounded-lg p-4 transition-all shadow-sm
              ${isEditing ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}
            `}
          >
            {/* Metadata Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                 <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                  #{chunk.index + 1}
                </span>
                
                {/* Pin Badge */}
                {isPinned && (
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    📌 Pinned
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {/* Action Buttons */}
                {!isEditing && (
                  <>
                    <button
                      onClick={() => onUpdateChunk(chunk.id, undefined, !isPinned)}
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
            
            {/* Content Area */}
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
            
            {!isEditing && (
               <div className="mt-2 flex gap-2 text-[10px] text-gray-300">
                  <span>Type: {chunk.metadata?.chunkType || 'general'}</span>
                  <span>Tokens: {chunk.metadata?.tokenCount || '?'}</span>
               </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
