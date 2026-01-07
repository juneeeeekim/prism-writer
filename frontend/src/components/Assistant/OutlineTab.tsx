// =============================================================================
// PRISM Writer - Outline Tab
// =============================================================================
// 파일: frontend/src/components/Assistant/OutlineTab.tsx
// 역할: 주제 입력 → 목차 생성 요청 → 결과 표시 → DB 저장/로드
// Update: 2025-12-27 - Phase 7 Persistence
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { useEditorState, OutlineItem } from '@/hooks/useEditorState'
import { useProject } from '@/contexts/ProjectContext' // [FIX] Import useProject

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface SavedOutline {
  id: string
  topic: string
  outline_data: OutlineItem[]
  sources_used: number
  created_at: string
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function OutlineTab() {
  const [topic, setTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedOutline, setGeneratedOutline] = useState<OutlineItem[]>([])
  const [sourcesUsed, setSourcesUsed] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [savedOutlines, setSavedOutlines] = useState<SavedOutline[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  
  const { insertOutline } = useEditorState()
  
  // [RAG-ISOLATION] 프로젝트 ID 사용
  const { currentProject } = useProject()

  // ---------------------------------------------------------------------------
  // Load Saved Outlines on Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadOutlines = async () => {
      try {
        const res = await fetch('/api/outlines')
        if (!res.ok) {
          console.warn('[OutlineTab] Failed to load outlines')
          return
        }
        const data = await res.json()
        if (data.success && data.outlines?.length > 0) {
          setSavedOutlines(data.outlines)
          // 가장 최근 목차를 자동 로드
          const latest = data.outlines[0]
          setTopic(latest.topic)
          setGeneratedOutline(latest.outline_data || [])
          setSourcesUsed(latest.sources_used || 0)
          setIsSaved(true)
        }
      } catch (err) {
        console.error('[OutlineTab] Error loading outlines:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadOutlines()
  }, [])

  // ---------------------------------------------------------------------------
  // Save Outline to DB
  // ---------------------------------------------------------------------------
  const saveOutline = async (outlineData: OutlineItem[], topicText: string, sources: number) => {
    try {
      const res = await fetch('/api/outlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicText,
          outlineData,
          sourcesUsed: sources
        })
      })
      if (res.ok) {
        setIsSaved(true)
        console.log('[OutlineTab] Outline saved to DB')
      }
    } catch (err) {
      console.error('[OutlineTab] Failed to save outline:', err)
    }
  }

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
    setSourcesUsed(0)
    setIsSaved(false)
    
    try {
      // -----------------------------------------------------------------------
      // P0 Fix: 내부 API Route 호출 (vectorSearch 연동됨)
      // 업로드된 참고자료를 기반으로 목차 생성
      // -----------------------------------------------------------------------
      // [RAG-ISOLATION] 프로젝트 ID 전달하여 검색 격리 준수
      const response = await fetch('/api/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          maxDepth: 3,
          topK: 10,
          projectId: currentProject?.id || null, // [FIX] 프로젝트 ID 전달
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '목차 생성에 실패했습니다.')
      }

      // 참고자료 사용 정보 로그
      if (data.sourcesUsed > 0) {
        console.log(`[OutlineTab] 참고자료 ${data.sourcesUsed}개 활용`)
      }

      const outline = data.outline || []
      const sources = data.sourcesUsed || 0
      
      setGeneratedOutline(outline)
      setSourcesUsed(sources)

      // [Phase 7] 생성 후 자동 저장
      await saveOutline(outline, topic.trim(), sources)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '목차 생성에 실패했습니다. 다시 시도해주세요.')
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
  // Load Saved Outline Handler
  // ---------------------------------------------------------------------------
  const handleLoadOutline = (outline: SavedOutline) => {
    setTopic(outline.topic)
    setGeneratedOutline(outline.outline_data || [])
    setSourcesUsed(outline.sources_used || 0)
    setIsSaved(true)
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
          onChange={(e) => { setTopic(e.target.value); setIsSaved(false); }}
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
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            📋 생성된 목차
            {sourcesUsed > 0 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                📚 참고자료 {sourcesUsed}개 활용
              </span>
            )}
            {isSaved && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                ✅ 저장됨
              </span>
            )}
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

          {/* 참고자료 없음 경고 */}
          {sourcesUsed === 0 && generatedOutline.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
              ⚠️ 업로드된 참고자료 중 관련 내용을 찾지 못해 일반 지식으로 생성되었습니다.
              <br />
              <span className="text-gray-500 dark:text-gray-400">
                주제와 더 밀접한 관련이 있는 자료를 업로드해보세요.
              </span>
            </div>
          )}

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

      {/* 이전 목차 히스토리 - 저장된 목차가 1개 이상이면 항상 표시 */}
      {!isLoadingHistory && savedOutlines.length >= 1 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📁 이전 목차</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {savedOutlines.slice(0, 5).map((outline) => (
              <button
                key={outline.id}
                onClick={() => handleLoadOutline(outline)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 truncate"
              >
                {outline.topic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
