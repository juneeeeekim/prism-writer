# Decision Log

> PRISM Writer 프로젝트의 주요 설계 결정 기록
> 각 결정의 배경, 선택지, 채택 이유, 트레이드오프를 문서화합니다.

---

## DL-001: LLM Provider 전략 - Multi-Provider + Gateway 패턴

### 배경
글쓰기 보조 도구에서 LLM은 핵심 기능이며, 단일 Provider에 의존하면 장애 시 전체 서비스가 중단됩니다.

### 선택지
1. **단일 Provider (OpenAI 또는 Gemini)** - 단순하나 장애에 취약
2. **Multi-Provider + Gateway 패턴** - 추상화 레이어로 Provider 교체 가능
3. **LLM Orchestrator 서비스 (LangChain 등)** - 기능 풍부하나 의존성 과다

### 결정
**Multi-Provider + Gateway 패턴** 채택 (`lib/llm/gateway.ts`)

### 이유
- `generateText(prompt, options)` 단일 인터페이스로 모든 Provider 추상화
- `getProviderByModel(modelId)`로 모델 ID 기반 자동 Provider 라우팅
- Fallback 전략: Primary 실패 시 `llm-usage-map.ts`의 context별 fallback 모델로 자동 재시도
- LangChain 없이 경량 구현 (번들 크기 최적화)

### 트레이드오프
- Provider별 고유 기능 (Function Calling 세부 옵션 등) 활용이 제한적
- Gateway 레이어 유지보수 비용 (새 Provider 추가 시 adapter 구현 필요)

---

## DL-002: LLM 모델 라우팅 - 중앙 집중식 Usage Map

### 배경
30+ 기능 컨텍스트 (chat, judge, reviewer, patch 등)에 각각 다른 모델/온도를 사용해야 합니다. 코드 곳곳에 모델명이 하드코딩되면 관리가 불가능합니다.

### 선택지
1. **각 모듈에서 직접 모델 지정** - 분산 관리, 일관성 부족
2. **중앙 Usage Map** - 단일 파일에서 모든 라우팅 관리
3. **DB 기반 동적 설정** - 런타임 변경 가능하나 복잡도 증가

### 결정
**중앙 집중식 `llm-usage-map.ts`** 채택 (Jemiel Ensemble Strategy)

### 이유
- 30+ 컨텍스트-모델 매핑을 단일 파일에서 관리
- `getModelForUsage(context)`: context 키로 모델 ID 반환
- `getFallbackModel(context)`: context별 fallback 모델 반환
- temperature, topP 등 생성 파라미터도 함께 관리
- 코드 검색 한 번으로 어떤 기능이 어떤 모델을 쓰는지 파악 가능

### 트레이드오프
- 런타임 모델 변경 불가 (빌드 타임에 결정)
- 파일이 커질 수 있음 (현재 30+ 엔트리)

---

## DL-003: 검색 전략 - Hybrid Search (Vector + BM25)

### 배경
순수 Vector Search는 의미적 유사도에 강하지만, 정확한 키워드 매칭에 약합니다. 글쓰기 도메인에서 "기승전결", "Hook", "CTA" 같은 전문 용어 매칭이 필수적입니다.

### 선택지
1. **Vector Search만** - 의미 검색 우수, 키워드 약함
2. **BM25만** - 키워드 강함, 의미 검색 약함
3. **Hybrid (Vector + BM25)** - 양쪽 장점 결합

### 결정
**Hybrid Search** 채택 (pgvector + Supabase full-text search)

### 이유
- Vector: 추상적 질문 ("어떻게 글을 써야 하나요?") 처리
- BM25: 전문 용어 검색 ("공감-정보 구조", "기승전결") 처리
- RRF (Reciprocal Rank Fusion) 또는 가중 점수 합산(Weighted Score Fusion)으로 결합
- Dynamic Threshold로 쿼리 특성에 따라 임계값 자동 조정 (추상→낮춤, 구체→높임)

### 트레이드오프
- Vector + Keyword 이중 인덱싱으로 스토리지 비용 증가
- 두 검색의 점수 정규화가 까다로움

---

## DL-004: 평가 체계 - 3단계 Judge 시스템

### 배경
단순 점수 제시만으로는 사용자가 어디를 어떻게 고쳐야 하는지 알 수 없습니다.

### 선택지
1. **단일 LLM 평가** - 한 번에 총점 + 피드백
2. **다단계 파이프라인** - 분석 → 종합 → 패치 생성
3. **사람 리뷰어 참여** - 정확하나 확장 불가

### 결정
**3단계 파이프라인** 채택

```
1. Align Judge    → 기준별 개별 점수 + 근거 (per-criteria)
2. Holistic Advisor → A+B+C 종합 분석 + 우선순위 조언
3. Patch Generator  → 구체적 수정 제안 (Before → After)
```

### 이유
- Align Judge: 각 기준(구조, 스타일, 논리 등)에 대해 독립적으로 평가 → 편향 감소
- Holistic Advisor: 개별 점수를 종합하여 큰 그림 제시 → 사용자 액션 우선순위 제공
- Patch Generator: 실제 수정 예시 생성 → "이렇게 고치세요" 제시 가능
- 각 단계가 독립적이므로 병렬 실행 가능

### 트레이드오프
- LLM 호출 3회 이상 필요 (비용 증가)
- 단계 간 결과 불일치 가능성 (Align Judge 높은데 Holistic은 낮은 평가)

---

## DL-005: Pipeline 버전 관리 - Feature Flag 기반 점진적 롤아웃

### 배경
RAG 파이프라인은 v3 → v4 → v5로 진화했으며, 새 버전이 문제가 있을 경우 즉시 롤백해야 합니다.

### 선택지
1. **Branch 배포** - 버전별 별도 브랜치, 롤백 시 재배포
2. **Feature Flag** - 환경 변수로 실시간 전환
3. **A/B 테스트 플랫폼** - 사용자 그룹별 분리

### 결정
**Feature Flag 기반** 채택 (`config/featureFlags.ts`)

### 이유
- 60+ Feature Flag로 개별 기능 단위 제어
- 환경 변수만 변경하면 재배포 없이 즉시 롤백
- `getPipelineVersion()` → `'v3' | 'v4' | 'v5'` 중앙 판별
- 기본값 패턴 2가지:
  - `!== 'false'`: 기본 활성화 (프로덕션 검증 완료 기능)
  - `=== 'true'`: 기본 비활성화 (실험 기능, 비용 발생 기능)
- `isFeatureEnabled(flag)` 타입 안전 헬퍼 (boolean 플래그만 허용)

### 트레이드오프
- Flag가 많아질수록 조합 경우의 수 폭발 (현재 60+)
- 오래된 Flag 정리 (Technical Debt) 필요

---

## DL-006: Gate 시스템 - 다중 검증 레이어

### 배경
LLM 생성 결과의 품질을 보장해야 합니다. 환각, 인용 오류, 과도한 수정 등을 방지해야 합니다.

### 선택지
1. **단일 검증** - LLM이 한 번에 모든 검증
2. **규칙 기반 Gate** - 정규식/점수 기반 사전 필터
3. **다중 Gate 파이프라인** - 단계별 독립 검증

### 결정
**다중 Gate 파이프라인** 채택

### Pipeline별 Gate 구성

| Pipeline | Gate 목록 |
|----------|---------|
| v3 | Citation Gate, Consistency Gate, Hallucination Gate |
| v4 | v3 + Regression Gate |
| v5 | v4 + Diff Safety Gate, Upgrade Effect Gate |

### 이유
- 각 Gate가 단일 책임 (Single Responsibility)
- 독립적 비활성화 가능 (Feature Flag)
- 가중 평균으로 최종 점수 계산 (Hallucination은 가중치 1.2, 더 중요)
- LLM Gate 실패 시 보수적 통과 원칙 → 시스템 장애로 사용자 블락 방지

### 트레이드오프
- Gate 추가 시마다 타입 통합 필요 (`unifyGateResults`)
- 전체 Gate 실행 시간 증가 (병렬 실행으로 완화)

---

## DL-007: 에러 처리 철학 - Graceful Degradation

### 배경
LLM 기반 시스템은 외부 API 의존도가 높아, 어떤 부분이 실패해도 전체 시스템은 동작해야 합니다.

### 결정
**Graceful Degradation** (우아한 성능 저하) 전략

### 구체적 원칙

| 상황 | 전략 | 예시 |
|------|------|------|
| LLM Gate 호출 실패 | 보수적 통과 (`passed: true, score: 0.5`) | ConsistencyGate, HallucinationGate |
| 사용자 등급 조회 실패 | 가장 낮은 등급으로 폴백 (`'free'`) | costGuard.getUserTier |
| Agentic Chunking 실패 | 기존 semanticChunk으로 폴백 | documentProcessor |
| Primary LLM 실패 | Fallback 모델로 재시도 | gateway.ts |
| 사용량 기록 실패 | 로그만 남김 (비치명적) | costGuard.trackUsage |
| 상태 업데이트 실패 | 로그만 남김 (이중 에러 방지) | updateDocumentStatus |
| Feature Flag 미설정 | 안전한 기본값 사용 | featureFlags.ts |

### 트레이드오프
- "조용한 실패"가 디버깅을 어렵게 할 수 있음 → 구조화 로깅으로 완화
- 보수적 통과로 인해 품질 저하 결과가 사용자에게 도달할 수 있음

---

## DL-008: 프론트엔드 아키텍처 - Next.js App Router + Server Components

### 배경
프론트엔드와 백엔드가 밀접하게 결합된 RAG 시스템에서 API 레이어를 어떻게 구성할지 결정해야 합니다.

### 선택지
1. **CRA + 별도 Express 서버** - 전통적이나 배포 복잡
2. **Next.js Pages Router** - 안정적이나 Server Components 불가
3. **Next.js App Router** - Server Components, Route Handlers 지원

### 결정
**Next.js 14 App Router** 채택

### 이유
- Route Handlers (`app/api/*/route.ts`): REST API를 프론트엔드 프로젝트 내에서 직접 구현
- Server Components: LLM API 키를 클라이언트에 노출하지 않고 서버에서 직접 호출
- Vercel 네이티브 배포: 빌드/배포 자동화
- 파일 시스템 기반 라우팅: 직관적 URL 매핑

### 트레이드오프
- Vercel Serverless 함수 시간 제한 (Hobby: 10초, Pro: 60초) → 긴 LLM 처리에 제약
- App Router 학습 곡선 (Server/Client Components 구분)
- `pdf2json` 등 Node.js 모듈 호환 이슈 (Serverless 환경)

---

## DL-009: 상태 관리 - Zustand + React Context 이원화

### 배경
에디터의 복잡한 전역 상태 (문서 내용, 대화 이력, 평가 결과)와 인증/프로젝트 정보를 관리해야 합니다.

### 선택지
1. **Redux** - 강력하나 보일러플레이트 과다
2. **Zustand** - 경량, 보일러플레이트 최소
3. **React Context만** - 추가 라이브러리 불필요, 리렌더링 이슈
4. **Jotai/Recoil** - Atomic 패턴

### 결정
**Zustand + React Context 이원화**

### 역할 분담

| 영역 | 관리 방식 | 사용처 |
|------|---------|--------|
| 에디터 상태 (문서 내용, 탭, 평가) | Zustand (`useEditorState`) | 고빈도 업데이트, persist 필요 |
| 프로젝트 컨텍스트 | React Context (`ProjectContext`) | 저빈도, 인증 후 1회 로드 |
| 테마 | React Context (`ThemeContext`) | 전역 일관성 |

### 이유
- Zustand: 에디터 상태의 고빈도 업데이트에 최적 (selector 기반 구독 → 불필요 리렌더 방지)
- `persist` 미들웨어로 localStorage 자동 저장 (`prism-editor-storage`)
- React Context: 인증/프로젝트처럼 변경 빈도가 낮은 데이터에 적합
- 라이브러리 의존성 최소화 (Zustand = ~1KB)

### 트레이드오프
- 두 가지 상태 관리 방식 혼용 → 새 개발자 혼란 가능
- Zustand와 Context 간 데이터 동기화 주의 필요

---

## DL-010: 환각 방지 전략 - 다층 방어

### 배경
RAG 시스템에서 LLM이 참고 자료가 있는데도 "자료에 내용이 없다"고 답하거나 (회피형 환각), 자료에 없는 내용을 만들어내는 (생성형 환각) 문제가 발생합니다.

### 결정
**다층 방어 (Defense in Depth)** 전략

### 방어 레이어

```
Layer 1: 프롬프트 엔지니어링
  └─ "반드시 참고 자료를 먼저 확인하세요" 지시
  └─ Chain of Thought 사고 과정 유도
  └─ 인용 마커 ([1], [2]) 삽입 요구

Layer 2: 검색 품질 보장
  └─ Dynamic Threshold (추상 질문 → 낮은 임계값 → 더 많은 문서)
  └─ Sufficiency Gate (근거 충분성 사전 검사)
  └─ Re-ranking (1차 결과를 LLM으로 재평가)

Layer 3: 응답 후 검증
  └─ Hallucination Detector (회피형 패턴 8개 탐지)
  └─ Citation Gate (인용문-원본 매칭 검증, 70% 임계값)
  └─ Self-RAG 4단계 (검색 필요 → 관련도 → 생성 → 근거 검증)

Layer 4: 비용 최적화
  └─ Lazy Self-RAG (고위험 응답에만 검증 → 비용 70% 절감)
```

### 이유
- 단일 방어 레이어로는 환각을 완전히 방지할 수 없음
- 각 레이어가 다른 유형의 환각을 포착
- Feature Flag로 개별 레이어 ON/OFF 가능
- 비용과 품질 간 균형 조절 가능 (Lazy Self-RAG)

### 트레이드오프
- 전체 파이프라인 레이턴시 증가 (Self-RAG 활성화 시 LLM 4회 추가 호출)
- 환각 탐지 False Positive 가능 (신뢰도 가중치로 완화)
- Lazy Self-RAG로 일부 저위험 환각을 놓칠 수 있음

---

## DL-011: 데이터베이스 전략 - Supabase (PostgreSQL + pgvector)

### 배경
RAG 시스템에는 관계형 데이터 (사용자, 프로젝트) + 벡터 데이터 (임베딩) + 파일 스토리지가 모두 필요합니다.

### 선택지
1. **MongoDB + Pinecone** - 유연하나 서비스 2개 관리
2. **Supabase (PostgreSQL + pgvector)** - 올인원
3. **Firebase + Weaviate** - 실시간 + 벡터 DB
4. **PlanetScale + Milvus** - MySQL 기반 + 전용 벡터 DB

### 결정
**Supabase** 채택

### 이유
- PostgreSQL 단일 DB로 관계형 + 벡터 데이터 통합
- pgvector 확장으로 임베딩 저장/유사도 검색 (`match_document_chunks` RPC)
- RLS (Row-Level Security)로 데이터 접근 제어 (프론트엔드에서 직접 쿼리 가능)
- Built-in Auth, Storage, Realtime
- Vercel과 네이티브 통합
- 무료 티어로 개발/스타트업 단계에서 비용 없음

### 트레이드오프
- 대규모 벡터 검색 시 Pinecone/Weaviate 대비 성능 제한 가능
- PostgreSQL 단일 인스턴스 확장 한계 (Supabase Pro 이상 필요)
- Supabase 플랫폼 종속 (이탈 시 PostgreSQL로 마이그레이션 필요)

---

## DL-012: 임베딩 전략 - Provider 별 모델 선택

### 배경
임베딩 모델 선택이 검색 품질과 비용에 직접적으로 영향을 미칩니다.

### 결정

| Provider | 모델 | 차원 | 용도 |
|----------|------|------|------|
| Google Gemini | `text-embedding-004` | 768 | Primary (기본) |
| OpenAI | `text-embedding-3-small` | 1536 | Fallback |

### 이유
- Gemini embedding: 비용 효율적, 한국어 성능 양호
- 768차원: pgvector 인덱스 크기와 검색 속도 최적
- OpenAI fallback: Gemini 장애 시 대체
- 임베딩 버전 관리 필드 (`embedding_model_id`, `embedding_dim`, `embedded_at`)로 모델 변경 시 추적 가능

### 트레이드오프
- 768차원 vs 1536차원 간 검색 결과 차이 발생 가능
- 모델 변경 시 기존 임베딩 재생성 필요

---

## DL-013: 청킹 전략 - Semantic Chunking + Agentic Chunking

### 배경
RAG 검색 품질은 청킹 품질에 크게 의존합니다. 단순 토큰 수 기반 분할은 문맥을 파괴합니다.

### 결정

```
기본: Semantic Chunking (규칙 기반)
  └─ 단락 경계 기반 분할
  └─ 청크 타입 분류 (rule / example / general)
  └─ 메타데이터 유지 (header, index)

고급: Agentic Chunking (LLM 기반, Feature Flag)
  └─ LLM이 문서 구조 분석 후 최적 분할 지점 결정
  └─ 실패 시 Semantic Chunking으로 자동 폴백
```

### 이유
- Semantic Chunking: LLM 호출 없이 빠르고 저렴
- Agentic Chunking: LLM이 "여기서 끊어야 의미가 보존된다"를 판단 → 품질 향상
- Fallback 보장: Agentic 실패 시 반드시 기존 로직으로 폴백
- Feature Flag (`ENABLE_AGENTIC_CHUNKING`)으로 비용 제어

### 트레이드오프
- Agentic Chunking은 문서당 LLM 1회 추가 호출 (비용/시간 증가)
- 청크 타입 분류 정확도가 검색 필터링 품질에 직결

---

## DL-014: 인증/권한 체계 - Supabase Auth + Role Hierarchy

### 배경
사용자 인증과 세분화된 권한 관리가 필요합니다.

### 결정

```
인증: Supabase Auth (OAuth 2.0 + Email/Password)
권한: Role Hierarchy
  pending → free → premium → special → admin
```

### 이유
- Supabase Auth: JWT 기반, RLS와 자동 통합
- Role Hierarchy: `profiles.role` 컬럼으로 단순 관리
- Middleware(`middleware.ts`)에서 경로별 RBAC 적용
- Cost Guard에서 role을 tier로 매핑 (`special`/`admin` → `enterprise`)

### 트레이드오프
- 세분화된 Permission 모델 (RBAC Matrix) 대비 유연성 부족
- Role 변경 시 세션 갱신 필요 (실시간 반영 지연 가능)

---

## DL-015: PDF 파싱 전략 - pdf2json 선택

### 배경
Vercel Serverless 환경에서 PDF 텍스트 추출이 필요합니다.

### 선택지
1. **pdf-parse** - 인기 있으나 Canvas/DOMMatrix 의존 (Serverless 비호환)
2. **pdf2json** - 순수 JavaScript, 의존성 없음
3. **서버사이드 Python (PyPDF2)** - 별도 백엔드 필요

### 결정
**pdf2json** 채택 (동적 import)

### 이유
- 순수 JavaScript: Canvas, DOM 의존성 완전 제거
- Vercel Serverless 환경 호환 (DOMMatrix 에러 없음)
- 한글 지원: URL 인코딩된 텍스트를 `decodeURIComponent`로 수동 디코딩
- 동적 import (`require('pdf2json')`): 번들 사이즈 최적화

### 트레이드오프
- 한글 인코딩이 완벽하지 않을 수 있음 (수동 디코딩 필요)
- 스캔 PDF (이미지 PDF) 미지원 → OCR/Vision으로 안내
- `getRawTextContent()` fallback은 한글 인코딩 문제 있음 → Pages→Texts→R→T 직접 추출 우선

---

## DL-016: 프론트엔드 에디터 전략 - Dual/Three Pane + Shadow Writer

### 배경
글쓰기 보조 도구의 핵심 UX는 "에디터 + 평가 + 제안"을 동시에 제공하는 것입니다.

### 결정

```
기본: Dual Pane (에디터 + 어시스턴트 패널)
  └─ 왼쪽: 에디터 (textarea 또는 TipTap Rich Editor)
  └─ 오른쪽: 어시스턴트 (Outline, Chat, References, Research 탭)

고급: Three Pane (에디터 + 부합도 + 제안 카드)
  └─ Feature Flag (ENABLE_THREE_PANEL_UI)로 제어

에디터 내 보조:
  └─ Shadow Writer: Ghost Text로 다음 문장 실시간 제안
  └─ Tab 수락, Escape 취소
  └─ Trigger 모드: auto / sentence-end / manual
```

### 이유
- Dual Pane: 대부분의 사용 시나리오에 적합, 심플한 UX
- Three Pane: 고급 사용자를 위한 확장 레이아웃 (점진적 롤아웃)
- Shadow Writer: GitHub Copilot 스타일의 인라인 제안 → 글쓰기 흐름 유지
- sentence-end 모드: 문장 끝에서만 호출 → LLM 비용 제어

### 트레이드오프
- Three Pane은 좁은 화면에서 UX 저하
- Shadow Writer auto 모드는 LLM 호출 빈도 높음 (비용)
- TipTap Rich Editor는 textarea 대비 번들 사이즈 증가

---

## DL-017: 비용 관리 전략 - 등급별 일일 한도 + Lazy 모드

### 배경
LLM 호출과 임베딩 생성은 토큰당 과금됩니다. 무제한 사용은 비용 폭증으로 이어집니다.

### 결정

```
1. Cost Guard: 등급별 일일 토큰 한도
   free: 50K / premium: 500K / enterprise: 5M

2. Lazy Self-RAG: 고위험 응답에만 Self-RAG 검증
   조건: 참고 자료 있음 + 응답 500자 이상 + 질문 50자 이상
   효과: 비용 70% 절감 예상

3. Model Router: 모드별 모델 선택
   cheap: 저비용, 검토 없음
   standard: 균형
   strict: 고품질, 상세 검토
```

### 이유
- 사용자 등급에 맞는 합리적 한도 설정
- 모든 응답을 검증하면 비용 과다 → 위험도 기반 선택적 검증
- 사용자가 품질/비용 트레이드오프를 직접 제어 가능 (모드 선택)

### 트레이드오프
- 무료 사용자의 사용 경험 제한 (50K 토큰/일 ≈ 100쪽)
- Lazy 모드에서 일부 환각이 미검증 통과 가능

---

## DL-018: 테스트 전략 - Vitest + Playwright + Pytest

### 배경
프론트엔드(TypeScript), 백엔드(Python), E2E까지 다중 스택 테스트가 필요합니다.

### 결정

| 테스트 유형 | 프레임워크 | 대상 |
|-----------|----------|------|
| Unit (Frontend) | Vitest | RAG 파이프라인, LLM Gateway, 청킹, Gate 시스템 |
| E2E | Playwright | 작성 플로우, RAG 상태 시각화 |
| Unit (Backend) | Pytest | FastAPI 엔드포인트, 아웃라인 생성 |

### 이유
- Vitest: Vite 기반, Next.js와 호환, Jest 대비 빠름
- Playwright: 크로스 브라우저 E2E, API Mock 기능 내장
- Pytest: Python 백엔드 표준 테스트 프레임워크
- 모든 테스트에서 외부 API Mock 적용 (LLM, Supabase)

### 테스트 우선순위

```
1. RAG 파이프라인 정확성 (청킹, 검색, 인용 검증)
2. Gate 시스템 (Citation, Sufficiency, Diff Safety)
3. LLM Gateway (Provider 라우팅, Fallback)
4. E2E 작성 플로우 (업로드 → 평가 → 패치)
```

### 트레이드오프
- LLM 응답 모킹으로 실제 LLM 동작과 차이 발생 가능
- E2E 테스트에서 인증 바이패스 필요 (테스트 환경 설정)

---

## DL-019: 백엔드 아키텍처 - FastAPI 경량 보조 서버

### 배경
Next.js Route Handlers로 대부분의 API를 처리하지만, Python 전용 처리(NLP, 고급 텍스트 분석)가 필요한 기능이 있습니다.

### 결정
**FastAPI 경량 보조 서버** (Python 3.13+)

### 담당 기능
- 아웃라인 자동 생성 (`/api/v1/outline/generate`)
- 참고 자료 리서치 (`/api/v1/references/*`)
- 향후 RAFT 파인튜닝 API

### 이유
- Next.js에서 처리하기 어려운 Python 라이브러리 활용
- FastAPI: 자동 API 문서(Swagger), 타입 검증(Pydantic), 비동기 지원
- Docker Compose로 프론트엔드와 함께 개발 환경 구성

### 트레이드오프
- 서비스 2개 운영 (Next.js + FastAPI) → 배포/모니터링 복잡도 증가
- 프론트-백 간 타입 동기화 수동 관리 필요

---

## DL-020: 에러 메시지 Sanitization - 내부 에러 ↔ 사용자 메시지 분리

### 배경
내부 에러 메시지(스택 트레이스, DB 에러 등)를 사용자에게 그대로 노출하면 보안 위험이 있고 UX도 나쁩니다.

### 결정
**2중 메시지 체계**

```
Internal Error (로그용)           User Error (표시용)
────────────────────           ──────────────────
"Download failed: ECONNRESET"  → "문서 처리 중 오류가 발생했습니다."
"Empty text content"           → "문서 내용이 비어있습니다."
"Token limit exceeded: 50000"  → "일일 사용량을 초과했습니다."
"SCANNED_PDF:..."              → "스캔된 이미지 PDF는 지원되지 않습니다."
```

### 구현
- `documentProcessor.ts`: 에러 메시지 패턴 매칭으로 사용자 메시지 변환
- `errorHandler.ts`: `handleApiError`에서 키워드 기반 자동 분류
- 내부 에러는 `console.error` 구조화 로깅으로 Vercel Functions 로그에 기록

### 이유
- 보안: 내부 시스템 정보 미노출
- UX: 사용자가 이해할 수 있는 한국어 메시지
- 디버깅: 내부 에러는 서버 로그에서 확인 가능

### 트레이드오프
- 패턴 매핑 유지보수 필요 (새 에러 유형 추가 시)
- 사용자 메시지가 너무 일반적이면 문제 원인 파악 어려움

---

## 변경 이력

| 날짜 | 결정 | 설명 |
|------|------|------|
| 2025-12-25 | DL-005, DL-006 | Pipeline v4 Feature Flag, Gate 시스템 도입 |
| 2025-12-27 | DL-010 | 환각 방지 다층 방어 전략 |
| 2025-12-28 | DL-002 | LLM Usage Map 중앙화 마이그레이션 |
| 2026-01-03 | DL-003, DL-006 | Sufficiency Gate 추가, Citation 임계값 상향 |
| 2026-01-06 | DL-013 | Agentic Chunking 추가 |
| 2026-01-08 | DL-016 | Shadow Writer 도입 |
| 2026-01-17 | DL-001 | LLM Gateway Fallback 전략 추가 |
| 2026-01-21 | DL-017 | Lazy Self-RAG 비용 최적화 |
| 2026-02-14 | 전체 | Decision Log 문서 작성 |
