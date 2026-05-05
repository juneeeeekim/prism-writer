// =============================================================================
// PRISM Writer - LLM Cost Dashboard (Phase 6)
// =============================================================================
// 파일: frontend/src/components/admin/LLMCostDashboard.tsx
// 역할: 관리자가 모델/컨텍스트/일자별 비용·실패율을 한 화면에서 확인.
// 설계 의도(왜 이 구조인가):
//   - 외부 차트 라이브러리 없이 native 표/막대로 시작 → 의존성 추가 없이
//     안정적으로 가동, 추후 recharts 등으로 개선 가능.
//   - 마이그레이션 미적용 환경(degradedReason='TABLE_NOT_MIGRATED')도 빈 화면이
//     아닌 "데이터가 아직 없습니다" 안내로 처리해 사용자 혼란 방지.
//   - 권한 부족(403)은 컴포넌트 단에서 명시적 안내. 페이지 라우팅 분기는 호출자
//     책임으로 두어 컴포넌트는 재사용 가능.
// =============================================================================

'use client'

import { useEffect, useState } from 'react'

type Range = 'day' | 'week' | 'month'

interface ModelRow {
  modelId: string
  calls: number
  costUsd: number
  failures: number
  avgLatencyMs: number
}
interface ContextRow {
  context: string
  calls: number
  costUsd: number
  failures: number
}
interface DayRow {
  day: string
  calls: number
  costUsd: number
  failures: number
}
interface CostsResponse {
  success: true
  range: Range
  totals: {
    calls: number
    totalCostUsd: number
    failures: number
    fallbackUsed: number
  }
  byModel: ModelRow[]
  byContext: ContextRow[]
  byDay: DayRow[]
  partial?: boolean
  degradedReason?: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | { kind: 'empty'; reason: string }
  | { kind: 'ok'; data: CostsResponse }

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

export default function LLMCostDashboard() {
  const [range, setRange] = useState<Range>('week')
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })

    async function load() {
      try {
        const res = await fetch(`/api/admin/llm-costs?range=${range}`, {
          credentials: 'include',
        })
        if (cancelled) return

        if (res.status === 401) {
          setState({ kind: 'unauthenticated' })
          return
        }
        if (res.status === 403) {
          setState({ kind: 'forbidden' })
          return
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setState({
            kind: 'error',
            message: data?.error?.message ?? '비용 데이터를 불러오지 못했습니다.',
          })
          return
        }
        const data: CostsResponse = await res.json()
        if (data.partial && data.degradedReason === 'TABLE_NOT_MIGRATED') {
          setState({ kind: 'empty', reason: '성능 로그 테이블이 아직 적용되지 않았습니다.' })
          return
        }
        if (data.totals.calls === 0) {
          setState({ kind: 'empty', reason: '선택한 기간에 기록된 호출이 없습니다.' })
          return
        }
        setState({ kind: 'ok', data })
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: '네트워크 오류로 데이터를 불러오지 못했습니다.' })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range])

  return (
    <section
      aria-labelledby="llm-cost-title"
      className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <header className="flex items-center justify-between">
        <h2
          id="llm-cost-title"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          LLM 비용 대시보드
        </h2>
        <div role="tablist" aria-label="기간 선택" className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {r === 'day' ? '1일' : r === 'week' ? '7일' : '30일'}
            </button>
          ))}
        </div>
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
        {state.kind === 'empty' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{state.reason}</p>
        )}
      </div>

      {state.kind === 'ok' && (
        <>
          {/* 전체 합계 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="총 호출" value={state.data.totals.calls.toLocaleString()} />
            <Stat label="총 비용" value={formatUsd(state.data.totals.totalCostUsd)} />
            <Stat label="실패" value={state.data.totals.failures.toLocaleString()} tone="danger" />
            <Stat
              label="Fallback 사용"
              value={state.data.totals.fallbackUsed.toLocaleString()}
              tone="warn"
            />
          </div>

          {/* 모델별 표 */}
          <Card title="모델별 사용량">
            <Table
              headers={['모델', '호출', '비용', '실패', '평균 지연(ms)']}
              rows={state.data.byModel.map((m) => [
                m.modelId,
                m.calls.toLocaleString(),
                formatUsd(m.costUsd),
                m.failures.toLocaleString(),
                m.avgLatencyMs.toLocaleString(),
              ])}
            />
          </Card>

          {/* 컨텍스트별 표 */}
          <Card title="컨텍스트별 사용량">
            <Table
              headers={['컨텍스트', '호출', '비용', '실패']}
              rows={state.data.byContext.map((c) => [
                c.context,
                c.calls.toLocaleString(),
                formatUsd(c.costUsd),
                c.failures.toLocaleString(),
              ])}
            />
          </Card>

          {/* 일자별 표 */}
          <Card title="일자별 사용량">
            <Table
              headers={['날짜', '호출', '비용', '실패']}
              rows={state.data.byDay.map((d) => [
                d.day,
                d.calls.toLocaleString(),
                formatUsd(d.costUsd),
                d.failures.toLocaleString(),
              ])}
            />
          </Card>
        </>
      )}
    </section>
  )
}

// -----------------------------------------------------------------------------
// 보조 컴포넌트
// -----------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'warn'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
        데이터가 없습니다.
      </p>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800/50">
          {headers.map((h) => (
            <th
              key={h}
              scope="col"
              className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr
            key={idx}
            className={
              idx % 2 === 0
                ? 'bg-white dark:bg-gray-900'
                : 'bg-gray-50 dark:bg-gray-800/30'
            }
          >
            {row.map((cell, cIdx) => (
              <td
                key={cIdx}
                className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
