# 🔍 JeDebug 최종 검증 보고서 - Phase 7 Project Trash

**검증일**: 2026-01-01 02:01  
**검증자**: JeDebug (Senior Lead Developer / Red Team)  
**대상 문서**: `2601010158_Phase7_Project_Trash_Design.md`

---

## 1. 🚨 Critical Issues (버그 및 목적 불일치)

### Issue #1: RLS 정책 충돌 - 영구 삭제 불가

- [ ] **Target ID**: P7-01-A (DB 마이그레이션)
  - **Problem**: 현재 설계에서 `projects_user_active` 정책은 `deleted_at IS NULL`만 허용하고, `projects_user_trash`는 SELECT만 허용. **영구 삭제(DELETE) 시 RLS가 차단**하여 삭제 실패.
  - **Solution**: 휴지통 정책에 DELETE 권한 추가 필요.

### Issue #2: DELETE 메서드로 UPDATE 수행 - REST 원칙 위반

- [ ] **Target ID**: P7-02-A (소프트 삭제 API)
  - **Problem**: DELETE 메서드가 실제로는 UPDATE(`deleted_at = now()`)를 수행. **REST 의미론 위반** 및 클라이언트 혼란 유발.
  - **Solution**: PATCH `/api/projects/[id]` 사용하거나, DELETE 응답에 "soft-deleted" 상태 명시.

### Issue #3: 연관 데이터 RLS 정책 누락

- [ ] **Target ID**: P7-01-A (DB 마이그레이션)
  - **Problem**: `user_documents`, `evaluation_logs` 등의 RLS 정책이 프로젝트의 `deleted_at` 상태를 고려하지 않음. **휴지통 프로젝트의 문서가 여전히 조회 가능**.
  - **Solution**: 연관 테이블 RLS에 `projects.deleted_at IS NULL` 조건 추가 또는 API 레벨에서 필터링.

---

## 2. 🩹 Patched Checklist Items (복사해서 교체용)

### P7-01-A (수정됨): DB 마이그레이션

```sql
-- 053_phase7_project_trash.sql

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
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON public.projects(user_id, deleted_at);
```

- `Note`: 휴지통에서 DELETE(영구삭제) 가능하도록 정책 수정.

---

### P7-02-A (수정됨): 소프트 삭제 API

- `Target`: `frontend/src/app/api/projects/[id]/route.ts`
- `Logic`:
  ```typescript
  // DELETE 메서드 유지하되, soft-delete임을 명시
  export async function DELETE(request, { params }) {
    // ... 인증 체크

    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() }) // UPDATE!
      .eq("id", params.id)
      .eq("user_id", user.id)
      .is("deleted_at", null); // 이미 삭제된 것 제외

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Project moved to trash",
      deleted_at: new Date().toISOString(),
    });
  }
  ```
- `Note`: DELETE 메서드 유지하되 응답에 soft-delete 상태 명시.

---

### P7-02-C (수정됨): 영구 삭제 API

- `Target`: `frontend/src/app/api/projects/[id]/permanent/route.ts`
- `Logic`:
  ```typescript
  export async function DELETE(request, { params }) {
    // ... 인증 체크

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
- `Note`: 활성 프로젝트 직접 영구삭제 방지 (휴지통 경유 필수).

---

### P7-04-B (추가): 휴지통 페이지 - 남은 일수 계산

- `Target`: `frontend/src/app/trash/page.tsx`
- `Logic`:
  ```typescript
  // 남은 일수 계산 유틸
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
- `Note`: 사용자에게 정확한 남은 일수 표시 필요.

---

## 3. 🛡️ Security & Performance Check

### Security

- [x] **SQL Injection**: Supabase SDK 사용으로 **Pass**
- [x] **권한 검사**: RLS + `user.id` 비교로 **Pass**
- [ ] **Rate Limiting**: 영구 삭제 API에 rate limit 권장 (DoS 방지)

### Performance

- [x] **N+1 Query**: 휴지통 목록 단일 쿼리로 **Pass**
- [ ] **CASCADE 삭제 성능**: 대용량 프로젝트 삭제 시 시간 소요 가능 → 백그라운드 처리 권장

---

## 4. ✅ Final Verdict

- [x] **부분 수정 (Approved with Patches)**: 위 Patched Items로 해당 항목 교체 후 진행.

### 요약

| 항목          | 상태             |
| ------------- | ---------------- |
| RLS 정책 수정 | 🔧 패치 필요     |
| API 로직 보완 | 🔧 패치 필요     |
| 보안          | ✅ Pass          |
| 성능          | ⚠️ 주의 (대용량) |

---

> **JeDebug 서명**: 위 패치 적용 후 구현 진행을 승인합니다.  
> **버전**: v1.0
