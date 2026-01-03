// =============================================================================
// PRISM Writer - Rubric Candidates API
// =============================================================================
// 파일: frontend/src/app/api/rubrics/candidates/route.ts
// 역할: 루브릭 후보 생성 API (패턴 추출 LLM 호출)
// 생성일: 2026-01-03
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPatterns, type ChunkData, type RuleCandidate } from '@/lib/rag/patternExtractor'
import { getTierForPattern } from '@/lib/rag/rubrics'
import { FEATURE_FLAGS } from '@/config/featureFlags'

// =============================================================================
// [PATTERN] Helper: 배열 무작위 셔플 (Fisher-Yates)
// =============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// =============================================================================
// [PATTERN] POST: 루브릭 후보 생성
// =============================================================================

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // [SAFETY] Feature Flag 확인
    if (!FEATURE_FLAGS.ENABLE_PATTERN_EXTRACTION) {
      return NextResponse.json(
        { error: 'Pattern extraction is disabled' },
        { status: 403 }
      )
    }

    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. 요청 파싱
    const body = await req.json()
    const {
      projectId,
      targetCount = 50,
      patternScope = 'both'
    } = body

    // [SAFETY] projectId 필수
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // 3. 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // 4. 프로젝트의 청크 조회
    const allChunks = await getProjectChunks(supabase, projectId)
    
    if (allChunks.length === 0) {
      return NextResponse.json(
        { error: 'No chunks found in project. Please upload documents first.' },
        { status: 400 }
      )
    }

    // [NEW] 무작위 샘플링 (최대 15개) - 매번 다른 청크 선택으로 다양성 증가
    const SAMPLE_SIZE = 15
    const chunks = allChunks.length <= SAMPLE_SIZE 
      ? allChunks 
      : shuffleArray(allChunks).slice(0, SAMPLE_SIZE)

    console.log(`[RubricCandidates] Sampled ${chunks.length}/${allChunks.length} chunks for project ${projectId}`)

    // [NEW] 기존 패턴 조회 (중복 방지)
    const { data: existingCandidates } = await supabase
      .from('rag_rule_candidates')
      .select('rule_text')
      .eq('project_id', projectId)
      .limit(50)
    
    const existingPatterns = existingCandidates?.map(c => c.rule_text) || []
    console.log(`[RubricCandidates] Found ${existingPatterns.length} existing patterns to exclude`)

    // 5. 패턴 추출 LLM 호출 (기존 패턴 제외)
    const rawCandidates = await extractPatterns(chunks, {
      targetCount: Math.min(targetCount, 100), // 최대 100개
      patternScope: patternScope as 'script' | 'lecture' | 'both',
      existingPatterns // [NEW] 제외할 패턴 목록 전달 (프롬프트 레벨)
    })

    // [NEW] 2차 필터링: 코드 레벨에서 중복 제거 (LLM 할루시네이션 방지)
    const existingSet = new Set(existingPatterns)
    const newSet = new Set<string>()
    
    const candidates = rawCandidates.filter(c => {
      // 1. 기존 DB에 있는가?
      if (existingSet.has(c.rule_text)) return false
      
      // 2. 이번 배치에서 이미 나왔는가?
      if (newSet.has(c.rule_text)) return false
      
      newSet.add(c.rule_text)
      return true
    })

    console.log(`[RubricCandidates] After deduplication: ${rawCandidates.length} -> ${candidates.length}`)

    // 6. DB 저장 (rag_rule_candidates)
    const insertData = candidates.map(c => ({
      project_id: projectId,
      user_id: user.id,
      pattern_type: c.pattern_type,
      rule_text: c.rule_text,
      why_it_works: c.why_it_works,
      query_hints: c.query_hints,
      evidence_quote: c.evidence_quote,
      evidence_chunk_ids: c.evidence_chunk_id ? [c.evidence_chunk_id] : [],
      status: 'draft',
      tier: getTierForPattern(c.pattern_type) // [NEW] 티어 자동 분류 (P4-03)
    }))

    const { data: savedData, error: insertError } = await supabase
      .from('rag_rule_candidates')
      .insert(insertData)
      .select('id')

    if (insertError) {
      console.error('[RubricCandidates] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save candidates', details: insertError.message },
        { status: 500 }
      )
    }

    console.log(`[RubricCandidates] Saved ${savedData?.length || 0} candidates`)

    return NextResponse.json({
      success: true,
      saved: savedData?.length || 0,
      extracted: candidates.length,
      message: `Successfully extracted ${candidates.length} patterns and saved ${savedData?.length || 0} candidates`
    })

  } catch (error) {
    console.error('[RubricCandidates] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// =============================================================================
// [PATTERN] GET: 루브릭 후보 목록 조회
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const patternType = searchParams.get('patternType')

    // 3. 쿼리 빌드
    let query = supabase
      .from('rag_rule_candidates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (patternType) {
      query = query.eq('pattern_type', patternType)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch candidates', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      candidates: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('[RubricCandidates] GET Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// [PATTERN] Helper: 프로젝트 청크 조회
// =============================================================================

async function getProjectChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<ChunkData[]> {
  // 프로젝트 문서의 청크 조회 (최대 200개)
  const { data, error } = await supabase
    .from('rag_chunks')
    .select(`
      id,
      content,
      document_id,
      metadata,
      user_documents!inner(project_id)
    `)
    .eq('user_documents.project_id', projectId)
    .limit(200)

  if (error || !data) {
    console.error('[RubricCandidates] Failed to get chunks:', error?.message)
    return []
  }

  return data.map(chunk => ({
    chunkId: chunk.id,
    content: chunk.content,
    documentId: chunk.document_id,
    metadata: chunk.metadata
  }))
}
