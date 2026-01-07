-- =============================================================================
-- Migration: 083_add_project_isolation_to_v2.sql
-- =============================================================================
-- 작성일: 2026-01-07
-- 목적: [CRITICAL] 검색 엔진 V4(search_similar_chunks_v2) 프로젝트 격리 적용
-- 설명:
--   - 기존 V4 함수에 project_id 파라미터가 없어, 사용자의 모든 프로젝트 문서가 검색되는 보안 취약점 발견.
--   - 함수 시그니처를 변경하여 project_id를 필수로 받도록 수정하고, Strict Isolation 로직 추가.
--   - search_path 보안 설정도 'public'으로 유지.
-- =============================================================================

BEGIN;

-- 1. 기존 취약한 함수 삭제 (시그니처 변경을 위해 Drop 필수)
DROP FUNCTION IF EXISTS public.search_similar_chunks_v2(vector, uuid, integer, text);

-- 2. 보안이 강화된 새 함수 생성
CREATE OR REPLACE FUNCTION public.search_similar_chunks_v2(
    query_embedding vector(1536),
    user_id_param uuid,
    match_count integer,
    chunk_type_filter text DEFAULT NULL,
    project_id_param uuid DEFAULT NULL -- [ADDED] 프로젝트 격리용 파라미터
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    metadata jsonb,
    similarity float,
    chunk_type text -- V4 필수 반환 컬럼
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- [SECURITY] 프로젝트 격리 강제 (Strict Mode)
    -- Frontend에서 project_id를 보내지 않으면 검색 결과를 반환하지 않음
    IF project_id_param IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) as similarity,
        c.chunk_type
    FROM rag_chunks c
    JOIN user_documents d ON c.document_id = d.id
    WHERE 
        -- 1) 사용자 본인 확인
        d.user_id = user_id_param
        -- 2) [SECURITY] 프로젝트 격리
        AND d.project_id = project_id_param
        -- 3) 청크 타입 필터 (V4)
        AND (chunk_type_filter IS NULL OR c.chunk_type = chunk_type_filter)
        -- 4) 최소 유사도 (기본값)
        AND 1 - (c.embedding <=> query_embedding) > 0.0
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 3. 함수 권한 및 설정
ALTER FUNCTION public.search_similar_chunks_v2(vector, uuid, integer, text, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.search_similar_chunks_v2(vector, uuid, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_chunks_v2(vector, uuid, integer, text, uuid) TO service_role;

-- 4. Search Path 보안 설정 (081 패치 유지)
ALTER FUNCTION public.search_similar_chunks_v2(vector, uuid, integer, text, uuid) SET search_path = 'public';

COMMIT;
