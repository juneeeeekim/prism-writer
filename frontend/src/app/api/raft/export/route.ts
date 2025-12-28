// =============================================================================
// PRISM Writer - RAFT Export API
// =============================================================================
// 파일: frontend/src/app/api/raft/export/route.ts
// 역할: RAFT 데이터셋 내보내기 (JSONL, CSV)
// 작성일: 2025-12-29
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// Supabase 클라이언트 (Service Role)
// =============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

// =============================================================================
// 인증 검증 (간소화됨 - 실제로는 미들웨어 사용 권장)
// =============================================================================

async function verifyAdminAccess(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
    
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_RAFT_AUTH === 'true') {
    return { authorized: true }
  }
    
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Authorization header missing' }
  }
    
  const token = authHeader.replace('Bearer ', '')
  const supabase = getSupabaseAdmin()
  const { data: { user }, error } = await supabase.auth.getUser(token)
    
  if (error || !user) {
    return { authorized: false, error: 'Invalid token' }
  }
    
  return { authorized: true, userId: user.id }
}

// =============================================================================
// GET: 데이터 내보내기
// =============================================================================

export async function GET(request: NextRequest) {
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json({ error: 'Features disabled' }, { status: 503 })
  }

  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'jsonl' // jsonl | csv
    const category = searchParams.get('category')
    const onlyVerified = searchParams.get('verified') !== 'false' // 기본값 true

    const supabase = getSupabaseAdmin()
    
    // 1. 데이터 조회
    let query = supabase
      .from('raft_dataset')
      .select('*')
      .order('created_at', { ascending: false })

    if (category && category !== 'ALL') {
      query = query.eq('category', category)
    }
    
    // 검증된 데이터 필터링 (품질 보장)
    if (onlyVerified) {
      query = query.eq('verified', true)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    // 2. 포맷 변환
    let content = ''
    let contentType = ''
    let filename = `raft_dataset_${new Date().toISOString().split('T')[0]}`

    if (format === 'csv') {
      // CSV 변환
      contentType = 'text/csv'
      filename += '.csv'
      
      const headers = ['id', 'category', 'user_query', 'gold_answer', 'quality_score', 'created_at']
      const rows = data.map(row => {
        return headers.map(header => {
          const val = row[header] || ''
          // CSV 이스케이프: 따옴표 포함 시 이중 따옴표 후 전체 따옴표 처리
          const strVal = String(val).replace(/"/g, '""')
          return `"${strVal}"`
        }).join(',')
      })
      
      content = [headers.join(','), ...rows].join('\n')

    } else {
      // JSONL 변환 (Gemini Fine-tuning Format)
      contentType = 'application/jsonl'
      filename += '.jsonl'
      
      content = data.map(row => {
        const entry = {
          messages: [
            { role: 'user', content: row.user_query },
            { role: 'model', content: row.gold_answer }
          ]
        }
        return JSON.stringify(entry)
      }).join('\n')
    }

    // 3. 파일 응답 반환
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    })

  } catch (error: any) {
    console.error('[Export API] Error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}
