-- =============================================================================
-- PRISM Writer - Pipeline v4: 레거시 document_chunks 테이블 삭제
-- =============================================================================
-- 파일: backend/migrations/034_drop_legacy_document_chunks.sql
-- 역할: 사용되지 않는 레거시 document_chunks 테이블 정리
-- 배경:
--   - document_chunks: 초기 Gemini 768차원 임베딩용 (레거시)
--   - rag_chunks: 현재 사용 중인 OpenAI 1536차원 임베딩용
-- =============================================================================

-- =============================================================================
-- 1. 삭제 전 데이터 확인 (안전 검증)
-- =============================================================================
-- 주석(시니어 개발자): 삭제 전 데이터 유무 확인 권장
-- SELECT COUNT(*) as count FROM document_chunks;
-- 결과가 0이면 안전하게 삭제 가능

-- =============================================================================
-- 2. 관련 함수 삭제
-- =============================================================================
-- 주석(주니어 개발자): 테이블 삭제 전 관련 함수 먼저 정리

DROP FUNCTION IF EXISTS match_document_chunks(vector(768), float, int);

-- =============================================================================
-- 3. RLS 정책 삭제
-- =============================================================================

DROP POLICY IF EXISTS "Users can select their own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Users can insert their own chunks" ON document_chunks;

-- =============================================================================
-- 4. 테이블 삭제
-- =============================================================================

DROP TABLE IF EXISTS document_chunks;

-- =============================================================================
-- 5. 삭제 확인
-- =============================================================================

COMMENT ON SCHEMA public IS 'Pipeline v4: document_chunks 레거시 테이블 삭제 완료 (034 마이그레이션)';

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백이 필요한 경우 아래 스크립트 실행 (020_search_schema.sql 내용)

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION match_document_chunks (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id bigint,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        document_chunks.id,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own chunks"
    ON document_chunks
    FOR SELECT
    USING (
        auth.uid()::text = (metadata->>'userId') 
        OR 
        (metadata->>'isPublic')::boolean = true
    );

CREATE POLICY "Users can insert their own chunks"
    ON document_chunks
    FOR INSERT
    WITH CHECK (auth.uid() = auth.uid());
*/
