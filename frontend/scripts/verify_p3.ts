import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { agenticChunk } from '../src/lib/rag/agenticChunking'
import { checkRetrievalNecessity, critiqueRetrievalResults, verifyGroundedness } from '../src/lib/rag/selfRAG'

// Simple test runner
async function runTests() {
  console.log('🚀 Starting P3 Integration Verification (Real LLM Calls)...')
  let passed = 0
  let failed = 0

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`Testing: ${name}... `)
      await fn()
      console.log('✅ PASS')
      passed++
    } catch (e: any) {
      console.log('❌ FAIL')
      console.error('   Error Message:', e.message)
      if (e.response) console.error('   API Response:', e.response)
      console.error(e)
      failed++
    }
  }

  function expect(actual: any) {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`)
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(`Expected truthy, got ${actual}`)
      },
      toBeFalsy: () => {
        if (actual) throw new Error(`Expected falsy, got ${actual}`)
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) throw new Error(`Expected > ${expected}, got ${actual}`)
      },
      toBeLessThanOrEqual: (expected: number) => {
        if (actual > expected) throw new Error(`Expected <= ${expected}, got ${actual}`)
      }
    }
  }

  // ===========================================================================
  // P3-01 Agentic Chunking Tests
  // ===========================================================================
  await test('Agentic Chunking: Small doc returns single chunk (No LLM)', async () => {
    // 20 chars, max 50 tokens -> should be single chunk
    const text = '01234567890123456789' 
    const chunks = await agenticChunk(text, { maxChunkTokens: 50 })

    expect(chunks.length).toBe(1)
    expect(chunks[0].content).toBe(text)
  })

  await test('Agentic Chunking: Large doc calls LLM and splits', async () => {
    // Generate large text (~1200 chars)
    const rule = "Rule 1: Always wash your hands before eating. This is mandatory for hygiene."
    const example = "Example: John washed his hands and didn't get sick."
    const text = Array(20).fill(`${rule}\n${example}`).join('\n\n')
    
    // Set small maxChunkTokens to force split
    // 1200 chars is roughly 300-400 tokens. Set limit to 100.
    const chunks = await agenticChunk(text, { maxChunkTokens: 100, minChunkTokens: 20 })

    console.log(`\n   -> Created ${chunks.length} chunks`)
    expect(chunks.length).toBeGreaterThan(1)
    
    // Check if types are assigned (LLM should detect rules/examples)
    const hasType = chunks.some(c => c.metadata.chunkType === 'rule' || c.metadata.chunkType === 'example')
    if (!hasType) console.warn('   -> Warning: LLM did not assign rule/example types (might be general)')
  })

  // ===========================================================================
  // P3-02 Self-RAG Tests
  // ===========================================================================
  await test('Self-RAG: Necessity Check (Greeting -> False)', async () => {
    const result = await checkRetrievalNecessity('안녕하세요! 반가워요.')
    console.log(`\n   -> Needed: ${result.needed}, Reason: ${result.reason}`)
    expect(result.needed).toBeFalsy()
  })

  await test('Self-RAG: Necessity Check (Integration Query -> True)', async () => {
    const result = await checkRetrievalNecessity('Prism Writer의 P3 파이프라인 구조에 대해 설명해줘.')
    console.log(`\n   -> Needed: ${result.needed}, Reason: ${result.reason}`)
    expect(result.needed).toBeTruthy()
  })

  await test('Self-RAG: Groundedness (Short answer skipped)', async () => {
    const result = await verifyGroundedness('Short answer', [{ content: 'Doc', chunkId: '1' } as any])
    // Should be grounded (default safe) but score 1.0 or skipped
    // Code returns: { isGrounded: true, score: 1.0 ... } if skipped
    expect(result.isGrounded).toBe(true)
  })

  await test('Self-RAG: Groundedness (Long answer check)', async () => {
    const answer = "Prism Writer is a tool for writing evaluation. " + "It uses AI to grade essays based on rubrics. ".repeat(5)
    
    // Provide relevant doc
    const docs = [{ content: "Prism Writer uses AI to evaluate writing using defined rubrics.", chunkId: '1', score: 0.9 } as any]
    
    const result = await verifyGroundedness(answer, docs)
    console.log(`\n   -> Grounded: ${result.isGrounded}, Score: ${result.groundednessScore}`)
    
    // Should be grounded
    expect(result.isGrounded).toBe(true)
  })

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

runTests().catch(console.error)
