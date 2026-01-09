// =============================================================================
// PRISM Writer - Research Card Component
// =============================================================================
// 파일: frontend/src/components/Assistant/ResearchCard.tsx
// 역할: Deep Scholar 검색 결과 카드 (Trust Badge 포함)
// 참고: [Deep Scholar 체크리스트 P2-02]
// =============================================================================

'use client'

import type { SummarizedResult } from '@/lib/research/resultSummarizer'

// =============================================================================
// Types
// =============================================================================

interface ResearchCardProps {
  /** 검색 결과 */
  result: SummarizedResult
  /** 인용 삽입 콜백 */
  onInsert: () => void
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Trust Badge 설정
 *
 * @description
 * [UX 전문가 주석]
 * - 학술: 보라색 (권위)
 * - 정부: 파란색 (공식)
 * - 뉴스: 녹색 (신뢰)
 * - 기타: 회색 (중립)
 */
const TRUST_BADGE_CONFIG = {
  academic: {
    icon: '🎓',
    label: '학술 자료',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  },
  government: {
    icon: '🏛️',
    label: '정부 공식',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  news: {
    icon: '📰',
    label: '뉴스/저널',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  },
  other: {
    icon: '🔗',
    label: '기타',
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  },
}

// =============================================================================
// Component: ResearchCard
// =============================================================================

/**
 * Research Card - 검색 결과 카드
 *
 * @description
 * [시니어 개발자 주석]
 * - Trust Badge로 출처 신뢰도 시각화
 * - Key Fact를 인용구로 강조
 * - 인용 삽입 및 원문 보기 버튼
 */
export default function ResearchCard({ result, onInsert }: ResearchCardProps) {
  // ---------------------------------------------------------------------------
  // [P2-02-01] Trust Badge 설정 가져오기
  // ---------------------------------------------------------------------------
  const badge = TRUST_BADGE_CONFIG[result.trustBadge]

  return (
    <div className="research-card p-4 bg-white dark:bg-gray-800 border border-gray-200 
                    dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* -----------------------------------------------------------------------
          [P2-02-02] Trust Badge
          ----------------------------------------------------------------------- */}
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
          {badge.icon} {badge.label}
        </span>
        {result.publishedDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {result.publishedDate}
          </span>
        )}
      </div>

      {/* -----------------------------------------------------------------------
          [P2-02-03] Title
          ----------------------------------------------------------------------- */}
      <h4 className="font-bold text-gray-800 dark:text-gray-200 line-clamp-2 mb-2 break-words">
        {result.title}
      </h4>

      {/* -----------------------------------------------------------------------
          [P2-02-04] Source
          ----------------------------------------------------------------------- */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 break-all">
        📍 {result.source}
      </p>

      {/* -----------------------------------------------------------------------
          [P2-02-05] Key Fact (강조 인용구)
          ----------------------------------------------------------------------- */}
      <blockquote className="border-l-4 border-prism-primary pl-3 my-3 text-sm italic 
                             text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 
                             py-2 rounded-r break-words">
        "{result.keyFact}"
      </blockquote>

      {/* -----------------------------------------------------------------------
          [P2-02-06] Summary
          ----------------------------------------------------------------------- */}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3 break-words">
        {result.summary}
      </p>

      {/* -----------------------------------------------------------------------
          [P2-02-07] Actions
          ----------------------------------------------------------------------- */}
      <div className="flex gap-2">
        <button
          onClick={onInsert}
          className="flex-1 px-3 py-2 bg-prism-primary text-white rounded-lg text-sm 
                     font-medium hover:bg-prism-primary/90 transition-colors"
        >
          ✍️ 인용 삽입
        </button>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          🔗 원문
        </a>
      </div>
    </div>
  )
}
