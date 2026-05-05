# 목차 제안 RAG 통합 분석 및 개선 계획

**문서 ID**: 2512260034_Outline_RAG_Enhancement_Plan  
**작성일**: 2025-12-26  
**작성자**: 개발팀 (시니어/주니어/UX 전문가)  
**상태**: 검토 대기 (Ready for Review)

---

## 📋 개요 (Executive Summary)

디렉터님의 요청: "목차 제안" 기능이 **업로드된 참고자료를 기준**으로 제안해야 함.

### ✅ 분석 결과

> [!NOTE] > **좋은 소식!** 현재 `/api/outline` API는 이미 **RAG 통합이 구현되어 있습니다**.  
> 백엔드에서 `vectorSearch`를 호출하여 사용자의 참고자료를 검색하고 있습니다.

그러나 아래의 **UX 개선 기회**가 발견되었습니다.

---

## 🔍 현재 상태 분석 (As-Is)

### 백엔드 (`/api/outline/route.ts`)

| 항목             | 상태      | 비고                                       |
| ---------------- | --------- | ------------------------------------------ |
| RAG 연동         | ✅ 구현됨 | Line 120: `vectorSearch(topic, ...)` 호출  |
| 사용자 인증      | ✅ 구현됨 | `supabase.auth.getUser()`                  |
| 참고자료 context | ✅ 구현됨 | 검색 결과를 프롬프트에 포함 (Line 130-132) |
| Feature Flag     | ✅ 적용됨 | `ENABLE_PIPELINE_V5`                       |

**핵심 코드 (Line 120-125):**

```typescript
const searchResults = await vectorSearch(topic, {
  userId: user.id,
  topK,
  minScore: 0.5,
});
```

### 프론트엔드 (`OutlineTab.tsx`)

| 항목                 | 상태      | 개선 필요             |
| -------------------- | --------- | --------------------- |
| API 호출             | ✅ 구현됨 | `/api/outline` 호출   |
| 참고자료 사용 피드백 | ⚠️ 부족   | 콘솔 로그만 (Line 58) |
| "참고자료 없음" 안내 | ❌ 미구현 | 사용자에게 알림 없음  |
| 로딩 상태            | ✅ 구현됨 | 스피너 표시           |

---

## 🎯 개선 목표 (To-Be)

### 1. UX 개선: 참고자료 사용 피드백 표시

**현재**: 사용자는 참고자료가 사용되었는지 알 수 없음  
**개선**: "📚 참고자료 N개 활용" 배지를 목차 결과에 표시

### 2. UX 개선: 참고자료 없음 안내

**현재**: 업로드된 자료 없이도 일반 목차 생성 (혼란 유발 가능)  
**개선**: "⚠️ 업로드된 참고자료가 없습니다. 자료를 업로드하면 더 정확한 목차를 받을 수 있습니다." 안내 표시

### 3. (선택) 특정 문서 선택 기능

**현재**: 모든 업로드 문서 대상 검색  
**개선**: 드롭다운으로 특정 문서 선택 가능

---

## 📐 구현 계획 (Implementation Plan)

### Phase 1: UX 피드백 개선 (우선 순위: 높음)

#### [MODIFY] [OutlineTab.tsx](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/frontend/src/components/Assistant/OutlineTab.tsx)

1. **참고자료 사용 정보 상태 추가**

   ```typescript
   const [sourcesUsed, setSourcesUsed] = useState<number>(0);
   ```

2. **API 응답에서 sourcesUsed 저장**

   ```typescript
   setSourcesUsed(data.sourcesUsed || 0);
   ```

3. **생성된 목차 영역에 배지 표시**

   ```tsx
   {
     sourcesUsed > 0 && (
       <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
         📚 참고자료 {sourcesUsed}개 활용
       </span>
     );
   }
   ```

4. **참고자료 없음 안내 추가**
   ```tsx
   {
     sourcesUsed === 0 && generatedOutline.length > 0 && (
       <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
         ⚠️ 참고자료 없이 일반 지식으로 생성됨
       </div>
     );
   }
   ```

---

### Phase 2: 문서 선택 기능 (우선 순위: 낮음, 선택사항)

#### [MODIFY] [OutlineTab.tsx](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/frontend/src/components/Assistant/OutlineTab.tsx)

1. 사용자의 업로드 문서 목록 조회 API 호출
2. 드롭다운 UI로 문서 선택 가능
3. 선택된 `documentId`를 API 요청에 포함

#### [MODIFY] [route.ts](file:///c:/Users/chyon/Desktop/01.Project/00.Program/prismLM/frontend/src/app/api/outline/route.ts)

1. `documentIds` 파라미터로 필터링 (현재 주석으로 언급됨, Line 124)

---

## ✅ 검증 계획 (Verification Plan)

### 수동 테스트 시나리오

1. **참고자료 있는 경우**

   - 문서 업로드 후 목차 생성
   - "📚 참고자료 N개 활용" 배지 표시 확인
   - 생성된 목차가 참고자료 내용 반영하는지 확인

2. **참고자료 없는 경우**

   - 문서 없이 목차 생성
   - "⚠️ 참고자료 없이 생성됨" 안내 표시 확인

3. **에러 케이스**
   - 주제 미입력 → 에러 메시지 확인

---

## 📊 영향받는 기존 기능

| 기능          | 영향도 | 비고                        |
| ------------- | ------ | --------------------------- |
| 목차 생성 API | 없음   | 변경 없음 (이미 RAG 적용됨) |
| OutlineTab UI | 낮음   | UI 요소 추가만              |
| 에디터 삽입   | 없음   | 변경 없음                   |

---

## 🚀 결론 및 권장 사항

> [!IMPORTANT] > **핵심 발견**: 백엔드는 이미 RAG를 사용 중입니다.  
> **권장 조치**: 프론트엔드 UX 개선만으로 디렉터님의 요구사항 충족 가능합니다.

### 즉시 실행 가능 (Phase 1)

- 예상 작업 시간: 15-30분
- 위험도: 매우 낮음 (UI 추가만)
- 기존 기능 영향: 없음

---

## 📝 디렉터님께 질문

1. **Phase 1 (UX 피드백)** 을 바로 구현해도 될까요?
2. **Phase 2 (문서 선택)** 기능도 필요하신가요, 아니면 추후 검토할까요?
