-- =============================================================================
-- PRISM Writer - 최종 시스템 복구 (관리자 한도 및 권한)
-- =============================================================================
-- 파일: backend/migrations/023_final_system_repair.sql
-- 목표: 
-- 1. 관리자(Admin) 등급인데 할당량이 0인 경우 무제한으로 복구
-- 2. RLS 정책 최종 재설정 (무한루프 방지 포함)
-- 3. 결과 직접 확인
-- =============================================================================

-- [1] 데이터 복구: 관리자(Admin) 등급 할당량 복구
-- 관리자도 'daily_request_limit'가 0이면 UI에서 '정보 없음'으로 뜹니다.
UPDATE public.profiles
SET 
    daily_request_limit = 999999,
    monthly_token_limit = 999999999
WHERE 
    role = 'admin' 
    AND (daily_request_limit = 0 OR daily_request_limit IS NULL);


-- [2] 보안 정책(RLS) 초기화 및 재설정
-- 기존 정책들을 모두 지우고 가장 깔끔한 상태로 다시 만듭니다.

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_admins_read_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 함수 재정의 (안전장치)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 사용자 본인 조회 정책 (누구나 자기는 볼 수 있음)
CREATE POLICY "allow_users_read_own_profile"
ON public.profiles FOR SELECT
TO authenticated
USING ( 
  auth.uid() = id 
);

-- 관리자 전체 조회 정책 (함수 사용 -> 재귀 방지)
CREATE POLICY "allow_admins_read_all_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING ( 
  public.get_my_role() = 'admin' 
);

-- [3] 결과 검증 (이 쿼리의 결과가 보여야 정상입니다!)
SELECT 
  profiles.id, 
  auth.users.email, 
  profiles.role, 
  profiles.daily_request_limit, 
  'Data Fixed Successfully' as status 
FROM 
  public.profiles 
LEFT JOIN 
  auth.users ON profiles.id = auth.users.id
WHERE 
  profiles.id = auth.uid() OR profiles.role = 'admin'
LIMIT 5;
