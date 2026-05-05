// 디렉토리 경로: frontend/scripts/
// 파일명: run-e2e-project.mjs
// 파일 코드의 역할/설명: npm script에서 Playwright project를 명시 실행하고 필요 시 frontend webServer 자동 기동을 끈다.

import { spawn } from 'node:child_process'

const [projectName, ...rawArgs] = process.argv.slice(2)

if (!projectName) {
  console.error('Usage: node scripts/run-e2e-project.mjs <project-name> [--skip-web-server] [playwright args...]')
  process.exit(1)
}

const skipWebServer = rawArgs.includes('--skip-web-server')
const passthroughArgs = rawArgs.filter((arg) => arg !== '--skip-web-server')
const npxCommand = 'npx'
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => key && !key.startsWith('=') && value !== undefined)
)

if (skipWebServer) {
  childEnv.PLAYWRIGHT_SKIP_WEB_SERVER = '1'
} else if (!childEnv.PLAYWRIGHT_SKIP_WEB_SERVER) {
  delete childEnv.PLAYWRIGHT_SKIP_WEB_SERVER
}

const child = spawn(
  npxCommand,
  ['playwright', 'test', `--project=${projectName}`, ...passthroughArgs],
  {
    stdio: 'inherit',
    env: childEnv,
    shell: process.platform === 'win32',
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Playwright was interrupted by ${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
