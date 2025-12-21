// =============================================================================
// PRISM Writer - LLM Test API
// =============================================================================
// 파일: frontend/src/app/api/llm/test/route.ts
// 역할: LLM API 연결 및 기능 테스트 엔드포인트
// =============================================================================

import { NextResponse } from 'next/server'
import { generateText, isLLMAvailable } from '@/lib/llm/gateway'
import { buildEvaluationPrompt, type RubricItem, type SearchResult } from '@/lib/llm/prompts'
import { parseEvaluationResponse, validateEvaluationResult, summarizeEvaluationResult } from '@/lib/llm/parser'

// =============================================================================
// 타입 정의
// =============================================================================

interface TestResult {
  testName: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  duration?: number
  details?: any
}

interface TestResponse {
  success: boolean
  totalTests: number
  passed: number
  failed: number
  skipped: number
  results: TestResult[]
}

// =============================================================================
// 테스트 데이터
// =============================================================================

const SAMPLE_USER_TEXT = `
인공지능(AI)은 현대 사회에서 중요한 역할을 하고 있습니다.
특히 자연어 처리 기술은 번역, 요약, 대화 시스템 등에 활용됩니다.
RAG(Retrieval-Augmented Generation)는 검색과 생성을 결합한 기술입니다.
`

const SAMPLE_RUBRICS: RubricItem[] = [
  {
    id: 'accuracy',
    name: '정확성',
    description: '내용이 사실에 기반하고 정확한지 평가',
    weight: 40,
  },
  {
    id: 'clarity',
    name: '명확성',
    description: '글의 구조와 표현이 명확한지 평가',
    weight: 30,
  },
]

const SAMPLE_SEARCH_RESULTS: SearchResult[] = [
  {
    chunkId: 'chunk-001',
    content: 'RAG(Retrieval-Augmented Generation)는 대규모 언어 모델의 환각(hallucination) 문제를 해결하기 위해 외부 지식을 검색하여 활용하는 기술입니다.',
    score: 0.92,
    metadata: { source: 'AI 기술 문서' },
  },
  {
    chunkId: 'chunk-002',
    content: '자연어 처리(NLP)는 컴퓨터가 인간의 언어를 이해하고 생성하는 인공지능의 한 분야입니다.',
    score: 0.85,
    metadata: { source: 'NLP 개론' },
  },
]

// =============================================================================
// POST: LLM 테스트 실행
// =============================================================================

export async function POST(request: Request): Promise<NextResponse<TestResponse>> {
  const modelOverride = request.headers.get('x-prism-model-id') || undefined
  const results: TestResult[] = []
  let passed = 0
  let failed = 0
  let skipped = 0

  // ---------------------------------------------------------------------------
  // 테스트 1: API 키 설정 확인
  // ---------------------------------------------------------------------------
  const test1Start = Date.now()
  if (isLLMAvailable()) {
    results.push({
      testName: 'API 키 설정 확인',
      status: 'pass',
      message: 'GOOGLE_API_KEY 환경 변수가 설정되어 있습니다.',
      duration: Date.now() - test1Start,
    })
    passed++
  } else {
    results.push({
      testName: 'API 키 설정 확인',
      status: 'fail',
      message: 'GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.',
      duration: Date.now() - test1Start,
    })
    failed++

    // API 키가 없으면 나머지 테스트 스킵
    return NextResponse.json({
      success: false,
      totalTests: 4,
      passed,
      failed,
      skipped: 3,
      results: [
        ...results,
        { testName: 'LLM 호출 테스트', status: 'skip', message: 'API 키 미설정으로 스킵' },
        { testName: 'JSON 형식 응답 확인', status: 'skip', message: 'API 키 미설정으로 스킵' },
        { testName: '근거 인용 포함 확인', status: 'skip', message: 'API 키 미설정으로 스킵' },
      ],
    })
  }

  // ---------------------------------------------------------------------------
  // 테스트 2: LLM 호출 테스트
  // ---------------------------------------------------------------------------
  const test2Start = Date.now()
  let llmResponse: string = ''
  
  try {
    const prompt = buildEvaluationPrompt({
      userText: SAMPLE_USER_TEXT,
      rubrics: SAMPLE_RUBRICS,
      searchResults: SAMPLE_SEARCH_RESULTS,
    })

    const response = await generateText(prompt, {
      model: modelOverride,
      temperature: 0.3,
      maxOutputTokens: 2048,
    })

    llmResponse = response.text

    results.push({
      testName: 'LLM 호출 테스트',
      status: 'pass',
      message: `LLM 호출 성공 (${response.tokensUsed || 'N/A'} 토큰 사용)`,
      duration: Date.now() - test2Start,
      details: {
        finishReason: response.finishReason,
        responseLength: response.text.length,
      },
    })
    passed++
  } catch (error) {
    results.push({
      testName: 'LLM 호출 테스트',
      status: 'fail',
      message: `LLM 호출 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - test2Start,
    })
    failed++

    // LLM 호출 실패 시 나머지 테스트 스킵
    return NextResponse.json({
      success: false,
      totalTests: 4,
      passed,
      failed,
      skipped: 2,
      results: [
        ...results,
        { testName: 'JSON 형식 응답 확인', status: 'skip', message: 'LLM 호출 실패로 스킵' },
        { testName: '근거 인용 포함 확인', status: 'skip', message: 'LLM 호출 실패로 스킵' },
      ],
    })
  }

  // ---------------------------------------------------------------------------
  // 테스트 3: JSON 형식 응답 확인
  // ---------------------------------------------------------------------------
  const test3Start = Date.now()
  const parsedResult = parseEvaluationResponse(llmResponse, { debug: true })

  if (parsedResult.success) {
    results.push({
      testName: 'JSON 형식 응답 확인',
      status: 'pass',
      message: `JSON 파싱 성공 (${parsedResult.evaluations.length}개 평가 항목)`,
      duration: Date.now() - test3Start,
      details: {
        overallScore: parsedResult.overall_score,
        evaluationCount: parsedResult.evaluations.length,
      },
    })
    passed++
  } else {
    results.push({
      testName: 'JSON 형식 응답 확인',
      status: 'fail',
      message: `JSON 파싱 실패: ${parsedResult.error}`,
      duration: Date.now() - test3Start,
      details: {
        rawResponse: llmResponse.substring(0, 500) + '...',
      },
    })
    failed++
  }

  // ---------------------------------------------------------------------------
  // 테스트 4: 근거 인용 포함 확인
  // ---------------------------------------------------------------------------
  const test4Start = Date.now()
  
  if (parsedResult.success && parsedResult.evaluations.length > 0) {
    // 적어도 하나의 평가에 근거 인용이 있거나 insufficient_evidence 상태인지 확인
    const hasEvidenceOrInsufficient = parsedResult.evaluations.some(
      (evaluation) =>
        evaluation.evidence_quotes.length > 0 ||
        evaluation.status === 'insufficient_evidence'
    )

    if (hasEvidenceOrInsufficient) {
      const evidenceCount = parsedResult.evaluations.reduce(
        (sum, e) => sum + e.evidence_quotes.length,
        0
      )
      const insufficientCount = parsedResult.evaluations.filter(
        (e) => e.status === 'insufficient_evidence'
      ).length

      results.push({
        testName: '근거 인용 포함 확인',
        status: 'pass',
        message: `근거 인용 확인 (${evidenceCount}개 인용, ${insufficientCount}개 근거부족)`,
        duration: Date.now() - test4Start,
        details: {
          totalEvidenceQuotes: evidenceCount,
          insufficientEvidenceCount: insufficientCount,
          summary: summarizeEvaluationResult(parsedResult),
        },
      })
      passed++
    } else {
      results.push({
        testName: '근거 인용 포함 확인',
        status: 'fail',
        message: '평가 결과에 근거 인용이 없습니다.',
        duration: Date.now() - test4Start,
        details: {
          evaluations: parsedResult.evaluations,
        },
      })
      failed++
    }
  } else {
    results.push({
      testName: '근거 인용 포함 확인',
      status: 'skip',
      message: 'JSON 파싱 실패로 스킵',
      duration: Date.now() - test4Start,
    })
    skipped++
  }

  // ---------------------------------------------------------------------------
  // 최종 결과 반환
  // ---------------------------------------------------------------------------
  return NextResponse.json({
    success: failed === 0,
    totalTests: results.length,
    passed,
    failed,
    skipped,
    results,
  })
}

// =============================================================================
// GET: 테스트 상태 확인
// =============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'LLM 테스트 API입니다. POST 요청으로 테스트를 실행하세요.',
    apiKeyConfigured: isLLMAvailable(),
    endpoints: {
      POST: '/api/llm/test - LLM 테스트 실행',
    },
  })
}
