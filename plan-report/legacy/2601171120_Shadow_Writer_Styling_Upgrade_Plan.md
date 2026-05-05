# [Shadow Writer] 에디터 기능 고도화: "Ghost Mode & Muted Text" 구현 계획

## 1. 사용자의 의도 분석 (Intent Inference)

**"작성한 글이 에디터에 있지만 잘 눈에 띄지 않게 처리하여 원본과 비교하고 싶다."**

사용자님은 **"비교(Comparison)"** 와 **"아카이빙(Archiving)"** 의 중간 단계를 원하고 계십니다.

- **완전 삭제(Delete)**: 원본이 사라져 비교 불가능 → ❌ 원하지 않음
- **그대로 두기(Keep)**: 새 글과 섞여서 혼란스러움 → ❌ 원하지 않음
- **비강조 처리(De-emphasize)**: 원본을 희미하게(Gray), 작게(Small), 또는 기울임(Italic) 처리하여 "참고용"으로 남김 → ✅ **원하는 기능**

전문 용어로는 **"Soft Delete"** 시각화 또는 **"Muted State"** 라고 부릅니다. 이를 통해 사용자는 AI의 제안을 수용하면서도, 자신의 원래 문장을 즉시 버리지 않고 "그림자(Shadow)"처럼 남겨두어 심리적 안정감을 얻고 언제든 참고할 수 있습니다.

---

## 2. 기술적 현황 및 챌린지 (Current State & Challenge)

### 현황

현재 `ShadowWriter.tsx`는 표준 HTML `<textarea>` 엘리먼트를 사용하고 있습니다.

```tsx
// frontend/src/components/Editor/ShadowWriter.tsx
<textarea value={text} onChange={handleChange} className="..." />
```

### 챌린지 (The Problem)

HTML `<textarea>`는 **단일 텍스트 노드**입니다.

- ❌ **불가능**: "첫 번째 문장은 검은색, 두 번째 문장은 회색으로"
- ❌ **불가능**: "특정 단어만 폰트 작게"
- `<textarea>` 안에서는 모든 텍스트가 **동일한 스타일(색상, 폰트)** 을 가져야만 합니다.

따라서 사용자님이 원하시는 **"부분적 비강조 처리(Muted Text)"** 를 구현하기 위해서는 `<textarea>`를 버리고 **Rich Text Editor (RTE)** 기술을 도입해야 합니다.

---

## 3. 해결 방안: TipTap 에디터 도입 (Proposed Solution)

**TipTap**은 React 환경에서 가장 강력하고 유연한 "Headless" Rich Text Editor 프레임워크입니다. UI가 정해져 있지 않아 우리가 원하는 "초프리미엄 디자인"을 자유롭게 입힐 수 있습니다.

### 핵심 변경 사항

1.  **엔진 교체**: `<textarea>` → `TipTap Editor` (ContentEditable)
2.  **커스텀 확장(Extension) 개발**: `MutedMark`
    - 선택한 텍스트에 `.muted-text` 클래스를 적용하는 기능 구현
3.  **UI 추가**: 텍스트 선택 시 "Mute(비강조)" 버튼이 나타나는 `Bubble Menu` 추가

### 예상되는 UI/UX

1.  사용자가 원본 문장을 드래그하여 선택합니다.
2.  선택 영역 위에 작은 툴팁(Bubble Menu)이 뜹니다. `[ 👻 Mute ]` 버튼이 보입니다.
3.  버튼을 누르면 해당 문장이 **회색(Gray-400), 기울임(Italic), 0.9배 크기**로 변합니다.
4.  새로운 문장을 그 뒤에 이어서 작성합니다.
5.  비교가 끝나면 Muted 된 문장을 삭제하거나 복구합니다.

---

## 4. 상세 구현 계획 (Implementation Steps)

### Phase 1: 기반 마련 (Setup)

- [ ] TipTap 필수 패키지 설치
  - `@tiptap/react`, `@tiptap/starter-kit`
  - `@tiptap/extension-color`, `@tiptap/extension-text-style`
- [ ] `RichShadowWriter` 컴포넌트 스캐폴딩 생성

### Phase 2: 기능 구현 (Feature Development)

- [ ] **MutedMark Extension 개발**
  - HTML 렌더링: `<span class="muted-text">...</span>`
  - Command: `toggleMuted()`
- [ ] **CSS 스타일링 (globals.css)**
  ```css
  .muted-text {
    color: #9ca3af; /* Gray-400 */
    font-style: italic;
    font-size: 0.9em;
    text-decoration: line-through; /* 선택 사항 */
    transition: all 0.2s ease;
  }
  .muted-text:hover {
    color: #4b5563; /* 마우스 올리면 다시 진하게 보여주기 (UX 디테일) */
    text-decoration: none;
  }
  ```

### Phase 3: 마이그레이션 (Migration)

- [ ] 기존 `ShadowWriter`의 "Ghost Text(회색 제안)" 기능을 TipTap의 **Overlay Extension** 형식으로 포팅
- [ ] `ShadowWriterEditor.tsx`에서 `<ShadowWriter>`를 `<RichShadowWriter>`로 교체
- [ ] 기존 기능(자동 저장, 글자 수 세기) 연동 확인

---

## 5. 전문가 의견 (Expert Opinion)

이 기능은 단순한 스타일링 기능을 넘어, **"AI 협업 글쓰기"의 핵심 UX**가 될 잠재력이 있습니다. AI의 제안을 수동적으로 받는 것이 아니라, **"내 글(Past)"과 "AI 제안(Future)"을 한 공간에서 비교(Present)** 하며 더 나은 문장을 선택하는 주체적인 경험을 제공합니다.

기술적으로는 `<textarea>`에서 `TipTap`으로의 전환이 필수적이며, 이는 프로젝트의 기술적 완성도를 한 단계 높이는 훌륭한 결정입니다.
