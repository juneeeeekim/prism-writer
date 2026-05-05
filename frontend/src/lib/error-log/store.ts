// =============================================================================
// PRISM Writer - File-backed Error Log Store
// =============================================================================
// This store is deliberately best-effort. Logging must never block or break the
// user-facing operation that produced an error, especially on read-only hosts.
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { appendFile, mkdir, readFile, readdir } from 'fs/promises'
import path from 'path'
import {
  ERROR_LOG_CATEGORIES,
  type ErrorLogCategory,
  type ErrorLogEntry,
  type ErrorLogFilters,
  type ErrorLogInput,
  type ErrorLogSeverity,
} from './types'
import { sanitizeDomain, sanitizeError, sanitizeForErrorLog } from './sanitize'

const DEFAULT_WRITE_TIMEOUT_MS = 1000
const MAX_WRITE_TIMEOUT_MS = 10000

export function getErrorLogRoot(): string {
  return process.env.ERROR_LOG_ROOT || path.join(process.cwd(), 'error-log')
}

export function getErrorLogWriteTimeoutMs(): number {
  const parsed = Number(process.env.ERROR_LOG_WRITE_TIMEOUT_MS)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WRITE_TIMEOUT_MS

  return Math.min(parsed, MAX_WRITE_TIMEOUT_MS)
}

export function createErrorLogEntry(input: ErrorLogInput): ErrorLogEntry {
  const timestamp = new Date().toISOString()

  return {
    id: randomUUID(),
    timestamp,
    category: input.category,
    severity: input.severity,
    source: input.source,
    domain: sanitizeDomain(input.domain),
    operation: input.operation,
    requestId: input.requestId,
    userIdHash: hashUserId(input.userId),
    message: String(sanitizeForErrorLog(input.message)),
    error: input.error === undefined ? undefined : sanitizeError(input.error),
    metadata: input.metadata
      ? (sanitizeForErrorLog(input.metadata) as Record<string, unknown>)
      : undefined,
    sanitized: true,
  }
}

function hashUserId(userId?: string): string | undefined {
  if (!userId) return undefined

  return createHash('sha256').update(userId).digest('hex')
}

export async function writeErrorLog(input: ErrorLogInput): Promise<ErrorLogEntry | null> {
  try {
    const entry = createErrorLogEntry(input)
    await withTimeout(persistErrorLogEntry(entry), getErrorLogWriteTimeoutMs())

    return entry
  } catch (error) {
    console.warn('[ErrorLog] write failed; original flow preserved', error)
    return null
  }
}

async function persistErrorLogEntry(entry: ErrorLogEntry): Promise<void> {
  const filePath = getErrorLogFilePath(entry.category, entry.domain, entry.timestamp)

  await mkdir(path.dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
}

export async function readErrorLogs(filters: ErrorLogFilters): Promise<ErrorLogEntry[]> {
  const root = getErrorLogRoot()
  const categories = filters.category ? [filters.category] : [...ERROR_LOG_CATEGORIES]
  const logs: ErrorLogEntry[] = []

  for (const category of categories) {
    const categoryDir = path.join(root, category)
    const domains = filters.domain ? [sanitizeDomain(filters.domain)] : await safeReadDir(categoryDir)

    for (const domain of domains) {
      const domainDir = path.join(categoryDir, sanitizeDomain(domain))
      const files = (await safeReadDir(domainDir))
        .filter((file) => file.endsWith('.jsonl'))
        .sort()
        .reverse()

      for (const file of files) {
        const fileLogs = await readLogFile(path.join(domainDir, file), filters.severity)
        logs.push(...fileLogs)

        if (logs.length >= filters.limit * 2) break
      }
    }
  }

  return logs
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, filters.limit)
}

export async function readErrorLogsWithStatus(
  filters: ErrorLogFilters
): Promise<{ logs: ErrorLogEntry[]; partial: boolean; degradedReason?: string }> {
  try {
    const logs = await readErrorLogs(filters)
    return { logs, partial: false }
  } catch {
    return {
      logs: [],
      partial: true,
      degradedReason: 'FILE_STORE_UNAVAILABLE',
    }
  }
}

function getErrorLogFilePath(category: ErrorLogCategory, domain: string, timestamp: string): string {
  const day = timestamp.slice(0, 10)
  return path.join(getErrorLogRoot(), category, sanitizeDomain(domain), `${day}.jsonl`)
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir)
  } catch {
    return []
  }
}

async function readLogFile(
  filePath: string,
  severity?: ErrorLogSeverity
): Promise<ErrorLogEntry[]> {
  try {
    const content = await readFile(filePath, 'utf8')

    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ErrorLogEntry)
      .filter((entry) => !severity || entry.severity === severity)
  } catch {
    return []
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('ERROR_LOG_WRITE_TIMEOUT')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
