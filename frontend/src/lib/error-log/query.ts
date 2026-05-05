// =============================================================================
// PRISM Writer - Error Log Query Parsing
// =============================================================================
// Query parsing is kept outside the route so the API contract can be tested
// without mocking Next.js request objects.
// =============================================================================

import {
  ERROR_LOG_CATEGORIES,
  ERROR_LOG_SEVERITIES,
  type ErrorLogCategory,
  type ErrorLogFilters,
  type ErrorLogSeverity,
} from './types'
import { sanitizeDomain } from './sanitize'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export type ErrorLogQueryResult =
  | { ok: true; filters: ErrorLogFilters }
  | { ok: false; code: string; message: string }

export function parseErrorLogQuery(searchParams: URLSearchParams): ErrorLogQueryResult {
  const categoryParam = searchParams.get('category') || undefined
  const severityParam = searchParams.get('severity') || undefined
  const domain = searchParams.get('domain') || undefined
  const limitValue = searchParams.get('limit')

  if (categoryParam && !isErrorLogCategory(categoryParam)) {
    return {
      ok: false,
      code: 'INVALID_CATEGORY',
      message: 'category must be one of api, ui, db, external, payment',
    }
  }

  if (severityParam && !isErrorLogSeverity(severityParam)) {
    return {
      ok: false,
      code: 'INVALID_SEVERITY',
      message: 'severity must be one of debug, info, warn, error, fatal',
    }
  }

  const category: ErrorLogCategory | undefined =
    categoryParam && isErrorLogCategory(categoryParam) ? categoryParam : undefined
  const severity: ErrorLogSeverity | undefined =
    severityParam && isErrorLogSeverity(severityParam) ? severityParam : undefined

  const limit = parseLimit(limitValue)
  if (!limit) {
    return {
      ok: false,
      code: 'INVALID_LIMIT',
      message: 'limit must be a number between 1 and 100',
    }
  }

  return {
    ok: true,
    filters: {
      category,
      severity,
      domain: domain ? sanitizeDomain(domain) : undefined,
      limit,
    },
  }
}

function isErrorLogCategory(value: string): value is ErrorLogCategory {
  return (ERROR_LOG_CATEGORIES as readonly string[]).includes(value)
}

function isErrorLogSeverity(value: string): value is ErrorLogSeverity {
  return (ERROR_LOG_SEVERITIES as readonly string[]).includes(value)
}

function parseLimit(value: string | null): number | null {
  if (!value) return DEFAULT_LIMIT

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    return null
  }

  return parsed
}
