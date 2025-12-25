// =============================================================================
// PRISM Writer - Change Plan API (Pipeline v5)
// =============================================================================
// 파일: frontend/src/app/api/rag/change-plan/route.ts
// 역할: 패치 생성 및 Shadow Workspace 시뮬레이션 API
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// 이 API는 Pipeline v5의 핵심 기능입니다.
// 검색 + 평가 + 패치 생성 + 시뮬레이션을 병렬 처리하여 응답 시간 최적화.
// 목표: 평균 응답 시간 < 5초 (P95)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/config/featureFlags'
import { 
  getCachedCriteriaPack, 
  setCachedCriteriaPack,
  type CriteriaPack 
} from '@/lib/rag/cache/criteriaPackCache'
import type { 
  ChangePlan, 
  Patch, 
  GapItem, 
  AlignmentDelta,
  SimulationResult 
} from '@/lib/rag/types/patch'

// =============================================================================
// 타입 정의
// =============================================================================

interface ChangePlanRequest {
  /** 사용자 입력 텍스트 */
  userText: string
  /** 문서 ID */
  documentId: string
  /** 템플릿 ID (선택) */
  templateId?: string
  /** 최대 패치 수 (기본 3) */
  maxPatches?: number
  /** 특정 기준에 대한 패치만 생성 (선택) */
  targetCriteriaId?: string
}

interface ChangePlanResponse {
  success: boolean
  message?: string
  changePlan?: ChangePlan
  cacheHit?: boolean
  processingTimeMs?: number
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ChangePlanResponse>> {
  const startTime = Date.now()
  
  // ---------------------------------------------------------------------------
  // 1. Feature Flag 확인
  // ---------------------------------------------------------------------------
  if (!isFeatureEnabled('ENABLE_PIPELINE_V5')) {
    return NextResponse.json({
      success: false,
      message: 'Pipeline v5 is not enabled. Set ENABLE_PIPELINE_V5=true to use this API.',
    }, { status: 400 })
  }

  try {
    // -------------------------------------------------------------------------
    // 2. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized',
      }, { status: 401 })
    }

    // -------------------------------------------------------------------------
    // 3. 요청 파싱
    // -------------------------------------------------------------------------
    const body: ChangePlanRequest = await request.json()
    const { userText, documentId, templateId, maxPatches = 3, targetCriteriaId } = body

    if (!userText || userText.length < 10) {
      return NextResponse.json({
        success: false,
        message: 'User text must be at least 10 characters',
      }, { status: 400 })
    }

    if (!documentId) {
      return NextResponse.json({
        success: false,
        message: 'Document ID is required',
      }, { status: 400 })
    }

    // -------------------------------------------------------------------------
    // S (Security): 문서 소유권 검증 (RLS + API 레벨 이중 검증)
    // -------------------------------------------------------------------------
    // 주석(시니어 개발자): Supabase RLS가 기본 보호를 제공하지만,
    // API 레벨에서도 명시적으로 검증하여 보안을 강화합니다.
    // 이렇게 하면 RLS 정책 실수나 우회 시도를 방지할 수 있습니다.
    // -------------------------------------------------------------------------
    
    // documentId가 'new'나 'latest' 같은 특수값이 아닌 경우 소유권 검증
    const isSpecialDocumentId = ['new', 'latest', 'draft'].includes(documentId)
    
    if (!isSpecialDocumentId) {
      const { data: document, error: docError } = await supabase
        .from('rag_documents')
        .select('id, user_id')
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        return NextResponse.json({
          success: false,
          message: 'Document not found',
        }, { status: 404 })
      }

      // 문서 소유자 검증
      if (document.user_id !== user.id) {
        console.warn(`[Security] Unauthorized access attempt: User ${user.id} tried to access document ${documentId} owned by ${document.user_id}`)
        return NextResponse.json({
          success: false,
          message: 'You do not have permission to access this document',
        }, { status: 403 })
      }
    }

    // -------------------------------------------------------------------------
    // 4. 캐시 확인 (CriteriaPack)
    // -------------------------------------------------------------------------
    let criteriaPack = getCachedCriteriaPack(documentId, templateId)
    let cacheHit = !!criteriaPack

    // -------------------------------------------------------------------------
    // 5. 병렬 처리: 검색 + 평가
    // -------------------------------------------------------------------------
    // 주석(주니어 개발자): Promise.all로 병렬 실행하여 응답 시간 최적화
    
    if (!criteriaPack) {
      // 캐시 미스: 규칙과 예시를 병렬로 검색
      const [rulesResult, examplesResult] = await Promise.all([
        searchRulesParallel(supabase, user.id, userText),
        searchExamplesParallel(supabase, user.id, userText),
      ])

      criteriaPack = {
        rules: rulesResult,
        examples: examplesResult,
        pinnedIds: [],
        documentId,
        templateId: templateId || 'default',
      }

      // 캐시 저장
      setCachedCriteriaPack(documentId, criteriaPack, templateId)
    }

    // -------------------------------------------------------------------------
    // 6. Gap 분석 (Top 3 or Target)
    // -------------------------------------------------------------------------
    let gapTop3 = await analyzeGapTop3(userText, criteriaPack)

    // targetCriteriaId가 있으면 해당 기준만 필터링 (우선순위 최상위로)
    if (targetCriteriaId) {
      const targetGap = gapTop3.find(g => g.criteria_id === targetCriteriaId)
      if (targetGap) {
        gapTop3 = [targetGap]
      } else {
        // Gap 목록에 없으면 강제로 추가하거나 예외 처리 (여기서는 단순 경고)
        console.warn(`[ChangePlan] Target criteria ${targetCriteriaId} not found in gaps`)
      }
    }

    // -------------------------------------------------------------------------
    // 7. 패치 생성 (병렬)
    // -------------------------------------------------------------------------
    const patches = await generatePatchesParallel(
      userText, 
      gapTop3, 
      criteriaPack,
      maxPatches
    )

    // -------------------------------------------------------------------------
    // 8. Shadow Workspace 시뮬레이션 (병렬)
    // -------------------------------------------------------------------------
    const simulatedPatches = await Promise.all(
      patches.map(patch => simulatePatch(userText, patch))
    )

    // 시뮬레이션 결과로 패치 업데이트
    for (let i = 0; i < patches.length; i++) {
      patches[i].expectedDelta = simulatedPatches[i].alignmentDelta
    }

    // -------------------------------------------------------------------------
    // 9. Change Plan 구성
    // -------------------------------------------------------------------------
    const changePlan: ChangePlan = {
      patches,
      expectedAlignmentDelta: calculateOverallDelta(simulatedPatches),
      gapTop3,
      timestamp: new Date().toISOString(),
      documentId,
      templateId: templateId || 'default',
    }

    // -------------------------------------------------------------------------
    // 10. 응답 반환
    // -------------------------------------------------------------------------
    const processingTimeMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      changePlan,
      cacheHit,
      processingTimeMs,
    })

  } catch (error) {
    console.error('[ChangePlan API] Error:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * 규칙 검색 (병렬 처리용)
 */
async function searchRulesParallel(
  supabase: any,
  userId: string,
  query: string
): Promise<CriteriaPack['rules']> {
  // TODO: 실제 검색 로직 구현 (Phase 2)
  // 현재는 Mock 데이터 반환
  return [
    { id: 'rule-1', content: 'Sample rule 1', score: 0.9 },
    { id: 'rule-2', content: 'Sample rule 2', score: 0.85 },
  ]
}

/**
 * 예시 검색 (병렬 처리용)
 */
async function searchExamplesParallel(
  supabase: any,
  userId: string,
  query: string
): Promise<CriteriaPack['examples']> {
  // TODO: 실제 검색 로직 구현 (Phase 2)
  // 현재는 Mock 데이터 반환
  return [
    { id: 'example-1', content: 'Sample example 1', score: 0.88 },
    { id: 'example-2', content: 'Sample example 2', score: 0.82 },
  ]
}

/**
 * Gap Top 3 분석
 */
async function analyzeGapTop3(
  userText: string,
  criteriaPack: CriteriaPack
): Promise<GapItem[]> {
  // TODO: 실제 Gap 분석 로직 구현 (Phase 3)
  // 현재는 Mock 데이터 반환
  return [
    {
      criteria_id: 'criteria-1',
      criteria_name: '논리적 흐름',
      current_score: 65,
      target_score: 85,
      priority: 1,
    },
    {
      criteria_id: 'criteria-2',
      criteria_name: '근거 제시',
      current_score: 55,
      target_score: 80,
      priority: 2,
    },
    {
      criteria_id: 'criteria-3',
      criteria_name: '문장 간결성',
      current_score: 70,
      target_score: 85,
      priority: 3,
    },
  ]
}

/**
 * 패치 생성 (병렬)
 */
async function generatePatchesParallel(
  userText: string,
  gaps: GapItem[],
  criteriaPack: CriteriaPack,
  maxPatches: number
): Promise<Patch[]> {
  // TODO: 실제 LLM 기반 패치 생성 (Phase 3)
  // 현재는 Mock 데이터 반환
  const patches: Patch[] = gaps.slice(0, maxPatches).map((gap, index) => ({
    id: `patch-${index + 1}`,
    type: 'Replace' as const,
    targetRange: { start: 0, end: 10 },
    before: userText.substring(0, 10),
    after: `[Improved: ${gap.criteria_name}]`,
    reason: `${gap.criteria_name} 개선을 위한 수정`,
    citationId: criteriaPack.rules[0]?.id || 'unknown',
    expectedDelta: [],
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  }))

  return patches
}

/**
 * 패치 시뮬레이션
 */
async function simulatePatch(
  originalText: string,
  patch: Patch
): Promise<SimulationResult> {
  // TODO: 실제 Shadow Workspace 시뮬레이션 (Phase 1)
  // 현재는 Mock 데이터 반환
  return {
    patchId: patch.id,
    success: true,
    previewText: originalText.substring(0, 200),
    alignmentDelta: [
      {
        criteria_id: 'criteria-1',
        before_score: 65,
        after_score: 75,
        delta: 10,
      },
    ],
    overallScoreDelta: 10,
    simulatedAt: new Date().toISOString(),
  }
}

/**
 * 전체 부합도 변화 계산
 */
function calculateOverallDelta(
  simulations: SimulationResult[]
): AlignmentDelta[] {
  // 모든 시뮬레이션 결과의 delta 합산
  const deltaMap = new Map<string, AlignmentDelta>()

  for (const sim of simulations) {
    for (const delta of sim.alignmentDelta) {
      const existing = deltaMap.get(delta.criteria_id)
      if (existing) {
        existing.delta += delta.delta
        existing.after_score = delta.after_score
      } else {
        deltaMap.set(delta.criteria_id, { ...delta })
      }
    }
  }

  return Array.from(deltaMap.values())
}
