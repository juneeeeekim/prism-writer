// =============================================================================
// PRISM Writer - MessageItem Component
// =============================================================================
// 파일: frontend/src/components/Assistant/chat/MessageItem.tsx
// 역할: 개별 채팅 메시지 렌더링 (메모이제이션)
// 리팩토링: 2026-01-20
// =============================================================================

'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TIER_CONFIG, type RubricTier } from '@/lib/rag/rubrics'
import AdaptiveFeedbackButtons from '@/components/chat/AdaptiveFeedbackButtons'

// =============================================================================
// Types
// =============================================================================

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    citation_verification?: {
      valid: boolean
      matchScore: number
    }
    rubric_tier?: RubricTier
    sources?: Array<{
      title: string
      chunkId: string
      score: number
    }>
  }
  feedback?: 'chat_helpful' | 'chat_not_helpful' | 'chat_hallucination' | null
}

interface MessageItemProps {
  message: Message
  projectId: string | null
}

// =============================================================================
// Citation Badge Component
// =============================================================================

function CitationBadge({ score, rubricTier }: { score: number; rubricTier?: RubricTier }) {
  const scorePercent = Math.round(score * 100)

  let badgeStyle: string
  let badgeIcon: string
  let badgeText: string

  if (score >= 0.7) {
    badgeStyle = 'bg-green-100 text-green-700'
    badgeIcon = '✅'
    badgeText = '원문 직접 인용'
  } else if (score >= 0.4) {
    badgeStyle = 'bg-blue-100 text-blue-700'
    badgeIcon = '📝'
    badgeText = '참고 기반 작성'
  } else {
    badgeStyle = 'bg-gray-100 text-gray-600'
    badgeIcon = 'ℹ️'
    badgeText = 'AI 요약 답변'
  }

  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      <div className={`text-xs px-2 py-1 rounded w-fit ${badgeStyle}`}>
        {badgeIcon} {badgeText}
        {scorePercent > 0 && ` (${scorePercent}%)`}
      </div>
      {rubricTier && (
        <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {TIER_CONFIG[rubricTier].label}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Sources Panel Component
// =============================================================================

function SourcesPanel({ sources }: { sources: Array<{ title: string; chunkId: string; score: number }> }) {
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1">
        <span>📚 사용된 참고자료 ({sources.length}개)</span>
        <svg className="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-2 space-y-1.5 pl-1">
        {sources.map((source) => {
          const scorePercent = Math.round(source.score * 100)
          let barColor = 'bg-gray-300'
          let dotColor = '🟠'
          if (scorePercent >= 80) {
            barColor = 'bg-green-500'
            dotColor = '🟢'
          } else if (scorePercent >= 60) {
            barColor = 'bg-yellow-400'
            dotColor = '🟡'
          }

          return (
            <div key={source.chunkId} className="flex items-center gap-2 text-xs">
              <span>{dotColor}</span>
              <span className="truncate max-w-[150px] text-gray-700 dark:text-gray-300" title={source.title}>
                {source.title}
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden min-w-[50px] max-w-[80px]">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <span className="text-gray-400 w-8 text-right">{scorePercent}%</span>
            </div>
          )
        })}
      </div>
    </details>
  )
}

// =============================================================================
// MessageItem Component (Memoized)
// =============================================================================

export const MessageItem = memo(function MessageItem({ message, projectId }: MessageItemProps) {
  return (
    <div
      className="flex message-item"
      style={{
        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 80px',
      }}
    >
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          message.role === 'user'
            ? 'bg-prism-primary text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        {message.role === 'user' ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose dark:prose-invert max-w-none text-sm break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <div className="bg-gray-800 text-white p-2 rounded overflow-x-auto my-2">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </div>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <span className="text-xs opacity-70 mt-1 block">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Citation Badge */}
      {message.role === 'assistant' && message.metadata?.citation_verification && (
        <CitationBadge
          score={message.metadata.citation_verification.matchScore}
          rubricTier={message.metadata.rubric_tier}
        />
      )}

      {/* Sources Panel */}
      {message.role === 'assistant' && message.metadata?.sources && message.metadata.sources.length > 0 && (
        <SourcesPanel sources={message.metadata.sources} />
      )}

      {/* Feedback Buttons */}
      {message.role === 'assistant' && projectId && (
        <AdaptiveFeedbackButtons
          messageId={message.id}
          projectId={projectId}
          initialFeedback={message.feedback}
        />
      )}
    </div>
  )
})
