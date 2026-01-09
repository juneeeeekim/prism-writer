// =============================================================================
// PRISM Writer - Shadow Writer Settings Component
// =============================================================================
// 파일: frontend/src/components/Editor/ShadowWriterSettings.tsx
// 역할: Shadow Writer Trigger Mode 설정 UI (비용 제어)
// 참고: [Shadow Writer 체크리스트 P2-04-A]
// =============================================================================

'use client'

import { useState, useRef, useEffect } from 'react'

// =============================================================================
// Types
// =============================================================================

/** Trigger Mode 타입 */
export type TriggerMode = 'auto' | 'sentence-end' | 'manual'

/** 설정 컴포넌트 Props */
interface ShadowWriterSettingsProps {
  /** 현재 Trigger Mode */
  mode: TriggerMode
  /** Mode 변경 콜백 */
  setMode: (mode: TriggerMode) => void
  /** 컴팩트 모드 (작은 UI) */
  compact?: boolean
}

// =============================================================================
// Constants
// =============================================================================

/** Trigger Mode 옵션 정의 */
const TRIGGER_MODE_OPTIONS: Array<{
  value: TriggerMode
  label: string
  description: string
  icon: string
  costLevel: 'high' | 'medium' | 'low'
}> = [
  {
    value: 'auto',
    label: '자동',
    description: '타이핑 멈출 때마다 제안',
    icon: '⚡',
    costLevel: 'high',
  },
  {
    value: 'sentence-end',
    label: '문장 끝',
    description: '.?! 후에만 제안 (권장)',
    icon: '🛑',
    costLevel: 'medium',
  },
  {
    value: 'manual',
    label: '수동',
    description: 'Ctrl+Shift+Space로 호출',
    icon: '⌨️',
    costLevel: 'low',
  },
]

// =============================================================================
// Helper: 비용 레벨 뱃지
// =============================================================================

function CostBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }

  const labels = {
    high: '비용 ↑',
    medium: '권장',
    low: '비용 ↓',
  }

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[level]}`}>
      {labels[level]}
    </span>
  )
}

// =============================================================================
// Main Component: Shadow Writer Settings
// =============================================================================

export function ShadowWriterSettings({
  mode,
  setMode,
  compact = false,
}: ShadowWriterSettingsProps) {
  // ---------------------------------------------------------------------------
  // State: 드롭다운 열림/닫힘
  // ---------------------------------------------------------------------------
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Effect: 외부 클릭 시 드롭다운 닫기
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ---------------------------------------------------------------------------
  // Handler: 옵션 선택
  // ---------------------------------------------------------------------------
  const handleSelect = (value: TriggerMode) => {
    setMode(value)
    setIsOpen(false)
  }

  // ---------------------------------------------------------------------------
  // 현재 선택된 옵션
  // ---------------------------------------------------------------------------
  const currentOption = TRIGGER_MODE_OPTIONS.find((opt) => opt.value === mode) || TRIGGER_MODE_OPTIONS[1]

  // ---------------------------------------------------------------------------
  // Render: Compact 모드 (아이콘만)
  // ---------------------------------------------------------------------------
  if (compact) {
    return (
      <div ref={dropdownRef} className="relative inline-block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 text-sm 
                     bg-gray-100 dark:bg-gray-800 
                     hover:bg-gray-200 dark:hover:bg-gray-700
                     rounded-md transition-colors"
          title={`Shadow Writer: ${currentOption.label}`}
        >
          <span>{currentOption.icon}</span>
          <span className="text-xs text-gray-500">▼</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 z-50
                          bg-white dark:bg-gray-800 
                          border border-gray-200 dark:border-gray-700
                          rounded-lg shadow-lg">
            {TRIGGER_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full px-3 py-2 text-left text-sm 
                           hover:bg-gray-100 dark:hover:bg-gray-700
                           flex items-center justify-between
                           ${option.value === mode ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </span>
                <CostBadge level={option.costLevel} />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Full 모드 (라벨 + 설명 포함)
  // ---------------------------------------------------------------------------
  return (
    <div ref={dropdownRef} className="relative">
      {/* 레이블 */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Shadow Writer 모드
      </label>

      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2
                   bg-white dark:bg-gray-800 
                   border border-gray-300 dark:border-gray-600
                   hover:border-gray-400 dark:hover:border-gray-500
                   rounded-lg transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">{currentOption.icon}</span>
          <span className="text-sm font-medium">{currentOption.label}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            - {currentOption.description}
          </span>
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-50
                        bg-white dark:bg-gray-800 
                        border border-gray-200 dark:border-gray-700
                        rounded-lg shadow-lg overflow-hidden">
          {TRIGGER_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-left
                         hover:bg-gray-50 dark:hover:bg-gray-700
                         border-b border-gray-100 dark:border-gray-700 last:border-b-0
                         ${option.value === mode ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{option.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </div>
                <CostBadge level={option.costLevel} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 도움말 텍스트 */}
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        비용 절감을 위해 &quot;문장 끝&quot; 모드를 권장합니다.
      </p>
    </div>
  )
}

// =============================================================================
// Named Export
// =============================================================================
export default ShadowWriterSettings
