// =============================================================================
// PRISM Writer - Structured Logger Utility (P-A04-01)
// =============================================================================
// 파일: frontend/src/lib/utils/logger.ts
// 역할: 구조화된 로깅 유틸리티 - 개발/운영 환경별 출력 형식 지원
// 작성일: 2026-01-04
// Phase: A - Quick Wins (DX 개선)
// =============================================================================

// =============================================================================
// [P-A04-01] 타입 정의
// =============================================================================

/** 로그 레벨 타입 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** 로그 엔트리 구조 */
export interface LogEntry {
  /** 로그 레벨 */
  level: LogLevel
  /** 로그 메시지 */
  message: string
  /** 컨텍스트 (예: '[SmartSearchTab]', '[vectorSearch]') */
  context?: string
  /** 추가 데이터 */
  data?: Record<string, unknown>
  /** 타임스탬프 (ISO 8601) */
  timestamp: string
  /** 요청 ID (선택적, 추적용) */
  requestId?: string
}

// =============================================================================
// [P-A04-01] 로그 레벨 설정
// =============================================================================

/** 로그 레벨 우선순위 (숫자가 높을수록 중요) */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * 최소 로그 레벨
 * - production: 'info' (debug 로그 필터링)
 * - development: 'debug' (모든 로그 출력)
 */
const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

// =============================================================================
// [P-A04-01] 헬퍼 함수
// =============================================================================

/**
 * 해당 로그 레벨을 출력해야 하는지 판단
 *
 * @param level - 확인할 로그 레벨
 * @returns 출력 여부
 *
 * @example
 * // production 환경에서
 * shouldLog('debug') // false - debug는 production에서 출력 안함
 * shouldLog('info')  // true
 * shouldLog('error') // true
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

/**
 * 현재 타임스탬프 생성 (ISO 8601 형식)
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

// =============================================================================
// [P-A04-01] 메인 로그 함수
// =============================================================================

/**
 * 구조화된 로그 출력
 *
 * @description
 * 환경에 따라 다른 형식으로 로그를 출력합니다:
 * - Production: JSON 형식 (로그 수집/분석 도구 호환)
 * - Development: 가독성 있는 형식 (개발 편의)
 *
 * @param level - 로그 레벨
 * @param context - 컨텍스트 (호출 위치, 예: '[SmartSearchTab]')
 * @param message - 로그 메시지
 * @param data - 추가 데이터 (선택적)
 *
 * @example
 * // 기본 사용
 * log('info', '[SearchTab]', '검색 시작', { query: '테스트' })
 *
 * // Development 출력:
 * // 2026-01-04T12:00:00.000Z [INFO] [SearchTab] 검색 시작 { query: '테스트' }
 *
 * // Production 출력:
 * // {"level":"info","context":"[SearchTab]","message":"검색 시작","data":{"query":"테스트"},"timestamp":"2026-01-04T12:00:00.000Z"}
 */
export function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>
): void {
  // 최소 레벨 미만이면 출력하지 않음
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    context,
    message,
    data,
    timestamp: getTimestamp(),
  }

  // -------------------------------------------------------------------------
  // [P-A04-01] 환경별 출력 형식
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    // Production: JSON 형식 (로그 수집 도구 호환)
    // error 레벨은 console.error, 나머지는 console.log
    const output = JSON.stringify(entry)
    if (level === 'error') {
      console.error(output)
    } else {
      console.log(output)
    }
  } else {
    // Development: 가독성 있는 형식
    const prefix = `${entry.timestamp} [${level.toUpperCase()}] ${context}`
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'

    if (data && Object.keys(data).length > 0) {
      console[consoleMethod](prefix, message, data)
    } else {
      console[consoleMethod](prefix, message)
    }
  }
}

// =============================================================================
// [P-A04-01] 편의 함수 (logger 객체)
// =============================================================================

/**
 * 구조화된 로거 객체
 *
 * @description
 * 로그 레벨별 편의 함수를 제공합니다.
 *
 * @example
 * import { logger } from '@/lib/utils/logger'
 *
 * // 정보성 로그
 * logger.info('[API]', '요청 시작', { endpoint: '/api/search' })
 *
 * // 경고 로그
 * logger.warn('[Cache]', '캐시 만료 임박', { ttl: 60 })
 *
 * // 에러 로그
 * logger.error('[Auth]', '인증 실패', { userId: '123', reason: 'token_expired' })
 *
 * // 디버그 로그 (production에서 출력 안됨)
 * logger.debug('[Search]', '벡터 검색 결과', { count: 10 })
 */
export const logger = {
  /**
   * 정보성 로그 (INFO)
   * 일반적인 작업 흐름 기록
   */
  info: (context: string, message: string, data?: Record<string, unknown>): void => {
    log('info', context, message, data)
  },

  /**
   * 경고 로그 (WARN)
   * 잠재적 문제 또는 주의 필요 상황
   */
  warn: (context: string, message: string, data?: Record<string, unknown>): void => {
    log('warn', context, message, data)
  },

  /**
   * 에러 로그 (ERROR)
   * 오류 상황 기록
   */
  error: (context: string, message: string, data?: Record<string, unknown>): void => {
    log('error', context, message, data)
  },

  /**
   * 디버그 로그 (DEBUG)
   * 상세 디버깅 정보 (production에서 자동 필터링)
   */
  debug: (context: string, message: string, data?: Record<string, unknown>): void => {
    log('debug', context, message, data)
  },
}

// =============================================================================
// Default Export
// =============================================================================

export default logger
