'use client'

import { useState } from 'react'
import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline'
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid'
import clsx from 'clsx'

interface FeedbackButtonsProps {
  templateId: string
  onFeedbackSent?: (helpful: boolean) => void
}

export default function FeedbackButtons({ templateId, onFeedbackSent }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'unhelpful' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFeedback = async (helpful: boolean) => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          helpful,
        }),
      })

      if (response.ok) {
        setFeedback(helpful ? 'helpful' : 'unhelpful')
        onFeedbackSent?.(helpful)
      }
    } catch (error) {
      console.error('[Feedback] Failed to send feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center space-x-4 py-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">이 피드백이 도움이 되었나요?</span>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => handleFeedback(true)}
          disabled={isSubmitting || feedback !== null}
          className={clsx(
            "p-1.5 rounded-full transition-colors",
            feedback === 'helpful' 
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          )}
          aria-label="도움이 됐어요"
        >
          {feedback === 'helpful' ? <HandThumbUpSolid className="w-5 h-5" /> : <HandThumbUpIcon className="w-5 h-5" />}
        </button>
        <button
          onClick={() => handleFeedback(false)}
          disabled={isSubmitting || feedback !== null}
          className={clsx(
            "p-1.5 rounded-full transition-colors",
            feedback === 'unhelpful' 
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" 
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          )}
          aria-label="별로예요"
        >
          {feedback === 'unhelpful' ? <HandThumbDownSolid className="w-5 h-5" /> : <HandThumbDownIcon className="w-5 h-5" />}
        </button>
      </div>
      {feedback && (
        <span className="text-xs text-green-600 dark:text-green-400 animate-fade-in">
          의견 감사합니다!
        </span>
      )}
    </div>
  )
}
