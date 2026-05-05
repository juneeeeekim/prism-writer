// 디렉토리 경로: frontend/e2e/
// 파일명: ui-smoke.ui.spec.ts
// 파일 코드의 역할/설명: mock 없이 현재 인증 보호 UI 흐름의 최소 smoke를 검증한다.

import { expect, test } from '@playwright/test'

test.describe('ui-smoke @ui-smoke', () => {
  test('home CTA points to protected dashboard flow', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/PRISM Writer/)

    const cta = page.getByRole('link', { name: /AI 코치 만들기|코치 만들기/ })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/dashboard')
  })

  test('protected editor redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/editor')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
