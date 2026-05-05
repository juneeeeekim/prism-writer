// =============================================================================
// PRISM Writer - Error Log Sanitization
// =============================================================================
// Logs are useful only if they are safe to keep. This sanitizer removes common
// secret-bearing fields and masks obvious credentials before anything is stored.
// =============================================================================

import type { SanitizedError } from './types'

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|pwd|token|secret|api[-_]?key|authorization|cookie|session|refresh|access[-_]?token|private[-_]?key)/i

const EMAIL_PATTERN = /([A-Z0-9._%+-])[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const KOREAN_RRN_PATTERN = /\b\d{6}[-\s]?[1-4]\d{6}\b/g
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g
const PHONE_PATTERN = /\b(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g

const MAX_STRING_LENGTH = 2000
const MAX_DEPTH = 6

export function sanitizeDomain(domain?: string): string {
  if (!domain) return 'general'

  const normalized = domain
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return normalized || 'general'
}

export function sanitizeForErrorLog(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[Truncated]'
  if (value === null || value === undefined) return value

  if (value instanceof Error) {
    return sanitizeError(value)
  }

  if (typeof value === 'string') {
    return maskString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForErrorLog(item, depth + 1))
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[REDACTED]'
        continue
      }

      output[key] = sanitizeForErrorLog(item, depth + 1)
    }

    return output
  }

  return String(value)
}

export function sanitizeError(error: unknown): SanitizedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: maskString(error.message),
      stack: error.stack ? maskString(error.stack) : undefined,
      cause: error.cause ? sanitizeForErrorLog(error.cause) : undefined,
    }
  }

  const sanitized = sanitizeForErrorLog(error)

  return {
    message: typeof sanitized === 'string' ? sanitized : safeStringify(sanitized),
  }
}

function maskString(value: string): string {
  const truncated =
    value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]` : value

  return truncated
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(EMAIL_PATTERN, '$1***$2')
    .replace(KOREAN_RRN_PATTERN, '[REDACTED_RRN]')
    .replace(CARD_PATTERN, '[REDACTED_CARD]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(LONG_SECRET_PATTERN, '[REDACTED]')
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
