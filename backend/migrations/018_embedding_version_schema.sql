-- =============================================================================
-- PRISM Writer - Embedding Version Schema Migration
-- =============================================================================
-- 파일: backend/migrations/018_embedding_version_schema.sql
-- 역할: RAG 임베딩 버전 관리를 위한 스키마 확장
-- 목적: 임베딩 모델 변경 시 기존 데이터와의 호환성 관리
-- 버전: v1.0
-- =============================================================================

-- =============================================================================
-- 1. 임베딩 버전 관리 컬럼 추가
-- =============================================================================
-- 설명: rag_chunks 테이블에 임베딩 모델 정보 및 생성 시점 추적 컬럼 추가
-- 주의: DEFAULT 값 설정으로 기존 데이터 호환성 확보

ALTER TABLE public.rag_chunks
  ADD COLUMN IF NOT EXISTS embedding_model_id TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  ADD COLUMN IF NOT EXISTS embedding_dim INT NOT NULL DEFAULT 1536,
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =============================================================================
-- 2. 성능 최적화 인덱스 추가
-- =============================================================================
-- 설명: embedding_model_id로 필터링 시 성능 향상을 위한 인덱스

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_model_id 
  ON public.rag_chunks(embedding_model_id);

-- =============================================================================
-- 3. 컬럼 코멘트 (문서화)
-- =============================================================================

COMMENT ON COLUMN public.rag_chunks.embedding_model_id IS 
    '사용된 임베딩 모델 ID (예: text-embedding-3-small)';

COMMENT ON COLUMN public.rag_chunks.embedding_dim IS 
    '임베딩 벡터 차원 수 (예: 1536)';

COMMENT ON COLUMN public.rag_chunks.embedded_at IS 
    '임베딩 생성 시점 (타임스탬프)';

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
