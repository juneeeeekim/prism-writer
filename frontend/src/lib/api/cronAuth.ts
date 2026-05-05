// 디렉토리 경로: frontend/src/lib/api/
// 파일명: cronAuth.ts
// 파일 코드의 역할/설명: Cron API 라우트의 secret 기반 접근 제어를 공통으로 검증한다.

import { NextRequest, NextResponse } from 'next/server'

type CronAuthResult =
  | { ok: true }
  | {
      ok: false
      response: NextResponse
    }

export function requireCronAuthorization(
  request: NextRequest,
  source: string
): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const queryKey = request.nextUrl.searchParams.get('key')

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[${source}] CRON_SECRET is not configured`)
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'CRON_SECRET is not configured' },
          { status: 500 }
        ),
      }
    }

    console.warn(`[${source}] CRON_SECRET is not configured; allowing local request`)
    return { ok: true }
  }

  if (authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret) {
    return { ok: true }
  }

  console.warn(`[${source}] Unauthorized access attempt`)
  return {
    ok: false,
    response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
  }
}
