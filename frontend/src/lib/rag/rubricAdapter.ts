
import { type Rubric, type RubricCategory } from './rubrics'
import { type TemplateSchema } from './templateTypes'

/**
 * RubricAdapter
 * 
 * 기존 Rubric 시스템과 신규 TemplateSchema 시스템 간의 상호 변환을 담당합니다.
 * Phase 4.3: Rubrics Migration (공존 Phase)의 핵심 컴포넌트입니다.
 */
export class RubricAdapter {
  /**
   * TemplateSchema를 Rubric으로 변환합니다.
   * 
   * @param template - 변환할 TemplateSchema 객체
   * @returns 변환된 Rubric 객체
   */
  static toRubric(template: TemplateSchema): Rubric {
    return {
      id: template.criteria_id,
      name: template.rationale.substring(0, 50), // 제목이 없으므로 rationale의 앞부분 사용
      description: template.rationale,
      category: this.mapTemplateCategoryToRubric(template.category),
      weight: 10, // 기본 가중치
      enabled: true,
    }
  }

  /**
   * Rubric을 TemplateSchema로 변환합니다.
   * 
   * @param rubric - 변환할 Rubric 객체
   * @returns 변환된 TemplateSchema 객체
   */
  static toTemplate(rubric: Rubric): TemplateSchema {
    return {
      criteria_id: rubric.id,
      category: this.mapRubricCategoryToTemplate(rubric.category),
      rationale: `${rubric.name}: ${rubric.description}`,
      positive_examples: [], // 기존 루브릭에는 예시가 없음
      negative_examples: [],
      remediation_steps: [],
      source_citations: [],
      confidence_score: 1.0,
    }
  }

  /**
   * Template 카테고리를 Rubric 카테고리로 매핑합니다.
   */
  private static mapTemplateCategoryToRubric(category: TemplateSchema['category']): RubricCategory {
    switch (category) {
      case 'structure':
        return 'structure'
      case 'expression':
      case 'tone':
      case 'prohibition':
        return 'expression'
      default:
        return 'content'
    }
  }

  /**
   * Rubric 카테고리를 Template 카테고리로 매핑합니다.
   */
  private static mapRubricCategoryToTemplate(category: RubricCategory): TemplateSchema['category'] {
    switch (category) {
      case 'structure':
        return 'structure'
      case 'expression':
        return 'expression'
      case 'content':
      case 'logic':
      case 'evidence':
        return 'expression' // 가장 근접한 카테고리로 매핑
      default:
        return 'expression'
    }
  }

  // ===========================================================================
  // [P3-03] Batch 변환 메서드 (2025-12-29 추가)
  // ===========================================================================

  /**
   * [P3-03] Rubric 배열을 TemplateSchema 배열로 일괄 변환합니다.
   * 
   * @param rubrics - 변환할 Rubric 배열
   * @returns 변환된 TemplateSchema 배열 (enabled된 것만)
   */
  static toTemplateArray(rubrics: Rubric[]): TemplateSchema[] {
    return rubrics.filter(r => r.enabled).map(r => this.toTemplate(r))
  }

  /**
   * [P3-03] TemplateSchema 배열을 Rubric 배열로 일괄 변환합니다.
   * 
   * @param templates - 변환할 TemplateSchema 배열
   * @returns 변환된 Rubric 배열
   */
  static toRubricArray(templates: TemplateSchema[]): Rubric[] {
    return templates.map(t => this.toRubric(t))
  }

  /**
   * [P3-03] 기본 Templates 캐싱용 변수
   * @private
   */
  private static _defaultTemplates: TemplateSchema[] | null = null

  /**
   * [P3-03] 기본 Rubrics를 TemplateSchema로 변환하여 캐싱합니다.
   * 
   * @description 첫 호출 시 변환하여 캐싱, 이후 호출 시 캐싱된 값 반환
   * @param defaultRubrics - 기본 Rubric 배열 (DEFAULT_RUBRICS)
   * @returns 캐싱된 TemplateSchema 배열
   */
  static getDefaultTemplates(defaultRubrics: Rubric[]): TemplateSchema[] {
    if (!this._defaultTemplates) {
      this._defaultTemplates = this.toTemplateArray(defaultRubrics)
    }
    return this._defaultTemplates
  }

  /**
   * [P3-03] 캐시를 초기화합니다. (테스트용)
   */
  static clearCache(): void {
    this._defaultTemplates = null
  }
}
