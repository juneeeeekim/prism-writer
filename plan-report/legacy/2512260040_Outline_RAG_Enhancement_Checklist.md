# 목차 제안 RAG 통합 개선 체크리스트

**문서 ID**: 2512260040_Outline_RAG_Enhancement_Checklist  
**작성일**: 2025-12-26  
**기반 문서**: [2512260034_Outline_RAG_Enhancement_Plan.md](./2512260034_Outline_RAG_Enhancement_Plan.md)  
**담당**: 시니어 개발자, 주니어 개발자, UX/UI 전문가

---

## 📁 파일 구성 결정

> **결정: 단일 파일 (1개)**

### 근거

1. **범위**: 수정 대상이 `OutlineTab.tsx` 1개 파일에 집중됨
2. **복잡도**: UI 요소 추가 위주로 복잡도 낮음
3. **협업 효율**: 단일 문서로 진행 상황 추적 용이
4. **Phase 수**: 총 2개 Phase로 분리가 불필요

---

## 🎯 전체 목표

- [x] 현재 상태 분석 완료 (RAG 이미 적용됨 확인)
- [x] **Phase 1**: 참고자료 사용 피드백 UI 개선
- [ ] **Phase 2**: (선택) 문서 선택 기능 추가
- [ ] 배포 및 검증

---

# Phase 1: 참고자료 사용 피드백 UI 개선

## ⚠️ 영향받을 수 있는 기존 기능

| 기능             | 위험도 | 확인 필요 사항     |
| ---------------- | ------ | ------------------ |
| 목차 생성 버튼   | 낮음   | 클릭 후 정상 동작  |
| 생성된 목차 표시 | 낮음   | 레이아웃 깨짐 없음 |
| 에디터 삽입      | 없음   | 기능 변경 없음     |
| 에러 메시지      | 없음   | 기능 변경 없음     |

---

## 1.1 상태 변수 추가

- [x] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [x] **위치**: Line 19 근처 (기존 state 선언부)
- [x] **작업**: `sourcesUsed` 상태 추가

```typescript
const [sourcesUsed, setSourcesUsed] = useState<number>(0);
```

### 품질 체크

- [x] 변수명 명확성: `sourcesUsed` (사용된 참고자료 수)
- [x] 타입 명시: `number`
- [x] 초기값 설정: `0`

---

## 1.2 API 응답 처리 로직 수정

- [x] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [x] **위치**: `handleGenerate` 함수 내부, Line 62 근처
- [x] **연결성**: 1.1에서 추가한 `setSourcesUsed` 호출
- [x] **작업**: API 응답에서 `sourcesUsed` 값 저장

```typescript
setGeneratedOutline(data.outline || []);
setSourcesUsed(data.sourcesUsed || 0); // 추가
```

### 품질 체크

- [x] Null 처리: `|| 0` 으로 기본값
- [x] 기존 로직 손상 없음

---

## 1.3 참고자료 활용 배지 UI 추가

- [x] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [x] **위치**: "생성된 목차" 헤더 영역, Line 128 근처
- [x] **연결성**: 1.1, 1.2에서 설정한 `sourcesUsed` 값 참조
- [x] **작업**: 조건부 배지 렌더링

```tsx
<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
  📋 생성된 목차
  {sourcesUsed > 0 && (
    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
      📚 참고자료 {sourcesUsed}개 활용
    </span>
  )}
</h3>
```

### 품질 체크

- [x] 다크모드 대응: `dark:` 접두사 적용
- [x] 접근성: span 요소로 보조 정보 표시 (스크린리더 대응)
- [x] 코딩 스타일: 기존 Tailwind 패턴 유지

---

## 1.4 참고자료 없음 경고 UI 추가

- [x] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [x] **위치**: 생성된 목차 영역 하단, Line 147 근처 (목차 리스트 다음)
- [x] **연결성**: 1.1, 1.2에서 설정한 `sourcesUsed` 값 참조
- [x] **작업**: 참고자료 없이 생성된 경우 안내 메시지

```tsx
{
  sourcesUsed === 0 && generatedOutline.length > 0 && (
    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
      ⚠️ 업로드된 참고자료 없이 일반 지식으로 생성되었습니다.
      <br />
      <span className="text-gray-500 dark:text-gray-400">
        참고자료를 업로드하면 더 정확한 목차를 받을 수 있습니다.
      </span>
    </div>
  );
}
```

### 품질 체크

- [x] 다크모드 대응: `dark:` 접두사 적용
- [x] 색상 일관성: amber 계열 (경고성 정보)
- [x] 조건문 논리: `sourcesUsed === 0 && generatedOutline.length > 0`
- [x] 접근성: 의미 있는 텍스트 제공

---

## 1.5 초기화 로직 추가

- [x] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [x] **위치**: `handleGenerate` 함수 시작 부분, Line 33 근처
- [x] **연결성**: 1.1에서 추가한 `setSourcesUsed` 초기화
- [x] **작업**: 새로운 생성 시작 시 이전 값 초기화

```typescript
setIsLoading(true);
setError(null);
setSourcesUsed(0); // 추가: 이전 결과 초기화
```

### 품질 체크

- [x] 상태 초기화 순서 일관성
- [x] 메모리 누수 방지

---

## ✅ Phase 1 검증 체크리스트

### Syntax 확인

- [ ] `npx tsc --noEmit` 실행 - 타입 오류 없음
- [ ] ESLint 경고/오류 없음

### 브라우저 테스트

| 테스트 케이스                    | 예상 결과                        | 확인 |
| -------------------------------- | -------------------------------- | ---- |
| 참고자료 있는 상태에서 목차 생성 | "📚 참고자료 N개 활용" 배지 표시 | [ ]  |
| 참고자료 없는 상태에서 목차 생성 | 경고 메시지 표시                 | [ ]  |
| 다크모드 전환                    | 배지/경고 색상 적절히 변경       | [ ]  |
| 목차 재생성                      | 이전 배지 초기화 후 새 값 표시   | [ ]  |

### 기존 기능 정상 동작 확인

- [ ] 주제 입력 → 목차 생성 버튼 클릭 → 로딩 스피너 표시
- [ ] 목차 생성 완료 → 목차 리스트 표시
- [ ] "에디터에 삽입" 버튼 클릭 → 에디터에 목차 삽입
- [ ] 에러 발생 시 → 에러 메시지 표시

---

# Phase 2: 문서 선택 기능 (선택사항)

> [!NOTE]
> 이 Phase는 디렉터님의 결정에 따라 진행 여부가 결정됩니다.
> Phase 1 완료 후 별도 검토 예정.

## ⚠️ 영향받을 수 있는 기존 기능

| 기능          | 위험도 | 확인 필요 사항            |
| ------------- | ------ | ------------------------- |
| 목차 생성 API | 중간   | documentIds 파라미터 처리 |
| 주제 입력 UI  | 낮음   | 레이아웃 변경             |

---

## 2.1 문서 목록 조회 API 호출

- [ ] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [ ] **작업**: useEffect로 사용자 문서 목록 조회
- [ ] **API**: `/api/rag/documents` (GET)

---

## 2.2 문서 선택 드롭다운 UI

- [ ] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [ ] **작업**: 주제 입력 위에 문서 선택 드롭다운 추가

---

## 2.3 선택된 문서 ID API 전달

- [ ] **파일**: `frontend/src/components/Assistant/OutlineTab.tsx`
- [ ] **작업**: API 요청 body에 `documentIds` 추가

---

## ✅ Phase 2 검증 체크리스트

- [ ] 문서 목록 정상 로드
- [ ] 선택한 문서만 검색에 사용됨 확인
- [ ] 기존 "전체 문서" 옵션 유지

---

# 📦 배포 체크리스트

- [x] `git add` 변경 파일
- [x] `git commit -m "feat(outline): Add RAG usage feedback UI"`
- [x] `git push origin main`
- [x] Vercel 배포 완료 확인 (Commit: 1767399)
- [x] 프로덕션 환경 테스트 ✅

---

# 📋 완료 서명

| 역할          | 담당자 | 완료일 | 서명 |
| ------------- | ------ | ------ | ---- |
| 시니어 개발자 | -      | -      | [ ]  |
| 주니어 개발자 | -      | -      | [ ]  |
| UX/UI 전문가  | -      | -      | [ ]  |
| 디렉터 승인   | -      | -      | [ ]  |
