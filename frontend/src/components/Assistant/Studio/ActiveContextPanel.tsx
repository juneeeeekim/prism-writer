
// Phase 2: Integrated with ChunkList
// Phase 3: Mobile Responsive (Back Button)
import { useChunks } from '@/hooks/useChunks'
import ChunkList from './ChunkList'

interface ActiveContextPanelProps {
  selectedDocId: string | null
  className?: string
  // Mobile Navigation Props
  onBack?: () => void
  showBackButton?: boolean
  // [I-06] Pin/Unpin Props (optional - 상위 컴포넌트에서 관리)
  pinnedChunkIds?: string[]
  onPinChunk?: (chunkId: string) => void
  onUnpinChunk?: (chunkId: string) => void
}

export default function ActiveContextPanel({ 
  selectedDocId, 
  className = '',
  onBack,
  showBackButton = false
}: ActiveContextPanelProps) {
  
  // Data Fetching
  const { chunks, isLoading, error, updateChunk } = useChunks(selectedDocId)

  if (!selectedDocId) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-gray-400 bg-white dark:bg-gray-800 ${className}`}>
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-3xl grayscale">👈</span>
        </div>
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">
          문서를 선택하세요
        </h3>
        <p className="text-sm text-gray-500 mt-2 max-w-xs text-center">
          왼쪽 목록에서 문서를 선택하여 상세 내용과 AI가 인식한 지식(Chunk)을 확인하세요.
        </p>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button (only visible when showBackButton is true) */}
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="목록으로 돌아가기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Knowledge Context
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              ID: {selectedDocId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div>
           {/* Future: Refresh / Search in Doc buttons */}
        </div>
      </div>
      
      {/* Main Content: Chunk List */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-gray-900/30">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
            <span className="text-sm text-gray-500">지식 데이터를 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="text-center p-8 text-red-500">
            <p>데이터를 불러오는데 실패했습니다.</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        ) : (
          <ChunkList 
            chunks={chunks} 
            onUpdateChunk={(chunkId, content, isPinned, chunkType) => 
              updateChunk(chunkId, content, isPinned, chunkType)
            } 
          />
        )}
      </div>
    </div>
  )
}
