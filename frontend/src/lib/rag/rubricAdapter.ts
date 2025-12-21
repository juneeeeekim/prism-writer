
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
}
