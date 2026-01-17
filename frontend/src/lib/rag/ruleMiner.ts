
import { createClient } from '@/lib/supabase/client'
import { fullTextSearch } from './search'
import { generateRuleExtractionPrompt, RULE_EXTRACTION_SYSTEM_PROMPT } from './prompts/ruleExtraction'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getModelForUsage } from '@/config/llm-usage-map'
import { extractJSON } from '@/lib/llm/parser'

// =============================================================================
// 타입 정의
// =============================================================================

export type RuleCategory = 'tone' | 'structure' | 'expression' | 'prohibition'

export interface Rule {
  id?: string
  document_id: string
  tenant_id: string
  content: string
  type: 'rule' | 'principle' | 'guideline' | 'general'
  category: RuleCategory
  keywords?: string // BM25 최적화용 (저장 시 생성)
  source_chunk_id?: string
  metadata?: Record<string, any>
}

// =============================================================================
// 상수 정의
// =============================================================================

const CATEGORY_KEYWORDS: Record<RuleCategory, string> = {
  tone: '어조 말투 문체 tone style attitude',
  structure: '구조 구성 서론 본론 결론 structure layout organization',
  expression: '표현 단어 용어 expression vocabulary phrasing',
  prohibition: '금지 지양 피해야 avoid don\'t never warning',
}

const MINING_TOP_K = 20 // 카테고리별 검색할 청크 수

// =============================================================================
// Rule Miner 구현
// =============================================================================

/**
 * 특정 카테고리에 대한 규칙을 채굴합니다.
 * 1. BM25로 관련 청크 검색
 * 2. LLM으로 규칙 추출
 * 3. DB에 저장
 */
export async function mineRulesByCategory(
  documentId: string,
  tenantId: string,
  category: RuleCategory,
  userId: string
): Promise<Rule[]> {
  // 1. BM25로 관련 청크 대량 검색
  const keywords = CATEGORY_KEYWORDS[category]
  const searchResults = await fullTextSearch(keywords, {
    userId,
    documentId,
    topK: MINING_TOP_K,
    minScore: 0.1, // 너무 관련 없는 것은 제외
  })

  if (searchResults.length === 0) {
    console.log(`[RuleMiner] No chunks found for category: ${category}`)
    return []
  }

  const chunksContent = searchResults.map(r => r.content)

  // 2. LLM으로 규칙 추출
  const extractedRules = await extractRulesFromChunks(chunksContent, category)

  // 3. Rule 객체 생성
  const rules: Rule[] = extractedRules.map(content => ({
    document_id: documentId,
    tenant_id: tenantId,
    content,
    type: 'rule',
    category,
    // 첫 번째 검색 결과의 chunk_id를 출처로 사용 (단순화)
    source_chunk_id: searchResults[0]?.chunkId, 
    metadata: {
      source_chunks_count: searchResults.length,
      extraction_method: 'llm-mining',
    },
  }))

  return rules
}

/**
 * LLM을 사용하여 청크에서 규칙 텍스트 추출
 * 주석(LLM 전문 개발자): Gemini 3 Flash로 업그레이드 (2025-12-25)
 */
async function extractRulesFromChunks(chunks: string[], category: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY is missing')

  // ---------------------------------------------------------------------------
  // Gemini 3 Flash 초기화 (LLM 전문 개발자)
  // 주석(중앙화 마이그레이션): getModelForUsage 적용 (2025-12-28)
  // ---------------------------------------------------------------------------
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ 
    model: getModelForUsage('rule.mining'),
    generationConfig: {
      temperature: 1.0,  // Gemini 3 권장 (Gemini_3_Flash_Reference.md)
    },
    systemInstruction: RULE_EXTRACTION_SYSTEM_PROMPT,
  })
  
  const prompt = generateRuleExtractionPrompt(category, chunks)

  try {
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const content = response.response.text()
    if (!content) return []

    // JSON 파싱 (Gemma 3 호환)
    const jsonString = extractJSON(content)
    if (!jsonString) return []

    const result = JSON.parse(jsonString)

    return result.rules?.map((r: any) => r.content) || [] // JSON 구조에 따라 조정 필요
  } catch (error) {
    console.error('[RuleMiner] Extraction failed:', error)
    return []
  }
}

/**
 * 추출된 규칙을 데이터베이스에 저장
 */
export async function saveRulesToDatabase(rules: Rule[]) {
  if (rules.length === 0) return

  const supabase = await createClient()
  
  // keywords 생성 (간단히 content를 토큰화하거나 그대로 저장 - DB 트리거가 tsvector 변환 처리 가정)
  // 여기서는 텍스트 그대로 저장하고 DB 측에서 처리하도록 함
  
  const { error } = await supabase.from('rag_rules').insert(rules)

  if (error) {
    throw new Error(`Failed to save rules: ${error.message}`)
  }
}
