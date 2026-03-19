// =============================================================================
// PRISM Writer - Insight Cards Component (P2-05)
// =============================================================================
// 파일: frontend/src/components/Analytics/InsightCards.tsx
// 역할: 강점/약점 인사이트 카드 — 카테고리별 분석 결과 시각화
// Phase B Track 2: Writing Growth Dashboard
// =============================================================================

'use client'

// =============================================================================
// 타입 정의
// =============================================================================

export interface StrengthItem {
  category: string
  score: number
  maxScore?: number
}

export interface WeaknessItem {
  category: string
  score: number
  maxScore?: number
  tip: string
}

export interface Insights {
  strengths: StrengthItem[]
  weaknesses: WeaknessItem[]
  tips?: string[]
}

export interface InsightCardsProps {
  insights: Insights
}

// =============================================================================
// InsightCards 컴포넌트
// =============================================================================

export default function InsightCards({ insights }: InsightCardsProps) {
  const { strengths, weaknesses, tips } = insights
  const hasData = strengths.length > 0 || weaknesses.length > 0

  // ---------------------------------------------------------------------------
  // 빈 상태
  // ---------------------------------------------------------------------------
  if (!hasData) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          인사이트
        </h3>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3">💡</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            평가를 3회 이상 진행하면 인사이트가 생성됩니다
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            지속적인 평가를 통해 나만의 글쓰기 패턴을 파악해보세요
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 인사이트 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* 강점 섹션 */}
      {strengths.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-sm">
              ✓
            </span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              강점
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {strengths.slice(0, 3).map((item) => (
              <StrengthCard key={item.category} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 약점 섹션 */}
      {weaknesses.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-sm">
              !
            </span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              개선 영역
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {weaknesses.slice(0, 3).map((item) => (
              <WeaknessCard key={item.category} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 추가 팁 */}
      {tips && tips.length > 0 && (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <h4 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            맞춤 학습 팁
          </h4>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li
                key={i}
                className="text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-1.5"
              >
                <span className="mt-0.5 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// StrengthCard 서브 컴포넌트
// =============================================================================

function StrengthCard({ item }: { item: StrengthItem }) {
  const max = item.maxScore ?? 100
  const pct = Math.min(Math.round((item.score / max) * 100), 100)

  return (
    <div className="rounded-lg border border-green-100 dark:border-green-900/40 bg-green-50/50 dark:bg-green-900/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {item.category}
        </span>
        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
          {item.score}점
        </span>
      </div>
      {/* 프로그레스 바 */}
      <div className="w-full h-1.5 bg-green-100 dark:bg-green-900/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// WeaknessCard 서브 컴포넌트
// =============================================================================

function WeaknessCard({ item }: { item: WeaknessItem }) {
  const max = item.maxScore ?? 100
  const pct = Math.min(Math.round((item.score / max) * 100), 100)

  return (
    <div className="rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {item.category}
        </span>
        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
          {item.score}점
        </span>
      </div>
      {/* 프로그레스 바 */}
      <div className="w-full h-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* 개선 팁 */}
      <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">
        💡 {item.tip}
      </p>
    </div>
  )
}
