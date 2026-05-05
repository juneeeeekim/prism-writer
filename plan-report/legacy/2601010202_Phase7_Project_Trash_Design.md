# 🗑️ Phase 7: 프로젝트 삭제 + 휴지통 기능 설계 문서

**작성일**: 2026-01-01 01:58  
**수정일**: 2026-01-01 02:06 (JeDebug 패치 적용)  
**작성자**: Tech Lead  
**검증자**: JeDebug (Senior Lead Developer)  
**문서 ID**: PHASE7-PROJECT-TRASH-2026-0101  
**우선순위**: P2 (기능 확장)  
**예상 소요**: 5-6시간

---

## 📌 배경 및 목표

### 요구 사항

1. 프로젝트 **삭제 기능** 추가
2. 삭제된 프로젝트는 **휴지통으로 이동** (소프트 삭제)
3. 휴지통에서 **30일간 복구 가능**
4. 30일 후 **자동 영구 삭제**

### 데이터 흐름

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  프로젝트   │ ──▶ │   휴지통    │ ──▶ │  영구 삭제  │
│  (active)   │     │ deleted_at  │     │  (CASCADE)  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
    사용자            30일 대기           Cron Job
    삭제 클릭        복구 가능         자동 정리
```

---

## 📋 구현 체크리스트

### Phase 7.1: DB 마이그레이션

- [x] **P7-01-A**: `projects` 테이블에 `deleted_at` 컬럼 추가 ⭐ _패치 적용_ ✅ COMPLETED (2026-01-01 02:08)

  - `Target`: `supabase/migrations/053_phase7_project_trash.sql`
  - `Logic`:

    ```sql
    -- 1. deleted_at 컬럼 추가
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

    -- 2. 기존 정책 삭제
    DROP POLICY IF EXISTS "projects_user_crud" ON public.projects;
    DROP POLICY IF EXISTS "projects_user_active" ON public.projects;
    DROP POLICY IF EXISTS "projects_user_trash" ON public.projects;

    -- 3. 활성 프로젝트 정책 (SELECT, INSERT, UPDATE)
    CREATE POLICY "projects_active_access" ON public.projects
      FOR ALL USING (
        auth.uid() = user_id
        AND deleted_at IS NULL
      );

    -- 4. 휴지통 정책 (SELECT, UPDATE, DELETE) ⭐ DELETE 포함!
    CREATE POLICY "projects_trash_access" ON public.projects
      FOR ALL USING (
        auth.uid() = user_id
        AND deleted_at IS NOT NULL
      );

    -- 5. 인덱스
    CREATE INDEX IF NOT EXISTS idx_projects_deleted
      ON public.projects(user_id, deleted_at);
    ```

  - `Note`: 휴지통에서 DELETE(영구삭제) 가능하도록 정책 수정 (JeDebug #1 패치)

---

### Phase 7.2: API 엔드포인트

- [x] **P7-02-A**: 소프트 삭제 API ⭐ _패치 적용_ ✅ COMPLETED

  - `Target`: `frontend/src/app/api/projects/[id]/route.ts` (DELETE 수정)
  - `Logic`:

    ```typescript
    // DELETE 메서드 - soft delete 수행
    export async function DELETE(request, { params }) {
      // 인증 체크
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("user_id", user.id)
        .is("deleted_at", null); // 이미 삭제된 것 제외

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Project moved to trash", // ⭐ soft-delete 명시
        deleted_at: new Date().toISOString(),
      });
    }
    ```

  - `Note`: 응답에 soft-delete 상태 명시 (JeDebug #2 패치)

- [x] **P7-02-B**: 복구 API ✅ COMPLETED

  - `Target`: `frontend/src/app/api/projects/[id]/restore/route.ts` [NEW]
  - `Logic`: PATCH → `deleted_at = NULL` 설정

- [x] **P7-02-C**: 영구 삭제 API ⭐ _패치 적용_ ✅ COMPLETED

  - `Target`: `frontend/src/app/api/projects/[id]/permanent/route.ts` [NEW]
  - `Logic`:

    ```typescript
    export async function DELETE(request, { params }) {
      // 인증 체크
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // ⚠️ 휴지통에 있는 것만 영구 삭제 가능
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", params.id)
        .eq("user_id", user.id)
        .not("deleted_at", "is", null); // 휴지통에 있는 것만!

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Project permanently deleted",
      });
    }
    ```

  - `Note`: 활성 프로젝트 직접 영구삭제 방지 (JeDebug #3 추가)

- [x] **P7-02-D**: 휴지통 목록 API ✅ COMPLETED
  - `Target`: `frontend/src/app/api/projects/trash/route.ts` [NEW]
  - `Logic`: GET → `deleted_at IS NOT NULL` 조건 조회

---

### Phase 7.3: 타입 정의

- [x] **P7-03-A**: Project 타입 업데이트 ✅ COMPLETED
  - `Target`: `frontend/src/types/project.ts`
  - `변경`: `deleted_at?: string | null` 필드 추가

---

### Phase 7.4: UI 구현

- [x] **P7-04-A**: 대시보드 삭제 버튼 ✅ COMPLETED

  - `Target`: `frontend/src/app/dashboard/page.tsx`
  - `UI`: 프로젝트 카드에 삭제 버튼 (휴지통 아이콘)

- [x] **P7-04-B**: 휴지통 페이지 ⭐ _패치 적용_ ✅ COMPLETED

  - `Target`: `frontend/src/app/trash/page.tsx` [NEW]
  - `Logic`:
    ```typescript
    // 남은 일수 계산 유틸 (JeDebug 추가)
    function getDaysRemaining(deletedAt: string): number {
      const deleted = new Date(deletedAt);
      const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      return Math.max(
        0,
        Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );
    }
    ```
  - `UI`: 삭제된 프로젝트 목록, 복구/영구삭제 버튼, **남은 일수 표시**

- [x] **P7-04-C**: 삭제 확인 모달 ✅ COMPLETED
  - `Target`: `frontend/src/components/modals/DeleteConfirmModal.tsx` [NEW]
  - `UI`: "30일 후 영구 삭제됩니다" 경고 메시지

---

### Phase 7.5: 자동 정리 (Cron)

- [x] **P7-05-A**: 30일 지난 프로젝트 자동 삭제 함수 ✅ COMPLETED
  - `Target`: `supabase/migrations/054_project_cleanup_function.sql` [NEW]
  - `Logic`:
    ```sql
    CREATE OR REPLACE FUNCTION cleanup_deleted_projects()
    RETURNS void AS $$
    BEGIN
      DELETE FROM public.projects
      WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '30 days';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```

---

## ⚠️ 주의 사항

### CASCADE 삭제

프로젝트 삭제 시 연관 데이터도 함께 삭제됨:

- `user_documents`, `document_chunks`, `evaluation_logs`, `chat_sessions`

> **중요**: 영구 삭제 전 사용자에게 경고 필요!

---

## ✅ JeDebug 검증 결과

| 항목     | 상태           |
| -------- | -------------- |
| RLS 정책 | ✅ 패치 적용   |
| API 로직 | ✅ 패치 적용   |
| 보안     | ✅ Pass        |
| 성능     | ⚠️ 대용량 주의 |

**최종 판정**: ✅ **승인 (Approved with Patches)**

---

> **작성자**: Tech Lead  
> **검증자**: JeDebug  
> **상태**: ✅ **구현 준비 완료**  
> **버전**: v1.1 (JeDebug 패치 적용)
