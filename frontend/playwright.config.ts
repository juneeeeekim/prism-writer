// 디렉토리 경로: frontend/
// 파일명: playwright.config.ts
// 파일 코드의 역할/설명: Playwright E2E 실행 그룹을 backend-required, external-smoke, ui-smoke로 분리한다.

import { defineConfig, devices } from '@playwright/test'

const frontendURL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000'
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: frontendURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'backend-required',
      testMatch: /.*\.backend\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'external-smoke',
      testMatch: /.*\.external\.spec\.ts/,
      retries: 0,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ui-smoke',
      testMatch: /.*\.ui\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run dev',
        url: frontendURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
})
