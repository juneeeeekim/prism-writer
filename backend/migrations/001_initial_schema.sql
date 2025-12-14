-- =============================================================================
-- PRISM Writer - Initial Database Schema
-- =============================================================================
-- 파일: backend/migrations/001_initial_schema.sql
-- 역할: 핵심 테이블 및 인덱스 생성
-- 실행: Supabase SQL Editor에서 실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. pgvector Extension (이미 활성화되어 있어야 함)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 2. documents 테이블 - 업로드된 원본 문서 메타데이터
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 문서 메타데이터
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,  -- 'pdf', 'txt', 'md', 'image'
    file_size BIGINT,
    file_path TEXT,  -- Supabase Storage 경로
    
    -- 처리 상태
    status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- documents 인덱스
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. chunks 테이블 - 청킹된 텍스트 + 임베딩 벡터
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- 청크 내용
    content TEXT NOT NULL,
    chunk_index INT NOT NULL,  -- 문서 내 순서
    
    -- 메타데이터 (페이지 번호, 헤더 등)
    metadata JSONB DEFAULT '{}',
    
    -- 벡터 임베딩 (OpenAI text-embedding-3-small: 1536 차원)
    embedding vector(1536),
    
    -- 중복 방지용 해시
    content_hash TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- chunks 인덱스
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON chunks(content_hash);

-- 벡터 검색용 HNSW 인덱스 (대규모 데이터에서 빠른 검색)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 4. drafts 테이블 - 사용자가 작성 중인 글 [PRISM Writer 핵심]
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 글 내용
    title TEXT DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    
    -- 목차 구조 (JSON 형식)
    -- 예: [{"title": "서론", "depth": 1}, {"title": "본론", "depth": 1}]
    outline JSONB DEFAULT '[]',
    
    -- 메타데이터
    word_count INT DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- drafts 인덱스
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at DESC);

-- -----------------------------------------------------------------------------
-- 5. draft_references 테이블 - 글과 참조 청크 연결
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draft_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
    
    -- 참조 위치 정보
    paragraph_index INT,  -- 몇 번째 문단에서 참조했는지
    
    -- 참조 메타데이터
    reference_type TEXT DEFAULT 'citation',  -- 'citation', 'summary', 'quote'
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- draft_references 인덱스
CREATE INDEX IF NOT EXISTS idx_draft_references_draft_id ON draft_references(draft_id);
CREATE INDEX IF NOT EXISTS idx_draft_references_chunk_id ON draft_references(chunk_id);

-- -----------------------------------------------------------------------------
-- 6. ingestion_jobs 테이블 - 문서 처리 작업 추적
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    
    -- 작업 상태
    status TEXT DEFAULT 'queued',  -- 'queued', 'running', 'completed', 'failed'
    progress INT DEFAULT 0,  -- 0-100 진행률
    error_message TEXT,
    
    -- 재시도 정보
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    -- 타임스탬프
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ingestion_jobs 인덱스
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_document_id ON ingestion_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);

-- -----------------------------------------------------------------------------
-- 7. 벡터 검색 RPC 함수 - match_documents
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE 
        (filter_user_id IS NULL OR d.user_id = filter_user_id)
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. updated_at 자동 갱신 트리거
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- documents 테이블에 트리거 적용
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- drafts 테이블에 트리거 적용
CREATE TRIGGER update_drafts_updated_at
    BEFORE UPDATE ON drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
-- 실행 후 테이블 확인: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
