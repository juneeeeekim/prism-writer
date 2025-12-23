import { DocumentStatus } from '@/types/rag'

interface ReferenceItemProps {
  status: DocumentStatus
  errorMessage?: string
  className?: string
  onDelete?: () => void
}

export default function ReferenceItem({ status, errorMessage, className = '', onDelete }: ReferenceItemProps) {
  // ---------------------------------------------------------------------------
  // 상태별 UI 설정 (아이콘, 색상, 텍스트)
  // ---------------------------------------------------------------------------
  const getStatusConfig = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.QUEUED:
        return {
          icon: '⏳',
          text: '대기 중...',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100 dark:bg-gray-800',
          progress: 0
        }
      case DocumentStatus.PARSING:
        return {
          icon: '📄',
          text: '텍스트 추출 중...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          progress: 25
        }
      case DocumentStatus.CHUNKING:
        return {
          icon: '✂️',
          text: '내용 분석 중...',
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
          progress: 50
        }
      case DocumentStatus.EMBEDDING:
        return {
          icon: '🧠',
          text: 'AI 학습 중...',
          color: 'text-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          progress: 75
        }
      case DocumentStatus.COMPLETED:
        return {
          icon: '✅',
          text: '준비됨',
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          progress: 100
        }
      case DocumentStatus.FAILED:
        return {
          icon: '❌',
          text: '오류 발생',
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          progress: 100
        }
      // 호환성
      case 'pending' as any:
        return { icon: '⏳', text: '대기 중...', color: 'text-gray-500', bgColor: 'bg-gray-100', progress: 0 }
      case 'processing' as any:
        return { icon: '⚙️', text: '처리 중...', color: 'text-blue-500', bgColor: 'bg-blue-50', progress: 50 }
      case 'ready' as any:
        return { icon: '✅', text: '준비됨', color: 'text-green-500', bgColor: 'bg-green-50', progress: 100 }
      case 'error' as any:
        return { icon: '❌', text: '오류', color: 'text-red-500', bgColor: 'bg-red-50', progress: 100 }
      default:
        return { icon: '❓', text: '알 수 없음', color: 'text-gray-400', bgColor: 'bg-gray-50', progress: 0 }
    }
  }

  const config = getStatusConfig(status)

  return (
    <div 
      className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-all duration-300 ${config.bgColor} ${config.color} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm">{config.icon}</span>
      <span>{config.text}</span>
      
      {/* 진행 상태 바 (처리 중일 때만 표시) */}
      {config.progress > 0 && config.progress < 100 && (
        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ml-1">
          <div 
            className="h-full bg-current transition-all duration-500 ease-out"
            style={{ width: `${config.progress}%` }}
          />
        </div>
      )}

      {/* 에러 메시지 툴팁 */}
      {status === DocumentStatus.FAILED && errorMessage && (
        <div className="group relative ml-1">
          <span className="cursor-help text-xs border border-current rounded-full w-4 h-4 flex items-center justify-center">?</span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {errorMessage}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}

      {/* 삭제 버튼 (Phase 4 추가) */}
      <button
        onClick={(e) => {
          e.stopPropagation() // 부모 클릭 이벤트 방지
          if (onDelete) onDelete()
        }}
        className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        title="문서 삭제"
        aria-label="문서 삭제"
      >
        🗑️
      </button>
    </div>
  )
}
