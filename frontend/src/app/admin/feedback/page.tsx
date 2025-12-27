'use client'

// =============================================================================
// PRISM Writer - Admin Dashboard for Hallucination Feedback
// =============================================================================
// 파일: frontend/src/app/admin/feedback/page.tsx
// 역할: 관리자용 환각 피드백 대시보드
// 생성일: 2025-12-27
// 
// [RAG 환각 방지 업그레이드]
// - 환각률 통계 표시
// - 피드백 목록 조회 (긍정/부정)
// - 사용자 코멘트 확인
// =============================================================================

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =============================================================================
// 타입 정의
// =============================================================================

interface FeedbackItem {
  id: string
  user_id: string
  user_query: string
  model_response: string
  is_positive: boolean
  feedback_type: string
  user_comment: string | null
  created_at: string
}

interface FeedbackStats {
  total: number
  positive: number
  negative: number
  hallucinationReports: number
  withComments: number
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export default function AdminFeedbackPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [stats, setStats] = useState<FeedbackStats>({
    total: 0,
    positive: 0,
    negative: 0,
    hallucinationReports: 0,
    withComments: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'hallucination'>('all')

  // ---------------------------------------------------------------------------
  // 데이터 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadFeedback()
  }, [filter])

  const loadFeedback = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // 기본 쿼리
      let query = supabase
        .from('hallucination_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      // 필터 적용
      if (filter === 'positive') {
        query = query.eq('is_positive', true)
      } else if (filter === 'negative') {
        query = query.eq('is_positive', false)
      } else if (filter === 'hallucination') {
        query = query.eq('feedback_type', 'hallucination')
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        throw fetchError
      }

      setFeedbackList(data || [])

      // 통계 계산 (전체 데이터 기준)
      const { data: allData } = await supabase
        .from('hallucination_feedback')
        .select('is_positive, feedback_type, user_comment')

      if (allData) {
        setStats({
          total: allData.length,
          positive: allData.filter(d => d.is_positive).length,
          negative: allData.filter(d => !d.is_positive).length,
          hallucinationReports: allData.filter(d => d.feedback_type === 'hallucination').length,
          withComments: allData.filter(d => d.user_comment).length,
        })
      }

    } catch (err: any) {
      console.error('[Admin Feedback] Error:', err)
      setError(err.message || '데이터 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 환각률 계산
  // ---------------------------------------------------------------------------
  const hallucinationRate = stats.total > 0 
    ? ((stats.hallucinationReports / stats.total) * 100).toFixed(1)
    : '0.0'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* -----------------------------------------------------------------------
          헤더
      ----------------------------------------------------------------------- */}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          🎯 환각 피드백 대시보드
        </h1>
        <p className="text-gray-600 mb-6">
          사용자 피드백을 기반으로 환각 답변을 모니터링합니다.
        </p>

        {/* ---------------------------------------------------------------------
            통계 카드
        --------------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard 
            title="전체 피드백" 
            value={stats.total} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="긍정적" 
            value={stats.positive} 
            color="bg-green-500" 
          />
          <StatCard 
            title="부정적" 
            value={stats.negative} 
            color="bg-red-500" 
          />
          <StatCard 
            title="환각 신고" 
            value={stats.hallucinationReports} 
            color="bg-orange-500" 
          />
          <StatCard 
            title="환각률" 
            value={`${hallucinationRate}%`} 
            color="bg-purple-500" 
          />
        </div>

        {/* ---------------------------------------------------------------------
            필터 버튼
        --------------------------------------------------------------------- */}
        <div className="flex gap-2 mb-4">
          <FilterButton 
            active={filter === 'all'} 
            onClick={() => setFilter('all')}
          >
            전체
          </FilterButton>
          <FilterButton 
            active={filter === 'positive'} 
            onClick={() => setFilter('positive')}
          >
            👍 긍정
          </FilterButton>
          <FilterButton 
            active={filter === 'negative'} 
            onClick={() => setFilter('negative')}
          >
            👎 부정
          </FilterButton>
          <FilterButton 
            active={filter === 'hallucination'} 
            onClick={() => setFilter('hallucination')}
          >
            🚨 환각 신고
          </FilterButton>
        </div>

        {/* ---------------------------------------------------------------------
            에러 메시지
        --------------------------------------------------------------------- */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
            <p className="font-medium">오류 발생</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            로딩 상태
        --------------------------------------------------------------------- */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">로딩 중...</p>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            피드백 목록
        --------------------------------------------------------------------- */}
        {!isLoading && feedbackList.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            피드백 데이터가 없습니다.
          </div>
        )}

        {!isLoading && feedbackList.length > 0 && (
          <div className="space-y-4">
            {feedbackList.map((item) => (
              <FeedbackCard key={item.id} feedback={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// 서브 컴포넌트
// =============================================================================

/** 통계 카드 */
function StatCard({ 
  title, 
  value, 
  color 
}: { 
  title: string
  value: number | string
  color: string 
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-bold ${color.replace('bg-', 'text-')}`}>
        {value}
      </p>
    </div>
  )
}

/** 필터 버튼 */
function FilterButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${active 
          ? 'bg-blue-500 text-white' 
          : 'bg-white text-gray-600 hover:bg-gray-100'
        }
      `}
    >
      {children}
    </button>
  )
}

/** 피드백 카드 */
function FeedbackCard({ feedback }: { feedback: FeedbackItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-1 rounded text-xs font-medium
            ${feedback.is_positive 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
            }
          `}>
            {feedback.is_positive ? '👍 긍정' : '👎 부정'}
          </span>
          {feedback.feedback_type === 'hallucination' && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
              🚨 환각 신고
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {new Date(feedback.created_at).toLocaleString('ko-KR')}
        </span>
      </div>

      {/* 질문 */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">사용자 질문:</p>
        <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
          {feedback.user_query.length > 100 
            ? feedback.user_query.substring(0, 100) + '...' 
            : feedback.user_query
          }
        </p>
      </div>

      {/* 코멘트 (있을 경우) */}
      {feedback.user_comment && (
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">💬 사용자 코멘트:</p>
          <p className="text-sm text-gray-800 bg-yellow-50 p-2 rounded border border-yellow-200">
            {feedback.user_comment}
          </p>
        </div>
      )}

      {/* 확장 버튼 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-blue-500 hover:text-blue-700"
      >
        {expanded ? '▲ 접기' : '▼ AI 응답 보기'}
      </button>

      {/* 확장된 AI 응답 */}
      {expanded && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">AI 응답:</p>
          <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded max-h-48 overflow-y-auto">
            {feedback.model_response}
          </p>
        </div>
      )}
    </div>
  )
}
