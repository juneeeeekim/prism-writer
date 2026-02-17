# Config Reference

> PRISM Writer 전체 설정 파일 / Feature Flags / 모델 레지스트리 / 빌드 설정 명세
> 최종 갱신: 2026-02-14

---

## 목차

1. [Feature Flags](#1-feature-flags)
2. [LLM Usage Map (모델 라우팅)](#2-llm-usage-map)
3. [LLM Config](#3-llm-config)
4. [Embedding Models](#4-embedding-models)
5. [Model Registry](#5-model-registry)
6. [Next.js Config](#6-nextjs-config)
7. [Tailwind Config](#7-tailwind-config)
8. [TypeScript Config](#8-typescript-config)
9. [Middleware (RBAC)](#9-middleware-rbac)
10. [Playwright Config](#10-playwright-config)
11. [Vitest Config](#11-vitest-config)
12. [Docker Compose](#12-docker-compose)

---

## 1. Feature Flags

파일: `frontend/src/config/featureFlags.ts`

60+ 개의 기능 플래그로 점진적 롤아웃을 관리합니다.

### 핵심 플래그 목록

| 플래그 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| **파이프라인** | | | |
| `ENABLE_PIPELINE_V4` | `boolean` | `true` | Pipeline v4 (Search → Rerank → Answer → Review → Citation) |
| `ENABLE_PIPELINE_V5` | `boolean` | `true` | Pipeline v5 (Shadow Workspace + Patch System) |
| **RAG 핵심** | | | |
| `ENABLE_RAG_HALLUCINATION_IMPROVEMENTS` | `boolean` | `true` | 환각 방지 개선 |
| `ENABLE_QUERY_EXPANSION` | `boolean` | `true` | 쿼리 확장 (동의어/유사어) |
| `ENABLE_SELF_RAG` | `boolean` | `true` | Self-RAG 4단계 검증 |
| `LAZY_SELF_RAG_MODE` | `boolean` | `true` | Lazy Self-RAG (Stage 1+4만, 비용 70% 절감) |
| `ENABLE_CITATION_MARKERS` | `boolean` | `true` | [1], [2] 인용 마커 표시 |
| `ENABLE_SOURCE_CITATIONS` | `boolean` | `true` | Judge에서 원문 인용 포함 |
| `ENABLE_DYNAMIC_THRESHOLD` | `boolean` | `true` | 검색 점수 동적 임계값 |
| **비활성 (실험)** | | | |
| `ENABLE_PATTERN_EXTRACTION` | `boolean` | `false` | 글쓰기 패턴 추출 |
| `ENABLE_AGENTIC_CHUNKING` | `boolean` | `false` | AI 기반 청킹 |
| `ENABLE_SHADOW_WRITER` | `boolean` | `false` | Ghost Text 자동완성 |
| `ENABLE_DEEP_SCHOLAR` | `boolean` | `false` | 외부 학술 검색 |
| `ENABLE_RICH_SHADOW_WRITER` | `boolean` | `false` | TipTap 기반 리치 에디터 |
| `ENABLE_AI_STRUCTURER` | `boolean` | `false` | AI 구조 분석기 |
| **UI** | | | |
| `ENABLE_DUAL_PANE` | `boolean` | `true` | 2단 패널 레이아웃 |
| `ENABLE_THREE_PANE` | `boolean` | `false` | 3단 패널 레이아웃 |
| `ENABLE_CHAT_HISTORY` | `boolean` | `true` | 채팅 세션 이력 |
| **템플릿 시스템** | | | |
| `ENABLE_TEMPLATE_BUILDER` | `boolean` | `true` | 템플릿 빌더 |
| `ENABLE_CONSISTENCY_GATE` | `boolean` | `true` | 일관성 검증 게이트 |
| `ENABLE_HALLUCINATION_GATE` | `boolean` | `true` | 환각 검증 게이트 |
| `ENABLE_REGRESSION_GATE` | `boolean` | `true` | 회귀 검증 게이트 |
| **비용 관리** | | | |
| `COST_GUARD_ENABLED` | `boolean` | `true` | 토큰 비용 모니터링 |
| `COST_GUARD_ALERT_THRESHOLD_USD` | `number` | `0.5` | 비용 경고 임계값 (USD) |

### Lazy Self-RAG 설정

```typescript
LAZY_SELF_RAG_CONFIG: {
  MIN_RESPONSE_LENGTH: 500,  // 이 길이 이상이면 Stage 4 실행
  MIN_QUERY_LENGTH: 50,      // 이 길이 이상이면 Stage 1 실행
}
```

### 플래그 접근 방법

```typescript
import { FEATURE_FLAGS } from '@/config/featureFlags'

if (FEATURE_FLAGS.ENABLE_SELF_RAG) {
  // Self-RAG 로직 실행
}
```

---

## 2. LLM Usage Map

파일: `frontend/src/config/llm-usage-map.ts`

모든 LLM 호출의 모델/파라미터를 중앙 관리합니다 (Jemiel Ensemble Strategy).

### 사용 컨텍스트별 설정

```typescript
interface UsageConfig {
  modelId: string
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
  }
}
```

| 컨텍스트 키 | 모델 | temperature | topP | 용도 |
|-------------|------|-------------|------|------|
| **RAG Pipeline** | | | | |
| `rag.answer` | gemini-3-flash-preview | 0.3 | 0.95 | RAG 응답 생성 |
| `rag.reviewer` | gemini-3-flash-preview | 0.1 | - | 응답 리뷰 |
| `rag.reranker` | gemini-3-flash-preview | 0.0 | - | 검색 결과 재랭킹 |
| `rag.selfrag` | gemini-3-flash-preview | 0.0 | 1.0 | Self-RAG 검증 |
| `rag.chunking` | gemini-3-flash-preview | 0.1 | - | Agentic 청킹 |
| **Judge** | | | | |
| `judge.align` | gemini-3-flash-preview | 0.1 | - | 기준별 판정 |
| `judge.holistic` | gemini-3-flash-preview | 0.1 | - | 종합 평가 |
| **Template** | | | | |
| `template.consistency` | gemini-3-flash-preview | 0.0 | - | 일관성 게이트 |
| `template.hallucination` | gemini-3-flash-preview | 0.0 | - | 환각 게이트 |
| `template.regression` | gemini-3-flash-preview | 0.0 | - | 회귀 게이트 |
| **Mining** | | | | |
| `example.mining` | gemini-3-flash-preview | 0.3 | - | 예시 추출 |
| `rule.mining` | gemini-3-flash-preview | 0.2 | - | 규칙 추출 |
| **Premium** | | | | |
| `premium.answer` | gemini-3-pro-preview | 0.3 | 0.95 | 프리미엄 응답 |
| `premium.reviewer` | gemini-3-pro-preview | 0.1 | - | 프리미엄 리뷰 |
| **기타** | | | | |
| `suggest.completion` | gemini-3-flash-preview | 0.7 | 0.9 | Shadow Writer |
| `research.query` | gemini-3-flash-preview | 0.3 | - | 연구 쿼리 생성 |
| `research.summarize` | gemini-3-flash-preview | 0.2 | - | 연구 결과 요약 |
| `pattern.extraction` | gemini-3-flash-preview | 0.2 | - | 패턴 추출 |
| `outline.generation` | gemini-3-flash-preview | 0.3 | - | 목차 생성 |
| `ocr.vision` | gemini-3-flash-preview | 0.0 | - | 이미지 OCR |
| `chat.general` | gemini-3-flash-preview | 0.7 | 0.95 | 일반 채팅 |
| `raft.generation` | gemma-3-12b-it | 0.3 | - | RAFT 데이터 생성 |

### API 함수

```typescript
// 컨텍스트 키로 모델 ID 가져오기
export function getModelForUsage(context: string): string

// 컨텍스트 키로 전체 설정 가져오기
export function getUsageConfig(context: string): UsageConfig | undefined

// 등록된 모든 컨텍스트 검증
export function validateAllContexts(): { valid: boolean; errors: string[] }

// 디버그: 모든 컨텍스트 출력
export function debugPrintAllContexts(): void
```

---

## 3. LLM Config

파일: `frontend/src/config/llm.config.ts`

### 함수

```typescript
// 활성화된 LLM 프로바이더 목록 (API 키 존재 여부로 판단)
export function getEnabledProviders(): ('gemini' | 'openai' | 'anthropic')[]

// 기본 모델 ID
export function getDefaultModel(): string
// → process.env.DEFAULT_MODEL || MODEL_REGISTRY에서 isDefault=true인 모델

// 프로바이더별 API 키
export function getProviderApiKey(provider: string): string | undefined
// → 'gemini': GOOGLE_API_KEY
// → 'openai': OPENAI_API_KEY
// → 'anthropic': ANTHROPIC_API_KEY

// 프로바이더 활성화 여부
export function isProviderEnabled(provider: string): boolean
```

---

## 4. Embedding Models

파일: `frontend/src/config/embedding-models.ts`

```typescript
interface EmbeddingModelConfig {
  provider: 'gemini' | 'openai'
  modelId: string
  displayName: string
  dimensions: number
  costPer1MTokens: number  // USD
  enabled: boolean
}

const EMBEDDING_MODELS: Record<string, EmbeddingModelConfig> = {
  'text-embedding-004': {
    provider: 'gemini',
    modelId: 'text-embedding-004',
    displayName: 'Gemini Embedding',
    dimensions: 768,
    costPer1MTokens: 0.01,
    enabled: true,           // 기본 활성
  },
  'text-embedding-3-small': {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'OpenAI Embedding 3 Small',
    dimensions: 1536,
    costPer1MTokens: 0.02,
    enabled: false,          // 비활성
  },
}
```

| 모델 | Provider | 차원 | 비용/1M토큰 | 상태 |
|------|----------|------|-------------|------|
| text-embedding-004 | Gemini | 768 | $0.01 | 활성 (기본) |
| text-embedding-3-small | OpenAI | 1536 | $0.02 | 비활성 |

---

## 5. Model Registry

파일: `frontend/src/config/models.ts`

> 상세 내용은 [data-model-schema.md § 1.11](data-model-schema.md#111-llm-model-config) 참조

### 모델 비용 요약 (USD per token)

| Model | Input | Output | Tier |
|-------|-------|--------|------|
| gemini-1.5-flash-002 | $0.000000075 | $0.0000003 | free |
| **gemini-3-flash-preview** | $0.0000005 | $0.000003 | developer |
| gemini-3-pro-preview | $0.00125 | $0.005 | premium |
| gemma-3-27b-it | $0.00000004 | $0.00000015 | premium |
| gemma-3-12b-it | $0.00000003 | $0.00000012 | free |
| gpt-5.2-2025-12-11 | $0.00000175 | $0.000014 | premium |
| gpt-5-mini | $0.00000025 | $0.000002 | free |
| claude-opus-4-5 | $0.000005 | $0.000025 | premium |
| claude-sonnet-4-5 | $0.000003 | $0.000015 | premium |
| claude-haiku-4-5 | $0.000001 | $0.000005 | free |

---

## 6. Next.js Config

파일: `frontend/next.config.js`

```javascript
const nextConfig = {
  reactStrictMode: true,

  // 패키지 임포트 최적화
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },

  // 이미지 최적화 (개발 환경에서는 비활성)
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // 환경 변수
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'PRISM Writer',
  },
}
```

---

## 7. Tailwind Config

파일: `frontend/tailwind.config.js`

```javascript
module.exports = {
  darkMode: 'class',  // 수동 다크모드 토글
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // PRISM 브랜드 색상
      colors: {
        primary: { /* indigo 팔레트 */ },
        secondary: { /* pink 팔레트 */ },
        accent: { /* purple 팔레트 */ },
      },
      // Dual Pane 레이아웃 너비
      width: {
        'pane-sm': '360px',
        'pane-md': '480px',
        'pane-lg': '600px',
      },
    },
  },
}
```

### 커스텀 색상 체계

| 이름 | 기본 색상 | 용도 |
|------|-----------|------|
| `primary` | Indigo | 주요 버튼, 링크, 강조 |
| `secondary` | Pink | 보조 요소 |
| `accent` | Purple | 특수 강조, 배지 |

---

## 8. TypeScript Config

파일: `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**주요 설정**

| 옵션 | 값 | 설명 |
|------|-----|------|
| `strict` | `true` | 엄격한 타입 검사 |
| `paths.@/*` | `./src/*` | `@/` 경로 별칭 |
| `incremental` | `true` | 증분 빌드 |
| `moduleResolution` | `bundler` | 번들러 모드 |

---

## 9. Middleware (RBAC)

파일: `frontend/src/middleware.ts`

### 역할 기반 접근 제어

```typescript
// 역할 계층
const ROLE_HIERARCHY: Record<UserRole, number> = {
  pending: 0,
  free: 1,
  premium: 2,
  special: 3,
  admin: 4,
}
```

### 경로별 요구사항

| 경로 | 최소 역할 | 승인 필요 | 설명 |
|------|-----------|-----------|------|
| `/admin/*` | `admin` (4) | Y | 관리자 전용 |
| `/editor/*` | `free` (1) | Y | 승인된 사용자만 |
| `/profile/*` | `pending` (0) | N | 모든 인증 사용자 |
| `/dashboard/*` | `pending` (0) | N | 모든 인증 사용자 |
| `/trash/*` | `pending` (0) | N | 모든 인증 사용자 |

### 미들웨어 적용 범위

```typescript
export const config = {
  matcher: [
    '/editor/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/dashboard/:path*',
    '/trash/:path*',
  ],
}
```

### 인증 흐름

1. Supabase 세션 확인
2. 세션 없음 → `/login`으로 리다이렉트
3. 프로필 조회 (`profiles` 테이블)
4. 역할 계층 검증
5. 승인 상태 검증 (필요 시)
6. 실패 → `/profile`로 리다이렉트 (권한 부족 안내)

---

## 10. Playwright Config

파일: `frontend/playwright.config.ts`

```typescript
defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

| 항목 | 로컬 | CI |
|------|------|-----|
| 병렬 실행 | 무제한 | 1 worker |
| 재시도 | 0회 | 2회 |
| forbidOnly | false | true |
| 서버 재사용 | true | false |

---

## 11. Vitest Config

파일: `frontend/vitest.config.ts`

```typescript
defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
```

| 항목 | 값 |
|------|-----|
| 환경 | `node` |
| 전역 API | `true` (`describe`, `it`, `expect` 등) |
| 제외 경로 | node_modules, e2e, dist |

---

## 12. Docker Compose

파일: `docker-compose.dev.yml`

### 서비스 구성

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - APP_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - FRONTEND_URL=http://frontend:3000
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      backend:
        condition: service_healthy
    command: npm run dev
```

| 서비스 | 포트 | 핫 리로드 | 상태 확인 |
|--------|------|-----------|-----------|
| Backend (FastAPI) | 8000 | `--reload` | `/health` 엔드포인트 |
| Frontend (Next.js) | 3000 | `npm run dev` | depends_on backend |

---

## 13. LLM 모델 변경 가이드

> 출처: LLM_Model_Change_Guide_v2.md (2026-01-10)

### 13.1 핵심 규칙

1. **`models.ts`에 등록된 모델만 사용 가능** — 등록되지 않은 문자열 입력 시 TypeScript 컴파일 에러 발생
2. **`llm-usage-map.ts` 한 곳에서만 변경** — 여러 파일을 수정할 필요 없음

### 13.2 상황 A: 기존 모델로 변경

예: Shadow Writer를 `gemini-3-flash` → `gpt-5-mini`로 변경

```typescript
// 파일: frontend/src/config/llm-usage-map.ts

// 변경 전
'suggest.completion': {
  modelId: 'gemini-3-flash-preview',
}

// 변경 후 (오타 시 빨간 줄 표시)
'suggest.completion': {
  modelId: 'gpt-5-mini-2025-08-07',
}
```

저장 시 즉시 반영 (서버 재시작 불필요).

### 13.3 상황 B: 새 모델 추가

**Step 1 — 모델 등록** (`frontend/src/config/models.ts`):

```typescript
export const MODEL_REGISTRY = {
  // 기존 모델들 ...
  "gemini-2.0-flash": {
    provider: "gemini",
    displayName: "Gemini 2.0 Flash",
    capabilities: ["text-generation", "vision"],
    costPerInputToken: 0.0000001,
    costPerOutputToken: 0.0000004,
    maxTokens: 32000,
    tier: "free",
    enabled: true,
  },
} as const satisfies ...;
```

**Step 2 — 모델 사용** (`frontend/src/config/llm-usage-map.ts`):

등록 후 자동 완성 목록에 표시됩니다.

### 13.4 디버깅

| 문제 | 해결 |
|------|------|
| 오타 여부 확인 | `modelId` 필드에 빨간 밑줄 표시: `Type '"gemini-1.5-flsh"' is not assignable to type 'ValidModelId'` |
| 변경 미적용 | 브라우저 콘솔(F12)에서 `printUsageMap()` 실행 → 현재 모델 목록 ✅/❌ 상태 확인 |

---

## 14. Adaptive Threshold 메커니즘

> 출처: Service Logic Manual v1.1 (2026-01-09)

사용자의 구조 분석 피드백에 따라 RAG 검색 임계값을 자동 조정하는 시스템입니다.

### 14.1 동작 원리

| 사용자 행동 | 시그널 | 임계값 변화 | 의미 |
|------------|--------|------------|------|
| AI 제안 **수락** (Accept) | `structure_accept` | `similarity_threshold -= 0.02` | "이 정도면 충분" → 넓은 범위 검색 |
| AI 제안 **수정** (Modify/DnD) | `structure_modify` | `similarity_threshold += 0.01` | "아직 부족" → 엄격한 검색 |

### 14.2 관련 테이블

- `structure_suggestions` — AI 제안 저장 (`is_applied` 컬럼으로 수락 여부 추적)
- `structure_user_adjustments` — 사용자 수정 순서 저장
- `project_rag_preferences` — `similarity_threshold` 값 관리

### 14.3 Graceful Degradation

DB 저장이나 피드백 연동이 실패해도 사용자의 순서 변경 행위는 방해받지 않도록 `try-catch` 블록으로 비침투적(Non-intrusive) 설계를 적용합니다.
