# 📋 Gemini 3.0 Flash 파인튜닝 핸드오버 문서

**작성일**: 2025-12-27
**목표**: 다음 개발 세션에서 Gemini 3.0 Flash 파인튜닝을 즉시 시작하기 위한 가이드

---

## 1. 현재 상태 (As-Is)

- **데이터셋**: `raft_dataset` 테이블에 **500개의 RAFT 데이터**가 저장되어 있습니다.
  - `user_query`: 질문
  - `context`: 참고 문서 내용
  - `gold_answer`: 정답
- **데이터 위치**: Supabase DB (`public.raft_dataset`)
- **기존 코드**: `frontend/src/lib/raft/converter.ts` (현재 OpenAI 포맷용으로 작성됨)

## 2. 다음 세션 작업 목표 (To-Do)

Gemini 파인튜닝을 위해 데이터 형식을 변환하고 내보내야 합니다.

### Step 1. Gemini 포맷 변환기 구현

`frontend/src/lib/raft/converter.ts`를 수정하여 Gemini 포맷을 지원해야 합니다.

```typescript
// Gemini Tuning Format
{
  "messages": [
    { "role": "user", "parts": [{ "text": "Context: ...\nQuery: ..." }] },
    { "role": "model", "parts": [{ "text": "Expected Answer" }] }
  ]
}
```

### Step 2. JSONL 추출 스크립트 작성

DB에서 데이터를 읽어와 `training_data.jsonl` 파일로 저장하는 스크립트(`scripts/export_gemini_data.ts`)를 작성해야 합니다.

### Step 3. Google AI Studio 업로드 및 학습

1.  생성된 `training_data.jsonl`을 Google AI Studio (또는 Vertex AI)에 업로드.
2.  Base Model: **Gemini 1.5 Flash** (또는 3.0 Flash Preview가 가능하다면 선택).
3.  학습 시작 (약 30분~1시간 소요 예상).

## 3. 참고 자료

- **Google AI Studio Tuning Guide**: https://ai.google.dev/gemini-api/docs/model-tuning
- **Supabase Table**: `raft_dataset`
