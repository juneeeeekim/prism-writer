// 디렉토리 경로: frontend/e2e/
// 파일명: external-smoke.external.spec.ts
// 파일 코드의 역할/설명: 명시 승인된 경우에만 외부 배포 대상의 최소 비파괴 smoke를 검증한다.

import { expect, test } from '@playwright/test'

const externalSmokeEnabled =
  process.env.E2E_EXTERNAL_SMOKE === '1' ||
  process.env.ALLOW_EXTERNAL_SMOKE === 'true'

const externalBaseURL = (
  process.env.E2E_EXTERNAL_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  ''
).replace(/\/$/, '')

test.describe('external-smoke @external-smoke', () => {
  test.skip(!externalSmokeEnabled, 'Set E2E_EXTERNAL_SMOKE=1 or ALLOW_EXTERNAL_SMOKE=true to run external smoke.')

  test('target homepage responds without server failure', async ({ request }) => {
    expect(externalBaseURL).not.toBe('')

    const response = await request.get(externalBaseURL)
    expect(response.status()).toBeGreaterThanOrEqual(200)
    expect(response.status()).toBeLessThan(500)
  })

  test('SEO discovery files are reachable', async ({ request }) => {
    expect(externalBaseURL).not.toBe('')

    const robots = await request.get(`${externalBaseURL}/robots.txt`)
    expect(robots.ok()).toBeTruthy()

    const sitemap = await request.get(`${externalBaseURL}/sitemap.xml`)
    expect(sitemap.ok()).toBeTruthy()
  })
})
