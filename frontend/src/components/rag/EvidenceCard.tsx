// =============================================================================
// PRISM Writer - Evidence Card Component
// =============================================================================
// 파일: frontend/src/components/rag/EvidenceCard.tsx
// 역할: 인용 근거 표시 카드 컴포넌트 (Phase 4: Citation Gate UI)
// =============================================================================

'use client'

import type { JudgeEvidence, EvidenceQuality, EvidenceQualityGrade } from '@/types/rag'
import type { CitationVerifyResult } from '@/lib/rag/citationGate'

// =============================================================================
// 타입 정의
// =============================================================================

interface EvidenceCardProps {
  /** 근거 정보 (검증 결과 포함) */
  evidence: JudgeEvidence & { 
    verified: CitationVerifyResult
    quality?: EvidenceQuality 
  }
  /** 카드 인덱스 */
  index?: number
  /** 컴팩트 모드 */
  compact?: boolean
}

// =============================================================================
// 스타일 상수
// =============================================================================

const styles = {
  card: {
    base: 'rounded-lg border p-4 transition-all duration-200',
    valid: 'bg-green-50 border-green-200 hover:border-green-300',
    invalid: 'bg-amber-50 border-amber-200 hover:border-amber-300',
    compact: 'p-3',
  },
  header: {
    base: 'flex items-center gap-2 mb-2',
    icon: 'text-lg',
    label: 'text-sm font-medium',
    score: 'ml-auto text-xs px-2 py-0.5 rounded',
    scoreValid: 'bg-green-100 text-green-700',
    scoreInvalid: 'bg-amber-100 text-amber-700',
    qualityIndex: 'text-xs px-2 py-0.5 rounded font-mono',
    qualityHigh: 'bg-indigo-100 text-indigo-700',
    qualityMedium: 'bg-blue-100 text-blue-700',
    qualityLow: 'bg-gray-100 text-gray-700',
  },
  quote: {
    base: 'text-sm text-gray-700 italic border-l-2 pl-3 my-2',
    valid: 'border-green-400',
    invalid: 'border-amber-400',
  },
  meta: {
    base: 'flex gap-4 text-xs text-gray-500 mt-2',
  },
}

// =============================================================================
// 컴포넌트
// =============================================================================

/**
 * Evidence Card 컴포넌트
 * 
 * @description
 * Judge의 근거(인용문)를 표시하고 검증 상태를 시각적으로 구분합니다.
 * 
 * @example
 * ```tsx
 * <EvidenceCard 
 *   evidence={{ 
 *     chunkId: "chunk-1", 
 *     quote: "RAG는...", 
 *     relevance: 0.9,
 *     verified: { valid: true, matchScore: 1.0 }
 *   }} 
 * />
 * ```
 */
export function EvidenceCard({ evidence, index, compact = false }: EvidenceCardProps) {
  const isValid = evidence.verified.valid
  
  // ---------------------------------------------------------------------------
  // 스타일 계산
  // ---------------------------------------------------------------------------
  const cardClass = [
    styles.card.base,
    isValid ? styles.card.valid : styles.card.invalid,
    compact ? styles.card.compact : '',
  ].join(' ')
  
  const quoteClass = [
    styles.quote.base,
    isValid ? styles.quote.valid : styles.quote.invalid,
  ].join(' ')
  
  const scoreClass = [
    styles.header.score,
    isValid ? styles.header.scoreValid : styles.header.scoreInvalid,
  ].join(' ')

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  return (
    <div 
      className={cardClass}
      role="article"
      aria-label={`인용 근거 ${index !== undefined ? index + 1 : ''}: ${isValid ? '검증됨' : '검증 경고'}`}
    >
      {/* 헤더 */}
      <div className={styles.header.base}>
        <span className={styles.header.icon} aria-hidden="true">
          {isValid ? '✅' : '⚠️'}
        </span>
        <span className={styles.header.label}>
          {isValid ? '검증된 인용' : '검증 경고'}
        </span>
        {evidence.quality && (
          <span className={`${styles.header.qualityIndex} ${
            evidence.quality.grade === 'high' ? styles.header.qualityHigh :
            evidence.quality.grade === 'medium' ? styles.header.qualityMedium :
            styles.header.qualityLow
          }`}>
            {evidence.quality.grade.toUpperCase()}
          </span>
        )}
        <span className={scoreClass}>
          매칭 {Math.round(evidence.verified.matchScore * 100)}%
        </span>
      </div>

      {/* 인용문 */}
      <blockquote className={quoteClass}>
        "{evidence.quote}"
      </blockquote>

      {/* 메타 정보 */}
      {!compact && (
        <div className={styles.meta.base}>
          <span>청크: {evidence.chunkId}</span>
          <span>관련성: {Math.round(evidence.relevance * 100)}%</span>
          {evidence.verified.matchedChunkId && (
            <span>매칭 청크: {evidence.verified.matchedChunkId}</span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Evidence List 컴포넌트
 * 
 * @description
 * 여러 근거 카드를 리스트로 표시합니다.
 */
export function EvidenceList({ 
  evidence,
  compact = false,
}: { 
  evidence: Array<JudgeEvidence & { verified: CitationVerifyResult }>
  compact?: boolean
}) {
  if (evidence.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic p-4 text-center">
        근거가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-3" role="list" aria-label="인용 근거 목록">
      {evidence.map((ev, index) => (
        <EvidenceCard 
          key={ev.chunkId || index} 
          evidence={ev} 
          index={index}
          compact={compact}
        />
      ))}
    </div>
  )
}
