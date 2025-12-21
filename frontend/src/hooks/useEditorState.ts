// =============================================================================
// PRISM Writer - Editor State Hook
// =============================================================================
// 파일: frontend/src/hooks/useEditorState.ts
// 역할: 에디터 상태 관리 (content, title, outline)
// 라이브러리: Zustand
// =============================================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type EvaluationResult } from '@/lib/judge/types'
import { type TemplateSchema } from '@/lib/rag/templateTypes'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface OutlineItem {
  title: string
  depth: number
}

interface EditorState {
  // 글 내용
  content: string
  title: string
  outline: OutlineItem[]
  
  // 현재 선택된 문단 인덱스
  currentParagraphIndex: number
  
  // 저장 상태
  isDirty: boolean
  lastSavedAt: Date | null
  
  // v3: 평가 및 템플릿 상태
  evaluationResult: EvaluationResult | null
  template: TemplateSchema[] | null
  
  // 액션
  setContent: (content: string) => void
  setTitle: (title: string) => void
  setOutline: (outline: OutlineItem[]) => void
  setCurrentParagraphIndex: (index: number) => void
  setEvaluationResult: (result: EvaluationResult | null) => void
  setTemplate: (template: TemplateSchema[] | null) => void
  insertOutline: (outline: OutlineItem[]) => void
  insertText: (text: string) => void
  markAsSaved: () => void
  reset: () => void
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------
export const useEditorState = create<EditorState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      content: '',
      title: '',
      outline: [],
      currentParagraphIndex: 0,
      isDirty: false,
      lastSavedAt: null,
      evaluationResult: null,
      template: null,

      // ---------------------------------------------------------------------------
      // Setters
      // ---------------------------------------------------------------------------
      setContent: (content) => set({ content, isDirty: true }),
      
      setTitle: (title) => set({ title, isDirty: true }),
      
      setOutline: (outline) => set({ outline }),
      
      setCurrentParagraphIndex: (currentParagraphIndex) => set({ currentParagraphIndex }),

      setEvaluationResult: (evaluationResult) => set({ evaluationResult }),
      
      setTemplate: (template) => set({ template }),

      // ---------------------------------------------------------------------------
      // Insert Outline (목차를 마크다운 형식으로 삽입)
      // ---------------------------------------------------------------------------
      insertOutline: (outline) => {
        const markdownOutline = outline
          .map((item) => `${'#'.repeat(item.depth)} ${item.title}`)
          .join('\n\n')
        
        const currentContent = get().content
        const newContent = currentContent 
          ? `${currentContent}\n\n${markdownOutline}` 
          : markdownOutline
        
        set({ content: newContent, outline, isDirty: true })
      },

      // ---------------------------------------------------------------------------
      // Insert Text (참조 텍스트 삽입)
      // ---------------------------------------------------------------------------
      insertText: (text) => {
        const currentContent = get().content
        const newContent = currentContent 
          ? `${currentContent}\n\n> ${text}` 
          : `> ${text}`
        
        set({ content: newContent, isDirty: true })
      },

      // ---------------------------------------------------------------------------
      // Save Actions
      // ---------------------------------------------------------------------------
      markAsSaved: () => set({ isDirty: false, lastSavedAt: new Date() }),

      reset: () => set({
        content: '',
        title: '',
        outline: [],
        currentParagraphIndex: 0,
        isDirty: false,
        lastSavedAt: null,
      }),
    }),
    {
      name: 'prism-editor-storage', // localStorage key
      partialize: (state) => ({ 
        content: state.content, 
        title: state.title,
        outline: state.outline 
      }), // Persist only content, title, and outline
    }
  )
)
