// =============================================================================
// PRISM Writer - Reference Tab (Intelligent Reference Studio)
// =============================================================================
// 파일: frontend/src/components/Assistant/ReferenceTab.tsx
// 역할: 참고자료 관리 및 지식 편집 (Studio Mode)
// Update: 2025-12-26 - Migrated to Studio Architecture
// =============================================================================

'use client'

import ReferenceStudioContainer from './Studio/ReferenceStudioContainer'

/* Legacy Imports (Kept for Rollback)
import { useState } from 'react'
import ReferenceCard from './ReferenceCard'
import DocumentUploader from '@/components/documents/DocumentUploader'
import ReferenceItem from './ReferenceItem' 
import { searchDocuments, RAGSearchError } from '@/lib/api/rag'
import { useDocumentStatus } from '@/hooks/useDocumentStatus' 
*/

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function ReferenceTab() {
  return (
    <div className="p-4 h-full">
      {/* 
        Phase 1: Intelligent Reference Studio Layout 
        기존의 단순 리스트/검색 구조에서 2-Pane Editor 구조로 변경되었습니다.
      */}
      <ReferenceStudioContainer />
    </div>
  )
}

