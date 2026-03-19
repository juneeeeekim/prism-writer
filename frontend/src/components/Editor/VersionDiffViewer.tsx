'use client'

// =============================================================================
// Phase A Track 2: P1-08 - Version Diff Viewer
// =============================================================================
// 파일: frontend/src/components/Editor/VersionDiffViewer.tsx
// 역할: 현재 내용과 선택된 버전의 내용을 비교하여 diff를 표시
// 생성일: 2026-03-19
// =============================================================================

import { useMemo } from 'react'
import { diffLines } from 'diff'

// =============================================================================
// Props
// =============================================================================

interface VersionDiffViewerProps {
  /** 현재 에디터 내용 */
  currentContent: string
  /** 선택된 버전의 내용 */
  versionContent: string
  /** 선택된 버전 번호 */
  versionNumber: number
}

// =============================================================================
// Component
// =============================================================================

export default function VersionDiffViewer({
  currentContent,
  versionContent,
  versionNumber,
}: VersionDiffViewerProps) {
  // ---------------------------------------------------------------------------
  // Diff 계산
  // ---------------------------------------------------------------------------
  const diffResult = useMemo(() => {
    const changes = diffLines(versionContent, currentContent)

    let addedCount = 0
    let removedCount = 0

    changes.forEach((change) => {
      const lineCount = change.count || 0
      if (change.added) {
        addedCount += lineCount
      } else if (change.removed) {
        removedCount += lineCount
      }
    })

    return { changes, addedCount, removedCount }
  }, [currentContent, versionContent])

  return (
    <div className="flex flex-col h-full">
      {/* -------------------------------------------------------------------
          Header: 변경 통계
          ------------------------------------------------------------------- */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          버전 {versionNumber} vs 현재
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{diffResult.addedCount}줄 추가
          </span>
          <span className="text-red-600 dark:text-red-400 font-medium">
            -{diffResult.removedCount}줄 삭제
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          Diff 내용
          ------------------------------------------------------------------- */}
      <div className="flex-1 overflow-auto">
        <pre className="text-sm leading-relaxed font-mono">
          {diffResult.changes.map((change, index) => {
            const lines = change.value.split('\n')
            // diffLines는 마지막에 빈 문자열이 올 수 있으므로 처리
            const displayLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines

            if (displayLines.length === 0 && change.value === '') {
              return null
            }

            return displayLines.map((line, lineIndex) => {
              let bgClass = ''
              let textClass = 'text-gray-800 dark:text-gray-200'
              let prefix = ' '

              if (change.added) {
                bgClass = 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500'
                textClass = 'text-green-800 dark:text-green-200'
                prefix = '+'
              } else if (change.removed) {
                bgClass = 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500'
                textClass = 'text-red-800 dark:text-red-200'
                prefix = '-'
              }

              return (
                <div
                  key={`${index}-${lineIndex}`}
                  className={`px-4 py-0.5 ${bgClass}`}
                >
                  <span className={`select-none mr-2 ${change.added ? 'text-green-500' : change.removed ? 'text-red-500' : 'text-gray-400 dark:text-gray-600'}`}>
                    {prefix}
                  </span>
                  <span className={textClass}>
                    {line || ' '}
                  </span>
                </div>
              )
            })
          })}
        </pre>
      </div>
    </div>
  )
}
