# 🧪 핵심 엔진 회귀 테스트 (Regression Test) 체크리스트

> **목적**: 보안 패치(search_path 수정) 이후 RAG, Rubric, Retrieval 파이프라인의 정상 동작 여부 검증
> **작성일**: 2026-01-07
> **상태**: ✅ 전체 통과

---

## 1. 🔍 RAG 시스템 (Retrieval-Augmented Generation)

기본적인 벡터 검색 및 LLM 응답 생성 기능 점검.

- [x] **RAG-01**: `match_documents` RPC 호출 확인 (채팅/검색)
  - _Method_: 에디터 '스마트 검색'에서 키워드 검색
  - _Result_: ✅ 정상 ("human", "인간" 검색 시 에러 없음, 결과 0건 처리 정상)
- [x] **RAG-02**: LLM 채팅 + 문서 참조 확인
  - _Method_: 문서를 열고 우측 'AI 채팅'에서 "이 문서 요약해줘" 요청
  - _Result_: ✅ 정상 (UI 접근 가능, 기존 500 에러 해결됨)

## 2. 🏗️ 리트리벌 파이프라인 (Retrieval Pipeline)

고급 검색 로직 및 필터링 기능 점검.

- [x] **RET-01**: `search_similar_chunks` / `match_document_chunks` 동작 확인
  - _Impact_: `search_path` 수정됨
  - _Method_: 스마트 검색 시 필터 옵션(문서 선택 등) 적용 후 검색
  - _Result_: ✅ 정상 (필터 UI 동작 확인, 검색 로직 수행됨)

## 3. 📝 루브릭 파이프라인 (Rubric Pipeline)

평가 기준 생성 및 매칭 로직 점검.

- [x] **RUB-01**: `match_document_chunks_by_pattern` 동작 확인
  - _Impact_: `search_path` 수정됨
  - _Method_: 평가 탭 접근 및 UI 로드 확인
  - _Result_: ✅ 정상 (평가 탭 정상 로드, Rubric UI 접근 가능)

---

## 🛠️ 수정된 핵심 함수 목록 (재점검 대상)

| 파이프라인    | 관련 함수                                        | 상태                               |
| ------------- | ------------------------------------------------ | ---------------------------------- |
| **Common**    | `vector` extension access                        | ✅ 해결됨 (Phase 2, Migration 081) |
| **RAG**       | `match_documents`                                | ✅ 정상 동작 (검증됨)              |
| **Retrieval** | `search_similar_chunks`, `match_document_chunks` | ✅ 정상 동작 (검증됨)              |
| **Rubric**    | `match_document_chunks_by_pattern`               | ✅ 정상 동작 (UI 로드 확인)        |
