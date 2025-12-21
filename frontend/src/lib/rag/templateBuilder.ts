
import { createClient } from '@/lib/supabase/client'
import { mineRulesByCategory, saveRulesToDatabase, type Rule, type RuleCategory } from './ruleMiner'
import { processExamplesForRule, saveExamplesToDatabase, type Example, type ExampleSet } from './exampleMiner'
import { validateAllGates, type AllGatesResult } from './templateGates'
import { type TemplateSchema, type TemplateBuilderResult, type Template } from './templateTypes'
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
    return data as Template
  }
}
