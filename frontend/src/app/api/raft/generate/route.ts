// =============================================================================
// PRISM Writer - RAFT Synthetic Data Generation API
// =============================================================================
// 파일: frontend/src/app/api/raft/generate/route.ts
// 역할: LLM을 사용하여 RAFT 파인튜닝용 합성 Q&A 데이터 생성
// 생성일: 2025-12-27
// 
// [Risk 해결]
// - Risk 5: LLM 배치 생성 시 타임아웃 방지
// - 타임아웃 30초 설정
// - 배치 크기 동적 조절 (최대 50개)
// - 개별 실패 시 graceful degradation
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FEATURE_FLAGS } from '@/config/featureFlags'
import { 
  generateSyntheticData, 
  validateGeneratedData,
  GeneratedQAPair 
} from '@/lib/raft/syntheticDataGenerator'
import { getModelForUsage } from '@/config/llm-usage-map'

// =============================================================================
// 상수 정의
// =============================================================================

/** 최대 배치 크기 */
const MAX_BATCH_SIZE = 50

/** 일일 최대 생성 한도 [Risk 10] */
const DAILY_GENERATION_LIMIT = 500

/** LLM 호출 타임아웃 (밀리초) */
const LLM_TIMEOUT_MS = 30000

/** 기본 생성 개수 */
const DEFAULT_COUNT = 10

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
// [Risk 9] 관리자 인증 검증
// =============================================================================

async function verifyAdminAccess(request: NextRequest): Promise<{
  authorized: boolean
  userId?: string
  error?: string
}> {
  try {
    const authHeader = request.headers.get('Authorization')
    
    // 개발 환경에서는 인증 생략 가능 (환경 변수로 제어)
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RAFT_AUTH === 'true') {
      return { authorized: true, userId: 'dev-admin' }
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, error: 'Authorization header missing' }
    }
    
    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabaseAdmin()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { authorized: false, error: 'Invalid or expired token' }
    }
    
    return { authorized: true, userId: user.id }
  } catch (error: any) {
    return { authorized: false, error: 'Authentication failed' }
  }
}

// =============================================================================
// LLM 텍스트 생성 함수 (타임아웃 적용)
// =============================================================================

/**
 * LLM API 호출 (타임아웃 30초)
 * 
 * @param prompt - 생성 프롬프트
 * @returns 생성된 텍스트
 * 
 * [Risk 5 해결] 타임아웃 30초로 API 중단 방지
 */
async function generateTextWithTimeout(prompt: string, modelId?: string): Promise<string> {
  // ---------------------------------------------------------------------------
  // OpenAI API 호출 (타임아웃 래핑)
  // ---------------------------------------------------------------------------
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId || 'gpt-4o-mini', // 동적 모델 ID 사용 (기본값: gpt-4o-mini)
        messages: [
          {
            role: 'system',
            content: '당신은 글쓰기 교육 Q&A 데이터를 생성하는 전문가입니다. 반드시 유효한 JSON 배열만 출력하세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const generatedText = data.choices?.[0]?.message?.content || ''

    console.log(`[RAFT Generate] LLM response received (${generatedText.length} chars)`)

    return generatedText

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`LLM 호출 타임아웃 (${LLM_TIMEOUT_MS / 1000}초 초과)`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// =============================================================================
// POST: 합성 데이터 생성
// =============================================================================

/**
 * LLM을 사용하여 합성 Q&A 데이터 생성
 * 
 * @body context - (필수) 참고 자료 내용
 * @body count - (선택) 생성할 Q&A 개수 (기본 10, 최대 50)
 * 
 * @returns { success: true, generated: number, data: [], errors: [] }
 * 
 * [Risk 5 해결]
 * - 타임아웃 30초 설정
 * - 배치 크기 최대 50개 제한
 * - 동적 배치 조절: 요청 크기에 따라 분할
 * 
 * [Risk 10 해결]
 * - 일일 생성 한도 500개 제한
 * - 초과 시 429 Too Many Requests 반환
 */
export async function POST(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Feature Flag 체크
  // ---------------------------------------------------------------------------
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // ---------------------------------------------------------------------------
  // [Risk 9] 관리자 인증 검증
  // ---------------------------------------------------------------------------
  const auth = await verifyAdminAccess(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', message: auth.error || '인증이 필요합니다.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    // -------------------------------------------------------------------------
    // [Phase B] B-02: useExistingChunks 분기 로직
    // -------------------------------------------------------------------------
    let finalContext = body.context || ''
    let chunkInfo: { chunkCount: number; truncated: boolean; warning?: string } = { 
      chunkCount: 0, 
      truncated: false 
    }

    // useExistingChunks 모드: 백엔드에서 카테고리별 청크 자동 추출
    if (body.useExistingChunks && body.category) {
      const { extractCategoryChunks } = await import('@/lib/raft/chunkExtractor')
      const extraction = await extractCategoryChunks(body.category, 100)
      
      finalContext = extraction.text
      chunkInfo = {
        chunkCount: extraction.chunkCount,
        truncated: extraction.truncated,
        warning: extraction.warning
      }

      // 방어 로직: 최소 컨텍스트 길이 검증
      if (!finalContext || finalContext.length < 100) {
        return NextResponse.json(
          { 
            success: false,
            error: 'INSUFFICIENT_CHUNKS',
            message: `카테고리 '${body.category}'에 충분한 청크 데이터가 없습니다. (최소 100자 필요, 현재: ${finalContext?.length || 0}자)`,
            chunkInfo
          },
          { status: 400 }
        )
      }

      console.log(`[Phase B] useExistingChunks: category=${body.category}, chunks=${chunkInfo.chunkCount}, length=${finalContext.length}`)
    }

    // -------------------------------------------------------------------------
    // 필수 파라미터 검증 (useExistingChunks가 아닌 경우에만)
    // -------------------------------------------------------------------------
    if (!body.useExistingChunks && (!finalContext || finalContext.trim() === '')) {
      return NextResponse.json(
        { error: 'context is required', message: 'context 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // [Risk 10] 일일 생성 한도 체크
    // -------------------------------------------------------------------------
    const supabase = getSupabaseAdmin()
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { count: todayCount, error: countError } = await supabase
      .from('raft_dataset')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'synthetic')
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)

    if (countError) {
      console.error('[RAFT Generate] Daily limit check error:', countError)
      // 에러 발생 시 진행 (보수적 접근보다는 가용성 우선)
    } else if ((todayCount || 0) >= DAILY_GENERATION_LIMIT) {
      return NextResponse.json(
        { 
          error: 'Daily generation limit exceeded', 
          message: `일일 생성 한도(${DAILY_GENERATION_LIMIT}개)를 초과했습니다.` 
        },
        { status: 429 }
      )
    }

    // -------------------------------------------------------------------------
    // [Risk 5] 배치 크기 제한
    // -------------------------------------------------------------------------
    const requestedCount = parseInt(body.count) || DEFAULT_COUNT
    const count = Math.min(Math.max(requestedCount, 1), MAX_BATCH_SIZE)

    // 한도 내 남은 수량 체크
    if ((todayCount || 0) + count > DAILY_GENERATION_LIMIT) {
      return NextResponse.json(
        { 
          error: 'Daily generation limit exceeded', 
          message: `요청 수량이 일일 한도를 초과합니다. (남은 한도: ${DAILY_GENERATION_LIMIT - (todayCount || 0)}개)`
        },
        { status: 429 }
      )
    }
    
    if (requestedCount > MAX_BATCH_SIZE) {
      console.warn(`[RAFT Generate] Requested ${requestedCount}, limited to ${MAX_BATCH_SIZE}`)
    }

    console.log(`[RAFT Generate] Starting generation: ${count} Q&A pairs`)

    // -------------------------------------------------------------------------
    // LLM을 사용하여 합성 데이터 생성
    // -------------------------------------------------------------------------
    // [Phase B] body.context 대신 finalContext 사용 (청크 추출 모드 지원)
    const result = await generateSyntheticData(
      { context: finalContext, count },
      (prompt) => generateTextWithTimeout(prompt, body.modelId || getModelForUsage('raft.generation'))
    )

    // -------------------------------------------------------------------------
    // 생성 실패
    // -------------------------------------------------------------------------
    if (!result.success || result.data.length === 0) {
      console.error('[RAFT Generate] Generation failed:', result.errors)
      return NextResponse.json(
        { 
          success: false, 
          generated: 0,
          errors: result.errors,
          message: '합성 데이터 생성 실패',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // category 값 검증 (P3-01)
    // -------------------------------------------------------------------------
    const category = body.category || '미분류' 
    // TODO: RAFT_CATEGORIES와 유효성 검증 로직 추가 가능 (현재는 DB Default 의존)

    // -------------------------------------------------------------------------
    // 생성된 데이터를 raft_dataset 테이블에 저장
    // -------------------------------------------------------------------------
    // supabase 변수는 이미 상단에서 선언됨
    // [Phase B] body.context 대신 finalContext 저장 (청크 추출 모드 지원)
    const insertData = result.data.map((item: GeneratedQAPair) => ({
      user_query: item.question,
      context: finalContext,
      gold_answer: item.answer,
      source: 'synthetic',
      category: category, 
      verified: false,
    }))

    const { data: insertedData, error: insertError } = await supabase
      .from('raft_dataset')
      .insert(insertData)
      .select('id')

    if (insertError) {
      console.error('[RAFT Generate] Insert error:', insertError)
      return NextResponse.json(
        { 
          success: false, 
          generated: result.data.length,
          saved: 0,
          errors: [insertError.message],
          message: '데이터 저장 실패 (생성은 성공)',
        },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 성공 응답
    // -------------------------------------------------------------------------
    console.log(`[RAFT Generate] Success: ${result.data.length} Q&A pairs generated and saved`)

    return NextResponse.json({
      success: true,
      generated: result.data.length,
      saved: insertedData?.length || 0,
      totalAttempts: result.totalAttempts,
      data: result.data,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })

  } catch (error: any) {
    console.error('[RAFT Generate] Exception:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        success: false,
        generated: 0,
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET: 생성 상태 조회 (선택 사항)
// =============================================================================

export async function GET(request: NextRequest) {
  // Feature Flag 체크
  if (!FEATURE_FLAGS.ENABLE_RAFT_FEATURES) {
    return NextResponse.json(
      { error: 'RAFT features are disabled' },
      { status: 503 }
    )
  }

  // 현재 설정 정보 반환
  return NextResponse.json({
    maxBatchSize: MAX_BATCH_SIZE,
    timeoutMs: LLM_TIMEOUT_MS,
    defaultCount: DEFAULT_COUNT,
    enabled: FEATURE_FLAGS.ENABLE_RAFT_FEATURES,
  })
}
