// =============================================================================
// PRISM Writer - Mode Selector Component
// =============================================================================
// 파일: frontend/src/components/rag/ModeSelector.tsx
// 역할: Router 모드 선택 UI 컴포넌트
// P1 Phase 2.4
// =============================================================================

import { RouterMode, ROUTER_CONFIGS } from '@/types/rag'
import { getModeDescription, getEstimatedTime } from '@/lib/rag/modelRouter'

// =============================================================================
// 스타일 및 상수
// =============================================================================

const MODE_ICONS: Record<RouterMode, string> = {
  cheap: '💰',
  standard: '⚖️',
  strict: '🔒',
}

const MODE_LABELS: Record<RouterMode, string> = {
  cheap: '경제',
  standard: '표준',
  strict: '정밀',
}

// =============================================================================
// Props 인터페이스
// =============================================================================

interface ModeSelectorProps {
  /** 현재 선택된 모드 */
  value: RouterMode
  /** 모드 변경 핸들러 */
  onChange: (mode: RouterMode) => void
  /** 추가 CSS 클래스 */
  className?: string
  /** 비활성화 여부 */
  disabled?: boolean
  /** 상세 정보 표시 여부 */
  showDetails?: boolean
}

// =============================================================================
// 컴포넌트
// =============================================================================

/**
 * AI 모드 선택 컴포넌트
 * 
 * @description
 * 사용자가 cheap/standard/strict 모드 중 선택할 수 있는 드롭다운
 * 
 * @example
 * ```tsx
 * <ModeSelector 
 *   value={mode} 
 *   onChange={setMode} 
 *   showDetails 
 * />
 * ```
 */
export function ModeSelector({
  value,
  onChange,
  className = '',
  disabled = false,
  showDetails = false,
}: ModeSelectorProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      {/* ---------------------------------------------------------------
          드롭다운 선택
          --------------------------------------------------------------- */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RouterMode)}
        disabled={disabled}
        aria-label="AI 모드 선택"
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="cheap">{MODE_ICONS.cheap} {MODE_LABELS.cheap} (빠름)</option>
        <option value="standard">{MODE_ICONS.standard} {MODE_LABELS.standard}</option>
        <option value="strict">{MODE_ICONS.strict} {MODE_LABELS.strict} (상세)</option>
      </select>

      {/* ---------------------------------------------------------------
          상세 정보 (옵션)
          --------------------------------------------------------------- */}
      {showDetails && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <p>{getModeDescription(value)}</p>
          <p className="mt-1">
            예상 응답 시간: ~{getEstimatedTime(value)}초
            {ROUTER_CONFIGS[value].reviewerModel && (
              <span className="ml-2 text-green-600 dark:text-green-400">
                ✓ 검토 포함
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 버튼 그룹 버전
// =============================================================================

interface ModeButtonGroupProps {
  /** 현재 선택된 모드 */
  value: RouterMode
  /** 모드 변경 핸들러 */
  onChange: (mode: RouterMode) => void
  /** 추가 CSS 클래스 */
  className?: string
  /** 비활성화 여부 */
  disabled?: boolean
}

/**
 * AI 모드 버튼 그룹 컴포넌트
 * 
 * @description
 * 세 개의 버튼으로 모드를 선택하는 대안 UI
 */
export function ModeButtonGroup({
  value,
  onChange,
  className = '',
  disabled = false,
}: ModeButtonGroupProps) {
  const modes: RouterMode[] = ['cheap', 'standard', 'strict']

  return (
    <div 
      className={`inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 ${className}`}
      role="group"
      aria-label="AI 모드 선택"
    >
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          disabled={disabled}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            value === mode
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-pressed={value === mode}
        >
          {MODE_ICONS[mode]} {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Export
// =============================================================================

export default ModeSelector
