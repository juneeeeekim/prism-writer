# 🛠️ Word Wrap & Typography Implementation Checklist

**Based on**: [Word Wrap Fix Plan](./2601092325_Word_Wrap_Fix_Plan.md)
**Role**: Tech Lead
**Date**: 2026-01-09

## [Phase 1: Global CSS Fix]

**Before Start:**

- ⚠️ 주의: `html` 태그에 전역 적용하므로 Flex/Grid 레이아웃 내에서 의도치 않은 줄바꿈이 발생하는지 확인 필요.
- ⚠️ 주의: `pre`, `code` 블록은 줄바꿈이 오히려 가독성을 해칠 수 있으므로 예외 처리 필수.

**Implementation Items:**

- [x] **ID(P1-01)**: Apply Global Word Break

  - `Target`: `frontend/src/app/globals.css` > `@layer base`
  - `Logic (Pseudo)`:
    ```css
    @layer base {
      html {
        word-break: break-word;
        overflow-wrap: break-word;
      }
      /* Code blocks should scroll, not wrap potentially */
      pre,
      code {
        word-break: normal;
        overflow-wrap: normal;
      }
    }
    ```
  - `Key Variables`: N/A (CSS)
  - `Safety`: Verify `pre` tag exception works on Markdown preview.

- [x] **ID(P1-02)**: Override Markdown Editor Styles
  - `Target`: `frontend/src/app/globals.css` > `.w-md-editor-text`
  - `Logic (Pseudo)`:
    ```css
    /* Override library defaults */
    .w-md-editor-text {
      word-break: break-word !important;
      white-space: pre-wrap !important;
    }
    ```
  - `Key Variables`: N/A (CSS)
  - `Safety`: Use `!important` to ensure library styles are overridden.

## [Phase 2: Component Hardening]

**Before Start:**

- ⚠️ 주의: `ShadowWriter`는 `textarea` 기반이므로 `break-words` 클래스가 올바르게 동작하는지 확인 필요.

**Implementation Items:**

- [x] **ID(P2-01)**: Hardening Shadow Writer
  - `Target`: `frontend/src/components/Editor/ShadowWriter.tsx` > `textarea` props
  - `Logic (Pseudo)`:
    ```tsx
    // Add Tailwind utilities for explicit safety
    className = "... break-words whitespace-pre-wrap ...";
    ```
  - `Key Variables`: `className`
  - `Safety`: Ensure `break-words` does not conflict with `resize-none`.

**Definition of Done (검증):**

- [x] Test: 에디터에 'Supercalifragilisticexpialidocious...' 입력 시 가로 스크롤 없이 줄바꿈 되는지 확인
- [x] Test: `ShadowWriter`에 긴 URL 붙여넣기 시 줄바꿈 확인
- [x] Test: `ResearchCard` 및 `ChatPanel`의 긴 텍스트가 컨테이너를 넘치지 않는지 확인
- [x] Review: 불필요한 콘솔 로그 없음 확인
