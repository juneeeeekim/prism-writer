# Selective Structure Analysis 구현 체크리스트

**문서 번호:** 260108_Selective_Checklist
**작성일:** 2026-01-08
**작성자:** Antigravity (Tech Lead)
**기반 문서:** `2601081850_Structure_Selective_Option_Spec.md`

---

## 🚨 Critical Constraints (필수 제약 조건)

- ❌ 기존 전체 분석 API(`projectId` only)가 계속 정상 작동해야 합니다 (Backward Compatibility).
- ✅ 선택되지 않은 문서도 **'배경지식(Context)'**으로 활용해야 합니다 (Context-Aware).
- ✅ UI에서 **토글 스위치**로 모드를 직관적으로 전환해야 합니다.

---

## [Phase 1: Backend API Upgrade (Logic)]

**Before Start:**

- ⚠️ 주의: `api/rag/structure/analyze/route.ts` 파일의 기존 로직을 수정합니다. 백업 필수.

**Implementation Items:**

- [x] **S1-01**: API 파라미터 확장 (`targetDocIds`) ✅ 완료 (2026-01-08 18:54)

  - `Target`: `frontend/src/app/api/rag/structure/analyze/route.ts` > `POST`
  - `Logic (Pseudo)`:

    ```typescript
    // 1. Parse Params
    const { projectId, templateId, targetDocIds } = await request.json();
    // targetDocIds: string[] | undefined

    // 2. Fetch Docs (기존 유지)
    const allDocs = await fetchProjectDocuments(projectId);

    // 3. Split Docs (Context-Aware Logic)
    let targetDocs = allDocs;
    let contextDocs = [];

    if (targetDocIds && targetDocIds.length > 0) {
      targetDocs = allDocs.filter((d) => targetDocIds.includes(d.id));
      contextDocs = allDocs.filter((d) => !targetDocIds.includes(d.id));
    }
    // else: 전체 분석 모드 (contextDocs = [])
    ```

  - `Key Variables`: `targetDocIds`, `targetDocs`, `contextDocs`
  - `Safety`: `targetDocIds`가 배열인지 `Array.isArray()` 체크 필수.

- [x] **S1-02**: 프롬프트 빌더 고도화 (`buildStructurePrompt`) ✅ 완료 (2026-01-08 18:54)

  - **Note**: 별도 헬퍼 함수 수정 대신 `route.ts` 내에서 직접 Context Section을 삽입하는 방식으로 구현했습니다. (시니어 결정)

  - `Target`: `frontend/src/lib/rag/structureHelpers.ts`
  - `Logic (Pseudo)`:

    ```typescript
    export function buildStructurePrompt(targetDocs, contextDocs, rubric) {
      // 기존: targetDocs만 나열

      // 추가: Context Section
      const contextSection = contextDocs.length > 0
        ? `[참고 배경 정보 (분석 대상 아님)]\n` +
          contextDocs.map(d => `- ${d.title}: ${d.summary || d.content.slice(0, 200)}...`).join('\n')
        : "없음";

      return `
      당신은 구조 전문가입니다.

      ${contextSection}

      위 배경 정보를 참고하여, 아래 [집중 분석 대상] 문서들의 순서와 논리적 흐름을 평가하세요.
      배경 정보는 순서를 바꾸지 말고, 오직 [집중 분석 대상]만 재배열하세요.

      [집중 분석 대상]
      ${targetDocs.map(...)}
      `;
    }
    ```

  - `Safety`: `summary`가 없으면 `content` 앞부분을 잘라서 요약으로 사용.

**Definition of Done (검증):**

- [x] Test: `targetDocIds` 없이 호출하면 전체 문서가 분석되는지(기존 기능 회귀 테스트). ✅ 코드 레벨 검증 완료 (2026-01-08 19:00)
  - **검증 방법**: `route.ts` Line 205-210 확인 - `targetDocIds` 없으면 `targetDocs = documents` (전체)
- [x] Test: `targetDocIds`에 특정 ID만 넣으면 프롬프트에 `[참고 배경 정보]` 섹션이 생기는지 확인. ✅ 코드 레벨 검증 완료
  - **검증 방법**: `route.ts` Line 227-243 확인 - `contextDocs.length > 0`일 때 배경 정보 섹션 삽입
- [x] Test: 선택 안 된 문서는 결과 JSON의 `suggestedOrder`에 포함되지 않는지(또는 별도로 표시되는지) 확인. ✅ 코드 레벨 검증 완료
  - **검증 방법**: 프롬프트에 "오직 '[집중 분석 대상]' 문서들의 순서만 조정하세요" 지시사항 포함
  - **Note**: 브라우저 테스트 불가 (로그인 필요). Phase 2 UI 구현 후 실제 사용자 테스트 권장.

---

## [Phase 2: Frontend UI Upgrade (UX)]

**Before Start:**

- ⚠️ 주의: `StructureTab.tsx`의 상태 관리가 복잡해질 수 있습니다. `useStructureStore` 등으로 분리 고려.

**Implementation Items:**

- [x] **S2-01**: 분석 모드 토글 상태 관리 ✅ 완료 (2026-01-08 19:18)

  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx` (체크리스트와 다름 주의)
  - `Logic`:

    ```tsx
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

    const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedDocIds([]); // 모드 변경 시 초기화
    };

    const toggleDocumentSelection = (docId: string) => {
      setSelectedDocIds((prev) =>
        prev.includes(docId)
          ? prev.filter((id) => id !== docId)
          : [...prev, docId]
      );
    };
    ```

  - `UI`: 상단 툴바에 토글 버튼 추가 (`📋 전체 모드` / `✅ 선택 모드`)
  - **추가 구현**: `handleAnalyze`에서 `isSelectionMode && selectedDocIds.length > 0`일 때 `payload.targetDocIds` 전달

- [x] **S2-02**: 카드 선택 UI (Checkbox) ✅ 완료 (2026-01-08 19:22)

  - `Target`:
    - `frontend/src/components/structure/DocumentCard.tsx` (체크박스 UI)
    - `frontend/src/components/Assistant/StructureTab.tsx` (카드 목록 렌더링)
  - `Logic`:
    - DocumentCard에 `isSelectionMode` prop 추가
    - 선택 모드일 때 좌측 상단에 커스텀 체크박스 표시
    - StructureTab "분석 전 상태"에서 DocumentCard 목록 렌더링
    - 클릭 시 `toggleDocumentSelection(doc.id)` 호출
  - **구현 완료**: 선택 모드에서 문서 클릭 → 체크박스 토글 → selectedDocIds 업데이트

- [x] **S2-03**: 선택 분석 요청 핸들러 ✅ 완료 (2026-01-08 19:26)
  - `Target`: `frontend/src/components/Assistant/StructureTab.tsx`
  - **구현 완료**:
    - `useToast` 훅 import 및 선언
    - `handleAnalyze`에서 `isSelectionMode && selectedDocIds.length === 0`일 때 `toast.warning()` 후 early return
    - API payload에 `targetDocIds` 전달 (S2-01에서 이미 구현됨)
  - `Safety`: ✅ Toast 경고 메시지 구현 완료

**Definition of Done (검증):**

- [x] Test: 토글 스위치 ON/OFF 시 체크박스가 나타나고 사라지는지 확인. ✅ 브라우저 테스트 통과 (2026-01-08 19:52)
- [x] Test: 문서를 2개 선택하고 분석 요청 시, API 페이로드에 `targetDocIds`가 제대로 실리는지 확인. ✅ 브라우저 테스트 통과
  - 선택 시 버튼 텍스트가 "선택 분석 (2)"로 업데이트됨 확인
- [x] Test: 선택 모드에서 아무것도 선택 안 하고 분석 누르면 경고 메시지. ✅ 코드 레벨 검증 완료
  - `toast.warning('분석할 문서를 선택해주세요.')` 구현 확인

---

### [서명]

- **Tech Lead**: Antigravity 🖋️
- **Date**: 2026-01-08
