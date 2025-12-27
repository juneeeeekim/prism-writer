-- =============================================================================
-- Phase 13: Document Sort Order Migration
-- =============================================================================
-- 파일: supabase/migrations/035_add_sort_order.sql
-- 역할: user_documents 테이블에 sort_order 컬럼 추가
-- 생성일: 2025-12-28
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sort_order 컬럼 추가 (Default: 0)
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_documents 
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 2. 성능 인덱스 추가 (카테고리별 정렬 조회용)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_documents_category_sort 
ON public.user_documents(category, sort_order);

-- -----------------------------------------------------------------------------
-- 3. 기존 데이터 초기화 (created_at 기준 오름차순 정렬 값 부여)
--    같은 카테고리 내에서 시간순으로 정렬값 부여
-- -----------------------------------------------------------------------------
WITH ordered_docs AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at) as new_order
  FROM public.user_documents
)
UPDATE public.user_documents
SET sort_order = ordered_docs.new_order
FROM ordered_docs
WHERE public.user_documents.id = ordered_docs.id;
