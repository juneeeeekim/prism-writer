// =============================================================================
// Phase 13: Document Reorder API
// =============================================================================
// 파일: frontend/src/app/api/documents/reorder/route.ts
// 역할: 문서 순서 일괄 변경 (Batch Update)
// 생성일: 2025-12-28
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ReorderRequest } from '@/types/document'

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()  // [FIX] getSession -> getUser
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // -------------------------------------------------------------------------
    // 2. 요청 본문 파싱
    // -------------------------------------------------------------------------
    const body: ReorderRequest = await req.json()
    const { documents } = body

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents provided' },
        { status: 400 }
      )
    }

    // -------------------------------------------------------------------------
    // 3. Batch Update (Upsert 사용)
    // Supabase(PostgreSQL)에서는 upsert를 사용하여 일괄 업데이트 가능
    // 단, 보안상 user_id 확인이 필요하므로 RPC를 사용하거나 반복문 사용
    // 여기서는 안전하게 Promise.all + update 호출 (건수가 적으므로)
    // -------------------------------------------------------------------------
    
    const updatePromises = documents.map(doc => 
      supabase
        .from('user_documents')
        .update({ sort_order: doc.sort_order })
        .eq('id', doc.id)
        .eq('user_id', user.id) // RLS: 본인 문서만 수정 가능
    )

    await Promise.all(updatePromises)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DocumentReorder] Update error:', error)
    return NextResponse.json(
      { error: 'Failed to reorder documents' },
      { status: 500 }
    )
  }
}

// =============================================================================
// [DnD-B01] PATCH: Project-based Document Reorder
// =============================================================================
// 역할: 프로젝트 기반 문서 순서 일괄 업데이트 (Drag & Drop용)
// 입력: { projectId: string, orderedDocIds: string[] }
// 출력: { success: boolean, updatedCount: number }
// 생성일: 2026-01-08
// =============================================================================

interface ReorderByProjectRequest {
  projectId: string
  orderedDocIds: string[]
}

interface ReorderByProjectResponse {
  success: boolean
  updatedCount: number
  error?: string
}

export async function PATCH(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // [DnD-B01-01] 인증 확인
    // -------------------------------------------------------------------------
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' } as ReorderByProjectResponse,
        { status: 401 }
      )
    }
    
    // -------------------------------------------------------------------------
    // [DnD-B01-02] 요청 본문 파싱 및 검증
    // -------------------------------------------------------------------------
    const body: ReorderByProjectRequest = await req.json()
    const { projectId, orderedDocIds } = body

    // Safety: projectId 검증
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid projectId', success: false, updatedCount: 0 } as ReorderByProjectResponse,
        { status: 400 }
      )
    }

    // Safety: orderedDocIds 배열 검증
    if (!Array.isArray(orderedDocIds) || orderedDocIds.length === 0) {
      return NextResponse.json(
        { error: 'orderedDocIds must be a non-empty array', success: false, updatedCount: 0 } as ReorderByProjectResponse,
        { status: 400 }
      )
    }
    
    // -------------------------------------------------------------------------
    // [DnD-B01-03] 프로젝트 소유권 확인
    // -------------------------------------------------------------------------
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied', success: false, updatedCount: 0 } as ReorderByProjectResponse,
        { status: 404 }
      )
    }
    
    // -------------------------------------------------------------------------
    // [DnD-B01-04] Batch Update sort_order
    // - 순서대로 1, 2, 3... 으로 업데이트
    // - 개별 실패 시에도 전체 롤백하지 않음 (부분 성공 허용)
    // -------------------------------------------------------------------------
    let updatedCount = 0

    for (let i = 0; i < orderedDocIds.length; i++) {
      const { error: updateError } = await supabase
        .from('user_documents')
        .update({ sort_order: i + 1 })
        .eq('id', orderedDocIds[i])
        .eq('project_id', projectId)

      if (!updateError) {
        updatedCount++
      } else {
        console.warn(`[DocumentReorder PATCH] Failed to update doc ${orderedDocIds[i]}:`, updateError.message)
      }
    }

    // -------------------------------------------------------------------------
    // [DnD-B01-05] 성공 응답
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      updatedCount
    } as ReorderByProjectResponse)

  } catch (error) {
    console.error('[DocumentReorder PATCH] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reorder documents', success: false, updatedCount: 0 } as ReorderByProjectResponse,
      { status: 500 }
    )
  }
}

