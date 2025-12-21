
'use client'

import React, { useState } from 'react'
import { type Template } from '@/lib/rag/templateTypes'
import { CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface TemplateReviewCardProps {
  template: Template
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
}

/**
 * TemplateReviewCard
 * 역할: 관리자가 템플릿의 상세 내용을 검토하고 승인/반려할 수 있는 카드 컴포넌트
 */
export default function TemplateReviewCard({
  template,
  onApprove,
  onReject
}: TemplateReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleApprove = async () => {
    if (confirm('이 템플릿을 승인하시겠습니까?')) {
      setIsSubmitting(true)
      try {
        await onApprove(template.id)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('반려 사유를 입력해주세요.')
      return
    }
    setIsSubmitting(true)
    try {
      await onReject(template.id, rejectReason)
      setShowRejectInput(false)
      setRejectReason('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
      {/* 카드 헤더 */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={clsx(
            "w-2 h-2 rounded-full",
            template.status === 'approved' ? "bg-green-500" :
            template.status === 'rejected' ? "bg-red-500" :
            template.status === 'pending' ? "bg-yellow-500" : "bg-gray-400"
          )} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{template.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              버전 {template.version} • {new Date(template.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {template.status === 'pending' && (
            <>
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="승인"
              >
                <CheckIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => setShowRejectInput(!showRejectInput)}
                disabled={isSubmitting}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="반려"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* 반려 사유 입력창 */}
      {showRejectInput && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-4 bg-red-50/30 dark:bg-red-900/10">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">반려 사유</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-red-500 outline-none"
            />
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 상세 내용 (확장 시) */}
      {isExpanded && (
        <div className="px-4 pb-6 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-6">
          {template.description && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">설명</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{template.description}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider">평가 기준 (Criteria)</h4>
            <div className="space-y-4">
              {template.criteria_json.map((criteria, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className={clsx(
                      "px-2 py-1 rounded text-xs font-bold uppercase",
                      criteria.category === 'tone' ? "bg-blue-100 text-blue-700" :
                      criteria.category === 'structure' ? "bg-purple-100 text-purple-700" :
                      criteria.category === 'expression' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {criteria.category}
                    </span>
                    {criteria.confidence_score && (
                      <span className="text-xs text-gray-400">Confidence: {(criteria.confidence_score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">{criteria.rationale}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-xs font-bold text-green-600 mb-2">Positive Examples</h5>
                      <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {criteria.positive_examples.map((ex, i) => <li key={i}>{ex}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-red-600 mb-2">Negative Examples</h5>
                      <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {criteria.negative_examples.map((ex, i) => <li key={i}>{ex}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {template.rejection_reason && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
              <h4 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">최근 반려 사유</h4>
              <p className="text-sm text-red-600 dark:text-red-300">{template.rejection_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
