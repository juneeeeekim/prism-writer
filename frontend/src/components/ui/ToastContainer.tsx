// =============================================================================
// PRISM Writer - Toast Container Component
// =============================================================================
// 파일: frontend/src/components/ui/ToastContainer.tsx
// 역할: 토스트 알림 표시 컨테이너
// =============================================================================

'use client'

import { useToastStore } from '@/hooks/useToast'

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  const getToastStyles = (type: string) => {
    const baseStyles = 'px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-80 max-w-md'
    
    const typeStyles = {
      success: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
      error: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
      info: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
    }
    
    return `${baseStyles} ${typeStyles[type as keyof typeof typeStyles] || typeStyles.info}`
  }

  const getIcon = (type: string) => {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    }
    
    const iconColors = {
      success: 'text-green-600 dark:text-green-400',
      error: 'text-red-600 dark:text-red-400',
      warning: 'text-yellow-600 dark:text-yellow-400',
      info: 'text-blue-600 dark:text-blue-400',
    }
    
    return (
      <span className={`text-xl font-bold ${iconColors[type as keyof typeof iconColors]}`}>
        {icons[type as keyof typeof icons]}
      </span>
    )
  }

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} animate-slide-in-right`}
          role="alert"
        >
          {getIcon(toast.type)}
          <p className="flex-1 text-sm text-gray-800 dark:text-gray-200">
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
