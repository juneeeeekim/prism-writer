# <!--

# PRISM Writer - 시스템 아키텍처 문서

파일명: SYSTEM_ARCHITECTURE.md
버전: v4.0.0-gemini-flash
생성일: 2025-12-25
최종 수정일: 2025-12-25
작성자: 개발팀 (시니어, LLM 전문, UX/UI 전문가)

설명:
이 문서는 PRISM Writer 서비스의 현재 시스템 아키텍처와 설정을 기록합니다.
향후 서비스 업그레이드 시 이 문서를 참고하여 다운그레이드를 방지하세요.

# ⚠️ 경고: 이 문서의 설정을 변경하기 전에 반드시 기술 리드와 상의하세요.

-->

# PRISM Writer 시스템 아키텍처

> **현재 버전**: `v4.0.0-gemini-flash`
>
> **배포일**: 2025-12-25
>
> **Git Tag**: `v4.0.0-gemini-flash`

---

## 📋 목차

1. [현재 시스템 버전](#현재-시스템-버전)
2. [LLM 설정](#llm-설정)
3. [임베딩 설정](#임베딩-설정)
4. [필수 환경 변수](#필수-환경-변수)
5. [데이터베이스 스키마](#데이터베이스-스키마)
6. [변경 금지 사항](#변경-금지-사항)
7. [롤백 절차](#롤백-절차)

---

## 현재 시스템 버전

| 항목              | 값                                |
| ----------------- | --------------------------------- |
| **Pipeline 버전** | v4                                |
| **LLM Provider**  | Google Gemini                     |
| **LLM 모델**      | `gemini-3-flash-preview`          |
| **임베딩 모델**   | `text-embedding-3-small` (OpenAI) |
| **Git Tag**       | `v4.0.0-gemini-flash`             |

---

## LLM 설정

### 기본 모델

```
Model ID: gemini-3-flash-preview
Provider: Google Gemini
```

### 적용된 파일

| 파일               | 용도                                               | 모델                   |
| ------------------ | -------------------------------------------------- | ---------------------- |
| `templateGates.ts` | Gate 평가 (Consistency, Hallucination, Regression) | gemini-3-flash-preview |
| `ruleMiner.ts`     | 규칙 추출                                          | gemini-3-flash-preview |
| `exampleMiner.ts`  | 예시 생성                                          | gemini-3-flash-preview |
| `reranker.ts`      | 관련성 리랭킹                                      | gemini-3-flash-preview |

### Gemini 3 권장 설정

| 설정               | 값                 | 이유                           |
| ------------------ | ------------------ | ------------------------------ |
| `temperature`      | `1.0`              | Gemini 3 공식 권장 (loop 방지) |
| `responseMimeType` | `application/json` | JSON 응답 형식                 |
| `maxOutputTokens`  | `100`              | 속도 최적화                    |

> ⚠️ **주의**: `temperature`를 1.0 미만으로 설정하면 루핑 또는 성능 저하가 발생할 수 있습니다.

---

## 임베딩 설정

### 현재 설정

| 항목         | 값                       |
| ------------ | ------------------------ |
| **Provider** | OpenAI                   |
| **모델**     | `text-embedding-3-small` |
| **차원**     | 1536                     |
| **파일**     | `embedding.ts`           |

### 유지 이유

- 비용 효율: OpenAI가 Gemini 대비 7.5배 저렴
- DB 호환성: 현재 스키마가 1536 차원 기준
- 안정성: 기존 임베딩 데이터 재생성 불필요

> ⚠️ **경고**: 임베딩 모델을 변경하면 모든 문서의 임베딩을 재생성해야 합니다.

---

## 필수 환경 변수

```env
# 필수 - LLM 호출용
GOOGLE_API_KEY=your_google_api_key

# 필수 - 임베딩 생성용
OPENAI_API_KEY=your_openai_api_key

# 선택 - 추가 Provider
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Vercel 환경 변수 설정

1. Vercel Dashboard → Project → Settings → Environment Variables
2. 위 변수들을 Production, Preview에 추가
3. 재배포하여 적용

---

## 데이터베이스 스키마

### 주요 테이블

| 테이블                        | 용도            | Pipeline v4 변경사항   |
| ----------------------------- | --------------- | ---------------------- |
| `rag_chunks`                  | 문서 청크 저장  | `chunk_type` 컬럼 추가 |
| `rag_documents`               | 문서 메타데이터 | 변경 없음              |
| `telemetry_logs`              | 텔레메트리 로깅 | `run_type` 컬럼 추가   |
| `template_validation_samples` | 검증 샘플       | **신규 테이블**        |

### 임베딩 벡터 설정

```sql
-- rag_chunks 테이블
embedding vector(1536)  -- OpenAI text-embedding-3-small
```

> ⚠️ **경고**: 이 차원을 변경하면 모든 임베딩 재생성 필요

---

## 변경 금지 사항

### 🚫 절대 변경 금지

| 항목         | 현재 값 | 이유               |
| ------------ | ------- | ------------------ |
| 임베딩 차원  | 1536    | DB 스키마 호환성   |
| 임베딩 모델  | OpenAI  | 기존 데이터 호환성 |
| Supabase RLS | 활성화  | 보안               |

### ⚠️ 변경 시 주의 필요

| 항목              | 현재 값                | 변경 시 필요한 조치      |
| ----------------- | ---------------------- | ------------------------ |
| LLM 모델          | gemini-3-flash-preview | 프롬프트 테스트 필요     |
| temperature       | 1.0                    | Gemini 3에서는 변경 금지 |
| chunk_type 기본값 | 'general'              | 하위 호환성 유지         |

---

## 롤백 절차

### 🔄 코드 롤백 (Vercel)

```bash
# 방법 1: Git Tag로 복원
git checkout v4.0.0-gemini-flash

# 방법 2: Vercel 대시보드
# Deployments → 이전 배포 선택 → Redeploy
```

### 🔄 DB 롤백 (Supabase)

모든 마이그레이션 파일에 롤백 스크립트가 포함되어 있습니다:

| 마이그레이션                | 롤백 스크립트 위치      |
| --------------------------- | ----------------------- |
| chunk_type 추가             | 파일 하단 ROLLBACK 섹션 |
| run_type 추가               | 파일 하단 ROLLBACK 섹션 |
| template_validation_samples | `DROP TABLE IF EXISTS`  |

---

## 📞 지원

문제 발생 시:

1. 이 문서의 설정과 현재 코드 비교
2. Git Tag `v4.0.0-gemini-flash`로 롤백
3. 기술 리드에게 보고

---

## 변경 이력

| 날짜       | 버전                | 변경 내용                           |
| ---------- | ------------------- | ----------------------------------- |
| 2025-12-25 | v4.0.0-gemini-flash | 초기 문서 생성, Gemini 3 Flash 적용 |
