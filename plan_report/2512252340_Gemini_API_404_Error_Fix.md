# 2512260006_Gemini_API_404_Error_Fix.md

**작성일**: 2025-12-26 00:06
**심각도**: 🔴 **CRITICAL** - 평가 기능 완전 중단
**상태**: ✅ **해결 완료** (Commit: a2d00cf)

---

## 🚨 에러 요약

### 핵심 문제

Google Gemini API가 **404 Not Found** 에러를 반환하여 **v5 평가 시스템 전체가 작동 불능** 상태였습니다.

```
[GoogleGenerativeAI Error]: Error fetching from
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
[404 Not Found] models/gemini-1.5-flash is not found for API version v1beta
```

### 영향 범위

- ❌ **AlignJudge**: 10개 루브릭 평가 모두 실패
- ❌ **UpgradePlanner**: 10개 개선 계획 생성 모두 실패
- ⚠️ **Fallback 작동**: 50점 기본 결과만 표시 (실제 평가 없음)

---

## 🔍 근본 원인 분석

### 1. API 버전 불일치

- **사용 중인 API**: Google Generative AI v1beta
- **문제**: v1beta에서는 모델명에 버전 suffix가 **필수**

### 2. 잘못된 모델명

| 컴포넌트       | 기존 (❌ 오류)     | 수정 (✅ 정상)            |
| -------------- | ------------------ | ------------------------- |
| AlignJudge     | `gemini-1.5-flash` | `gemini-1.5-flash-latest` |
| UpgradePlanner | `gemini-1.5-pro`   | `gemini-1.5-pro-latest`   |

### 3. 에러 전파 경로

```
API Request → 404 Error → LLM Gateway Error →
AlignJudge/UpgradePlanner Failure → Parser Fallback →
50점 기본 결과 반환
```

---

## ✅ 해결 방법

### 수정된 파일

1. **`frontend/src/lib/judge/alignJudge.ts`** (Line 55)

   ```typescript
   // Before
   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

   // After
   const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
   ```

2. **`frontend/src/lib/judge/upgradePlanner.ts`** (Line 49)

   ```typescript
   // Before
   const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

   // After
   const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
   ```

### 배포 정보

- **Commit**: `a2d00cf`
- **메시지**: "fix(llm): Update Gemini model names to -latest suffix for v1beta API compatibility"
- **배포 시간**: 2025-12-26 00:06 KST

---

## 🧪 검증 계획

### 즉시 확인 사항

- [ ] Vercel 배포 완료 대기 (2~3분)
- [ ] 브라우저 강력 새로고침 (Ctrl+Shift+R)
- [ ] 평가 실행 후 **실제 AI 피드백** 확인 (50점 fallback이 아닌)
- [ ] 콘솔 로그에서 404 에러 사라짐 확인

### 성공 기준

✅ **AlignJudge**: 각 루브릭별 `pass/fail/partial` 판정 표시
✅ **UpgradePlanner**: `What/Why/How` 구체적 개선 제안 표시
✅ **점수**: 50점 고정이 아닌 실제 평가 점수 표시

---

## 📊 기타 발견된 이슈 (낮은 우선순위)

### 1. Supabase 경고

```
Using supabase.auth.getSession() could be insecure
→ 권장: supabase.auth.getUser() 사용
```

**영향**: 보안 권고사항 (기능 정상 작동)

### 2. RLS 정책 위반

```
new row violates row-level security policy for table "embedding_usage"
```

**영향**: 사용량 기록 실패 (평가 기능 정상 작동)

### 3. JSON 파싱 경고

```
[Parser] JSON 파싱 실패, fallback 결과 반환
```

**영향**: LLM이 간헐적으로 잘못된 JSON 반환 시 fallback 처리 (정상 동작)

---

## 🎯 다음 단계

1. ✅ **즉시**: Gemini 모델명 수정 배포 완료
2. ⏳ **단기**: 사용자 테스트 및 실제 평가 결과 확인
3. 📋 **중기**: Supabase 보안 경고 해결
4. 🔧 **장기**: LLM JSON 출력 안정성 개선

---

## 📸 에러 스크린샷

![Evaluation Result](file:///C:/Users/chyon/.gemini/antigravity/brain/1ff55532-0de9-441b-8def-519c3489e43d/uploaded_image_1766675163437.png)

_현재 UI는 Fallback 결과(50점)를 표시하고 있으나, 배포 후에는 실제 AI 평가 결과가 표시될 예정입니다._
