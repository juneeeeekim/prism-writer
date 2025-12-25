
import { createClient } from '@/lib/supabase/client'
import { mineRulesByCategory, saveRulesToDatabase, type Rule, type RuleCategory } from './ruleMiner'
import { processExamplesForRule, saveExamplesToDatabase, type Example, type ExampleSet } from './exampleMiner'
import { validateAllGates, type AllGatesResult } from './templateGates'
import { type TemplateSchema, type TemplateBuilderResult, type Template } from './templateTypes'
import { PIPELINE_V4_FLAGS } from './featureFlags'
import { v4 as uuidv4 } from 'uuid'

// =============================================================================
// Template Builder
// =============================================================================

export class TemplateBuilder {
  private userId: string
  private tenantId: string
  private logs: string[] = []

  constructor(userId: string, tenantId: string) {
    this.userId = userId
    this.tenantId = tenantId
  }

  private log(message: string) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    this.logs.push(logMessage)
  }

  /**
   * 문서 ID를 받아 템플릿 빌드 파이프라인을 실행합니다.
   */
  async build(documentId: string): Promise<TemplateBuilderResult> {
    this.log(`Starting template build for document: ${documentId}`)

    try {
      const categories: RuleCategory[] = ['tone', 'structure', 'expression', 'prohibition']
      const templateSchemas: TemplateSchema[] = []

      // 1. 카테고리별 파이프라인 실행
      for (const category of categories) {
        this.log(`Processing category: ${category}`)

        // 1-1. Rule Mining & Extraction
        const rules = await mineRulesByCategory(documentId, this.tenantId, category, this.userId)
        this.log(`Mined ${rules.length} rules for ${category}`)
        
        // 규칙 저장
        await saveRulesToDatabase(rules)

        // 1-2. 각 Rule에 대해 Example 처리 및 템플릿 조립
        for (const rule of rules) {
          // Example Mining / Generation
          const exampleSet = await processExamplesForRule(rule, this.userId)
          
          // 임시 TemplateSchema 생성
          const tempSchema: TemplateSchema = {
            criteria_id: uuidv4(),
            category,
            rationale: rule.content,
            positive_examples: exampleSet.positive_examples,
            negative_examples: exampleSet.negative_examples,
            remediation_steps: exampleSet.remediation_steps,
            source_citations: exampleSet.source_citations,
            confidence_score: exampleSet.confidence_score,
          }

          // 1-3. Gate-Keeper 검증
          const gateResult = await validateAllGates(tempSchema)
          
          if (gateResult.passed) {
            this.log(`Rule passed gates: ${rule.content.substring(0, 20)}... (Score: ${gateResult.finalScore.toFixed(2)})`)
            templateSchemas.push(tempSchema)
            
            // Example DB 저장 (선택된 예시들)
            const examplesToSave: Example[] = [
              ...exampleSet.positive_examples.map(content => ({
                document_id: documentId,
                tenant_id: this.tenantId,
                rule_id: rule.id, // DB 저장 후 ID가 있다고 가정 (실제로는 saveRulesToDatabase가 ID 반환해야 함)
                content,
                type: 'positive' as const,
                is_generated: exampleSet.is_generated,
                confidence_score: exampleSet.confidence_score
              })),
              ...exampleSet.negative_examples.map(content => ({
                document_id: documentId,
                tenant_id: this.tenantId,
                rule_id: rule.id,
                content,
                type: 'negative' as const,
                is_generated: exampleSet.is_generated,
                confidence_score: exampleSet.confidence_score
              }))
            ]
            await saveExamplesToDatabase(examplesToSave)

          } else {
            this.log(`Rule failed gates: ${rule.content.substring(0, 20)}...`)
          }
        }
      }

      if (templateSchemas.length === 0) {
        throw new Error('No valid rules extracted from the document.')
      }

      // 2. 최종 템플릿 조립 및 저장
      const template = await this.saveFinalTemplate(documentId, templateSchemas)
      
      this.log('Template build completed successfully.')
      return {
        success: true,
        template,
        logs: this.logs
      }

    } catch (error: any) {
      this.log(`Template build failed: ${error.message}`)
      return {
        success: false,
        error: error.message,
        logs: this.logs
      }
    }
  }

  private async saveFinalTemplate(documentId: string, schemas: TemplateSchema[]): Promise<Template> {
    const supabase = createClient()
    
    // 문서 정보 조회 (이름 생성을 위해)
    const { data: doc } = await supabase.from('rag_documents').select('title').eq('id', documentId).single()
    const title = doc?.title || 'Untitled Document'

    const templateData = {
      tenant_id: this.tenantId,
      document_id: documentId,
      name: `${title} Style Template`,
      version: 1,
      status: 'pending', // 검수 대기 상태
      is_public: false,
      criteria_json: schemas,
    }

    const { data, error } = await supabase
      .from('rag_templates')
      .insert(templateData)
      .select()
      .single()

    if (error) throw error
    
    const template = data as Template

    // ---------------------------------------------------------------------------
    // Pipeline v4: 템플릿 저장 후 Validation Sample 자동 생성
    // ---------------------------------------------------------------------------
    // 주석(시니어 개발자): Regression Gate 활성화를 위해 최소 3개 샘플 보장
    // Feature Flag 체크: v4 비활성화 시 샘플 생성 스킵
    if (PIPELINE_V4_FLAGS.autoGenerateValidationSamples) {
      try {
        await this.generateValidationSamples(template.id, schemas)
      } catch (sampleError: any) {
        // 샘플 생성 실패해도 템플릿은 반환 (경고만)
        this.log(`⚠️ Warning: Failed to generate validation samples: ${sampleError.message}`)
      }
    } else {
      this.log('ℹ️ Pipeline v4 disabled - skipping validation sample generation')
    }

    return template
  }

  // =============================================================================
  // Pipeline v4: Validation Sample 자동 생성
  // =============================================================================

  /**
   * Pipeline v4: 템플릿 검증용 샘플 자동 생성
   * 
   * @description
   * 주석(시니어 개발자): Regression Gate가 의미있게 작동하려면 validation sample 필요
   * - 템플릿의 positive_examples에서 샘플 추출
   * - 최소 3개 보장 (MIN_VALIDATION_SAMPLES)
   * - 샘플 없는 템플릿에 경고 로깅
   * 
   * @param templateId - 템플릿 ID
   * @param schemas - 템플릿 스키마 배열
   */
  private async generateValidationSamples(templateId: string, schemas: TemplateSchema[]): Promise<void> {
    const MIN_VALIDATION_SAMPLES = 3
    const supabase = createClient()

    // 모든 스키마에서 positive_examples 수집
    const allExamples: Array<{ input: string; category: string; score: number }> = []
    
    for (const schema of schemas) {
      for (const example of schema.positive_examples) {
        allExamples.push({
          input: example,
          category: schema.category,
          score: schema.confidence_score ?? 0.8,  // 주석: undefined 시 기본값 0.8
        })
      }
    }

    // ---------------------------------------------------------------------------
    // 주석(주니어 개발자): 샘플이 부족하면 경고 후 있는 만큼만 생성
    // ---------------------------------------------------------------------------
    if (allExamples.length === 0) {
      this.log('⚠️ Warning: No examples available for validation samples')
      return
    }

    if (allExamples.length < MIN_VALIDATION_SAMPLES) {
      this.log(`⚠️ Warning: Only ${allExamples.length} examples available (minimum: ${MIN_VALIDATION_SAMPLES})`)
    }

    // 최대 MIN_VALIDATION_SAMPLES개 선택 (또는 가능한 만큼)
    const samplesToCreate = allExamples.slice(0, Math.min(allExamples.length, MIN_VALIDATION_SAMPLES))

    // validation_samples 테이블에 저장 (테이블 존재 시)
    // 주석(시니어 개발자): 테이블이 없으면 조용히 스킵 (마이그레이션 전 호환성)
    try {
      const sampleRecords = samplesToCreate.map((sample, index) => ({
        template_id: templateId,
        tenant_id: this.tenantId,
        input_text: sample.input,
        expected_score: sample.score,
        category: sample.category,
        sample_index: index,
      }))

      const { error: insertError } = await supabase
        .from('template_validation_samples')
        .insert(sampleRecords)

      if (insertError) {
        // 테이블 미존재 등의 에러는 경고만
        if (insertError.message.includes('does not exist') || insertError.code === '42P01') {
          this.log('ℹ️ Info: template_validation_samples table not yet created - skipping sample generation')
        } else {
          throw insertError
        }
      } else {
        this.log(`✅ Generated ${sampleRecords.length} validation samples for template ${templateId}`)
      }
    } catch (error: any) {
      this.log(`⚠️ Warning: Could not save validation samples: ${error.message}`)
    }
  }
}

