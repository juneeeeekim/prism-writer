-- Migration: 027_add_document_status.sql
-- Description: rag_documents 테이블에 상세 상태, 에러 메시지, 시작 시간 컬럼 추가 및 기존 데이터 마이그레이션

-- 1. 새로운 상태값들을 지원하기 위해 status 컬럼의 체크 제약조건을 수정합니다.
-- SQLite/PostgreSQL 호환성을 위해 기존 제약조건을 삭제하고 새로 추가하는 방식이 안전하지만,
-- Supabase(PostgreSQL)에서는 ALTER TABLE로 제약조건을 수정할 수 있습니다.

-- 먼저 기존 제약조건 이름을 확인해야 하지만, 여기서는 안전하게 DROP 후 ADD 방식을 사용합니다.
-- (가정: 제약조건 이름이 rag_documents_status_check 라고 가정, 만약 다르면 에러가 날 수 있으므로 확인 필요.
--  보통 Supabase UI에서 생성하면 rag_documents_status_check 형식이 됨)

DO $$
BEGIN
    -- 기존 제약조건이 있다면 삭제
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_documents_status_check') THEN
        ALTER TABLE rag_documents DROP CONSTRAINT rag_documents_status_check;
    END IF;
END $$;

-- 2. 새로운 컬럼 추가
ALTER TABLE rag_documents
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 3. 기존 데이터 마이그레이션
-- 'processing' 상태인 문서들은 좀비 프로세스일 가능성이 높으므로 'failed'로 변경하거나
-- 재시도를 위해 'queued'로 변경할 수 있습니다. 여기서는 안전하게 'failed'로 처리하고
-- 에러 메시지에 마이그레이션으로 인한 초기화임을 명시합니다.
UPDATE rag_documents
SET 
    status = 'failed',
    error_message = 'System update: Reset stuck processing status'
WHERE status = 'processing';

-- 4. 새로운 체크 제약조건 추가
-- Enum 값: queued, processing_parsing, processing_chunking, processing_embedding, completed, failed
ALTER TABLE rag_documents
ADD CONSTRAINT rag_documents_status_check 
CHECK (status IN (
    'pending', -- 기존 호환성을 위해 남겨둘 수도 있지만, 코드에서 queued로 변경했다면 제외해야 함. 
               -- 하지만 안전을 위해 기존 값('pending', 'processing', 'ready', 'error')도 포함하거나
               -- 데이터를 모두 신규 값으로 변환해야 함.
               -- 여기서는 코드의 Enum(queued, processing_parsing...)과 기존 값 매핑이 필요함.
               -- 기존: pending -> queued, processing -> processing_parsing, ready -> completed, error -> failed
    
    -- 신규 상태값
    'queued', 
    'processing_parsing', 
    'processing_chunking', 
    'processing_embedding', 
    'completed', 
    'failed',

    -- 기존 상태값 (마이그레이션 과도기 동안 유지, 추후 제거 권장)
    'pending',
    'processing',
    'ready',
    'error'
));

-- 5. 기존 데이터 값 변환 (선택 사항: 데이터를 완전히 신규 체계로 넘기고 싶다면 실행)
UPDATE rag_documents SET status = 'queued' WHERE status = 'pending';
UPDATE rag_documents SET status = 'completed' WHERE status = 'ready';
UPDATE rag_documents SET status = 'failed' WHERE status = 'error';
-- processing은 위에서 이미 처리함.

-- 6. (옵션) 이제 기존 상태값을 제약조건에서 제외하고 싶다면 다시 제약조건을 걸 수 있음.
-- 하지만 배포 중 구버전 API가 돌고 있을 수 있으므로 당분간은 모두 허용하는 것이 안전함.
