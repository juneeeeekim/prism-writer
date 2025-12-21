
import { createClient } from '@/lib/supabase/client'
import { type Template, type TemplateStatus } from './templateTypes'

export class TemplateRegistry {
  private supabase = createClient()

  /**
   * 템플릿 ID로 조회
   */
  async getTemplate(id: string): Promise<Template | null> {
    const { data, error } = await this.supabase
      .from('rag_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data as Template
  }

  /**
   * 테넌트별 템플릿 목록 조회
   */
  async listTemplates(tenantId: string): Promise<Template[]> {
    const { data, error } = await this.supabase
      .from('rag_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Template[]
  }

  /**
   * 모든 템플릿 목록 조회 (관리자용)
   */
  async listAllTemplates(status?: TemplateStatus): Promise<Template[]> {
    let query = this.supabase
      .from('rag_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data as Template[]
  }

  /**
   * 템플릿 상태 업데이트 (승인/거절)
   */
  async updateStatus(
    id: string, 
    status: TemplateStatus, 
    userId?: string, 
    reason?: string
  ): Promise<void> {
    const updateData: any = { status }
    
    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
      updateData.approved_by = userId
    } else if (status === 'rejected') {
      updateData.rejection_reason = reason
    }

    const { error } = await this.supabase
      .from('rag_templates')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }
}
