// =============================================================================
// PRISM Writer - Chat Model Selector
// =============================================================================
// 파일: frontend/src/components/Assistant/ChatModelSelector.tsx
// 역할: 일반 사용자용 채팅 모델 선택 UI (ChatGPT 스타일)
// 생성일: 2026-01-23
// 참조: AdminModelSelector.tsx (Admin 모드 체크 로직 제거)
// =============================================================================

'use client'

import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import { MODEL_REGISTRY } from '@/config/models'
import type { ModelConfig } from '@/config/models'

// =============================================================================
// [SECTION 1] 타입 및 상수 정의
// =============================================================================

/** 모델 정보 타입 */
interface ModelInfo {
  id: string
  name: string
  provider: 'gemini' | 'openai' | 'anthropic'
  tier?: 'free' | 'premium' | 'developer'
}

/** Provider 표시 라벨 */
const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
}

/** Provider 아이콘 */
const PROVIDER_ICONS: Record<string, string> = {
  gemini: '🌐',
  openai: '🤖',
  anthropic: '🧠',
}

/** localStorage 키 상수 */
const STORAGE_KEY = 'prism_selected_model'

// =============================================================================
// [SECTION 2] Props 인터페이스
// =============================================================================

interface ChatModelSelectorProps {
  /** 모델 변경 시 호출되는 콜백 (선택적) */
  onModelChange?: (modelId: string) => void
}

// =============================================================================
// [SECTION 3] 메인 컴포넌트
// =============================================================================

export default function ChatModelSelector({ onModelChange }: ChatModelSelectorProps) {
  // ---------------------------------------------------------------------------
  // 3-1. 상태 관리
  // ---------------------------------------------------------------------------
  const [selectedModel, setSelectedModel] = useState<string>('')

  // ---------------------------------------------------------------------------
  // 3-2. 초기값 로드 (localStorage에서)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Safety: SSR 환경에서 window 접근 방지
    if (typeof window === 'undefined') return

    const storedModel = localStorage.getItem(STORAGE_KEY)
    if (storedModel) {
      setSelectedModel(storedModel)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 3-3. 활성화된 모델 목록 필터링 (useMemo로 최적화)
  // ---------------------------------------------------------------------------
  const enabledModels = useMemo<ModelInfo[]>(() => {
    return Object.entries(MODEL_REGISTRY)
      .filter(([_, config]) => {
        // Safety: enabled가 undefined인 경우 true로 간주
        return config.enabled !== false
      })
      .map(([id, config]) => ({
        id,
        name: config.displayName,
        provider: config.provider as ModelInfo['provider'], // 타입 단언
        tier: config.tier as ModelInfo['tier'], // 타입 단언
      }))
  }, [])

  // ---------------------------------------------------------------------------
  // 3-4. Provider별 그룹핑 (useMemo로 최적화)
  // ---------------------------------------------------------------------------
  const groupedModels = useMemo(() => {
    return enabledModels.reduce(
      (acc, model) => {
        const provider = model.provider
        if (!acc[provider]) {
          acc[provider] = []
        }
        acc[provider].push(model)
        return acc
      },
      {} as Record<string, ModelInfo[]>
    )
  }, [enabledModels])

  // ---------------------------------------------------------------------------
  // 3-5. 모델 변경 핸들러
  // ---------------------------------------------------------------------------
  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value
    setSelectedModel(modelId)

    // localStorage 업데이트
    if (modelId) {
      localStorage.setItem(STORAGE_KEY, modelId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }

    // 콜백 호출 (부모 컴포넌트에 알림)
    onModelChange?.(modelId)
  }

  // ---------------------------------------------------------------------------
  // 3-6. 현재 모델의 Tier 뱃지 결정
  // ---------------------------------------------------------------------------
  const currentModelConfig = selectedModel
    ? (MODEL_REGISTRY as Record<string, ModelConfig>)[selectedModel]
    : null
  const tierBadge = currentModelConfig?.tier === 'premium' ? '⭐' : '⚡'

  // ---------------------------------------------------------------------------
  // 3-7. UI 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div className="flex items-center gap-2">
      {/* 모델 아이콘 */}
      <span className="text-base" title="AI 모델 선택">
        🤖
      </span>

      {/* Tier 뱃지 (모델 선택 시에만 표시) */}
      {selectedModel && (
        <span className="text-xs" title={currentModelConfig?.tier || 'default'}>
          {tierBadge}
        </span>
      )}

      {/* 모델 선택 드롭다운 */}
      <select
        value={selectedModel}
        onChange={handleModelChange}
        className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors cursor-pointer"
        aria-label="AI 모델 선택"
      >
        {/* 기본 옵션 */}
        <option value="">Default (Auto)</option>

        {/* Provider별 그룹 렌더링 */}
        {Object.entries(groupedModels).map(([provider, models]) => (
          <optgroup
            key={provider}
            label={`${PROVIDER_ICONS[provider] || '🔧'} ${PROVIDER_LABELS[provider] || provider}`}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
                {model.tier === 'premium' ? ' ⭐' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
