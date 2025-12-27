// =============================================================================
// PRISM Writer - Staged Patch Panel
// =============================================================================
// 파일: frontend/src/components/rag/StagedPatchPanel.tsx
// 역할: 패치를 단계별(핵심 -> 표현 -> 디테일)로 그룹화하여 표시
// =============================================================================

'use client'

import { useState, useMemo } from 'react'
import { StagedPatch, PatchGroup, PatchStage } from '@/types/rag'
import { isFeatureEnabled } from '@/config/featureFlags'

// =============================================================================
// Types & Interfaces
// =============================================================================

interface StagedPatchPanelProps {
  patches: StagedPatch[]
  onAccept: (patchId: string) => void
  onReject: (patchId: string) => void
  onAcceptAll?: (stage: PatchStage) => void
}

// 단계별 레이블 및 우선순위
const STAGE_CONFIG: Record<PatchStage, { label: string; priority: number; color: string }> = {
  core: { label: '핵심 수정', priority: 1, color: 'text-red-600 bg-red-50 border-red-200' },
  expression: { label: '표현/톤', priority: 2, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  detail: { label: '디테일', priority: 3, color: 'text-gray-600 bg-gray-50 border-gray-200' },
}

// =============================================================================
// Component
// =============================================================================

export default function StagedPatchPanel({ 
  patches, 
  onAccept, 
  onReject,
  onAcceptAll 
}: StagedPatchPanelProps) {
  // Feature Flag 확인
  const isStagingEnabled = isFeatureEnabled('FF_PATCH_STAGING')
  
  // 상태: 각 단계별 접힘/펼침 (기본값: 모두 펼침)
  const [expandedStages, setExpandedStages] = useState<Record<PatchStage, boolean>>({
    core: true,
    expression: true,
    detail: true,
  })

  // 토글 핸들러
  const toggleStage = (stage: PatchStage) => {
    setExpandedStages(prev => ({ ...prev, [stage]: !prev[stage] }))
  }

  // 패치 그룹화 로직
  const groupedPatches = useMemo(() => {
    if (!isStagingEnabled) {
      // 플래그 꺼져있으면 'all'이라는 가상 그룹 하나로 리턴하거나 그냥 플랫 리스트 처리
      // 여기서는 그냥 전체를 하나의 그룹으로 처리하지 않고 렌더링 분기
      return [] 
    }

    const groups: PatchGroup[] = [
      { stage: 'core', patches: [], isExpanded: expandedStages.core },
      { stage: 'expression', patches: [], isExpanded: expandedStages.expression },
      { stage: 'detail', patches: [], isExpanded: expandedStages.detail },
    ]

    patches.forEach(patch => {
      const group = groups.find(g => g.stage === patch.stage)
      if (group) group.patches.push(patch)
    })

    // 패치가 있는 그룹만 필터링
    return groups.filter(g => g.patches.length > 0)
  }, [patches, isStagingEnabled, expandedStages])

  // ---------------------------------------------------------------------------
  // Render: Legacy Flat List (Feature Flag OFF)
  // ---------------------------------------------------------------------------
  if (!isStagingEnabled) {
    return (
      <div className="space-y-4">
        {patches.map(patch => (
          <LegacyPatchCard 
            key={patch.id} 
            patch={patch} 
            onAccept={onAccept} 
            onReject={onReject} 
          />
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Staged List (Feature Flag ON)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {groupedPatches.map(group => (
        <div key={group.stage} className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700">
          
          {/* Group Header */}
          <div 
            className={`flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 dark:bg-gray-800 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700`}
            onClick={() => toggleStage(group.stage)}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${STAGE_CONFIG[group.stage].color}`}>
                {STAGE_CONFIG[group.stage].label}
              </span>
              <span className="text-sm text-gray-500">
                ({group.patches.length}개)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {onAcceptAll && group.patches.some(p => p.status === 'pending') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAcceptAll(group.stage)
                  }}
                  className="text-xs text-prism-primary hover:underline px-2"
                >
                  모두 수락
                </button>
              )}
              <svg 
                className={`w-5 h-5 text-gray-400 transform transition-transform ${group.isExpanded ? 'rotate-180' : ''}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Group Body */}
          {group.isExpanded && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {group.patches.map(patch => (
                <LegacyPatchCard 
                  key={patch.id} 
                  patch={patch} 
                  onAccept={onAccept} 
                  onReject={onReject} 
                  minimal
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {groupedPatches.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          제안된 수정 사항이 없습니다.
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Sub-component: Patch Card (Individual)
// -----------------------------------------------------------------------------
function LegacyPatchCard({ 
  patch, 
  onAccept, 
  onReject,
  minimal = false
}: { 
  patch: StagedPatch
  onAccept: (id: string) => void
  onReject: (id: string) => void
  minimal?: boolean
}) {
  if (patch.status !== 'pending') return null

  return (
    <div className={`p-4 ${minimal ? '' : 'border rounded-lg mb-4 border-gray-200 dark:border-gray-700'}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {patch.description}
        </span>
        {!minimal && (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${STAGE_CONFIG[patch.stage].color}`}>
            {STAGE_CONFIG[patch.stage].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded del">
          <span className="line-through decoration-red-500/50">{patch.originalText}</span>
        </div>
        <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded ins">
          {patch.patchedText}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onReject(patch.id)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          거절
        </button>
        <button
          onClick={() => onAccept(patch.id)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-prism-primary hover:bg-prism-primary/90 rounded transition-colors"
        >
          수락
        </button>
      </div>
    </div>
  )
}
