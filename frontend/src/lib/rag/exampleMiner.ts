
import { createClient } from '@/lib/supabase/client'
import { hybridSearch } from './search'
import { applyExampleBoost, DEFAULT_EXAMPLE_RERANKER_CONFIG } from './reranker'
import { generateExampleGenerationPrompt, EXAMPLE_GENERATION_SYSTEM_PROMPT } from './prompts/exampleGeneration'
import { type Rule } from './ruleMiner'
import { getModelForUsage } from '@/config/llm-usage-map'
// ❌ (중앙화 마이그레이션 2025-12-28) 미사용 import 제거
// import OpenAI from 'openai'

// =============================================================================
// 타입 정의
// =============================================================================

export interface Example {
  id?: string
  rule_id?: string
  document_id: string
  tenant_id: string
  content: string
  type: 'positive' | 'negative'
  is_generated: boolean
  source_chunk_id?: string
  confidence_score: number
}

export interface ExampleSet {
  positive_examples: string[]
  negative_examples: string[]
  remediation_steps: string[]
  source_citations: string[]
  /** Pipeline v4: 예시 생성의 근거가 된 원본 규칙 인용문 (Optional - 하위 호환성) */
  source_rule_quotes?: string[]
  confidence_score: number
  is_generated: boolean
}

// =============================================================================
// 상수 정의
// =============================================================================

const MINING_SIMILARITY_THRESHOLD = 0.75 // 예시 채택 임계값
const GENERATION_CONTEXT_CHUNKS = 3 // 생성 시 참고할 스타일 청크 수

// =============================================================================
// Example Miner 구현
// =============================================================================

/**
 * 규칙에 대한 예시를 찾거나 생성합니다.
 * 1. Mining 시도 (기존 청크에서 검색)
 * 2. 실패 시 Generation 시도 (LLM 생성)
 */
export async function processExamplesForRule(
  rule: Rule,
  userId: string
): Promise<ExampleSet> {
  // 1. Mining 시도
  const minedExamples = await mineExamplesForRule(rule, userId)
  
  if (minedExamples.positive_examples.length > 0) {
    console.log(`[ExampleMiner] Mined examples for rule: ${rule.content.substring(0, 20)}...`)
    return minedExamples
  }

  // 2. Generation 시도
  console.log(`[ExampleMiner] Generating examples for rule: ${rule.content.substring(0, 20)}...`)
  
  // 스타일 참고용 청크 검색 (일반 검색)
  const styleChunks = await hybridSearch(rule.content, {
    userId,
    documentId: rule.document_id,
    topK: GENERATION_CONTEXT_CHUNKS,
    chunkType: 'general' // 스타일은 일반 텍스트에서 참조
  })
  
  const sourceChunks = styleChunks.map(c => c.content)
  return await generateExamplesForRule(rule, sourceChunks)
}

/**
 * 규칙과 관련된 예시를 검색합니다.
 */
async function mineExamplesForRule(rule: Rule, userId: string): Promise<ExampleSet> {
  // 'example' 타입 청크만 검색
  const searchResults = await hybridSearch(rule.content, {
    userId,
    documentId: rule.document_id,
    topK: 5,
    chunkType: 'example'
  })

  // 예시 특화 리랭킹 적용
  const boostedResults = applyExampleBoost(searchResults, DEFAULT_EXAMPLE_RERANKER_CONFIG)
  
  // 임계값 이상인 결과만 필터링
  const validResults = boostedResults.filter(r => r.score >= MINING_SIMILARITY_THRESHOLD)

  const positiveExamples = validResults.map(r => r.content)
  const sourceCitations = validResults.map(r => r.content) // 인용문으로 사용

  return {
    positive_examples: positiveExamples,
    negative_examples: [], // Mining으로는 부정적 예시를 찾기 어려움 (보통 문서엔 좋은 예시만 있음)
    remediation_steps: [],
    source_citations: sourceCitations,
    confidence_score: validResults.length > 0 ? validResults[0].score : 0,
    is_generated: false
  }
}

/**
 * LLM을 사용하여 규칙에 맞는 예시를 생성합니다.
 * 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
 */
async function generateExamplesForRule(rule: Rule, sourceChunks: string[]): Promise<ExampleSet> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY is missing')

  // ---------------------------------------------------------------------------
  // Gemini 3 Flash 초기화 (LLM 전문 개발자)
  // 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
  // ---------------------------------------------------------------------------
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ 
    model: getModelForUsage('example.mining'),
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
      responseMimeType: 'application/json',
    },
    systemInstruction: EXAMPLE_GENERATION_SYSTEM_PROMPT,
  })
  
  const prompt = generateExampleGenerationPrompt(rule.content, sourceChunks)

  try {
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const content = response.response.text()
    if (!content) throw new Error('No content generated')

    // JSON 파싱 (Gemini는 JSON 응답을 텍스트로 반환할 수 있음)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const result = JSON.parse(jsonMatch[0])
    
    return {
      positive_examples: result.positive_examples || [],
      negative_examples: result.negative_examples || [],
      remediation_steps: result.remediation_steps || [],
      source_citations: [], // 생성된 예시이므로 인용 없음
      confidence_score: 0.8, // 생성된 예시의 기본 신뢰도
      is_generated: true
    }
  } catch (error) {
    console.error('[ExampleMiner] Generation failed:', error)
    return {
      positive_examples: [],
      negative_examples: [],
      remediation_steps: [],
      source_citations: [],
      confidence_score: 0,
      is_generated: true
    }
  }
}

/**
 * 생성/채굴된 예시를 DB에 저장합니다.
 */
export async function saveExamplesToDatabase(examples: Example[]) {
  if (examples.length === 0) return

  const supabase = createClient()
  const { error } = await supabase.from('rag_examples').insert(examples)

  if (error) {
    throw new Error(`Failed to save examples: ${error.message}`)
  }
}
