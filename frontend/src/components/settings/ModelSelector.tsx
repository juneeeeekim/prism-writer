// =============================================================================
// PRISM Writer - Model Selector (Phase 5)
// =============================================================================
// 파일: frontend/src/components/settings/ModelSelector.tsx
// 역할: Premium 사용자가 선호 LLM 모델을 선택/저장한다.
// 설계 의도(왜 이 구조인가):
//   1) 외부 라이브러리 없이 native <select>를 사용해 키보드 접근성과 다크
//      모드 일관성을 보장한다(기존 다른 셀렉터와 동일한 시각 톤).
//   2) 권한 부족(403)은 인라인 안내로 표시한다. 페이지 이동이나 모달은
//      회귀 위험이 있어 같은 컴포넌트 내 영역으로 한정.
//   3) 저장은 PUT 요청, 응답 후 inline 피드백(저장됨/오류)을 보여주고 자동
//      사라지도록 한다(접근성: aria-live polite).
// =============================================================================

'use client'

import { useEffect, useState } from 'react'

// API 응답 모델 — route.ts와 동기화 필요
const ALLOWED_PREFERRED_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemma-3-27b-it',
  'gpt-5-mini',
  'gpt-5.2-2025-12-11',
  'claude-sonnet-4-5-20250929',
] as const

type PreferredModel = (typeof ALLOWED_PREFERRED_MODELS)[number]

const MODEL_LABELS: Record<PreferredModel, string> = {
  'gemini-3-flash-preview': 'Gemini 3 Flash (빠름·저렴)',
  'gemini-3-pro-preview': 'Gemini 3 Pro (고품질)',
  'gemma-3-27b-it': 'Gemma 3 27B (균형)',
  'gpt-5-mini': 'GPT-5 mini (안정)',
  'gpt-5.2-2025-12-11': 'GPT-5.2 (Reasoning)',
  'claude-sonnet-4-5-20250929': 'Claude 4.5 Sonnet (한국어 강점)',
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }
  | { kind: 'forbidden' }

export default function ModelSelector() {
  const [selected, setSelected] = useState<string>('')
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  // 초기 로드
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/user/model-preference', {
          method: 'GET',
          credentials: 'include',
        })
        if (!cancelled) {
          if (res.status === 401) {
            setStatus({ kind: 'error', message: '로그인이 필요합니다.' })
            return
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            setStatus({
              kind: 'error',
              message: data?.error?.message ?? '선호 모델을 불러오지 못했습니다.',
            })
            return
          }
          const data = await res.json()
          setSelected(data.preferredModel ?? '')
          setStatus({ kind: 'idle' })
        }
      } catch {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            message: '네트워크 오류로 선호 모델을 불러오지 못했습니다.',
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // 저장됨 메시지 자동 해제 (접근성: aria-live polite + 시각 페이드)
  useEffect(() => {
    if (status.kind !== 'saved') return
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 2200)
    return () => clearTimeout(t)
  }, [status])

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      const res = await fetch('/api/user/model-preference', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredModel: selected === '' ? null : selected,
        }),
      })

      if (res.status === 403) {
        setStatus({ kind: 'forbidden' })
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus({
          kind: 'error',
          message: data?.error?.message ?? '저장에 실패했습니다.',
        })
        return
      }

      setStatus({ kind: 'saved' })
    } catch {
      setStatus({
        kind: 'error',
        message: '네트워크 오류로 저장에 실패했습니다.',
      })
    }
  }

  return (
    <section
      aria-labelledby="model-selector-title"
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
    >
      <h3
        id="model-selector-title"
        className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1"
      >
        선호 AI 모델
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        프리미엄 답변/검토에 사용될 기본 모델입니다. 비워두면 시스템 기본값을
        사용합니다.
      </p>

      <div className="flex gap-2 items-center">
        <label htmlFor="preferred-model-select" className="sr-only">
          선호 모델 선택
        </label>
        <select
          id="preferred-model-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={status.kind === 'loading' || status.kind === 'saving'}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">시스템 기본값 사용</option>
          {ALLOWED_PREFERRED_MODELS.map((id) => (
            <option key={id} value={id}>
              {MODEL_LABELS[id]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={status.kind === 'loading' || status.kind === 'saving'}
          className="rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {status.kind === 'saving' ? '저장 중…' : '저장'}
        </button>
      </div>

      {/* 상태 메시지 — aria-live로 스크린리더 알림 */}
      <div
        role="status"
        aria-live="polite"
        className="mt-2 min-h-[1.25rem] text-xs"
      >
        {status.kind === 'saved' && (
          <span className="text-green-600 dark:text-green-400">
            ✅ 저장되었습니다.
          </span>
        )}
        {status.kind === 'error' && (
          <span className="text-red-600 dark:text-red-400">
            ⚠️ {status.message}
          </span>
        )}
        {status.kind === 'forbidden' && (
          <span className="text-amber-600 dark:text-amber-400">
            🔒 프리미엄 등급 사용자만 변경할 수 있습니다.
          </span>
        )}
        {status.kind === 'loading' && (
          <span className="text-gray-500 dark:text-gray-400">
            불러오는 중…
          </span>
        )}
      </div>
    </section>
  )
}
