
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TemplateBuilder } from '@/lib/rag/templateBuilder'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    
    // 1. 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. 요청 파싱
    const body = await req.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    // 3. 테넌트 ID 조회 (사용자 메타데이터 등에서 가져온다고 가정)
    // 실제 구현에서는 사용자의 조직/테넌트 정보를 정확히 조회해야 함
    const tenantId = user.id // 임시로 사용자 ID를 테넌트 ID로 사용 (개인 사용자)

    // 4. 빌더 실행 (비동기 처리가 이상적이나, MVP에서는 동기 실행 후 응답)
    // Vercel 함수 타임아웃 고려 시, 실제로는 Queue나 Background Job으로 처리해야 함
    const builder = new TemplateBuilder(user.id, tenantId)
    const result = await builder.build(documentId)

    if (!result.success) {
      return NextResponse.json({ error: result.error, logs: result.logs }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Template built successfully', 
      templateId: result.template?.id,
      logs: result.logs 
    })

  } catch (error: any) {
    console.error('[TemplateBuildAPI] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
