// =============================================================================
// PRISM Writer - Error Log Contract
// =============================================================================
// The error-log module is intentionally small and file-store backed so logging
// can fail independently from the product flow that triggered it.
// =============================================================================

export const ERROR_LOG_CATEGORIES = ['api', 'ui', 'db', 'external', 'payment'] as const
export const ERROR_LOG_SEVERITIES = ['debug', 'info', 'warn', 'error', 'fatal'] as const

export type ErrorLogCategory = (typeof ERROR_LOG_CATEGORIES)[number]
export type ErrorLogSeverity = (typeof ERROR_LOG_SEVERITIES)[number]

export interface ErrorLogInput {
  category: ErrorLogCategory
  severity: ErrorLogSeverity
  message: string
  source: string
  domain?: string
  operation?: string
  requestId?: string
  userId?: string
  error?: unknown
  metadata?: Record<string, unknown>
}

export interface ErrorLogEntry {
  id: string
  timestamp: string
  category: ErrorLogCategory
  severity: ErrorLogSeverity
  source: string
  domain: string
  operation?: string
  requestId?: string
  userIdHash?: string
  message: string
  error?: SanitizedError
  metadata?: Record<string, unknown>
  sanitized: true
}

export interface SanitizedError {
  name?: string
  message: string
  stack?: string
  cause?: unknown
}

export interface ErrorLogFilters {
  category?: ErrorLogCategory
  domain?: string
  severity?: ErrorLogSeverity
  limit: number
}
