// =============================================================================
// PRISM Writer - RAFT Statistics API
// =============================================================================
// 파일: frontend/src/app/api/raft/stats/route.ts
// 역할: RAFT 데이터 통계 제공 (카테고리별 Q&A 개수, 일자별 추이)
// 작성일: 2025-12-29
// =============================================================================
// [P3-01-02~04] 통계 API 엔드포인트 구현
// - 카테고리별 통계: JavaScript 집계
// - 일자별 추이: 최근 7일 데이터
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// 타입 정의
// =============================================================================

/** 카테고리별 통계 */
interface CategoryStat {
  category: string
  count: number
}

/** 일자별 추이 */
interface DailyTrend {
  date: string
  count: number
}

/** RAFT 통계 응답 */
interface RAFTStatsResponse {
  success: boolean
  stats?: {
    totalCount: number
    categoryStats: CategoryStat[]
    dailyTrend: DailyTrend[]
  }
  message?: string
}

// =============================================================================
// GET: RAFT 통계 조회
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<RAFTStatsResponse>> {
  console.log('[RAFT Stats API] Request received')

  try {
    // -------------------------------------------------------------------------
    // 1. 인증 체크
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      console.error('[RAFT Stats API] Auth error:', authError)
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log(`[RAFT Stats API] User: ${userId}`)

    // -------------------------------------------------------------------------
    // 2. 전체 RAFT 데이터 조회 (카테고리 + 생성일시)
    // -------------------------------------------------------------------------
    const { data: allData, error: fetchError } = await supabase
      .from('raft_datasets')
      .select('category, created_at')
      .eq('user_id', userId)

    if (fetchError) {
      console.error('[RAFT Stats API] Fetch error:', fetchError)
      return NextResponse.json(
        { success: false, message: '데이터 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!allData || allData.length === 0) {
      console.log('[RAFT Stats API] No data found')
      return NextResponse.json({
        success: true,
        stats: {
          totalCount: 0,
          categoryStats: [],
          dailyTrend: []
        }
      })
    }

    // -------------------------------------------------------------------------
    // 3. [P3-01-03] 카테고리별 통계 집계 (JavaScript)
    // -------------------------------------------------------------------------
    const categoryMap: Record<string, number> = {}
    
    allData.forEach(row => {
      const cat = row.category || '미분류'
      categoryMap[cat] = (categoryMap[cat] || 0) + 1
    })

    const categoryStats: CategoryStat[] = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count: count as number }))
      .sort((a, b) => b.count - a.count) // 개수 많은 순

    console.log(`[RAFT Stats API] Category stats: ${categoryStats.length} categories`)

    // -------------------------------------------------------------------------
    // 4. [P3-01-04] 일자별 추이 집계 (최근 7일)
    // -------------------------------------------------------------------------
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0) // 자정으로 설정

    const dailyMap: Record<string, number> = {}

    allData.forEach(row => {
      const createdDate = new Date(row.created_at)
      
      // 최근 7일 데이터만 집계
      if (createdDate >= sevenDaysAgo) {
        const dateStr = createdDate.toISOString().split('T')[0] // YYYY-MM-DD
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1
      }
    })

    // 최근 7일 날짜 배열 생성 (데이터 없는 날도 포함)
    const dailyTrend: DailyTrend[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      dailyTrend.push({
        date: dateStr,
        count: dailyMap[dateStr] || 0
      })
    }

    console.log(`[RAFT Stats API] Daily trend: ${dailyTrend.length} days`)

    // -------------------------------------------------------------------------
    // 5. 응답 반환
    // -------------------------------------------------------------------------
    const totalCount = allData.length

    return NextResponse.json({
      success: true,
      stats: {
        totalCount,
        categoryStats,
        dailyTrend
      }
    })

  } catch (error) {
    console.error('[RAFT Stats API] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: '통계 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
