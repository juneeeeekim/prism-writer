// =============================================================================
// PRISM Writer - Coach Style Analysis API
// =============================================================================
// 파일: frontend/src/app/api/coaches/analyze/route.ts
// 역할: 참고 문서 기반 글쓰기 스타일 분석 → style_profile 생성
// 생성일: 2026-03-19
// Phase C Track 1: P3-03
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from '@/lib/llm/gateway'

// =============================================================================
// 스타일 프로필 타입
// =============================================================================
interface StyleProfile {
  tone: string
  sentence_patterns: string
  vocabulary_level: string
  structure_preference: string
  expression_habits: string
  strengths: string
  system_prompt_addition: string
}

// =============================================================================
// 스타일 분석 프롬프트
// =============================================================================
function buildStyleAnalysisPrompt(text: string): string {
  return `당신은 전문 글쓰기 스타일 분석가입니다. 아래 텍스트를 분석하여 글쓰기 스타일 프로필을 JSON 형식으로 작성해주세요.

## 분석할 텍스트
---
${text}
---

## 출력 형식 (반드시 아래 JSON 형식만 출력)
{
  "tone": "글의 전체적인 톤과 분위기 (예: 학술적이고 격식 있는 톤, 친근하고 대화체 등)",
  "sentence_patterns": "문장 구조 패턴 (예: 짧고 간결한 문장 위주, 복문 활용 빈도 등)",
  "vocabulary_level": "어휘 수준 (예: 전문 용어 활용 수준, 일상어 비율 등)",
  "structure_preference": "글 구조 선호도 (예: 서론-본론-결론 구조, 두괄식, 미괄식 등)",
  "expression_habits": "표현 습관 (예: 비유/은유 활용, 접속사 패턴, 특징적 표현 등)",
  "strengths": "글쓰기 강점 (예: 논리적 전개력, 생동감 있는 묘사 등)",
  "system_prompt_addition": "이 스타일로 글을 쓸 때 LLM에게 전달할 시스템 프롬프트 추가 지시사항 (한국어, 2~3문장)"
}

## 주의사항
- 반드시 유효한 JSON만 출력하세요.
- 각 필드는 한국어로 구체적이고 실용적으로 작성하세요.
- system_prompt_addition은 "이 글의 스타일을 따라 ..."와 같이 LLM이 바로 활용할 수 있는 지시문으로 작성하세요.`
}

// =============================================================================
// JSON 파싱 헬퍼 (마크다운 코드 블록 처리)
// =============================================================================
function parseJsonFromLLMResponse(text: string): StyleProfile | null {
  // 마크다운 코드 블록에서 JSON 추출 시도
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()

  try {
    const parsed = JSON.parse(jsonStr)
    // 필수 필드 존재 여부 검증
    const requiredFields: (keyof StyleProfile)[] = [
      'tone', 'sentence_patterns', 'vocabulary_level',
      'structure_preference', 'expression_habits', 'strengths',
      'system_prompt_addition'
    ]
    for (const field of requiredFields) {
      if (typeof parsed[field] !== 'string') {
        console.warn(`[Coaches Analyze] Missing or invalid field: ${field}`)
        return null
      }
    }
    return parsed as StyleProfile
  } catch (e) {
    console.error('[Coaches Analyze] JSON parse failed:', e)
    return null
  }
}

// =============================================================================
// POST: 스타일 분석 실행
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { coachId, documentIds } = body

    if (!coachId) {
      return NextResponse.json(
        { error: 'Bad request', message: '코치 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Bad request', message: '분석할 문서를 선택해주세요.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 1. 코치 소유권 확인
    // -------------------------------------------------------------------------
    const { data: coach, error: coachError } = await supabase
      .from('writing_coaches')
      .select('id, user_id')
      .eq('id', coachId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (coachError) {
      console.error('[Coaches Analyze] Coach lookup error:', coachError)
      return NextResponse.json(
        { error: 'Database error', message: coachError.message },
        { status: 500 }
      )
    }

    if (!coach) {
      return NextResponse.json(
        { error: 'Not found', message: '코치를 찾을 수 없거나 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // -------------------------------------------------------------------------
    // 2. documentIds 소유권 검증
    // -------------------------------------------------------------------------
    const { data: ownedDocs, error: docOwnerError } = await supabase
      .from('user_documents')
      .select('id')
      .eq('user_id', user.id)
      .in('id', documentIds)

    if (docOwnerError) {
      console.error('[Coaches Analyze] Document ownership error:', docOwnerError)
      return NextResponse.json(
        { error: 'Database error', message: docOwnerError.message },
        { status: 500 }
      )
    }

    if (!ownedDocs || ownedDocs.length !== documentIds.length) {
      return NextResponse.json(
        { error: 'Forbidden', message: '선택한 문서 중 일부가 존재하지 않거나 접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. document_chunks에서 청크 가져오기 (최대 30개)
    // -------------------------------------------------------------------------
    const { data: chunks, error: chunkError } = await supabase
      .from('document_chunks')
      .select('content')
      .in('document_id', documentIds)
      .order('chunk_index', { ascending: true })
      .limit(30)

    if (chunkError) {
      console.error('[Coaches Analyze] Chunk fetch error:', chunkError)
      return NextResponse.json(
        { error: 'Database error', message: chunkError.message },
        { status: 500 }
      )
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: 'No data', message: '선택한 문서에 분석 가능한 텍스트가 없습니다. 문서가 처리되었는지 확인해주세요.' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 4. 청크 텍스트 결합 (최대 8000자)
    // -------------------------------------------------------------------------
    const MAX_CHARS = 8000
    let combinedText = ''
    for (const chunk of chunks) {
      if (!chunk.content) continue
      if (combinedText.length + chunk.content.length > MAX_CHARS) {
        // 남은 공간만큼만 추가
        const remaining = MAX_CHARS - combinedText.length
        if (remaining > 100) {
          combinedText += chunk.content.substring(0, remaining)
        }
        break
      }
      combinedText += chunk.content + '\n\n'
    }

    if (combinedText.trim().length < 50) {
      return NextResponse.json(
        { error: 'Insufficient data', message: '분석하기에 텍스트가 너무 짧습니다.' },
        { status: 400 }
      )
    }

    console.log(`[Coaches Analyze] Analyzing ${chunks.length} chunks (${combinedText.length} chars) for coach ${coachId}`)

    // -------------------------------------------------------------------------
    // 5. LLM 스타일 분석 호출
    // -------------------------------------------------------------------------
    const prompt = buildStyleAnalysisPrompt(combinedText)

    let llmResponse
    try {
      llmResponse = await generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 2048,
        context: 'coach.styleAnalysis'
      })
    } catch (llmError) {
      console.error('[Coaches Analyze] LLM call failed:', llmError)
      return NextResponse.json(
        { error: 'LLM error', message: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 }
      )
    }

    // -------------------------------------------------------------------------
    // 6. LLM 응답 파싱
    // -------------------------------------------------------------------------
    const styleProfile = parseJsonFromLLMResponse(llmResponse.text)

    if (!styleProfile) {
      console.error('[Coaches Analyze] Failed to parse style profile from LLM response:', llmResponse.text.substring(0, 500))
      return NextResponse.json(
        { error: 'Parse error', message: 'AI 응답을 분석할 수 없습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    // -------------------------------------------------------------------------
    // 7. style_profile + source_document_ids DB 업데이트
    // -------------------------------------------------------------------------
    const { data: updatedCoach, error: updateError } = await supabase
      .from('writing_coaches')
      .update({
        style_profile: styleProfile,
        source_document_ids: documentIds
      })
      .eq('id', coachId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Coaches Analyze] DB update error:', updateError)
      return NextResponse.json(
        { error: 'Database error', message: updateError.message },
        { status: 500 }
      )
    }

    console.log(`[Coaches Analyze] Style analysis complete for coach ${coachId}`)

    return NextResponse.json({
      success: true,
      coach: updatedCoach,
      analysis: {
        chunksAnalyzed: chunks.length,
        textLength: combinedText.length,
        tokensUsed: llmResponse.tokensUsed
      },
      message: '스타일 분석이 완료되었습니다.'
    })

  } catch (err) {
    console.error('[Coaches Analyze] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
