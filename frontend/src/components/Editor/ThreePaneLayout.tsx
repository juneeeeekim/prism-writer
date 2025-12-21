
'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface ThreePaneLayoutProps {
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
}

type Tab = 'reference' | 'editor' | 'feedback'

export default function ThreePaneLayout({
  leftPanel,
  centerPanel,
  rightPanel,
}: ThreePaneLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('editor')
  const [isMobile, setIsMobile] = useState(false)

  // 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 모바일 뷰 (탭 전환)
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* 탭 헤더 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            onClick={() => setActiveTab('reference')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'reference'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            참고 자료
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'editor'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            에디터
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'feedback'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            피드백
          </button>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-hidden relative">
          <div className={clsx('absolute inset-0', activeTab === 'reference' ? 'block' : 'hidden')}>
            {leftPanel}
          </div>
          <div className={clsx('absolute inset-0', activeTab === 'editor' ? 'block' : 'hidden')}>
            {centerPanel}
          </div>
          <div className={clsx('absolute inset-0', activeTab === 'feedback' ? 'block' : 'hidden')}>
            {rightPanel}
          </div>
        </div>
      </div>
    )
  }

  // 데스크탑 뷰 (3-Pane)
  return (
    <div className="flex h-full overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* 좌측 패널 (Reference) - 25% */}
      <div className="w-1/4 min-w-[300px] max-w-[400px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {leftPanel}
      </div>

      {/* 중앙 패널 (Editor) - 유동적 */}
      <div className="flex-1 min-w-[400px] bg-white dark:bg-gray-900 shadow-sm z-10">
        {centerPanel}
      </div>

      {/* 우측 패널 (Feedback) - 25% */}
      <div className="w-1/4 min-w-[300px] max-w-[400px] flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {rightPanel}
      </div>
    </div>
  )
}
