-- =============================================================================
-- PRISM Writer - RAG Chunks Schema
-- =============================================================================
-- 파일: backend/migrations/013_rag_chunks_schema.sql
-- 역할: RAG 시스템을 위한 문서 청크(조각) 저장 테이블 생성
-- 목적: 업로드된 문서를 검색 가능한 청크로 분할하여 저장
-- 버전: v1.0
-- =============================================================================

-- =============================================================================
-- 1. pgvector 확장 활성화
-- =============================================================================
-- 설명: 벡터 임베딩 저장 및 유사도 검색을 위한 pgvector 확장

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. 테이블 생성: rag_chunks
-- =============================================================================
-- 설명: 문서를 분할한 청크와 임베딩 벡터를 저장하는 테이블

CREATE TABLE IF NOT EXISTS public.rag_chunks (
    -- -------------------------------------------------------------------------
    -- 기본 ID 및 관계
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    
    -- -------------------------------------------------------------------------
    -- 청크 정보
    -- -------------------------------------------------------------------------
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    
    -- -------------------------------------------------------------------------
    -- 벡터 임베딩 (OpenAI text-embedding-ada-002: 1536 차원)
    -- -------------------------------------------------------------------------
    embedding vector(1536),
    
    -- -------------------------------------------------------------------------
    -- 확장 메타데이터 (JSONB)
    -- -------------------------------------------------------------------------
    -- 예시: { "section_title": "Introduction", "page_number": 1, "token_count": 512 }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- -------------------------------------------------------------------------
    -- 타임스탬프
    -- -------------------------------------------------------------------------
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- -------------------------------------------------------------------------
    -- 제약 조건: 같은 문서 내에서 chunk_index는 고유해야 함
    -- -------------------------------------------------------------------------
    CONSTRAINT unique_chunk_per_document UNIQUE(document_id, chunk_index)
);

-- =============================================================================
-- 3. 인덱스 생성 (성능 최적화)
-- =============================================================================

-- document_id로 청크 조회 (특정 문서의 모든 청크)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id 
    ON public.rag_chunks(document_id);

-- chunk_index로 정렬 (문서 내 순서대로 조회)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_index 
    ON public.rag_chunks(document_id, chunk_index);

-- 벡터 유사도 검색을 위한 HNSW 인덱스
-- 설명: Hierarchical Navigable Small World - 빠른 근사 최근접 이웃 검색
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding 
    ON public.rag_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- 4. RLS (Row Level Security) 활성화
-- =============================================================================

-- RLS 활성화
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS 정책 정의
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 정책 1: 사용자는 본인 문서의 청크만 조회 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view own document chunks"
    ON public.rag_chunks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.rag_documents
            WHERE rag_documents.id = rag_chunks.document_id
            AND rag_documents.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 정책 2: 사용자는 본인 문서의 청크를 삽입 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can insert own document chunks"
    ON public.rag_chunks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rag_documents
            WHERE rag_documents.id = rag_chunks.document_id
            AND rag_documents.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 정책 3: 사용자는 본인 문서의 청크를 삭제 가능
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can delete own document chunks"
    ON public.rag_chunks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.rag_documents
            WHERE rag_documents.id = rag_chunks.document_id
            AND rag_documents.user_id = auth.uid()
        )
    );

-- =============================================================================
-- 6. 기본 코멘트 (문서화)
-- =============================================================================

COMMENT ON TABLE public.rag_chunks IS 
    'RAG 시스템용 문서 청크 및 임베딩 저장 테이블 (v1.0)';

COMMENT ON COLUMN public.rag_chunks.id IS 
    '청크 고유 ID (UUID)';

COMMENT ON COLUMN public.rag_chunks.document_id IS 
    '원본 문서 ID (rag_documents 참조)';

COMMENT ON COLUMN public.rag_chunks.chunk_index IS 
    '문서 내 청크 순서 (0부터 시작)';

COMMENT ON COLUMN public.rag_chunks.content IS 
    '청크 텍스트 내용';

COMMENT ON COLUMN public.rag_chunks.embedding IS 
    '벡터 임베딩 (1536 차원, OpenAI text-embedding-ada-002)';

COMMENT ON COLUMN public.rag_chunks.metadata IS 
    '확장 메타데이터 (JSONB): 섹션 제목, 페이지 번호, 토큰 수 등';

-- =============================================================================
-- 7. 유틸리티 함수: 유사도 검색
-- =============================================================================

-- 설명: 주어진 쿼리 임베딩과 가장 유사한 청크 검색
-- 사용법: SELECT * FROM search_similar_chunks(query_embedding, user_id, limit);

CREATE OR REPLACE FUNCTION public.search_similar_chunks(
    query_embedding vector(1536),
    user_id_param UUID,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.metadata
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON c.document_id = d.id
    WHERE d.user_id = user_id_param
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_similar_chunks IS 
    '벡터 유사도 기반 청크 검색 함수 (코사인 거리 사용)';

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
