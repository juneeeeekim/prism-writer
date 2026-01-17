# Deep Scholar 검색 기록 영구 저장 및 동기화 구현 검토서

## 1. 개요

사용자는 각 프로젝트별 "근거 찾기(Deep Scholar)" 탭에서 실행한 검색 기록이 휘발되지 않고 유지되기를 원하며, 웹 브라우저 히스토리처럼 전체/개별 삭제 기능을 요구하였습니다. 현재 시스템은 브라우저 `localStorage`를 사용하여 기기 간 동기화가 되지 않는 한계가 있습니다. 이를 서버 기반 영구 저장 시스템으로 전환하기 위한 기술적 검토 및 해결 방안을 제시합니다.

## 2. 현황 분석

- **현재 상태**: `useResearchPersistence` 및 `useResearchHistory` 훅이 `localStorage`(`deep-scholar-history-${projectId}`)를 사용.
- **문제점**:
  1.  **휘발성**: 브라우저 캐시 삭제 시 데이터 소실.
  2.  **비동기화**: 기기 A에서 검색한 내용이 기기 B에 없음.
  3.  **관리 한계**: 체계적인 삭제/관리 UI 부재.

## 3. 구현 목표

1.  **영구 저장**: 검색 기록을 서버 데이터베이스(Supabase)에 저장.
2.  **동기화**: 사용자 ID와 프로젝트 ID 기반으로 언제 어디서든 동일한 히스토리 접근.
3.  **관리 기능**: 개별 삭제 및 전체 삭제 API 및 UI 구현.

## 4. 구현 방안

### 4.1. 데이터베이스 스키마 설계

`search_histories` 테이블을 신설하여 검색 이력을 관리합니다.

| 컬럼명            | 타입        | 설명                                    |
| :---------------- | :---------- | :-------------------------------------- |
| `id`              | UUID        | Primary Key                             |
| `user_id`         | UUID        | 사용자 식별 (FK)                        |
| `project_id`      | UUID        | 프로젝트 격리 (FK)                      |
| `query`           | TEXT        | 검색어                                  |
| `search_type`     | VARCHAR     | 검색 유형 ('deep_scholar', 'web' 등)    |
| `results_summary` | JSONB       | 검색 결과 요약 (선택적: 결과 캐싱 용도) |
| `result_count`    | INTEGER     | 결과 개수                               |
| `created_at`      | TIMESTAMPTZ | 검색 일시                               |

> **Note**: `results_summary`에 Tavily API 응답 전체를 저장할지, 아니면 쿼리만 저장하고 클릭 시 재검색할지 결정이 필요합니다. (아래 이슈 분석 참고)

### 4.2. API 설계

- `GET /api/research/history`: 히스토리 목록 조회 (페이지네이션 적용).
- `POST /api/research/history`: 검색 완료 시 기록 저장.
- `DELETE /api/research/history/[id]`: 특정 기록 삭제.
- `DELETE /api/research/history`: 프로젝트의 전체 기록 삭제 (옵션).

### 4.3. 프론트엔드 변경

- `useResearchHistory` 훅을 `localStorage` 대신 API 호출 방식으로 재작성 (SWR 또는 React Query 활용 권장).
- `ResearchPanel`에 "히스토리 탭" 또는 하단 "최근 검색" 영역을 확장하여 삭제/관리 UI 추가.

## 5. 예상되는 문제점 및 해결 방안 (Technical Risk Analysis)

### 이슈 1: 데이터 스토리지 용량 증가 (Storage Cost)

- **문제**: 검색 결과를 통째로(`JSONB`) 저장하면 Tavily API 응답이 클 경우 DB 용량이 빠르게 증가합니다.
- **해결 방안**:
  1.  **필수 데이터만 저장**: 제목, URL, 핵심 요약(Core Fact) 정도만 경량화하여 저장.
  2.  **보관 주기 설정**: 30일/60일 지난 기록 자동 삭제 (Supabase pg_cron 활용 가).
  3.  **텍스트 제한**: JSONB 크기 제한 (예: 10KB 미만).

### 이슈 2: Tavily API 비용 문제 (Cost Efficiency)

- **문제**: 히스토리를 클릭했을 때 저장된 결과를 보여주는 것이 아니라 **"재검색"**을 수행하면 Tavily API 비용(Query당 과금)이 중복 발생합니다.
- **해결 방안 (권장)**:
  - **결과 캐싱(Caching)**: DB에 **검색 결과를 함께 저장**(`results_summary`)하여, 히스토리 클릭 시 API 호출 없이 저장된 결과를 즉시 로드합니다. 이는 비용 절감과 속도 향상에 큰 도움이 됩니다.

### 이슈 3: 프라이버시 및 보안

- **문제**: 민감한 검색어가 영구 저장될 수 있음.
- **해결 방안**:
  - **삭제 기능 보장**: 사용자가 언제든 기록을 지울 수 있는 UI 제공 (전체/개별 삭제 완료).
  - **RLS(Row Level Security)**: Supabase RLS를 통해 `user_id`가 일치하는 본인만 조회 가능하도록 강력히 제한.

### 이슈 4: 성능 및 로딩 속도

- **문제**: 히스토리가 100건 이상 쌓이면 로딩이 느려질 수 있음.
- **해결 방안**:
  - **Pagination**: 한 번에 10~20개씩 불러오기 ("더 보기" 버튼).
  - **Indexing**: `user_id`, `project_id`, `created_at` 컬럼에 인덱스 적용.

## 6. 결론 및 추천

사용자 경험(UX)과 비용 효율성을 모두 만족시키기 위해 **"DB에 쿼리와 결과를 함께 저장(캐싱)"**하는 방식을 추천합니다. 이를 통해 Tavily API 중복 호출을 막고, 언제든 과거 검색 결과를 즉시 확인할 수 있는 쾌적한 환경을 제공할 수 있습니다.

### 다음 단계 제안

1.  **Supabase 테이블 생성**: `search_histories` 테이블 마이그레이션 작성.
2.  **API 개발**: Next.js API Route 구현.
3.  **UI 연동**: `ResearchPanel` 및 훅 업데이트.
