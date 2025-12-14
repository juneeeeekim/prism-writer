// =============================================================================
// PRISM Writer - Outline Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/OutlineTab.tsx
// 역할: 주제 입력 → 목차 생성 요청 → 결과 표시
// =============================================================================

'use client'

import { useState } from 'react'
import { useEditorState, OutlineItem } from '@/hooks/useEditorState'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function OutlineTab() {
  const [topic, setTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedOutline, setGeneratedOutline] = useState<OutlineItem[]>([])
  const [error, setError] = useState<string | null>(null)
  
  const { insertOutline } = useEditorState()

  // ---------------------------------------------------------------------------
  // Generate Outline Handler
  // ---------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      // TODO: 실제 API 연동 (Phase 3에서 구현)
      // const response = await fetch('/api/v1/outline/generate', { ... })
      
      // 임시 더미 데이터
      const dummyOutline: OutlineItem[] = [
        { title: '서론', depth: 1 },
        { title: '배경 및 목적', depth: 2 },
        { title: '본론', depth: 1 },
        { title: '핵심 내용 1', depth: 2 },
        { title: '핵심 내용 2', depth: 2 },
        { title: '결론', depth: 1 },
        { title: '요약 및 제언', depth: 2 },
      ]
      
      // 로딩 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setGeneratedOutline(dummyOutline)
    } catch (err) {
      setError('목차 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Insert to Editor Handler
  // ---------------------------------------------------------------------------
  const handleInsert = () => {
    insertOutline(generatedOutline)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 space-y-4">
      {/* 주제 입력 */}
      <div>
        <label htmlFor="topic-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          📝 글의 주제
        </label>
        <input
          id="topic-input"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="예: AI 시대의 글쓰기 방법론..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-prism-primary focus:border-transparent"
          disabled={isLoading}
        />
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-prism-primary text-white font-semibold rounded-lg
                   hover:bg-prism-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="목차 생성하기"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <span className="animate-spin mr-2">⏳</span>
            생성 중...
          </span>
        ) : (
          '🗂️ 목차 생성'
        )}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 생성된 목차 */}
      {generatedOutline.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            📋 생성된 목차
          </h3>
          
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
            {generatedOutline.map((item, index) => (
              <div
                key={index}
                className="flex items-center"
                style={{ paddingLeft: `${(item.depth - 1) * 16}px` }}
              >
                <span className="text-gray-400 mr-2">
                  {item.depth === 1 ? '●' : '○'}
                </span>
                <span className="text-gray-800 dark:text-gray-200">
                  {item.title}
                </span>
              </div>
            ))}
          </div>

          {/* 에디터에 삽입 버튼 */}
          <button
            onClick={handleInsert}
            className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg
                       hover:bg-green-700 transition-colors"
            aria-label="에디터에 목차 삽입"
          >
            ✅ 에디터에 삽입
          </button>
        </div>
      )}
    </div>
  )
}
