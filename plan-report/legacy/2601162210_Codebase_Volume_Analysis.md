# 코드베이스 파일 크기 분석 보고서

## 개요

요청하신 대로 코드베이스를 스캔하여 1000줄 이상의 코드가 포함된 파일들을 식별했습니다. 이 분석의 목적은 리팩토링을 통해 유지보수성, 가독성 및 성능을 개선할 수 있는 영역을 파악하는 데 있습니다.

**날짜:** 2026-01-16
**기준:** > 1000줄 (주석 포함)

## 주요 발견 사항

스캔 결과 기준치를 초과하는 **4개**의 파일이 확인되었습니다.

| 파일명                   | 위치                     | 라인 수  | 유형       | 우선순위    |
| :----------------------- | :----------------------- | :------- | :--------- | :---------- |
| `search.ts`              | `frontend/src/lib/rag/`  | **1258** | TypeScript | **높음**    |
| `globals.css`            | `frontend/src/app/`      | **1297** | CSS        | **중간**    |
| `prism_lm_...upgrade.md` | `plan_report/임시 저장/` | 1797     | Markdown   | 낮음 (문서) |
| `package-lock.json`      | `frontend/`              | 10983    | JSON       | 무시        |

---

## 상세 분석 및 개선 권장 사항

### 1. `frontend/src/lib/rag/search.ts` (1258줄)

**상태:** <span style="color:red">**심각 (CRITICAL)**</span>
이 파일은 너무 많은 역할을 담당하고 있어 유지보수와 테스트가 어렵습니다. 현재 다음과 같은 기능을 모두 처리하고 있습니다:

- **타입 정의**: `RAGLogEntry`, `SearchResult`, `SearchOptions` 등
- **비즈니스 로직**: 근거 품질 계산 (`calculateEvidenceQuality`)
- **인프라**: 로깅 (`logRAGSearch`), 재시도 로직 (`withRetry`)
- **핵심 검색**: 벡터 검색, 하이브리드 검색, 재정렬(Reranking) 구현

**리팩토링 계획:**
`search` 모듈 디렉토리로 분리:

- `types.ts`: 공통 인터페이스 및 타입 정의
- `utils.ts`: `withRetry`, `calculateEvidenceQuality` 등의 헬퍼 함수
- `logger.ts`: RAG 전용 로깅 로직
- `vector.ts`: `vectorSearch` 구현
- `hybrid.ts`: `hybridSearch` 및 퓨전(Fusion) 로직
- `index.ts`: 공용 API를 내보내는 메인 엔트리 포인트

### 2. `frontend/src/app/globals.css` (1297줄)

**상태:** <span style="color:orange">**경고 (WARNING)**</span>
전역 CSS 파일에 모듈화하거나 Tailwind 유틸리티 클래스로 이동해야 할 스타일이 다수 포함되어 있습니다.

- **발견 사항:** `.project-card`, `.dashboard-*`, `.batch-*`, `.assistant-pane` 등 컴포넌트별 전용 스타일
- **문제점:** 전역 번들 크기 증가 및 스타일 충돌 위험

**리팩토링 계획:**

- **CSS 모듈 추출**: 대시보드 스타일 등을 `Dashboard.module.css` 등으로 이동
- **Tailwind 활용**: 커스텀 클래스를 Tailwind 유틸리티로 교체 (예: 표준 플렉스박스 레이아웃)
- **컴포넌트 스타일**: 프로젝트 카드와 같은 컴포넌트 전용 스타일을 해당 React 컴포넌트 근처로 이동

### 3. `plan_report/임시 저장/prism_lm_claude_upgrade.md` (1797줄)

**상태:** <span style="color:green">**정보 (INFO)**</span>
문서 또는 백업 파일입니다. 크기는 크지만 런타임 성능에는 영향을 주지 않습니다.

- **권장 사항**: 더 이상 필요하지 않다면 아카이브 처리하고, 필요한 경우 현재 상태로 유지해도 무방합니다.

---

## 향후 단계

1. **리팩토링 계획 승인**: `search.ts` 분리 작업을 먼저 진행할지 확인 부탁드립니다.
2. **실행**: 첫 번째 안전한 단계로 `search.ts`에서 `types.ts`와 `utils.ts`를 추출하는 작업부터 시작할 수 있습니다.
