// 디렉토리 경로: frontend/scripts/
// 파일명: e2e-preflight-external.mjs
// 파일 코드의 역할/설명: external-smoke 실행 전 명시 승인, 대상 URL, 비용 가드가 설정됐는지 확인한다.

const externalSmokeEnabled =
  process.env.E2E_EXTERNAL_SMOKE === '1' ||
  process.env.ALLOW_EXTERNAL_SMOKE === 'true'

const externalBaseURL = (
  process.env.E2E_EXTERNAL_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  ''
).replace(/\/$/, '')

const costLimit = Number(process.env.E2E_COST_LIMIT_USD || '')
const maxTokens = Number(process.env.E2E_MAX_TOKENS || '')
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

function fail(message) {
  console.error(`[preflight:e2e:external] ${message}`)
  process.exit(1)
}

if (!externalSmokeEnabled) {
  fail('blocked. Set E2E_EXTERNAL_SMOKE=1 or ALLOW_EXTERNAL_SMOKE=true for intentional external execution.')
}

if (!externalBaseURL) {
  fail('E2E_EXTERNAL_BASE_URL or NEXT_PUBLIC_SITE_URL is required.')
}

if (!Number.isFinite(costLimit) || costLimit <= 0) {
  fail('E2E_COST_LIMIT_USD must be a positive number.')
}

if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
  fail('E2E_MAX_TOKENS must be a positive number.')
}

try {
  const response = await fetch(externalBaseURL, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (response.status >= 500) {
    fail(`target returned HTTP ${response.status}.`)
  }

  console.log(`[preflight:e2e:external] ready ${safeURL(externalBaseURL)}`)
} catch (error) {
  console.error(`[preflight:e2e:external] failed for ${safeURL(externalBaseURL)}`)
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
