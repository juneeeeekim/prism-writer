-- =============================================================================
-- PRISM Writer - Pipeline v4 BM25 Dual Index Migration
-- =============================================================================
-- 파일: backend/migrations/030_bm25_dual_index.sql
-- 역할: rag_chunks 테이블에 chunk_type 컬럼 추가 및 2종 인덱스 생성
-- Phase: Pipeline v4 업그레이드 - JeDebug Risk 1 해결
-- =============================================================================

-- =============================================================================
-- 1. chunk_type ENUM 타입 생성
-- =============================================================================
-- 주석(시니어 개발자): ENUM 타입으로 데이터 무결성 보장
-- 'rule': 규칙/원칙 청크
-- 'example': 예시/사례 청크  
-- 'general': 일반 텍스트 청크

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chunk_type_enum') THEN
        CREATE TYPE chunk_type_enum AS ENUM ('rule', 'example', 'general');
    END IF;
END$$;

-- =============================================================================
-- 2. rag_chunks 테이블에 chunk_type 컬럼 추가
-- =============================================================================
-- 주석(주니어 개발자): 기존 데이터는 'general'로 기본값 설정하여 하위 호환성 유지

ALTER TABLE rag_chunks 
ADD COLUMN IF NOT EXISTS chunk_type chunk_type_enum DEFAULT 'general';

-- 기존 데이터에 기본값 적용 (NULL 방지)
UPDATE rag_chunks 
SET chunk_type = 'general' 
WHERE chunk_type IS NULL;

-- =============================================================================
-- 3. Rule 전용 GIN 인덱스 생성
-- =============================================================================
-- 주석(시니어 개발자): Rule 타입 청크에 대한 키워드 검색 최적화
-- CONCURRENTLY 옵션은 운영 중 테이블 락 방지 (단, 트랜잭션 내에서 사용 불가)

CREATE INDEX IF NOT EXISTS idx_chunks_rule_type 
ON rag_chunks (chunk_type) 
WHERE chunk_type = 'rule';

-- tsvector 컬럼이 있다면 Rule 전용 GIN 인덱스도 생성
-- (현재 스키마에서 tsvector 컬럼이 없으므로 주석 처리)
-- CREATE INDEX IF NOT EXISTS idx_chunks_rule_keywords 
-- ON rag_chunks USING GIN(content_tsvector) 
-- WHERE chunk_type = 'rule';

-- =============================================================================
-- 4. Example 전용 GIN 인덱스 생성
-- =============================================================================
-- 주석(주니어 개발자): Example 타입 청크에 대한 검색 최적화

CREATE INDEX IF NOT EXISTS idx_chunks_example_type 
ON rag_chunks (chunk_type) 
WHERE chunk_type = 'example';

-- =============================================================================
-- 5. 복합 인덱스: document_id + chunk_type
-- =============================================================================
-- 주석(시니어 개발자): 문서별 특정 타입 청크 조회 시 성능 향상

CREATE INDEX IF NOT EXISTS idx_chunks_document_chunk_type 
ON rag_chunks (document_id, chunk_type);

-- =============================================================================
-- 6. 예시 신호 감지 함수 (Optional - 자동 분류용)
-- =============================================================================
-- 주석(UX/UI 개발자 리뷰): 이 함수는 DB 레벨에서 텍스트 분류 시 사용 가능
-- Frontend에서 classifyChunkType()이 이미 구현되어 있으므로 백업용

CREATE OR REPLACE FUNCTION detect_chunk_type(content TEXT) 
RETURNS chunk_type_enum AS $$
DECLARE
    has_rule_pattern BOOLEAN;
    has_example_pattern BOOLEAN;
BEGIN
    -- 규칙 패턴 검사 (한글 + 영어)
    has_rule_pattern := content ~ '해야\s*(합니다|한다|함)' 
                     OR content ~ '하지\s*(마|말아야|않아야)'
                     OR content ~* '금지|원칙|규칙|필수|반드시'
                     OR content ~* 'should\s+(always|never)'
                     OR content ~* 'must\s+(be|have|not)'
                     OR content ~* 'do\s+not|avoid';
    
    -- 예시 패턴 검사 (한글 + 영어)
    has_example_pattern := content ~ '예를\s*들어|예시|사례'
                        OR content ~ '"[^"]{10,}"'  -- 10자 이상 따옴표
                        OR content ~* 'before\s*[:/]|after\s*[:/]'
                        OR content ~* 'good\s*example|bad\s*example|for\s*example|e\.g\.'
                        OR content ~ '다음과\s*같';
    
    -- 우선순위: 규칙 > 예시 > 일반
    IF has_rule_pattern THEN
        RETURN 'rule';
    ELSIF has_example_pattern THEN
        RETURN 'example';
    ELSE
        RETURN 'general';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 7. 테이블 주석 추가
-- =============================================================================

COMMENT ON COLUMN rag_chunks.chunk_type IS 'Pipeline v4: 청크 유형 (rule/example/general)';

-- =============================================================================
-- 검증 쿼리 (수동 실행용)
-- =============================================================================
-- 주석: 마이그레이션 완료 후 아래 쿼리로 확인
-- SELECT chunk_type, COUNT(*) FROM rag_chunks GROUP BY chunk_type;

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
-- 아래 스크립트는 마이그레이션 취소 시 사용합니다.
-- 주의: 프로덕션에서 실행 전 반드시 백업 필수!
/*
-- 롤백 절차:
-- 1. 인덱스 삭제
DROP INDEX IF EXISTS idx_chunks_document_chunk_type;
DROP INDEX IF EXISTS idx_chunks_example_type;
DROP INDEX IF EXISTS idx_chunks_rule_type;

-- 2. 함수 삭제
DROP FUNCTION IF EXISTS detect_chunk_type(TEXT);

-- 3. 컬럼 삭제
ALTER TABLE rag_chunks DROP COLUMN IF EXISTS chunk_type;

-- 4. ENUM 타입 삭제
DROP TYPE IF EXISTS chunk_type_enum;
*/
