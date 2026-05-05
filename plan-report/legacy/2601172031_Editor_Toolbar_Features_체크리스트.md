# Editor Toolbar Features (Save & Export) 구현 체크리스트

**Date:** 2026-01-17
**Based on:** `2601172030_Editor_Functionality_Plan.md`
**Tech Lead:** Antigravity

---

## [Phase 1: 저장 기능 UX 개선]

**Before Start:**

- ⚠️ 주의: `useDocuments`의 `saveDocument` 로직 자체는 변경하지 않음. UI/UX 레이어만 수정.
- ⚠️ 주의: `alert()` 사용을 전면 제거하고 `useToast()`로 대체해야 함.

**Implementation Items:**

- [ ] **P1-01**: AuthHeader Props 확장 및 로딩 UI 추가
  - `Target`: `frontend/src/components/auth/AuthHeader.tsx`
  - `Logic (Pseudo)`:

    ```typescript
    interface AuthHeaderProps {
      // ... existing props
      isSaving?: boolean; // [Changed] Add prop
    }

    // In JSX (Button):
    <button disabled={isSaving}>
      {isSaving ? <Spinner /> : '💾 저장'}
    </button>
    ```

  - `Key Variables`: `isSaving`
  - `Safety`: `isSaving`이 undefined일 경우 false 처리 (Default value)

- [ ] **P1-02**: EditorPage 저장 핸들러 UX 개선
  - `Target`: `frontend/src/app/editor/page.tsx` > `handleSave()`
  - `Logic (Pseudo)`:

    ```typescript
    const { toast } = useToast(); // Hook init

    const handleSave = async () => {
      if (!user) { toast.error('로그인이 필요합니다'); return; }
      if (!content) { toast.warning('내용이 없습니다'); return; }

      setIsSaving(true);
      try {
        await saveDocument({ ... });
        toast.success('저장되었습니다');
      } catch (err) {
        toast.error('저장 실패: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    }
    ```

  - `Key Variables`: `toast`, `isSaving`
  - `Safety`: Try-Catch 블록 내에서 `toast.error` 호출 필수.

**Definition of Done (검증):**

- [ ] Test: 저장 버튼 클릭 시 로딩 스피너가 표시되었다가 사라지는가?
- [ ] Test: 저장 성공 시 녹색 Toast 메시지가 뜨는가?
- [ ] Test: 저장 실패(네트워크 차단 등) 시 붉은 Toast 메시지가 뜨는가?

---

## [Phase 2: 내보내기 기능 구현]

**Before Start:**

- ⚠️ 주의: 클라이언트 사이드에서만 동작하도록 구현 (Server Action 불필요).
- ⚠️ 주의: 파일명은 문서 제목(`title`)을 사용하되, 특수문자는 제거(`sanitize`)해야 함.

**Implementation Items:**

- [ ] **P2-01**: 파일 다운로드 유틸리티 구현
  - `Target`: `frontend/src/utils/exportUtils.ts` (New File)
  - `Logic (Pseudo)`:

    ```typescript
    export function downloadFile(
      filename: string,
      content: string,
      mimeType: string,
    ) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    export function sanitizeFilename(name: string): string {
      return name.replace(/[^a-z0-9가-힣\s-]/gi, "").trim() || "untitled";
    }
    ```

  - `Key Variables`: `Blob`, `URL.createObjectURL`
  - `Safety`: `title`이 비어있을 경우 기본값 'untitled' 사용.

- [ ] **P2-02**: Markdown 내보내기 구현
  - `Target`: `frontend/src/app/editor/page.tsx` > `handleExport()`
  - `Logic (Pseudo)`:

    ```typescript
    import { downloadFile, sanitizeFilename } from "@/utils/exportUtils";

    const handleExport = () => {
      if (!content) {
        toast.warning("내보낼 내용이 없습니다");
        return;
      }

      const filename = sanitizeFilename(title) + ".md";
      downloadFile(filename, content, "text/markdown");
      toast.success("Markdown으로 내보냈습니다");
    };
    ```

  - `Key Variables`: `content`, `title`
  - `Safety`: 내용 없음 체크 필수.

**Definition of Done (검증):**

- [ ] Test: 내보내기 버튼 클릭 시 `.md` 파일이 다운로드되는가?
- [ ] Test: 파일명이 문서 제목과 일치하는가?
- [ ] Test: 특수문자가 포함된 제목도 안전한 파일명으로 변환되는가?
