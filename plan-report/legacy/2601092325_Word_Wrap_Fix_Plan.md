# 🛠️ Word Wrap & Typography Improvement Plan

**문서 번호**: DEV-2026-0109-WRAP
**작성일**: 2026-01-09
**목표**: 에디터 내 영문/한글 자동 줄바꿈(Word Wrap) 완벽 지원 및 타이포그래피 개선

## 1. 현재 상황 분석 (As-Is)

1.  **Shadow Writer (`textarea`)**:

    - 별도 CSS 설정 없음. 브라우저 기본 `textarea` 동작(보통 `white-space: pre-wrap`)에 의존.
    - 문제점: 매우 긴 영단어(URL 등) 입력 시 줄바꿈되지 않고 가로 스크롤 발생 가능성 있음.

2.  **Markdown Editor (`@uiw/react-md-editor`)**:
    - 라이브러리 기본 스타일 사용.
    - 문제점: 모바일이나 좁은 화면에서 가독성이 떨어질 수 있음.

## 2. 개선 제안 (To-Be)

### 2.1 전역 CSS 전략 (Global Fix)

모든 프론트엔드 UI(카드, 메뉴, 채팅 등)에 일괄 적용하기 위해 최상위 레벨에서 기본 동작을 변경합니다.

- **파일**: `frontend/src/app/globals.css`
- **적용 내용**:
  ```css
  @layer base {
    html {
      /* 기본적으로 모든 텍스트는 컨테이너 너비를 넘어가면 줄바꿈 */
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* 예외: 코드 블록 등은 줄바꿈 하지 않음 */
    pre,
    code {
      word-break: normal;
      overflow-wrap: normal;
    }
  }
  ```

### 2.2 Shadow Writer & Editor 보강

- 기존 계획 유지: `ShadowWriter.tsx`와 `MarkdownEditor`에 명시적 유틸리티 클래스 추가 (이중 안전장치).

### 2.3 Markdown Editor 수정

- `frontend/src/app/globals.css`
- `@uiw/react-md-editor` 내부 클래스 오버라이딩

```css
.w-md-editor-text {
  word-break: break-word !important;
  white-space: pre-wrap !important;
}
```

## 3. 검증 계획 (Verification)

### 3.1 수동 테스트 케이스

1.  **긴 영단어 테스트**:
    - 입력: `Supercalifragilisticexpialidocious...` (공백 없이 100자 이상)
    - 기대 결과: 에디터 너비에 맞춰 자동으로 다음 줄로 넘어감 (가로 스크롤 X)
2.  **한글 문장 테스트**:
    - 입력: "안녕하세요..." (긴 문장)
    - 기대 결과: 화면 끝에서 자연스럽게 줄바꿈됨.
3.  **URL 테스트**:
    - 입력: 매우 긴 URL
    - 기대 결과: 줄바꿈되어 전체가 보임.
4.  **UI 컴포넌트 테스트**:
    - 검색 결과 카드(`ResearchCard`)의 긴 요약문이 카드 밖으로 튀어나가지 않는지 확인.
    - 채팅 메시지의 긴 영단어가 말풍선 내에서 줄바꿈되는지 확인.

## 4. 일정

- 승인 즉시 적용 (예상 소요 시간: 10분)
