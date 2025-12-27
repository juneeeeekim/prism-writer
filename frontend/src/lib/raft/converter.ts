import { RAFTData, SFTTrainingExample, GeminiTrainingEntry } from './types'

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context.`

export function convertRowToSFT(row: RAFTData): SFTTrainingExample {
  if (!row.user_query || !row.context || !row.gold_answer) {
    throw new Error(`Invalid RAFT data row: user_query, context, or gold_answer is missing (ID: ${row.id})`)
  }

  const userContent = `Context:\n${row.context}\n\nQuestion:\n${row.user_query}`

  return {
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userContent
      },
      {
        role: 'assistant',
        content: row.gold_answer
      }
    ]
  }
}

// Phase 5: Gemini Format Converter
export function convertToGeminiFormat(row: RAFTData): GeminiTrainingEntry {
  if (!row.user_query || !row.context || !row.gold_answer) {
    throw new Error(`Invalid RAFT data row: user_query, context, or gold_answer is missing (ID: ${row.id})`)
  }

  // Gemini Tuning Format: 
  // User: Context + Query
  // Model: Expected Answer
  const userContent = `Context:\n${row.context}\n\nQuestion:\n${row.user_query}`

  return {
    messages: [
      {
        role: 'user',
        parts: [{ text: userContent }]
      },
      {
        role: 'model',
        parts: [{ text: row.gold_answer }]
      }
    ]
  }
}
