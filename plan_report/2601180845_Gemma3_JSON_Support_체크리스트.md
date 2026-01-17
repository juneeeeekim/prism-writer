# 📝 Gemma 3 JSON 파싱 안정화 구현 계획 및 체크리스트

**작성일**: 2026-01-18
**작성자**: 기술 리더 (Antigravity)
**목표**: `Gemma 3 27B` 모델을 복구하고, JSON Mode 미지원 문제를 코드 레벨에서 해결하여 안정적인 평가 시스템을 구축한다.

---

## 🏗️ 배경 및 전략

1.  **배경**:
    - `Gemma 3 27B`는 Google AI API의 `responseMimeType: 'application/json'`(JSON Mode)를 아직 지원하지 않음 (400 Bad Request 발생).
    - 임시로 `Gemini 3 Flash`로 교체했으나, 디렉터님의 의도(Gemma 3의 추론 깊이 활용)를 존중하여 복구 결정.
2.  **전략 (Robust Parsing Strategy)**:
    - **API 설정**: `responseMimeType` 옵션 제거.
    - **Prompt Engineering**: 시스템 프롬프트에 "반드시 순수 JSON만 출력하라"는 강력한 지시 추가.
    - **Code Handling**: 응답 텍스트에서 JSON 객체를 정규식으로 정교하게 추출하는 `extractJSON` 함수 구현.

---

## ✅ Implementation Checklist

### Phase 1: 모델 설정 복구 (Recover Configuration)

- [x] **P1-01**: `llm-usage-map.ts` 모델 ID 복구
  - 대상: `rag.reviewer`, `template.hallucination`, `rule.mining`, `judge.align`
  - 변경: `gemini-3-flash-preview` → `gemma-3-27b-it`
- [x] **P1-02**: `responseMimeType` 제거
  - 대상: `alignJudge.ts`, `hallucinationGate.ts` 등 관련 파일
  - 작업: `generationConfig`에서 `responseMimeType: 'application/json'` 라인 삭제

### Phase 2: 파싱 로직 고도화 (Robust Parsing)

- [x] **P2-01**: `sanitizeJSON` 함수 강화 (유틸리티)
  - 위치: `frontend/src/lib/judge/alignJudge.ts` (또는 공통 유틸로 분리)
  - 기능:
    - Markdown Code Block (`json ... `) 제거
    - 텍스트 서두/말미의 불필요한 문구(예: "Here is the JSON:") 제거
    - 정규식으로 첫 `{`와 마지막 `}` 사이의 문자열 추출
- [x] **P2-02**: 프롬프트 강화
  - 대상: `evaluate-single`, `evaluate` 관련 프롬프트
  - 내용: `[CRITICAL] Do not use markdown. Output raw JSON only.` 문구 추가

### Phase 3: 검증 (Verification)

- [x] **P3-01**: Syntax Check (`tsc`)
- [x] **P3-02**: 평가 기능 테스트
  - `Gemma 3 27B`가 적용된 상태에서 "기준별 평가" 실행
  - "시스템 오류" 없이 결과가 잘 나오는지 확인

---

## 📅 Definition of Done

- [x] `llm-usage-map.ts`에 `gemma-3-27b-it`가 설정되어 있어야 함
- [x] 평가 실행 시 400 Bad Request 에러가 발생하지 않아야 함
- [x] 평가 결과(JSON)가 정상적으로 파싱되어 화면에 표시되어야 함
