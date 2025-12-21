// =============================================================================
// PRISM Writer - Environment Variable Types
// =============================================================================
// 파일: frontend/src/types/env.d.ts
// 역할: process.env에 대한 타입 정의 확장
// =============================================================================

declare namespace NodeJS {
  interface ProcessEnv {
    /** Google Gemini API Key */
    GOOGLE_API_KEY?: string;
    
    /** OpenAI API Key (Optional) */
    OPENAI_API_KEY?: string;
    
    /** Anthropic API Key (Optional) */
    ANTHROPIC_API_KEY?: string;
    
    /** 
     * 활성화할 LLM Provider 목록 (쉼표로 구분) 
     * 예: "gemini,openai"
     */
    ENABLED_PROVIDERS?: string;
    
    /** 
     * 시스템 기본 모델 ID 
     * 예: "gemini-2.0-flash"
     */
    DEFAULT_MODEL?: string;

    /** Supabase URL */
    NEXT_PUBLIC_SUPABASE_URL?: string;
    /** Supabase Anon Key */
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  }
}
