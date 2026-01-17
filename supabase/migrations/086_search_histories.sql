-- =============================================================================
-- Search History Sync: 검색 기록 영구 저장 테이블
-- =============================================================================
-- 파일: supabase/migrations/086_search_histories.sql
-- 생성일: 2026-01-17
-- 담당: Tech Lead
-- 
-- [Search History Sync]
-- 주석(시니어 개발자): Deep Scholar 검색 기록을 서버 DB에 영구 저장하여
-- 기기 간 동기화를 지원합니다. localStorage 대체 목적.
-- =============================================================================

-- =============================================================================
-- [P1-01] search_histories 테이블 생성
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.search_histories (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys (사용자 및 프로젝트 격리)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- 검색 데이터
  query TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'deep_scholar',
  
  -- [Search History Sync] 결과 캐싱 (Tavily API 비용 절감)
  -- 경량화된 결과만 저장: { title, url, keyFact }[]
  results_summary JSONB,
  result_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 테이블 코멘트
COMMENT ON TABLE public.search_histories IS '[Search History Sync] Deep Scholar 검색 기록 저장';
COMMENT ON COLUMN public.search_histories.id IS '검색 기록 고유 ID';
COMMENT ON COLUMN public.search_histories.user_id IS '소유자 ID (auth.users 참조)';
COMMENT ON COLUMN public.search_histories.project_id IS '프로젝트 ID (projects 참조)';
COMMENT ON COLUMN public.search_histories.query IS '검색어';
COMMENT ON COLUMN public.search_histories.search_type IS '검색 유형 (deep_scholar, web 등)';
COMMENT ON COLUMN public.search_histories.results_summary IS '검색 결과 요약 캐시 (JSONB, 최대 10개)';
COMMENT ON COLUMN public.search_histories.result_count IS '검색 결과 개수';
COMMENT ON COLUMN public.search_histories.created_at IS '검색 실행 시각';

-- =============================================================================
-- [P1-02] 인덱스 생성 (성능 최적화)
-- =============================================================================

-- 복합 인덱스: user_id + project_id + 최신순 정렬
CREATE INDEX IF NOT EXISTS idx_search_histories_user_project 
  ON public.search_histories(user_id, project_id, created_at DESC);

-- 프로젝트 단위 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_search_histories_project 
  ON public.search_histories(project_id, created_at DESC);

-- =============================================================================
-- [P1-03] RLS (Row Level Security) 정책 설정
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.search_histories ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (멱등성 보장)
DROP POLICY IF EXISTS "search_histories_select_own" ON public.search_histories;
DROP POLICY IF EXISTS "search_histories_insert_own" ON public.search_histories;
DROP POLICY IF EXISTS "search_histories_delete_own" ON public.search_histories;

-- SELECT: 본인 기록만 조회
CREATE POLICY "search_histories_select_own" 
  ON public.search_histories 
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인 기록만 생성
CREATE POLICY "search_histories_insert_own" 
  ON public.search_histories 
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 기록만 삭제
CREATE POLICY "search_histories_delete_own" 
  ON public.search_histories 
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 마이그레이션 완료 로그
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[Search History Sync] 086_search_histories.sql 마이그레이션 완료';
  RAISE NOTICE '  - search_histories 테이블 생성';
  RAISE NOTICE '  - 인덱스 생성 (user_project, project)';
  RAISE NOTICE '  - RLS 정책 설정 (SELECT, INSERT, DELETE)';
END $$;
