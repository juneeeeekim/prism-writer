// =============================================================================
// PRISM Writer - LLM Experiments Panel (Phase 7)
// =============================================================================
// 파일: frontend/src/components/admin/LLMExperimentsPanel.tsx
// 역할: 관리자가 등록된 A/B 실험과 변종별 성공률·지연을 한 화면에서 확인.
// 설계 의도(왜 이 구조인가):
//   - 실험 변경은 코드를 통해서만 적용되므로 본 패널은 "관찰 전용".
//     UI에서 활성/비활성 토글을 노출하면 운영 정책과 충돌 위험이 커진다.
//   - 실험이 0개일 때도 안내 문구로 빈 상태를 명시해 사용자 혼란을 줄인다.
// =============================================================================

'use client'

import { useEffect, useState } from 'react'

interface Variant {
  modelId: string
  weight: number
}
interface VariantResult extends Variant {
  calls: number
  failures: number
  successRate: number
  avgLatencyMs: number
}
interface Experiment {
  context: string
  enabled: boolean
  variants: Variant[]
  results: VariantResult[]
}
interface ApiResponse {
  success: true
  experiments: Experiment[]
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; data: ApiResponse }

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '0.0%'
  return `${(value * 100).toFixed(1)}%`
}

export default function LLMExperimentsPanel() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/llm-experiments', {
          credentials: 'include',
        })
        if (cancelled) return

        if (res.status === 401) return setState({ kind: 'unauthenticated' })
        if (res.status === 403) return setState({ kind: 'forbidden' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          return setState({
            kind: 'error',
            message: data?.error?.message ?? '실험 정보를 불러오지 못했습니다.',
          })
        }
        const data: ApiResponse = await res.json()
        setState({ kind: 'ok', data })
      } catch {
        if (!cancelled)
          setState({ kind: 'error', message: '네트워크 오류로 데이터를 불러오지 못했습니다.' })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      aria-labelledby="llm-experiments-title"
      className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <header>
        <h2
          id="llm-experiments-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          A/B 실험 결과
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          최근 30일 데이터 기준. 실험 활성/비활성은 코드의 AB_EXPERIMENTS에서
          관리됩니다.
        </p>
      </header>

      <div role="status" aria-live="polite" className="min-h-[2rem]">
        {state.kind === 'loading' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">불러오는 중…</p>
        )}
        {state.kind === 'unauthenticated' && (
          <p className="text-sm text-amber-600 dark:text-amber-400">로그인이 필요합니다.</p>
        )}
        {state.kind === 'forbidden' && (
          <p className="text-sm text-amber-600 dark:text-amber-400">관리자 권한이 필요합니다.</p>
        )}
        {state.kind === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400">⚠️ {state.message}</p>
        )}
      </div>

      {state.kind === 'ok' && state.data.experiments.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          등록된 실험이 없습니다. <code>frontend/src/lib/llm/ab-test.ts</code>의{' '}
          <code>AB_EXPERIMENTS</code>를 편집한 뒤 배포하세요.
        </p>
      )}

      {state.kind === 'ok' && state.data.experiments.length > 0 && (
        <div className="space-y-4">
          {state.data.experiments.map((exp) => (
            <article
              key={exp.context}
              className="rounded-md border border-gray-200 dark:border-gray-700"
            >
              <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {exp.context}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    exp.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {exp.enabled ? '활성' : '비활성'}
                </span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        모델
                      </th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        가중치
                      </th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        호출
                      </th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        실패
                      </th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        성공률
                      </th>
                      <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-400">
                        평균 지연(ms)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {exp.results.map((r, idx) => (
                      <tr
                        key={r.modelId}
                        className={
                          idx % 2 === 0
                            ? 'bg-white dark:bg-gray-900'
                            : 'bg-gray-50 dark:bg-gray-800/30'
                        }
                      >
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.modelId}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {r.weight.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {r.calls.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {r.failures.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {formatPct(r.successRate)}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                          {r.avgLatencyMs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
