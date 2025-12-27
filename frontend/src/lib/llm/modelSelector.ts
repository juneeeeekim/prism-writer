export type ModelQuality = 'standard' | 'high_quality'

export type TaskType = 'plan' | 'patch' | 'judge'

interface ModelConfig {
  primary: string
  fallback: string
}

/**
 * ModelSelector
 * taskType과 qualityLevel에 따라 최적의 모델 ID를 반환합니다.
 */
export class ModelSelector {
  static selectModel(task: TaskType, quality: ModelQuality = 'standard'): ModelConfig {
    // 1. High Quality Track (Pro Priority)
    if (quality === 'high_quality') {
      return {
        // Pro 모델 (3.0 Pro)
        primary: 'gemini-3-pro-preview',
        // Fallback: 3.0 Flash (Pro 실패 시 빠른 모델로 전환)
        fallback: 'gemini-3-flash-preview' 
      }
    }

    // 2. Standard Track (Flash Priority - Default)
    // 'gemini-3-flash-preview' is the documented default for this project.
    return {
      primary: 'gemini-3-flash-preview',
      // Fallback: 2.0 Flash (Reliable previous gen)
      fallback: 'gemini-2.0-flash-exp'
    }
  }
}
