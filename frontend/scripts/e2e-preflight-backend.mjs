// 디렉토리 경로: frontend/scripts/
// 파일명: e2e-preflight-backend.mjs
// 파일 코드의 역할/설명: backend-required E2E 실행 전에 실제 FastAPI 백엔드 readiness와 핵심 API schema를 확인한다.

const backendBaseURL = (
  process.env.E2E_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'
).replace(/\/$/, '')

const timeoutMs = Number(process.env.E2E_PREFLIGHT_TIMEOUT_MS || 5000)

function safeURL(value) {
  try {
    const url = new URL(value)
    url.username = url.username ? '***' : ''
    url.password = url.password ? '***' : ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return '<invalid-url>'
  }
}

async function fetchJSON(path, init = {}) {
  const response = await fetch(`${backendBaseURL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    throw new Error(`${path} did not return JSON`)
  }

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }

  return data
}

function assertOutlineSchema(data) {
  if (!data || !Array.isArray(data.outline)) {
    throw new Error('/v1/outline/generate response is missing outline[]')
  }

  if (typeof data.topic !== 'string' || typeof data.sources_used !== 'number') {
    throw new Error('/v1/outline/generate response schema is invalid')
  }
}

try {
  const health = await fetchJSON('/health')
  if (health.status !== 'ok') {
    throw new Error('/health returned a non-ok status')
  }

  const outline = await fetchJSON('/v1/outline/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'E2E backend preflight',
      document_ids: [],
      max_depth: 3,
    }),
  })
  assertOutlineSchema(outline)

  console.log(`[preflight:e2e:backend] ready ${safeURL(backendBaseURL)}`)
} catch (error) {
  console.error(`[preflight:e2e:backend] failed for ${safeURL(backendBaseURL)}`)
  console.error(error instanceof Error ? error.message : String(error))
  console.error('Start the backend first, or set E2E_BACKEND_URL to a ready FastAPI backend.')
  process.exit(1)
}
