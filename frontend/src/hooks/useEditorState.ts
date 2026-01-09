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
import { type Citation } from '@/components/Assistant/ResearchPanel'

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
  
  // Phase 11: 서버 문서 ID
  documentId: string | null
  
  // v3: 평가 및 템플릿 상태
  evaluationResult: EvaluationResult | null
  template: TemplateSchema[] | null

  // P2-03: 인용 삽입 기능 - 각주 목록
  footnotes: string[]

  // 액션
  setContent: (content: string) => void
  setTitle: (title: string) => void
  setOutline: (outline: OutlineItem[]) => void
  setCurrentParagraphIndex: (index: number) => void
  setEvaluationResult: (result: EvaluationResult | null) => void
  setTemplate: (template: TemplateSchema[] | null) => void
  insertOutline: (outline: OutlineItem[]) => void
  insertText: (text: string) => void
  // P2-03: 인용 삽입 액션
  insertCitation: (citation: Citation) => void
  markAsSaved: () => void
  reset: () => void
  // Phase 11: 서버 문서 관련 액션
  setDocumentId: (id: string | null) => void
  loadFromServer: (doc: { id: string; title: string; content: string }) => void
  
  // Phase 8: Chat Draft Interaction
  chatDraft: string | null
  setChatDraft: (draft: string | null) => void
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
      documentId: null,
      evaluationResult: null,
      template: null,
      // P2-03: 각주 목록 초기화
      footnotes: [],

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
      // P2-03: Insert Citation (인용 삽입 - 각주 형식)
      // ---------------------------------------------------------------------------
      // [시니어 개발자 주석]
      // 인용 삽입 기능: 에디터 끝에 각주 형식으로 인용 텍스트 삽입
      // - 기존 content 보존 (append only 방식)
      // - 중복 각주 번호 방지 (자동 증가)
      // - footnotes 배열에 출처 정보 저장
      // ---------------------------------------------------------------------------
      insertCitation: (citation) => {
        const currentContent = get().content
        const currentFootnotes = get().footnotes

        // 각주 번호는 기존 각주 개수 + 1 (1부터 시작)
        const footnoteNumber = currentFootnotes.length + 1

        // 인용 텍스트 형식: "[인용 내용] [각주번호]"
        const citationText = `"${citation.text}" [${footnoteNumber}]`

        // 각주 형식: "[각주번호] 출처명. URL"
        const footnote = `[${footnoteNumber}] ${citation.source}. ${citation.url}`

        // 새 content 생성 (기존 content 뒤에 인용 텍스트 추가)
        const newContent = currentContent
          ? `${currentContent}\n\n${citationText}`
          : citationText

        set({
          content: newContent,
          footnotes: [...currentFootnotes, footnote],
          isDirty: true,
        })
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
        documentId: null,
        // P2-03: footnotes 초기화
        footnotes: [],
      }),

      // ---------------------------------------------------------------------------
      // Phase 11: 서버 문서 관련 액션
      // ---------------------------------------------------------------------------
      setDocumentId: (documentId) => set({ documentId }),
      
      loadFromServer: (doc) => set({
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        isDirty: false,
        lastSavedAt: new Date(),
      }),
      
      // Phase 8: Chat Draft Interaction
      chatDraft: null,
      setChatDraft: (chatDraft) => set({ chatDraft }),
    }),
    {
      name: 'prism-editor-storage', // localStorage key
      // P2-03: footnotes도 localStorage에 저장
      partialize: (state) => ({
        content: state.content,
        title: state.title,
        outline: state.outline,
        documentId: state.documentId,
        footnotes: state.footnotes,
      }), // Persist content, title, outline, documentId, footnotes
    }
  )
)
