// =============================================================================
// PRISM Writer - Toast Notification Hook
// =============================================================================
// 파일: frontend/src/hooks/useToast.ts
// 역할: 토스트 알림 관리 (성공/오류/정보 메시지)
// =============================================================================

import { create } from 'zustand'

// =============================================================================
// 타입 정의
// =============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

// =============================================================================
// Zustand Store
// =============================================================================

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (type, message, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, type, message, duration }
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))
    
    // 자동 제거
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// =============================================================================
// Hook
// =============================================================================

/**
 * 토스트 알림을 위한 훅
 * 
 * @example
 * ```tsx
 * const toast = useToast()
 * 
 * toast.success('업로드 성공!')
 * toast.error('파일이 너무 큽니다.')
 * ```
 */
export const useToast = () => {
  const { addToast } = useToastStore()
  
  return {
    success: (message: string, duration?: number) => addToast('success', message, duration),
    error: (message: string, duration?: number) => addToast('error', message, duration),
    info: (message: string, duration?: number) => addToast('info', message, duration),
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
  }
}
