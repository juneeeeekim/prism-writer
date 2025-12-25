// =============================================================================
// PRISM Writer - Patch Service (Pipeline v5)
// =============================================================================
// 파일: frontend/src/lib/rag/services/patchService.ts
// 역할: 패치 생성 비즈니스 로직 (Clean Architecture)
// 생성일: 2025-12-25
//
// 주석(시니어 개발자): 
// API Route에서 비즈니스 로직을 분리하여 단위 테스트가 가능하도록 합니다.
// 이 서비스 클래스는 프레임워크에 독립적입니다.
//
// 주석(주니어 개발자):
// Clean Architecture 원칙: 의존성은 외부에서 주입받습니다.
// - DB 접근은 Repository 패턴으로 추상화
// - LLM 호출은 인터페이스로 추상화
// =============================================================================

import type { 
  Patch, 
  ChangePlan, 
  GapItem, 
  AlignmentDelta,
  SimulationResult 
} from '@/lib/rag/types/patch'
import type { CriteriaPack } from '@/lib/rag/cache/criteriaPackCache'

// =============================================================================
// 의존성 인터페이스 (Dependency Injection)
// =============================================================================

/**
 * 검색 서비스 인터페이스
 */
export interface ISearchService {
  searchRules(query: string, userId: string, topK?: number): Promise<SearchResult[]>
  searchExamples(query: string, userId: string, topK?: number): Promise<SearchResult[]>
}

/**
 * LLM 서비스 인터페이스
 */
export interface ILLMService {
  generatePatch(userText: string, gap: GapItem, context: string): Promise<Patch>
  simulatePatch(originalText: string, patch: Patch): Promise<SimulationResult>
}

/**
 * 검색 결과
 */
export interface SearchResult {
  id: string
  content: string
  score: number
}

/**
 * 패치 서비스 옵션
 */
export interface PatchServiceOptions {
  /** 최대 패치 수 */
  maxPatches?: number
  /** 최소 점수 (0-100) */
  minScoreThreshold?: number
}

// =============================================================================
// PatchService 클래스
// =============================================================================

/**
 * 패치 생성 서비스 (Clean Architecture)
 * 
 * @description
 * 비즈니스 로직을 API Route에서 분리하여 테스트 가능하게 합니다.
 * 의존성 주입(DI)을 통해 외부 서비스(검색, LLM)를 교체할 수 있습니다.
 * 
 * @example
 * ```typescript
 * // 프로덕션
 * const service = new PatchService(realSearchService, realLLMService)
 * 
 * // 테스트
 * const service = new PatchService(mockSearchService, mockLLMService)
 * 
 * const changePlan = await service.generateChangePlan(userText, userId, {
 *   maxPatches: 3,
 * })
 * ```
 */
export class PatchService {
  // ---------------------------------------------------------------------------
  // 의존성
  // ---------------------------------------------------------------------------
  private searchService: ISearchService
  private llmService: ILLMService
  private options: Required<PatchServiceOptions>

  // ---------------------------------------------------------------------------
  // 기본값
  // ---------------------------------------------------------------------------
  private static readonly DEFAULT_OPTIONS: Required<PatchServiceOptions> = {
    maxPatches: 3,
    minScoreThreshold: 50,
  }

  // ---------------------------------------------------------------------------
  // 생성자 (의존성 주입)
  // ---------------------------------------------------------------------------
  constructor(
    searchService: ISearchService,
    llmService: ILLMService,
    options?: PatchServiceOptions
  ) {
    this.searchService = searchService
    this.llmService = llmService
    this.options = { ...PatchService.DEFAULT_OPTIONS, ...options }
  }

  // ---------------------------------------------------------------------------
  // 메인 API: Change Plan 생성
  // ---------------------------------------------------------------------------
  
  /**
   * 사용자 글에 대한 Change Plan 생성
   * 
   * @param userText - 사용자 글
   * @param userId - 사용자 ID
   * @param documentId - 문서 ID
   * @param templateId - 템플릿 ID (optional)
   * @returns Change Plan (패치 목록 + 예상 개선 효과)
   */
  async generateChangePlan(
    userText: string,
    userId: string,
    documentId: string,
    templateId?: string
  ): Promise<ChangePlan> {
    // -------------------------------------------------------------------------
    // Step 1: CriteriaPack 구축 (규칙 + 예시 검색)
    // -------------------------------------------------------------------------
    const criteriaPack = await this.buildCriteriaPack(userText, userId)

    // -------------------------------------------------------------------------
    // Step 2: Gap 분석 (Top 3)
    // -------------------------------------------------------------------------
    const gapTop3 = await this.analyzeGaps(userText, criteriaPack)

    // -------------------------------------------------------------------------
    // Step 3: 패치 생성
    // -------------------------------------------------------------------------
    const patches = await this.generatePatches(userText, gapTop3, criteriaPack)

    // -------------------------------------------------------------------------
    // Step 4: 패치 시뮬레이션
    // -------------------------------------------------------------------------
    const simulatedPatches = await this.simulatePatches(userText, patches)

    // -------------------------------------------------------------------------
    // Step 5: 전체 개선 효과 계산
    // -------------------------------------------------------------------------
    const expectedDelta = this.calculateOverallDelta(simulatedPatches)

    // -------------------------------------------------------------------------
    // Step 6: Change Plan 반환
    // -------------------------------------------------------------------------
    return {
      patches,
      expectedAlignmentDelta: expectedDelta,
      gapTop3,
      timestamp: new Date().toISOString(),
      documentId,
      templateId: templateId || 'default',
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1: CriteriaPack 구축
  // ---------------------------------------------------------------------------
  
  private async buildCriteriaPack(
    query: string,
    userId: string
  ): Promise<CriteriaPack> {
    // 병렬로 규칙과 예시 검색
    const [rules, examples] = await Promise.all([
      this.searchService.searchRules(query, userId, 5),
      this.searchService.searchExamples(query, userId, 5),
    ])

    return {
      rules: rules.map(r => ({ id: r.id, content: r.content, score: r.score })),
      examples: examples.map(e => ({ id: e.id, content: e.content, score: e.score })),
      pinnedIds: [],
      documentId: '',
      templateId: 'default',
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Gap 분석
  // ---------------------------------------------------------------------------
  
  private async analyzeGaps(
    userText: string,
    criteriaPack: CriteriaPack
  ): Promise<GapItem[]> {
    // TODO: 실제 Gap 분석 로직 (LLM 기반)
    // 현재는 규칙 기반 가상 분석
    
    const gaps: GapItem[] = criteriaPack.rules.slice(0, this.options.maxPatches).map((rule, index) => ({
      criteria_id: rule.id,
      criteria_name: `개선 항목 ${index + 1}`,
      current_score: 60 + Math.random() * 20,
      target_score: 85 + Math.random() * 10,
      priority: index + 1,
    }))

    // 우선순위 순으로 정렬
    return gaps.sort((a, b) => a.priority - b.priority)
  }

  // ---------------------------------------------------------------------------
  // Step 3: 패치 생성
  // ---------------------------------------------------------------------------
  
  private async generatePatches(
    userText: string,
    gaps: GapItem[],
    criteriaPack: CriteriaPack
  ): Promise<Patch[]> {
    const context = criteriaPack.rules.map(r => r.content).join('\n')

    // 병렬로 패치 생성
    const patches = await Promise.all(
      gaps.slice(0, this.options.maxPatches).map(gap =>
        this.llmService.generatePatch(userText, gap, context)
      )
    )

    return patches
  }

  // ---------------------------------------------------------------------------
  // Step 4: 패치 시뮬레이션
  // ---------------------------------------------------------------------------
  
  private async simulatePatches(
    originalText: string,
    patches: Patch[]
  ): Promise<SimulationResult[]> {
    // 병렬로 시뮬레이션 실행
    const results = await Promise.all(
      patches.map(patch => 
        this.llmService.simulatePatch(originalText, patch)
      )
    )

    // 시뮬레이션 결과를 패치에 연결
    patches.forEach((patch, index) => {
      patch.expectedDelta = results[index].alignmentDelta
    })

    return results
  }

  // ---------------------------------------------------------------------------
  // Step 5: 전체 개선 효과 계산
  // ---------------------------------------------------------------------------
  
  private calculateOverallDelta(simulations: SimulationResult[]): AlignmentDelta[] {
    const deltaMap = new Map<string, AlignmentDelta>()

    for (const sim of simulations) {
      for (const delta of sim.alignmentDelta) {
        const existing = deltaMap.get(delta.criteria_id)
        if (existing) {
          existing.delta += delta.delta
          existing.after_score = Math.max(existing.after_score, delta.after_score)
        } else {
          deltaMap.set(delta.criteria_id, { ...delta })
        }
      }
    }

    return Array.from(deltaMap.values())
  }

  // ---------------------------------------------------------------------------
  // 유틸리티 메서드
  // ---------------------------------------------------------------------------

  /**
   * 단일 패치 적용 미리보기
   */
  applyPatchPreview(originalText: string, patch: Patch): string {
    const { targetRange, after } = patch
    const before = originalText.substring(targetRange.start, targetRange.end)
    return originalText.replace(before, after)
  }

  /**
   * 여러 패치 순차 적용
   */
  applyPatchesSequentially(originalText: string, patches: Patch[]): string {
    let result = originalText
    
    // 시작 위치 역순으로 정렬 (뒤에서부터 적용해야 인덱스 유지)
    const sortedPatches = [...patches].sort(
      (a, b) => b.targetRange.start - a.targetRange.start
    )

    for (const patch of sortedPatches) {
      result = this.applyPatchPreview(result, patch)
    }

    return result
  }
}

// =============================================================================
// 기본 구현체 (프로덕션용)
// =============================================================================

/**
 * 기본 검색 서비스 (vectorSearch 래퍼)
 */
export class DefaultSearchService implements ISearchService {
  private vectorSearch: (query: string, options: any) => Promise<any[]>
  
  constructor(vectorSearchFn: (query: string, options: any) => Promise<any[]>) {
    this.vectorSearch = vectorSearchFn
  }

  async searchRules(query: string, userId: string, topK = 5): Promise<SearchResult[]> {
    const results = await this.vectorSearch(query, {
      userId,
      topK,
      minScore: 0.6,
      chunkType: 'rule',
    })
    return results.map(r => ({ id: r.chunkId, content: r.content, score: r.score }))
  }

  async searchExamples(query: string, userId: string, topK = 5): Promise<SearchResult[]> {
    const results = await this.vectorSearch(query, {
      userId,
      topK,
      minScore: 0.6,
      chunkType: 'example',
    })
    return results.map(r => ({ id: r.chunkId, content: r.content, score: r.score }))
  }
}

/**
 * 기본 LLM 서비스 (Mock - 실제 구현은 Phase 3)
 */
export class MockLLMService implements ILLMService {
  async generatePatch(userText: string, gap: GapItem, context: string): Promise<Patch> {
    return {
      id: `patch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'Replace',
      targetRange: { start: 0, end: Math.min(50, userText.length) },
      before: userText.substring(0, Math.min(50, userText.length)),
      after: `[개선된 내용: ${gap.criteria_name}]`,
      reason: `${gap.criteria_name} 기준 충족을 위한 수정`,
      citationId: 'mock-citation',
      expectedDelta: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  }

  async simulatePatch(originalText: string, patch: Patch): Promise<SimulationResult> {
    return {
      patchId: patch.id,
      success: true,
      previewText: originalText.substring(0, 200),
      alignmentDelta: [{
        criteria_id: patch.citationId,
        before_score: 65,
        after_score: 80,
        delta: 15,
      }],
      overallScoreDelta: 15,
      simulatedAt: new Date().toISOString(),
    }
  }
}

// =============================================================================
// 팩토리 함수
// =============================================================================

/**
 * PatchService 인스턴스 생성 (기본 구현체 사용)
 */
export function createPatchService(
  vectorSearchFn: (query: string, options: any) => Promise<any[]>,
  options?: PatchServiceOptions
): PatchService {
  const searchService = new DefaultSearchService(vectorSearchFn)
  const llmService = new MockLLMService() // TODO: 실제 LLM 서비스로 교체
  
  return new PatchService(searchService, llmService, options)
}
