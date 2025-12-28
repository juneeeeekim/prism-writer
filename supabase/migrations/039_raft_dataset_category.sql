-- =============================================================================
-- Migration: Add category column to raft_dataset
-- Description: Supports Category Data Isolation for RAFT synthetic data
-- Author: Tech Lead
-- Date: 2025-12-28
-- =============================================================================

-- 1. category 컬럼 추가 (TEXT, 기본값 '미분류')
-- IF NOT EXISTS 를 사용하여 중복 실행 시 에러 방지
ALTER TABLE public.raft_dataset
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '미분류';

-- 2. 카테고리 필터링 성능 최적화를 위한 인덱스 생성
-- UI/API에서 카테고리별 격리 조회 시 필수
CREATE INDEX IF NOT EXISTS idx_raft_dataset_category
ON public.raft_dataset(category);

-- 3. 출처(source) + 카테고리 복합 인덱스 생성
-- '합성 데이터' 중 '마케팅' 카테고리만 조회하는 등의 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_raft_dataset_source_category
ON public.raft_dataset(source, category);

-- 4. 컬럼에 대한 메타데이터 코멘트 추가
COMMENT ON COLUMN public.raft_dataset.category IS 'RAFT 지식 도메인 카테고리 (예: 마케팅, 기술 등). 데이터 격리에 사용됨.';
