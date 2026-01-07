// =============================================================================
// PRISM Writer - Outline Generation API (Next.js Route)
// =============================================================================
// 파일: frontend/src/app/api/outline/route.ts
// 역할: 참고자료 기반 목차 생성 API (vectorSearch 연동)
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// 기존 외부 API 호출 (localhost:8000) 대신 Next.js API Route로 구현
// 업로드된 rag_documents → rag_chunks → vectorSearch → LLM → 목차 생성
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { vectorSearch } from '@/lib/rag/search'
import { isFeatureEnabled } from '@/config/featureFlags'
import { GoogleGenerativeAI } from '@google/generative-ai'

// =============================================================================
// 타입 정의
// =============================================================================

interface OutlineItem {
  title: string
  depth: number
}

interface OutlineRequest {
  /** 주제 */
  topic: string
  /** 참조할 문서 ID 목록 (optional) */
  documentIds?: string[]
  /** 최대 깊이 (기본 3) */
  maxDepth?: number
  /** 검색 결과 개수 (기본 10) */
  /** 검색 결과 개수 (기본 10) */
  topK?: number
  /** [RAG-ISOLATION] 프로젝트 ID (필수) */
  projectId?: string
}

interface OutlineResponse {
  success: boolean
  outline?: OutlineItem[]
  topic?: string
  sourcesUsed?: number
  message?: string
  error?: string
}

// =============================================================================
// 상수
// =============================================================================

const DEFAULT_TOP_K = 10
const DEFAULT_MAX_DEPTH = 3
const MODEL_NAME = 'gemini-3-flash-preview'

// =============================================================================
// POST: 목차 생성
// =============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<OutlineResponse>> {
  try {
    // -------------------------------------------------------------------------
    // 0. Feature Flag 확인 (Kill Switch)
    // -------------------------------------------------------------------------
    if (!isFeatureEnabled('ENABLE_PIPELINE_V5')) {
      return NextResponse.json({
        success: false,
        message: 'Pipeline v5 기능이 비활성화되어 있습니다.',
        error: 'FEATURE_DISABLED',
      }, { status: 503 })
    }

    // -------------------------------------------------------------------------
    // 1. API Key 확인
    // -------------------------------------------------------------------------
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: 'GOOGLE_API_KEY가 설정되지 않았습니다.',
        error: 'API_KEY_NOT_CONFIGURED',
      }, { status: 503 })
    }

    // -------------------------------------------------------------------------
    // 2. 사용자 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        message: '로그인이 필요합니다.',
        error: 'UNAUTHORIZED',
      }, { status: 401 })
    }

    // -------------------------------------------------------------------------
    // 3. 요청 파싱
    // -------------------------------------------------------------------------
    const body: OutlineRequest = await request.json()
    const { topic, documentIds, maxDepth = DEFAULT_MAX_DEPTH, topK = DEFAULT_TOP_K, projectId } = body

    if (!topic || topic.trim().length < 2) {
      return NextResponse.json({
        success: false,
        message: '주제를 2자 이상 입력해주세요.',
        error: 'TOPIC_TOO_SHORT',
      }, { status: 400 })
    }

    if (!projectId) {
       // [RAG-ISOLATION] 프로젝트 ID 필수 체크
       // 기존 호환성을 위해 에러는 안 뱉고 빈 결과(일반 생성)로 유도할 수도 있으나,
       // 아키텍처 원칙상 경고 로그 남김.
       console.warn('[Outline API] Project ID missing. RAG search will be skipped/empty.')
    }

    // -------------------------------------------------------------------------
    // 4. 참고자료 검색 (vectorSearch 연동)
    // -------------------------------------------------------------------------
    // 주석(주니어 개발자): 여기서 업로드된 참고자료(rag_chunks)를 검색합니다
    
    // [RAG-ISOLATION] projectId 전달
    const searchResults = await vectorSearch(topic, {
      userId: user.id,
      topK,
      minScore: 0.3, // 유사도 임계값 완화 (0.5 -> 0.3)
      projectId: projectId || null, // null이면 Strict Mode에 의해 결과 0개 반환 (Correct Behavior)
      // Note: documentId 단일 필터만 지원 (다중 문서는 추후 확장)
    })

    // -------------------------------------------------------------------------
    // 5. 프롬프트 생성
    // -------------------------------------------------------------------------
    const referenceContext = searchResults.length > 0 
      ? searchResults.map((r, i) => `[참고자료 ${i + 1}]\n${r.content}`).join('\n\n')
      : '(업로드된 참고자료 없음 - 일반 지식 기반으로 생성)'

    const prompt = `당신은 전문적인 글쓰기 도우미입니다.

주어진 주제에 대해 체계적인 목차를 생성해주세요.

## 주제
${topic}

## 참고자료
${referenceContext}

## 요구사항
1. 최대 깊이 ${maxDepth}단계의 목차를 생성하세요
2. 각 항목은 명확하고 구체적으로 작성하세요
3. 참고자료의 내용을 반영하여 목차를 구성하세요
4. 논리적인 흐름과 구성을 갖추세요

## 출력 형식 (JSON)
{
  "outline": [
    { "title": "서론", "depth": 1 },
    { "title": "배경 및 필요성", "depth": 2 },
    { "title": "본론", "depth": 1 },
    ...
  ]
}

JSON만 출력하세요.`

    // -------------------------------------------------------------------------
    // 6. LLM 호출 (Gemini)
    // -------------------------------------------------------------------------
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    })

    const responseText = result.response.text()

    // -------------------------------------------------------------------------
    // 7. JSON 파싱
    // -------------------------------------------------------------------------
    let outline: OutlineItem[] = []

    try {
      // JSON 블록 추출
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i) 
        || responseText.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        const parsed = JSON.parse(jsonStr)
        outline = parsed.outline || []
      }
    } catch (parseError) {
      console.error('[Outline API] JSON parse error:', parseError)
      // Fallback: 간단한 목차 생성
      outline = [
        { title: '서론', depth: 1 },
        { title: topic, depth: 1 },
        { title: '결론', depth: 1 },
      ]
    }

    // depth 검증 및 정규화
    outline = outline.map(item => ({
      title: String(item.title || '항목'),
      depth: Math.min(Math.max(1, Number(item.depth) || 1), maxDepth),
    }))

    // -------------------------------------------------------------------------
    // 8. 응답 반환
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      outline,
      topic,
      sourcesUsed: searchResults.length,
    })

  } catch (error) {
    console.error('[Outline API] Error:', error)
    return NextResponse.json({
      success: false,
      message: '목차 생성 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR',
    }, { status: 500 })
  }
}

// =============================================================================
// GET: 목차 템플릿 조회 (향후 확장용)
// =============================================================================

export async function GET(): Promise<NextResponse> {
  // TODO: 저장된 목차 템플릿 조회 기능
  return NextResponse.json({
    success: true,
    templates: [
      {
        id: 'academic',
        name: '학술 논문',
        outline: [
          { title: '서론', depth: 1 },
          { title: '연구 배경', depth: 2 },
          { title: '연구 목적', depth: 2 },
          { title: '이론적 배경', depth: 1 },
          { title: '연구 방법', depth: 1 },
          { title: '연구 결과', depth: 1 },
          { title: '결론', depth: 1 },
        ],
      },
      {
        id: 'blog',
        name: '블로그 포스트',
        outline: [
          { title: '들어가며', depth: 1 },
          { title: '핵심 내용', depth: 1 },
          { title: '마무리', depth: 1 },
        ],
      },
    ],
  })
}
