import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseErrorLogQuery,
  readErrorLogsWithStatus,
  writeErrorLog,
  type ErrorLogEntry,
} from '@/lib/error-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ErrorResponseBody {
  success: false
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'BAD_REQUEST' | 'INTERNAL_ERROR'
    message: string
    requestId: string
  }
}

function createRequestId(): string {
  return `errlog_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function errorResponse(
  status: number,
  code: ErrorResponseBody['error']['code'],
  message: string,
  requestId: string
) {
  return NextResponse.json<ErrorResponseBody>(
    {
      success: false,
      error: { code, message, requestId },
    },
    { status }
  )
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Login is required.', requestId)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      await writeErrorLog({
        category: 'api',
        domain: 'admin-error-log',
        severity: 'warn',
        source: 'GET /api/admin/error-log',
        operation: 'authorize',
        requestId,
        userId: user.id,
        message: 'Non-admin attempted to read error logs',
        metadata: { profileError: profileError?.message },
      })

      return errorResponse(403, 'FORBIDDEN', 'Admin access is required.', requestId)
    }

    const parsed = parseErrorLogQuery(request.nextUrl.searchParams)
    if (!parsed.ok) {
      return errorResponse(400, 'BAD_REQUEST', parsed.message, requestId)
    }

    const result = await withTimeout(
      readErrorLogsWithStatus(parsed.filters),
      3000,
      'LOG_READ_TIMEOUT'
    )

    await writeErrorLog({
      category: 'api',
      domain: 'admin-error-log',
      severity: 'info',
      source: 'GET /api/admin/error-log',
      operation: 'read_success',
      requestId,
      userId: user.id,
      message: 'Admin read error logs',
      metadata: {
        count: result.logs.length,
        partial: result.partial,
      },
    })

    return NextResponse.json({
      success: true,
      schemaVersion: 1,
      logs: result.logs.map(redactLogForAdmin),
      count: result.logs.length,
      partial: result.partial,
      degradedReason: result.degradedReason,
      requestId,
    })
  } catch (error) {
    await writeErrorLog({
      category: 'api',
      domain: 'admin-error-log',
      severity: 'error',
      source: 'GET /api/admin/error-log',
      operation: 'read',
      requestId,
      message: 'Error log query failed',
      error,
    })

    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to read error logs.', requestId)
  }
}

function redactLogForAdmin(entry: ErrorLogEntry & { userId?: string }) {
  const safeEntry: Record<string, unknown> = { ...entry }
  delete safeEntry.userId
  delete safeEntry.error

  return {
    ...safeEntry,
    error: entry.error
      ? {
          name: entry.error.name,
          message: entry.error.message,
          cause: entry.error.cause,
        }
      : undefined,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(reason)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
