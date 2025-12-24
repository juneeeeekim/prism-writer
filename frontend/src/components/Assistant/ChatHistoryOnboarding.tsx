'use client'

import { useState, useEffect } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface ChatHistoryOnboardingProps {
  onDismiss: () => void
}

const STORAGE_KEY = 'prism_chat_history_onboarding_seen'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ChatHistoryOnboarding({ onDismiss }: ChatHistoryOnboardingProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has already seen the onboarding
    const hasSeen = localStorage.getItem(STORAGE_KEY)
    if (!hasSeen) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = (shouldSave = true) => {
    setIsVisible(false)
    if (shouldSave) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    // 애니메이션 후 onDismiss 호출 (옵션)
    setTimeout(onDismiss, 300)
  }

  if (!isVisible) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-desc"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 scale-100 border border-gray-200 dark:border-gray-700"
      >
        {/* Header with Illustration/Icon */}
        <div className="bg-prism-primary/10 dark:bg-prism-primary/20 p-6 flex justify-center">
          <div className="text-6xl animate-bounce-slow">
            🎉
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          <h2 
            id="onboarding-title" 
            className="text-xl font-bold text-gray-900 dark:text-gray-100"
          >
            새로운 채팅 기록 기능!
          </h2>
          
          <div id="onboarding-desc" className="text-gray-600 dark:text-gray-300 space-y-2 text-sm leading-relaxed">
            <p>
              이제 <strong className="text-prism-primary">대화 내용이 자동으로 저장</strong>됩니다.
            </p>
            <p>
              왼쪽 사이드바에서 언제든지<br/>
              이전 대화를 다시 찾아볼 수 있어요.
            </p>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleClose(true)} // '시작하기'는 본 것으로 처리
            className="flex-1 px-4 py-2.5 bg-prism-primary text-white font-medium rounded-lg hover:bg-prism-primary/90 focus:outline-none focus:ring-2 focus:ring-prism-primary focus:ring-offset-2 transition-colors"
          >
            시작하기
          </button>
          
          <button
            onClick={() => handleClose(false)} // '나중에'는 안 본 것으로 처리 (다음에 다시 뜸) -> 기획에 따라 변경 가능, 여기선 일단 닫기만 함
            className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
