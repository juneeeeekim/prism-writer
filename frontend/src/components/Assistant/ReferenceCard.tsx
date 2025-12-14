// =============================================================================
// PRISM Writer - Reference Card
// =============================================================================
// 파일: frontend/src/components/Assistant/ReferenceCard.tsx
// 역할: 개별 참고자료 카드 (내용, 출처, 삽입 버튼)
// =============================================================================

'use client'

import { useEditorState } from '@/hooks/useEditorState'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface ReferenceCardProps {
  id: string
  content: string
  source: string
  similarity: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ReferenceCard({
  id,
  content,
  source,
  similarity,
}: ReferenceCardProps) {
  const { insertText } = useEditorState()

  // ---------------------------------------------------------------------------
  // Insert Handler
  // ---------------------------------------------------------------------------
  const handleInsert = () => {
    // 인용 형식으로 삽입
    const quotedText = `${content}\n\n— *${source}*`
    insertText(quotedText)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="reference-card bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600">
      {/* 유사도 배지 */}
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          유사도: {Math.round(similarity * 100)}%
        </span>
        <span
          className={`px-2 py-0.5 text-xs rounded-full
                      ${similarity >= 0.9 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : similarity >= 0.8 
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }`}
        >
          {similarity >= 0.9 ? '매우 관련' : similarity >= 0.8 ? '관련' : '참고'}
        </span>
      </div>

      {/* 내용 */}
      <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 line-clamp-3">
        {content}
      </p>

      {/* 출처 */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        📄 {source}
      </p>

      {/* 버튼 그룹 */}
      <div className="flex gap-2">
        <button
          onClick={handleInsert}
          className="flex-1 px-3 py-1.5 text-sm bg-prism-primary text-white rounded
                     hover:bg-prism-accent transition-colors"
          aria-label={`"${content.substring(0, 20)}..." 에디터에 삽입`}
        >
          ✍️ 삽입
        </button>
        <button
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded
                     hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          aria-label="원문 보기"
        >
          👁️
        </button>
      </div>
    </div>
  )
}
