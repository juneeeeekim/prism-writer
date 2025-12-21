// =============================================================================
// PRISM Writer - Admin Model Selector
// =============================================================================
// 파일: frontend/src/components/admin/AdminModelSelector.tsx
// 역할: 관리자/디렉터용 모델 스위칭 UI
// 기능: MODEL_REGISTRY에서 활성화된 모델 목록을 가져와 선택 가능하게 함
// =============================================================================

'use client'

import { useState, useEffect } from 'react'
import { MODEL_REGISTRY } from '@/config/models'

export default function AdminModelSelector() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')

  // ---------------------------------------------------------------------------
  // 1. 어드민 모드 확인 및 초기화
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // URL 파라미터에 admin=true가 있거나 localStorage에 설정된 경우 활성화
    const params = new URLSearchParams(window.location.search)
    const isAdminParam = params.get('admin') === 'true'
    const isAdminStored = localStorage.getItem('prism_admin_mode') === 'true'

    if (isAdminParam || isAdminStored) {
      setIsAdmin(true)
      if (isAdminParam) {
        localStorage.setItem('prism_admin_mode', 'true')
      }
    }

    // 저장된 모델 로드
    const storedModel = localStorage.getItem('prism_selected_model')
    if (storedModel) {
      setSelectedModel(storedModel)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 2. 모델 변경 핸들러
  // ---------------------------------------------------------------------------
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value
    setSelectedModel(modelId)
    if (modelId) {
      localStorage.setItem('prism_selected_model', modelId)
    } else {
      localStorage.removeItem('prism_selected_model')
    }
    // 페이지 새로고침하여 설정 반영 (가장 확실한 방법)
    window.location.reload()
  }

  if (!isAdmin) return null

  // 활성화된 모델 목록 추출
  const enabledModels = Object.entries(MODEL_REGISTRY)
    .filter(([_, config]) => config.enabled)
    .map(([id, config]) => ({ id, name: config.displayName }))

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md shadow-sm">
      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
        Admin Mode
      </span>
      <select
        value={selectedModel}
        onChange={handleModelChange}
        className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        <option value="">Default (Auto)</option>
        {enabledModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          localStorage.removeItem('prism_admin_mode')
          localStorage.removeItem('prism_selected_model')
          window.location.href = window.location.pathname // 파라미터 제거하며 새로고침
        }}
        className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
        title="Admin Mode Exit"
      >
        ✕
      </button>
    </div>
  )
}
