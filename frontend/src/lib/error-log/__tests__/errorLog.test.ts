import { mkdtemp, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createErrorLogEntry,
  getErrorLogWriteTimeoutMs,
  parseErrorLogQuery,
  readErrorLogs,
  sanitizeDomain,
  sanitizeForErrorLog,
  writeErrorLog,
} from '..'

let tempRoot: string

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prism-error-log-'))
  process.env.ERROR_LOG_ROOT = tempRoot
})

afterEach(async () => {
  delete process.env.ERROR_LOG_ROOT
  await rm(tempRoot, { recursive: true, force: true })
})

describe('error-log sanitization', () => {
  it('masks sensitive keys and obvious credentials', () => {
    const sanitized = sanitizeForErrorLog({
      email: 'writer@example.com',
      authorization: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890',
      nested: {
        apiKey: 'secret-value',
        message: 'token abcdefghijklmnopqrstuvwxyz1234567890',
      },
    })

    expect(sanitized).toEqual({
      email: 'w***@example.com',
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        message: 'token [REDACTED]',
      },
    })
  })

  it('masks direct personal identifiers in free text', () => {
    const sanitized = sanitizeForErrorLog(
      'phone 010-1234-5678 card 4111 1111 1111 1111 rrn 900101-1234567'
    )

    expect(sanitized).toContain('[REDACTED_PHONE]')
    expect(sanitized).toContain('[REDACTED_CARD]')
    expect(sanitized).toContain('[REDACTED_RRN]')
  })

  it('normalizes domains for folder-safe storage', () => {
    expect(sanitizeDomain('RAG Search / RPC')).toBe('rag-search-rpc')
    expect(sanitizeDomain('')).toBe('general')
  })
})

describe('error-log store', () => {
  it('writes and reads structured jsonl entries', async () => {
    const entry = await writeErrorLog({
      category: 'api',
      domain: 'rag-search',
      severity: 'error',
      source: 'POST /api/rag/search',
      operation: 'rpc',
      requestId: 'req-123',
      userId: 'user-123',
      message: 'Vector search failed',
      error: new Error('RPC failed with token abcdefghijklmnopqrstuvwxyz1234567890'),
      metadata: { projectId: 'project-123' },
    })

    expect(entry).not.toBeNull()

    const logs = await readErrorLogs({
      category: 'api',
      domain: 'rag-search',
      severity: 'error',
      limit: 10,
    })

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      category: 'api',
      domain: 'rag-search',
      severity: 'error',
      source: 'POST /api/rag/search',
      requestId: 'req-123',
      sanitized: true,
    })
    expect(logs[0]).not.toHaveProperty('userId')
    expect(logs[0].userIdHash).toHaveLength(64)
    expect(logs[0].error?.message).toContain('[REDACTED]')
  })

  it('does not throw when the file store cannot be written', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const blockedPath = path.join(tempRoot, 'not-a-directory')
    await writeFile(blockedPath, 'blocked')
    process.env.ERROR_LOG_ROOT = blockedPath

    try {
      await expect(
        writeErrorLog({
          category: 'api',
          severity: 'error',
          source: 'test',
          message: 'should be swallowed',
        })
      ).resolves.toBeNull()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('keeps write timeout bounded for storage resilience', () => {
    try {
      process.env.ERROR_LOG_WRITE_TIMEOUT_MS = '25000'
      expect(getErrorLogWriteTimeoutMs()).toBe(10000)

      process.env.ERROR_LOG_WRITE_TIMEOUT_MS = '0'
      expect(getErrorLogWriteTimeoutMs()).toBe(1000)
    } finally {
      delete process.env.ERROR_LOG_WRITE_TIMEOUT_MS
    }
  })

  it('creates entries without storing raw unknown errors', () => {
    const entry = createErrorLogEntry({
      category: 'external',
      severity: 'warn',
      source: 'provider',
      message: 'Provider failed',
      error: { token: 'secret-token', status: 429 },
    })

    expect(entry.error?.message).toContain('status')
    expect(entry.error?.message).toContain('[REDACTED]')
  })
})

describe('error-log API query contract', () => {
  it('parses valid filters', () => {
    const parsed = parseErrorLogQuery(
      new URLSearchParams('category=api&domain=RAG Search&severity=error&limit=25')
    )

    expect(parsed).toEqual({
      ok: true,
      filters: {
        category: 'api',
        domain: 'rag-search',
        severity: 'error',
        limit: 25,
      },
    })
  })

  it('rejects invalid filters before reading logs', () => {
    expect(parseErrorLogQuery(new URLSearchParams('category=unknown'))).toMatchObject({
      ok: false,
      code: 'INVALID_CATEGORY',
    })
    expect(parseErrorLogQuery(new URLSearchParams('limit=500'))).toMatchObject({
      ok: false,
      code: 'INVALID_LIMIT',
    })
  })
})
