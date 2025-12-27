export interface RAFTData {
  id: string
  created_at: string
  user_query: string
  context: string
  gold_answer: string
  bad_answer?: string
  source: 'synthetic' | 'user_feedback' | 'manual' | 'ab_test'
  verified: boolean
  model_id?: string
}

export interface SFTMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface SFTTrainingExample {
  messages: SFTMessage[]
}

// Gemini Tuning Format (Phase 5)
export interface GeminiPart {
  text: string
}

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiTrainingEntry {
  messages: GeminiMessage[]
}
