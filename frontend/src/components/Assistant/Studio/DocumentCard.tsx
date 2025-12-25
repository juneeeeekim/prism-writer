
import { DocumentStatus } from '@/types/rag'

export interface DocumentCardProps {
  id: string
  title: string
  fileSize: number
  status: DocumentStatus
  errorMessage?: string
  isSelected?: boolean
  onClick?: () => void
  onDelete?: () => void
}

/**
 * Intelligent Reference Studio - Document Card
 * 
 * Purpose:
 * - Displays document status with richer UI
 * - Acts as a clickable item to open details
 * - Shows file metadata (size, title)
 */
export default function DocumentCard({
  id,
  title,
  fileSize,
  status,
  errorMessage,
  isSelected = false,
  onClick,
  onDelete
}: DocumentCardProps) {
  
  // Status configuration mapping
  const getStatusConfig = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.QUEUED:
        return { icon: '⏳', label: '대기', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' }
      case DocumentStatus.PARSING:
        return { icon: '📄', label: '분석', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' }
      case DocumentStatus.CHUNKING:
        return { icon: '✂️', label: '청크', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' }
      case DocumentStatus.EMBEDDING:
        return { icon: '🧠', label: '학습', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' }
      case DocumentStatus.COMPLETED:
        return { icon: '✅', label: '완료', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' }
      case DocumentStatus.FAILED:
        return { icon: '❌', label: '실패', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' }
      // Legacy Compatibility
      case 'pending' as any:
        return { icon: '⏳', label: '대기', color: 'text-gray-500', bg: 'bg-gray-100' }
      case 'processing' as any:
        return { icon: '⚙️', label: '처리', color: 'text-blue-500', bg: 'bg-blue-50' }
      case 'ready' as any:
        return { icon: '✅', label: '준비', color: 'text-green-500', bg: 'bg-green-50' }
      case 'error' as any:
        return { icon: '❌', label: '오류', color: 'text-red-500', bg: 'bg-red-50' }
      default:
        return { icon: '❓', label: '미상', color: 'text-gray-400', bg: 'bg-gray-50' }
    }
  }

  const config = getStatusConfig(status)

  return (
    <div 
      onClick={onClick}
      className={`
        relative group cursor-pointer p-3 rounded-lg border transition-all duration-200
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex justify-between items-start mb-2">
        {/* Document Icon & Title */}
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={title}>
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {(fileSize / 1024).toFixed(1)} KB
          </p>
        </div>
        
        {/* Status Badge */}
        <div className={`
          flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap
          ${config.bg} ${config.color}
        `}>
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </div>
      </div>

      {/* Tags / Summary Placeholder (Phase 1 Stub) */}
      <div className="text-xs text-gray-400 dark:text-gray-500 italic line-clamp-2 h-8">
        {status === DocumentStatus.COMPLETED 
          ? "문서 내용의 요약이 이곳에 표시됩니다..." 
          : "문서 처리 중입니다..."}
      </div>

      {/* Error Message Tooltip */}
      {status === DocumentStatus.FAILED && errorMessage && (
        <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-1.5 rounded">
          {errorMessage}
        </div>
      )}

      {/* Delete Button (Visible on Hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
        }}
        className="
          absolute top-2 right-2 p-1.5 rounded-full 
          text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30
          opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100
        "
        title="문서 삭제"
        aria-label="문서 삭제"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
