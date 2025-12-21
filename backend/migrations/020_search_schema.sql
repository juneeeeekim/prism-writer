-- =============================================================================
-- PRISM Writer - Search Schema (P2 Phase 1)
-- =============================================================================
-- 파일: backend/migrations/020_search_schema.sql
-- 역할: 벡터 검색을 위한 테이블 및 함수 생성 (Gemini text-embedding-004 대응)
-- =============================================================================

-- 1. Vector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 문서 청크 테이블 생성
-- 주의: Gemini text-embedding-004 모델은 768차원 벡터를 생성합니다.
-- 기존에 OpenAI(1536차원)용 테이블이 있다면 호환되지 않으므로 주의하세요.
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    
    -- 문서 내용
    content TEXT NOT NULL,
    
    -- 메타데이터 (JSONB로 유연하게 저장)
    -- 예: { "source": "file.pdf", "page": 1, "userId": "..." }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- 임베딩 벡터 (768차원)
    embedding vector(768),
    
    -- 생성 시간
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. 검색 함수 (RPC) 생성
-- =============================================================================
-- 함수명: match_document_chunks (기존 match_documents와 구분)
-- Supabase 클라이언트에서 rpc('match_document_chunks', { ... }) 로 호출
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

-- 4. 인덱스 생성 (IVFFlat 또는 HNSW)
-- 데이터가 적을 때는 인덱스 없이도 빠르지만, 많아지면 필수입니다.
-- 여기서는 IVFFlat을 예시로 사용 (데이터가 어느 정도 쌓인 후 생성하는 것이 좋음)
-- CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- =============================================================================
-- 5. RLS (Row Level Security) 설정
-- =============================================================================
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 본인 문서만 검색 또는 공개 문서
CREATE POLICY "Users can select their own chunks"
    ON document_chunks
    FOR SELECT
    USING (
        auth.uid()::text = (metadata->>'userId') 
        OR 
        (metadata->>'isPublic')::boolean = true
    );

-- 쓰기 정책: 인증된 사용자만 추가 가능
CREATE POLICY "Users can insert their own chunks"
    ON document_chunks
    FOR INSERT
    WITH CHECK (auth.uid() = auth.uid());

-- =============================================================================
-- 6. 주석 (함수 시그니처 명시로 충돌 방지)
-- =============================================================================
COMMENT ON TABLE document_chunks IS 'RAG 문서 청크 저장소 (Gemini 768차원)';
COMMENT ON FUNCTION match_document_chunks(vector(768), float, int) IS '벡터 유사도 검색 함수 (768차원 Gemini용)';

