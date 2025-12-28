'use client'

// =============================================================================
// PRISM Writer - RAFT 통계 대시보드
// =============================================================================
// 파일: frontend/src/components/admin/RAFTStatsDashboard.tsx
// 역할: RAFT 데이터 통계 시각화 (요약, 카테고리별, 일자별 추이)
// 작성일: 2025-12-29
// =============================================================================
// [P3-01] 통계 대시보드 구현
// - 요약 카드: 총 Q&A, 카테고리 수, 최근 7일 생성 수
// - 카테고리별 통계: 비율 바 차트
// - 일자별 추이: 최근 7일 막대 그래프
// =============================================================================

import React, { useEffect, useState } from 'react'
// import { Card } from '@/components/ui/card' // Shadcn UI Card 제거 (직접 스타일링 사용)

// =============================================================================
// 타입 정의
// =============================================================================

interface CategoryStat {
  category: string
  count: number
}

interface DailyTrend {
  date: string
  count: number
}

interface RAFTStats {
  totalCount: number
  categoryStats: CategoryStat[]
  dailyTrend: DailyTrend[]
}

interface RAFTStatsResponse {
  success: boolean
  stats?: RAFTStats
  message?: string
}

// =============================================================================
// 컴포넌트 구현
// =============================================================================

export default function RAFTStatsDashboard() {
  const [stats, setStats] = useState<RAFTStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 데이터 로드
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function fetchStats() {
      try {
        setIsLoading(true)
        const res = await fetch('/api/raft/stats') // [P3-01-02] 생성한 API 호출
        const data: RAFTStatsResponse = await res.json()

        if (res.ok && data.success && data.stats) {
          setStats(data.stats)
          setError(null)
        } else {
          setError(data.message || '통계 정보를 불러오지 못했습니다.')
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
        setError('통계 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // ---------------------------------------------------------------------------
  // [P3-01-09] 로딩 스켈레톤
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-pulse" aria-busy="true" aria-label="통계 로딩 중">
        {/* 요약 카드 스켈레톤 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
          ))}
        </div>
        {/* 차트 영역 스켈레톤 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 에러 상태
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
        ⚠️ {error}
      </div>
    )
  }

  // 데이터 없음 처리
  if (!stats) return null

  // 최근 7일 총 생성 수 계산
  const recentCount = stats.dailyTrend.reduce((sum, d) => sum + d.count, 0)

  return (
    <section className="w-full space-y-6" aria-label="RAFT 데이터 통계">
      {/* --------------------------------------------------------------------- */}
      {/* 1. [P3-01-06] 통계 요약 카드 */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 총 Q&A */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">총 Q&A 데이터</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.totalCount.toLocaleString()}
            <span className="text-sm font-normal text-gray-400 ml-1">개</span>
          </p>
        </div>

        {/* 카테고리 수 */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">활성 카테고리</h3>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.categoryStats.length.toLocaleString()}
            <span className="text-sm font-normal text-gray-400 ml-1">개</span>
          </p>
        </div>

        {/* 최근 7일 생성 */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">최근 7일 생성</h3>
          <div className="flex items-end gap-2 mt-2">
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {recentCount.toLocaleString()}
            </p>
            <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              (일평균 {Math.round(recentCount / 7)}개)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ------------------------------------------------------------------- */}
        {/* 2. [P3-01-07] 카테고리별 통계 (비율 바 차트) */}
        {/* ------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📊 카테고리별 분포
          </h3>
          
          {stats.categoryStats.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {stats.categoryStats.map((stat) => {
                const percentage = stats.totalCount > 0 
                  ? Math.round((stat.count / stats.totalCount) * 100) 
                  : 0
                
                return (
                  <div key={stat.category} className="group">
                    <div className="flex justify-between items-center mb-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={stat.category}>
                        {stat.category}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {stat.count}개 ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 dark:bg-indigo-600 rounded-full transition-all duration-500 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* 3. [P3-01-08] 일자별 추이 (막대 그래프) */}
        {/* ------------------------------------------------------------------- */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📈 최근 7일 생성 추이
          </h3>

          <div className="h-[250px] w-full flex items-end justify-between gap-2 pt-4">
            {stats.dailyTrend.map((trend) => {
              const maxCount = Math.max(...stats.dailyTrend.map(t => t.count), 5) // 최소 높이 보장
              const heightPercentage = Math.max((trend.count / maxCount) * 100, 4) // 최소 4% 높이 (0이어도 라인은 보이게)
              const dateObj = new Date(trend.date)
              const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
              const isToday = new Date().toDateString() === dateObj.toDateString()

              return (
                <div key={trend.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  {/* 툴팁 */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10">
                    {trend.date}: {trend.count}개
                  </div>
                  
                  {/* 막대 */}
                  <div 
                    className={`w-full max-w-[30px] rounded-t transition-all duration-300 relative ${
                      isToday 
                        ? 'bg-indigo-600 dark:bg-indigo-500' // 오늘 날짜 강조
                        : 'bg-indigo-200 dark:bg-indigo-900/50 hover:bg-indigo-400 dark:hover:bg-indigo-700'
                    }`}
                    style={{ height: `${heightPercentage}%` }}
                  >
                    {trend.count > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {trend.count}
                      </span>
                    )}
                  </div>
                  
                  {/* 날짜 라벨 */}
                  <span className={`text-xs mt-2 ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {dateLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
