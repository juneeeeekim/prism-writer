# 🩺 JeDebug Audit: RAFT Category Sync Implementation

**Analyzed Document**: `2512281730_RAFT_Category_Sync_Checklist.md`
**Auditor**: JeDebug (Senior Lead Developer)
**Date**: 2025-12-28

---

## ✅ Output Mode: Checklist-Only

## 1) 🔧 로직 및 구현 보완 (Logic Fixes)

- [ ] (Critical) API 보안 및 인증 로직 누락 방지

  - [ ] 원인: 신규 API(`api/categories/unique`)가 인증 없이 호출될 경우 보안 취약점(데이터 유출) 발생 가능.
  - [ ] **수정 제안**: P1-01 구현 상세에 "Supabase 보안 클라이언트 사용 및 `SKIP_RAFT_AUTH` 환경변수 체크 로직 추가" 명시.
  - [ ] 파일/위치: **P1-01** Detail 항목

- [ ] (Major) 테이블명 명확화 필요

  - [ ] 원인: 체크리스트에 `documents` (또는 `articles`)로 모호하게 기재됨. 실제 쿼리 작성 시 혼란 초래.
  - [ ] **수정 제안**: 작업 시작 전 DB 스키마 확인 단계(P1-00)를 추가하여 테이블명 확정 후 P1-01 진행하도록 변경.
  - [ ] 파일/위치: **Phase 1: Backend** 최상단

- [ ] (Major) Premium UX 요구사항 반영 (Comboox)
  - [ ] 원인: "Custom Datalist"는 브라우저 기본 스타일을 따르므로 "Premium Design" 요구사항 충족 불가 가능성 높음.
  - [ ] **수정 제안**: "Headless UI Combobox" 또는 "Custom div-based Dropdown"으로 구현 방식 명확히 지정 (Native Datalist 지양).
  - [ ] 파일/위치: **Phase 2: Frontend** Before Start 및 P2-01

## 2) 🚨 리스크 및 안전장치 (Risk Guardrails)

- [ ] (Mid) 대소문자 중복 및 공백 데이터 정제

  - [ ] 위험 요소: `Marketing`, `marketing `, `Marketing`이 서로 다른 카테고리로 인식될 수 있음.
  - [ ] **방어 로직 제안**: API 응답 전 `trim()` 및 대소문자 정규화(Optional) 처리, 또는 프론트엔드 Display 시 정제 로직 추가.
  - [ ] 파일/위치: **P1-01** Detail 항목

- [ ] (Mid) 카테고리 로딩 실패 시 UI 깨짐 방지
  - [ ] 위험 요소: API 에러 시 드롭다운이 비어버릴 수 있음.
  - [ ] **방어 코드 추가 제안**: `CategoryCombobox` 내부에서 에러 발생 시 `RAFT_CATEGORIES`(기본 상수)를 Fallback 데이터로 사용하도록 `catch` 블록 구현.
  - [ ] 파일/위치: **P2-01** Detail 항목

## 3) 🧪 검증 기준 구체화 (Test Criteria)

- [ ] Happy Path: 기존 카테고리 선택
  - [ ] 시나리오: 드롭다운에서 DB에 있는 `250621_예민2_풀링` 선택 -> 생성 요청 -> DB `raft_dataset`에 해당 문자열 그대로 저장됨 확인.
- [ ] Happy Path: 신규 카테고리 직접 입력
  - [ ] 시나리오: "NewProject_Test" 입력 -> 생성 요청 -> 정상 저장 확인.
- [ ] Edge Case: 특수문자 포함 카테고리
  - [ ] 시나리오: `C++`, `R&D` 등 특수문자 포함 카테고리 정상 처리 확인.

## 4) 최종 판단 (Decision)

- [ ] 상태 선택: ⚠️ **체크리스트 수정 후 진행**
- [ ] 가장 치명적인 결함: **API 인증 로직 누락 및 모호한 UI 구현 방식(Datalist vs Custom)**
