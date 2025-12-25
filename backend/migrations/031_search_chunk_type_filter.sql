-- =============================================================================
-- PRISM Writer - Pipeline v4 Search Function Upgrade
-- =============================================================================
-- 파일: backend/migrations/031_search_chunk_type_filter.sql
-- 역할: search_similar_chunks 함수에 chunk_type 필터 추가
-- Phase: Pipeline v4 업그레이드 - BM25 Dual Index 연동
-- =============================================================================

-- =============================================================================
-- 1. 기존 함수 업그레이드: search_similar_chunks_v2
-- =============================================================================
-- 주석(시니어 개발자): 기존 함수를 유지하면서 v2 함수를 추가 (하위 호환성)
-- 새 함수는 chunk_type 필터를 옵셔널 파라미터로 지원

CREATE OR REPLACE FUNCTION public.search_similar_chunks_v2(
    query_embedding vector(1536),
    user_id_param UUID,
    match_count INTEGER DEFAULT 5,
    chunk_type_filter TEXT DEFAULT NULL  -- Pipeline v4: 옵셔널 chunk_type 필터
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    chunk_type TEXT  -- Pipeline v4: chunk_type 반환 추가
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- -------------------------------------------------------------------------
    -- Pipeline v4: chunk_type 필터를 지원하는 벡터 유사도 검색
    -- chunk_type_filter가 NULL이면 모든 타입 검색 (하위 호환성 유지)
    -- -------------------------------------------------------------------------
    RETURN QUERY
    SELECT 
        c.id AS chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.metadata,
        c.chunk_type::TEXT AS chunk_type  -- ENUM을 TEXT로 변환
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON c.document_id = d.id
    WHERE d.user_id = user_id_param
      AND (chunk_type_filter IS NULL OR c.chunk_type::TEXT = chunk_type_filter)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_similar_chunks_v2 IS 
    'Pipeline v4: chunk_type 필터를 지원하는 벡터 유사도 검색 함수';

-- =============================================================================
-- 2. 문서별 chunk_type 필터 검색 함수
-- =============================================================================
-- 주석(주니어 개발자): 특정 문서 내에서 chunk_type으로 필터링하여 검색

CREATE OR REPLACE FUNCTION public.search_document_chunks_by_type(
    query_embedding vector(1536),
    user_id_param UUID,
    document_id_param UUID,
    chunk_type_filter TEXT DEFAULT NULL,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    chunk_type TEXT
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
        c.metadata,
        c.chunk_type::TEXT AS chunk_type
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON c.document_id = d.id
    WHERE d.user_id = user_id_param
      AND c.document_id = document_id_param
      AND (chunk_type_filter IS NULL OR c.chunk_type::TEXT = chunk_type_filter)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.search_document_chunks_by_type IS 
    'Pipeline v4: 특정 문서 내에서 chunk_type 필터를 적용한 벡터 검색';

-- =============================================================================
-- 3. chunk_type별 통계 함수 (모니터링용)
-- =============================================================================
-- 주석(UX/UI 개발자 리뷰): 대시보드에서 청크 분포 확인용

CREATE OR REPLACE FUNCTION public.get_chunk_type_stats(user_id_param UUID)
RETURNS TABLE (
    chunk_type TEXT,
    count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.chunk_type::TEXT,
        COUNT(*)::BIGINT
    FROM public.rag_chunks c
    INNER JOIN public.rag_documents d ON c.document_id = d.id
    WHERE d.user_id = user_id_param
    GROUP BY c.chunk_type;
END;
$$;

COMMENT ON FUNCTION public.get_chunk_type_stats IS 
    'Pipeline v4: 사용자별 chunk_type 분포 통계';

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백 절차:
DROP FUNCTION IF EXISTS public.get_chunk_type_stats(UUID);
DROP FUNCTION IF EXISTS public.search_document_chunks_by_type(vector(1536), UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.search_similar_chunks_v2(vector(1536), UUID, INTEGER, TEXT);
*/
