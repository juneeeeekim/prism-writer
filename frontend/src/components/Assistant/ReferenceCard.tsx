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
  const { insertText, setChatDraft } = useEditorState()
  
  // ---------------------------------------------------------------------------
  // [Phase 8] Drag & Drop Handler
  // ---------------------------------------------------------------------------
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // 텍스트 에디터에 드롭할 수 있도록 text/plain 설정
    const dragData = `> ${content}\n> \n> — *${source}*`
    e.dataTransfer.setData('text/plain', dragData)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // ---------------------------------------------------------------------------
  // [Phase 8] Draft with AI Handler
  // ---------------------------------------------------------------------------
  const handleDraftWithThis = () => {
    const prompt = `다음 참고 자료를 바탕으로 내용을 작성해줘:\n\n"${content}"\n\n(출처: ${source})`
    setChatDraft(prompt)
  }

  // ---------------------------------------------------------------------------
  // Insert Handler
  // ---------------------------------------------------------------------------
  const handleInsert = () => {
    // 인용 형식으로 삽입
    const quotedText = `> ${content}\n> \n> — *${source}*`
    insertText(quotedText)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div 
      className="reference-card bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-move hover:shadow-md transition-shadow duration-200"
      draggable={true}
      onDragStart={handleDragStart}
    >
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
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded
                     hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors flex items-center justify-center gap-1"
          aria-label="에디터에 삽입"
        >
          ✍️ 삽입
        </button>
        
        {/* [Phase 8] 이걸로 써줘 버튼 */}
        <button
          onClick={handleDraftWithThis}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-prism-primary text-white rounded
                     hover:bg-prism-accent transition-colors flex items-center justify-center gap-1"
          aria-label="AI 초안 작성"
        >
          ✨ 이걸로 써줘
        </button>
      </div>
    </div>
  )
}
