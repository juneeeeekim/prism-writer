# 🎨 PRISM Writer 프론트엔드 구축 회의록

**회의 일시:** 2024-12-14 16:45  
**참석자:** 디렉터, Senior Developer, Junior Developer, UX/UI Designer, Frontend Developer  
**회의 목적:** 프론트엔드 구축 전략 및 세부 계획 수립

---

## 📋 회의 안건

1. 프론트엔드 기술 스택 확정
2. 프로젝트 구조 설계
3. 핵심 컴포넌트 정의
4. 개발 우선순위 결정
5. 세팅 및 환경 구성

---

## 1️⃣ 프론트엔드 기술 스택 확정

### 🗣️ Senior Developer 발언

> "현재 이미 Next.js 14로 기반이 구축되어 있습니다. 이 선택을 유지하는 것이 좋겠습니다."

| 기술                     | 버전   | 선택 이유                               |
| :----------------------- | :----- | :-------------------------------------- |
| **Next.js**              | 14.0.4 | App Router, SSR/SSG 지원, React 18 호환 |
| **TypeScript**           | 5.3+   | 타입 안정성, IDE 지원, 버그 예방        |
| **Tailwind CSS**         | 3.4+   | 빠른 스타일링, 일관된 디자인 시스템     |
| **Zustand**              | 4.4+   | 경량 상태 관리, 보일러플레이트 최소     |
| **@uiw/react-md-editor** | 4.0+   | 마크다운 에디터, 미리보기 내장          |

### 🗣️ Junior Developer 발언

> "추가로 필요한 라이브러리가 있을까요?"

**논의 결과 - 추가 고려 라이브러리:**

| 라이브러리        | 용도           | 우선순위              |
| :---------------- | :------------- | :-------------------- |
| `react-hot-toast` | 토스트 알림    | 높음                  |
| `framer-motion`   | 애니메이션     | 중간                  |
| `react-query`     | 서버 상태 캐싱 | 높음 (백엔드 연동 시) |
| `lucide-react`    | 아이콘         | 높음                  |

### 🗣️ UX/UI Designer 발언

> "디자인 시스템은 Tailwind 기반으로 통일하고, 컬러 팔레트를 정의해야 합니다."

**확정된 컬러 팔레트:**

```css
/* Light Mode */
--prism-primary: #6366f1; /* Indigo 500 */
--prism-secondary: #8b5cf6; /* Violet 500 */
--prism-accent: #ec4899; /* Pink 500 */
--prism-background: #ffffff;
--prism-foreground: #1f2937;

/* Dark Mode */
--prism-bg-dark: #0f172a; /* Slate 900 */
--prism-text-dark: #f1f5f9; /* Slate 100 */
```

---

## 2️⃣ 프로젝트 구조 설계

### 🗣️ Senior Developer 제안

> "현재 구조를 기반으로 확장하겠습니다."

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 홈페이지
│   ├── editor/
│   │   └── page.tsx            # 에디터 페이지
│   └── globals.css             # 전역 스타일
│
├── components/                 # React 컴포넌트
│   ├── ui/                     # 재사용 가능 UI (버튼, 입력 등)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Toast.tsx
│   ├── layout/                 # 레이아웃 컴포넌트
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── DualPane/               # Dual Pane 에디터
│   │   └── DualPaneContainer.tsx
│   ├── Editor/                 # 마크다운 에디터
│   │   ├── MarkdownEditor.tsx
│   │   └── EditorToolbar.tsx
│   └── Assistant/              # AI 어시스턴트 패널
│       ├── AssistantPanel.tsx
│       ├── OutlineTab.tsx
│       ├── ReferenceTab.tsx
│       ├── ReferenceCard.tsx
│       └── ChatTab.tsx
│
├── hooks/                      # 커스텀 훅
│   ├── useEditorState.ts       # 에디터 상태 관리
│   ├── useToast.ts             # 토스트 알림
│   └── useDebounce.ts          # 디바운스
│
├── lib/                        # 유틸리티 및 설정
│   ├── api/                    # API 클라이언트
│   │   ├── outline.ts
│   │   └── references.ts
│   ├── utils.ts                # 공통 유틸
│   └── constants.ts            # 상수 정의
│
└── types/                      # TypeScript 타입 정의
    └── index.ts
```

### 🗣️ Frontend Developer 의견

> "컴포넌트 분류가 명확해서 좋습니다. `ui/` 폴더에 범용 컴포넌트를 분리하면 재사용성이 높아집니다."

---

## 3️⃣ 핵심 컴포넌트 정의

### 페이지별 컴포넌트 구성

| 페이지               | 컴포넌트                                                | 기능                  |
| :------------------- | :------------------------------------------------------ | :-------------------- |
| **홈 (/)**           | `HeroSection`, `FeatureCards`                           | 서비스 소개, CTA 버튼 |
| **에디터 (/editor)** | `DualPaneContainer`, `MarkdownEditor`, `AssistantPanel` | 핵심 글쓰기 기능      |

### 공통 UI 컴포넌트

| 컴포넌트  | Props                            | 설명               |
| :-------- | :------------------------------- | :----------------- |
| `Button`  | `variant`, `size`, `loading`     | 다양한 스타일 버튼 |
| `Input`   | `type`, `placeholder`, `error`   | 입력 필드          |
| `Card`    | `title`, `description`, `footer` | 카드 레이아웃      |
| `Toast`   | `message`, `type`                | 알림 메시지        |
| `Spinner` | `size`                           | 로딩 인디케이터    |
| `Modal`   | `isOpen`, `onClose`, `title`     | 모달 다이얼로그    |

### 🗣️ UX/UI Designer 발언

> "각 컴포넌트에 접근성(Accessibility)을 필수로 적용해야 합니다."

**접근성 체크리스트:**

- [ ] 모든 버튼에 `aria-label`
- [ ] 포커스 가능한 요소에 `tabIndex`
- [ ] 색상 대비 4.5:1 이상
- [ ] 키보드 네비게이션 지원

---

## 4️⃣ 개발 우선순위 결정

### 🗣️ Senior Developer 제안

> "핵심 기능부터 완성하고, 부가 기능을 추가하는 방식으로 진행합니다."

| 우선순위 | 작업                                           | 담당           | 예상 기간 |
| :------- | :--------------------------------------------- | :------------- | :-------- |
| 🔴 P0    | UI 컴포넌트 라이브러리 구축 (Button, Input 등) | Junior + UX/UI | 2일       |
| 🔴 P0    | 홈페이지 UI 개선                               | UX/UI          | 1일       |
| 🟠 P1    | 에디터 페이지 UI 개선                          | Senior         | 2일       |
| 🟠 P1    | 목차 생성 탭 실제 API 연동                     | Junior         | 1일       |
| 🟡 P2    | 참고자료 검색 기능                             | Senior         | 2일       |
| 🟡 P2    | AI 채팅 기능                                   | Junior         | 2일       |
| 🟢 P3    | 다크 모드 토글                                 | Junior         | 0.5일     |
| 🟢 P3    | 반응형 모바일 레이아웃                         | UX/UI          | 1일       |

---

## 5️⃣ 세팅 및 환경 구성

### 개발 환경 요구사항

```bash
# Node.js 버전
node --version  # v18.0.0 이상 필요

# 패키지 매니저
npm --version   # v9.0.0 이상 권장
```

### 초기 설정 명령어

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/prism-writer.git
cd prism-writer/frontend

# 2. 의존성 설치
npm install

# 3. 추가 라이브러리 설치 (회의에서 결정된 항목)
npm install react-hot-toast lucide-react clsx

# 4. 개발 서버 실행
npm run dev
```

### 환경변수 설정

```env
# frontend/.env.local

# API 연결 (개발 환경)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase (추후 연동)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### ESLint & Prettier 설정

```json
// .eslintrc.json (이미 생성됨)
{
  "extends": ["next/core-web-vitals"]
}
```

### TypeScript 설정

```json
// tsconfig.json 주요 설정
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 📝 회의 결론 및 Action Items

### ✅ 합의된 사항

1. **기술 스택**: Next.js 14 + TypeScript + Tailwind CSS + Zustand 유지
2. **추가 라이브러리**: react-hot-toast, lucide-react 설치
3. **프로젝트 구조**: `ui/` 폴더 분리, 컴포넌트 정리
4. **우선순위**: UI 컴포넌트 라이브러리 → 홈페이지 → 에디터 순서

### 📌 Action Items

| #   | 작업                                              | 담당자           | 기한  |
| :-- | :------------------------------------------------ | :--------------- | :---- |
| 1   | 공통 UI 컴포넌트 생성 (`Button`, `Input`, `Card`) | Junior Developer | 12/15 |
| 2   | 컬러 팔레트 Tailwind 설정 적용                    | UX/UI Designer   | 12/15 |
| 3   | 홈페이지 Hero 섹션 리디자인                       | UX/UI Designer   | 12/16 |
| 4   | react-hot-toast, lucide-react 설치 및 설정        | Junior Developer | 12/15 |
| 5   | 에디터 페이지 레이아웃 개선                       | Senior Developer | 12/16 |

### 🗓️ 다음 회의

- **일시:** 개발 진행 후 (예: 12/16)
- **안건:** 프론트엔드 1차 완성 검토 및 백엔드 연동 계획

---

**회의록 작성:** Senior Developer  
**승인:** 디렉터

---

_이 문서는 프론트엔드 개발의 기준 문서로 사용됩니다._
