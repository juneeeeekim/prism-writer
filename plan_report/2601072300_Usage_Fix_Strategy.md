# 🛠️ 전문가 회의: 사용량 표시 문제 해결 전략

## 1. 🔍 문제 진단 (Dr. S & Frontend Lead)

- **증상**: "현재 등급", "일일 요청", "월간 토큰"이 UI에서 표시되지 않거나 "정보 없음"으로 뜸.
- **원인 분석**:
  1.  **Frontend Logic**: `useLLMUsage` 훅은 Supabase Client를 통해 `llm_daily_usage`, `llm_usage_summary` 테이블을 **직접 조회(Direct Select)**함.
  2.  **Missing Permissions**: 해당 테이블들에 대해 `authenticated` 사용자가 자신의 데이터를 조회할 수 있는 **RLS(Row Level Security) 정책이 누락**되었거나 잘못 설정됨.
  3.  **RPC vs Table**: `increment_daily_usage` 같은 RPC는 `SECURITY DEFINER`로 동작하여 기록(Insert)은 되지만, 조회(Select)는 권한이 없어 실패함.

## 2. 💡 해결 방안 (Action Plan)

유료 서비스를 위해 이 기능은 **필수(Must Have)**입니다. 삭제하지 않고 고칩니다.

### Option A: 권한 복구 (채택됨)

`llm_daily_usage` 및 `llm_usage_summary` 테이블에 대해 명확한 RLS 정책을 부여합니다.

- **Policy 1**: `Users can view own daily usage` (SELECT)
- **Policy 2**: `Users can view own usage summary` (SELECT)

### Option B: 대안 검토 (기각됨)

- 외부 서비스(Stripe) 연동은 오버엔지니어링.
- 새로운 RPC 생성은 Frontend 수정을 동반하므로 현재 시점에서 불필요한 리스크.

## 3. 📝 실행 계획 (Migration 082)

`082_fix_usage_permissions.sql` 마이그레이션을 생성하여 다음을 수행:

1.  테이블 RLS 활성화 (`ENABLE ROW LEVEL SECURITY`)
2.  기존 정책 정리 (`DROP POLICY IF EXISTS`)
3.  새로운 조회 정책 생성 (`CREATE POLICY ... FOR SELECT USING (auth.uid() = user_id)`)
4.  권한 부여 (`GRANT SELECT ... TO authenticated`)

---

**결론**: 이 마이그레이션을 적용하면 사용자는 즉시 자신의 사용량을 볼 수 있게 됩니다.
