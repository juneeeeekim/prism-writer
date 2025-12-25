// =============================================================================
// PRISM Writer - Patch Gates (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/rag/patchGates.ts
// 역할: 패치 시스템용 게이트 (Diff Safety, Upgrade Effect) + 통합 함수
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 기존 3종 Gate와 신규 2종 Gate를 통합하는 Wrapper 패턴
// JeDebug 분석 결과: 타입 충돌 방지를 위해 unifyGateResults() 구현
// =============================================================================

import type { GateResult, AllGatesResult } from './templateGates'
import type { Patch, SimulationResult } from './types/patch'
import { isFeatureEnabled } from '@/config/featureFlags'

// =============================================================================
// 신규 Gate 타입 정의 (Pipeline v5)
// =============================================================================

/**
 * Patch 전용 Gate 결과
 * 기존 GateResult를 확장하여 patch 관련 메타데이터 추가
 */
export interface PatchGateResult extends GateResult {
  /** 관련 패치 ID (해당 시) */
  patchId?: string
  /** Gate 유형 */
  gateType: 'diffSafety' | 'upgradeEffect' | 'citation' | 'consistency' | 'hallucination' | 'regression'
}

/**
 * 모든 게이트 결과 통합 (v5 확장)
 * 기존 AllGatesResult를 확장하여 신규 Gate 추가
 */
export interface AllPatchGatesResult extends AllGatesResult {
  /** Pipeline v5: Diff Safety Gate 결과 (수정량 상한 검증) */
  diffSafetyResult?: PatchGateResult
  /** Pipeline v5: Upgrade Effect Gate 결과 (개선 효과 검증) */
  upgradeEffectResult?: PatchGateResult
  /** 전체 Gate 목록 (통합 접근용) */
  allGates: PatchGateResult[]
  /** Pipeline 버전 */
  pipelineVersion: 'v3' | 'v4' | 'v5'
}

// =============================================================================
// Diff Safety Gate: 수정량 상한 검증
// =============================================================================

/** Diff Safety 설정 */
export interface DiffSafetyConfig {
  /** 최대 변경 비율 (0.0 ~ 1.0, 기본 0.2 = 20%) */
  maxChangeRatio: number
  /** 경고 임계값 (0.0 ~ 1.0, 기본 0.15 = 15%) */
  warningThreshold: number
}

const DEFAULT_DIFF_SAFETY_CONFIG: DiffSafetyConfig = {
  maxChangeRatio: 0.2,
  warningThreshold: 0.15,
}

/**
 * Diff Safety Gate: 수정량 상한 검증
 * 
 * @description
 * 패치가 원본 글의 일정 비율(기본 20%) 이상을 변경하면 경고
 * "내 글을 망치지 않는 선"을 기술적으로 강제
 * 
 * @param originalText - 원본 텍스트
 * @param patchedText - 패치 적용 후 텍스트
 * @param config - Diff Safety 설정
 * @returns Gate 결과
 */
export function validateDiffSafetyGate(
  originalText: string,
  patchedText: string,
  config: DiffSafetyConfig = DEFAULT_DIFF_SAFETY_CONFIG
): PatchGateResult {
  // ---------------------------------------------------------------------------
  // 변경량 계산 (간단한 Levenshtein 근사)
  // ---------------------------------------------------------------------------
  const originalLength = originalText.length
  const patchedLength = patchedText.length
  
  // 길이 변화 비율 계산 (간단 근사)
  const lengthDiff = Math.abs(patchedLength - originalLength)
  const maxLength = Math.max(originalLength, patchedLength)
  
  // 문자 단위 변경 비율 (더 정확한 계산은 diff 라이브러리 사용 권장)
  let changedChars = 0
  const minLength = Math.min(originalLength, patchedLength)
  for (let i = 0; i < minLength; i++) {
    if (originalText[i] !== patchedText[i]) {
      changedChars++
    }
  }
  changedChars += lengthDiff
  
  const changeRatio = maxLength > 0 ? changedChars / maxLength : 0
  
  // ---------------------------------------------------------------------------
  // Gate 판정
  // ---------------------------------------------------------------------------
  if (changeRatio > config.maxChangeRatio) {
    return {
      passed: false,
      reason: `변경량이 ${(changeRatio * 100).toFixed(1)}%로 상한(${config.maxChangeRatio * 100}%)을 초과했습니다.`,
      score: Math.max(0, 1 - changeRatio),
      gateType: 'diffSafety',
    }
  }
  
  if (changeRatio > config.warningThreshold) {
    return {
      passed: true,
      reason: `변경량 ${(changeRatio * 100).toFixed(1)}% (경고 수준이지만 허용됨)`,
      score: 1 - (changeRatio / config.maxChangeRatio) * 0.3, // 경고 시 점수 감점
      gateType: 'diffSafety',
    }
  }
  
  return {
    passed: true,
    reason: `변경량 ${(changeRatio * 100).toFixed(1)}% (안전 범위)`,
    score: 1.0,
    gateType: 'diffSafety',
  }
}

// =============================================================================
// Upgrade Effect Gate: 개선 효과 검증
// =============================================================================

/**
 * Upgrade Effect Gate: 패치 적용 시 부합도 개선 효과 검증
 * 
 * @description
 * 패치 적용 후 부합도가 개선되지 않으면 "효과 없음" 표시
 * 권장안에서 제외될 수 있음
 * 
 * @param patch - 패치 정보
 * @param simulation - 시뮬레이션 결과
 * @returns Gate 결과
 */
export function validateUpgradeEffectGate(
  patch: Patch,
  simulation: SimulationResult
): PatchGateResult {
  // ---------------------------------------------------------------------------
  // 개선 효과 계산
  // ---------------------------------------------------------------------------
  const totalDelta = simulation.overallScoreDelta
  
  // 개선이 없거나 악화된 경우
  if (totalDelta <= 0) {
    return {
      passed: false,
      reason: `패치 적용 시 점수 변화: ${totalDelta > 0 ? '+' : ''}${totalDelta.toFixed(1)}점 (개선 효과 없음)`,
      score: 0,
      patchId: patch.id,
      gateType: 'upgradeEffect',
    }
  }
  
  // 미미한 개선 (1점 미만)
  if (totalDelta < 1) {
    return {
      passed: true,
      reason: `패치 적용 시 +${totalDelta.toFixed(1)}점 개선 (미미함)`,
      score: 0.5 + (totalDelta * 0.5), // 0.5 ~ 1.0
      patchId: patch.id,
      gateType: 'upgradeEffect',
    }
  }
  
  // 유의미한 개선
  return {
    passed: true,
    reason: `패치 적용 시 +${totalDelta.toFixed(1)}점 개선`,
    score: Math.min(1.0, 0.7 + (totalDelta * 0.1)), // 0.8 ~ 1.0
    patchId: patch.id,
    gateType: 'upgradeEffect',
  }
}

// =============================================================================
// 통합 Wrapper 함수: unifyGateResults()
// =============================================================================

/**
 * 기존 Gate 결과를 PatchGateResult 형태로 변환
 * 
 * @param result - 기존 GateResult
 * @param gateType - Gate 유형
 * @returns 통합된 PatchGateResult
 */
export function convertToPatchGateResult(
  result: GateResult,
  gateType: PatchGateResult['gateType']
): PatchGateResult {
  return {
    ...result,
    gateType,
  }
}

/**
 * 모든 Gate 결과를 통합 (Wrapper Pattern)
 * 
 * @description
 * 기존 3종 Gate (Citation, Consistency, Hallucination)와
 * 신규 2종 Gate (Diff Safety, Upgrade Effect)를 통합합니다.
 * Pipeline 버전에 따라 적절한 Gate만 포함합니다.
 * 
 * @param legacyResults - 기존 AllGatesResult
 * @param diffSafetyResult - Diff Safety Gate 결과 (v5)
 * @param upgradeEffectResult - Upgrade Effect Gate 결과 (v5)
 * @returns 통합된 AllPatchGatesResult
 */
export function unifyGateResults(
  legacyResults: AllGatesResult,
  diffSafetyResult?: PatchGateResult,
  upgradeEffectResult?: PatchGateResult
): AllPatchGatesResult {
  // ---------------------------------------------------------------------------
  // 기존 Gate 결과를 PatchGateResult로 변환
  // ---------------------------------------------------------------------------
  const allGates: PatchGateResult[] = [
    convertToPatchGateResult(legacyResults.citationResult, 'citation'),
    convertToPatchGateResult(legacyResults.consistencyResult, 'consistency'),
    convertToPatchGateResult(legacyResults.hallucinationResult, 'hallucination'),
  ]
  
  // Regression Gate (v4)
  if (legacyResults.regressionResult) {
    allGates.push(convertToPatchGateResult(legacyResults.regressionResult, 'regression'))
  }
  
  // Pipeline 버전 결정
  let pipelineVersion: 'v3' | 'v4' | 'v5' = 'v3'
  if (legacyResults.regressionResult) {
    pipelineVersion = 'v4'
  }
  
  // ---------------------------------------------------------------------------
  // 신규 Gate 추가 (v5)
  // ---------------------------------------------------------------------------
  if (diffSafetyResult) {
    allGates.push(diffSafetyResult)
    pipelineVersion = 'v5'
  }
  
  if (upgradeEffectResult) {
    allGates.push(upgradeEffectResult)
    pipelineVersion = 'v5'
  }
  
  // ---------------------------------------------------------------------------
  // 전체 통과 여부 계산
  // ---------------------------------------------------------------------------
  const allPassed = allGates.every(gate => gate.passed)
  
  // ---------------------------------------------------------------------------
  // 최종 점수 계산 (가중 평균)
  // ---------------------------------------------------------------------------
  const weights = {
    citation: 1.0,
    consistency: 1.0,
    hallucination: 1.2, // Hallucination은 더 중요
    regression: 0.8,
    diffSafety: 1.0,
    upgradeEffect: 0.8,
  }
  
  let totalWeight = 0
  let weightedSum = 0
  for (const gate of allGates) {
    const weight = weights[gate.gateType] || 1.0
    totalWeight += weight
    weightedSum += gate.score * weight
  }
  
  const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0
  
  // ---------------------------------------------------------------------------
  // 결과 반환
  // ---------------------------------------------------------------------------
  return {
    ...legacyResults,
    passed: allPassed,
    finalScore,
    diffSafetyResult,
    upgradeEffectResult,
    allGates,
    pipelineVersion,
  }
}

/**
 * Feature Flag 기반으로 적절한 Gate 실행
 * 
 * @description
 * Pipeline 버전에 따라 필요한 Gate만 실행합니다.
 * v3: Citation, Consistency, Hallucination
 * v4: + Regression
 * v5: + Diff Safety, Upgrade Effect
 * 
 * @param legacyResults - 기존 Gate 결과
 * @param patchContext - 패치 컨텍스트 (v5용)
 * @returns 통합된 Gate 결과
 */
export async function validateAllPatchGates(
  legacyResults: AllGatesResult,
  patchContext?: {
    originalText: string
    patchedText: string
    patch: Patch
    simulation: SimulationResult
  }
): Promise<AllPatchGatesResult> {
  // v5 기능이 비활성화되어 있으면 기존 결과만 반환
  if (!isFeatureEnabled('ENABLE_PIPELINE_V5') || !patchContext) {
    return unifyGateResults(legacyResults)
  }
  
  // v5: Diff Safety Gate 실행
  const diffSafetyResult = validateDiffSafetyGate(
    patchContext.originalText,
    patchContext.patchedText
  )
  
  // v5: Upgrade Effect Gate 실행
  const upgradeEffectResult = validateUpgradeEffectGate(
    patchContext.patch,
    patchContext.simulation
  )
  
  return unifyGateResults(legacyResults, diffSafetyResult, upgradeEffectResult)
}
