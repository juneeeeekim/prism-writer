-- =============================================================================
-- PRISM Writer - RLS 재귀(Recursion) 문제 해결
-- =============================================================================
-- 파일: backend/migrations/022_fix_rls_recursion.sql
-- 목표: 관리자 정책이 테이블을 다시 조회하며 무한루프에 빠지는 현상 수정
-- =============================================================================

-- 1. 안전하게 내 역할을 확인하는 함수 생성 (Security Definer)
-- 이 함수는 RLS를 우회하여 실행되므로 재귀가 발생하지 않음
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER -- 중요: 함수 생성자(postgres 등)의 권한으로 실행
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. 기존 관리자 정책 제거
DROP POLICY IF EXISTS "allow_admins_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. 함수 기반의 새 관리자 정책 생성
CREATE POLICY "allow_admins_read_all_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING ( 
  get_my_role() = 'admin' 
);

-- 4. 본인 조회 정책도 확실하게 재확인
DROP POLICY IF EXISTS "allow_users_read_own_profile" ON public.profiles;

CREATE POLICY "allow_users_read_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING ( 
  auth.uid() = id 
);
