// =============================================================================
// PRISM Writer - MutedMark TipTap Extension
// =============================================================================
// 파일: frontend/src/components/Editor/extensions/MutedMark.ts
// 역할: 선택한 텍스트를 "비강조(Muted)" 상태로 표시하는 커스텀 Mark Extension
// 참고: [Muted Text 체크리스트 P1-01]
// =============================================================================
//
// [기능 설명]
// - 사용자가 드래그로 선택한 텍스트에 "Muted" 스타일을 적용
// - 회색(Gray), 기울임(Italic), 취소선 효과로 "비강조" 상태 표현
// - AI 제안을 수용하면서 원본 문장을 "그림자"처럼 보존하는 UX 제공
//
// [사용 예시]
// editor.chain().focus().toggleMuted().run()  // Muted 토글
// editor.chain().focus().setMuted().run()     // Muted 적용
// editor.chain().focus().unsetMuted().run()   // Muted 해제
// editor.isActive('muted')                    // Muted 상태 확인
//
// =============================================================================

import { Mark, mergeAttributes } from '@tiptap/core'

// =============================================================================
// Type Declarations (커맨드 타입 확장)
// =============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    muted: {
      /**
       * 선택 영역에 Muted 마크 토글
       */
      toggleMuted: () => ReturnType
      /**
       * 선택 영역에 Muted 마크 적용
       */
      setMuted: () => ReturnType
      /**
       * 선택 영역에서 Muted 마크 해제
       */
      unsetMuted: () => ReturnType
    }
  }
}

// =============================================================================
// MutedMark Extension
// =============================================================================

export const MutedMark = Mark.create({
  // ---------------------------------------------------------------------------
  // Extension 기본 설정
  // ---------------------------------------------------------------------------

  /** Extension 고유 이름 (필수) */
  name: 'muted',

  // ---------------------------------------------------------------------------
  // HTML 파싱/렌더링 규칙
  // ---------------------------------------------------------------------------

  /**
   * HTML → ProseMirror 변환 규칙
   * 저장된 HTML을 다시 불러올 때 사용
   */
  parseHTML() {
    return [
      {
        tag: 'span.muted-text',
      },
    ]
  },

  /**
   * ProseMirror → HTML 변환 규칙
   * 에디터 내용을 HTML로 저장할 때 사용
   */
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'muted-text' }),
      0, // 0 = 자식 컨텐츠가 들어갈 위치
    ]
  },

  // ---------------------------------------------------------------------------
  // 커맨드 정의
  // ---------------------------------------------------------------------------

  /**
   * Editor에서 사용할 커맨드 등록
   * - toggleMuted: Muted 상태 토글 (적용 ↔ 해제)
   * - setMuted: Muted 상태 강제 적용
   * - unsetMuted: Muted 상태 강제 해제
   */
  addCommands() {
    return {
      toggleMuted:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name)
        },
      setMuted:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      unsetMuted:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

// =============================================================================
// Named Export
// =============================================================================

export default MutedMark
