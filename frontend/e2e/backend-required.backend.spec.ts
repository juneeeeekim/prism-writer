// 디렉토리 경로: frontend/e2e/
// 파일명: backend-required.backend.spec.ts
// 파일 코드의 역할/설명: 실제 FastAPI 백엔드가 기동된 상태에서 비용 없는 API 계약을 검증한다.

import { expect, test } from '@playwright/test'

const backendBaseURL = (
  process.env.E2E_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'
).replace(/\/$/, '')

test.describe('backend-required @backend-required', () => {
  test('GET /health returns a ready backend contract', async ({ request }) => {
    const response = await request.get(`${backendBaseURL}/health`)

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data).toMatchObject({
      status: 'ok',
      service: 'prism-writer-api',
    })
    expect(typeof data.version).toBe('string')
  })

  test('POST /v1/outline/generate returns outline schema', async ({ request }) => {
    const response = await request.post(`${backendBaseURL}/v1/outline/generate`, {
      data: {
        topic: 'E2E backend-required contract check',
        document_ids: [],
        max_depth: 3,
      },
    })

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.topic).toBe('E2E backend-required contract check')
    expect(Array.isArray(data.outline)).toBeTruthy()
    expect(typeof data.sources_used).toBe('number')

    for (const item of data.outline) {
      expect(typeof item.title).toBe('string')
      expect(typeof item.depth).toBe('number')
      expect(item.depth).toBeGreaterThanOrEqual(1)
      expect(item.depth).toBeLessThanOrEqual(3)
    }
  })
})
