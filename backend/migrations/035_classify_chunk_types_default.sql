-- =============================================================================
-- PRISM Writer - Pipeline v5 chunk_type 기본값 마이그레이션
-- =============================================================================
-- 파일: backend/migrations/035_classify_chunk_types_default.sql
-- 역할: 기존 rag_chunks에 chunk_type 기본값('general') 할당
-- 목적: BM25 듀얼 인덱스 (Rule + Example) 지원을 위한 데이터 정합성 확보
-- Phase: Pipeline v5 준비 - 데이터 마이그레이션
-- 생성일: 2025-12-25
-- =============================================================================
--
-- 주석(시니어 개발자): 
-- 이 마이그레이션은 기존 청크들에 chunk_type 기본값을 할당합니다.
-- Pipeline v5에서 Rule Index와 Example Index를 분리하려면
-- 모든 청크가 유효한 chunk_type을 가져야 합니다.
--
-- 영향받는 기능:
-- 1. search_similar_chunks_v2() - chunk_type 필터 사용
-- 2. search_document_chunks_by_type() - 문서별 타입 필터
-- 3. get_chunk_type_stats() - 통계 함수
--
-- =============================================================================

-- =============================================================================
-- 1. 사전 확인: 현재 NULL인 chunk_type 개수 확인
-- =============================================================================
-- 이 쿼리 결과가 0이 아니면 마이그레이션 필요

-- 진단 쿼리 (실행 전 확인용):
-- SELECT COUNT(*) AS null_chunk_type_count FROM public.rag_chunks WHERE chunk_type IS NULL;

-- =============================================================================
-- 2. chunk_type 컬럼에 DEFAULT 값 추가 (없는 경우)
-- =============================================================================
-- 주석(주니어 개발자): 새로 삽입되는 청크는 자동으로 'general' 타입 할당

-- 먼저 chunk_type ENUM이 존재하는지 확인하고 없으면 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chunk_type_enum') THEN
        CREATE TYPE chunk_type_enum AS ENUM ('general', 'rule', 'example', 'definition', 'reference');
        RAISE NOTICE 'Created chunk_type_enum type';
    END IF;
END $$;

-- chunk_type 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'rag_chunks' 
        AND column_name = 'chunk_type'
    ) THEN
        ALTER TABLE public.rag_chunks 
        ADD COLUMN chunk_type chunk_type_enum DEFAULT 'general';
        RAISE NOTICE 'Added chunk_type column with default';
    END IF;
END $$;

-- =============================================================================
-- 3. 기존 NULL 값을 'general'로 업데이트
-- =============================================================================
-- 주석(시니어 개발자): 
-- 이 업데이트는 기존 데이터의 chunk_type이 NULL인 경우에만 적용
-- 이미 타입이 지정된 청크는 변경하지 않음

UPDATE public.rag_chunks
SET chunk_type = 'general'::chunk_type_enum
WHERE chunk_type IS NULL;

-- =============================================================================
-- 4. chunk_type 컬럼에 NOT NULL 제약 추가 (선택적)
-- =============================================================================
-- 주석(UX/UI 개발자 리뷰): 
-- NOT NULL 제약을 추가하면 향후 NULL 삽입 방지
-- 단, 기존 코드 호환성을 위해 DEFAULT 값 설정 필수

-- 주의: 이 제약은 모든 NULL이 처리된 후에만 추가해야 함
-- ALTER TABLE public.rag_chunks 
-- ALTER COLUMN chunk_type SET NOT NULL;

-- =============================================================================
-- 5. chunk_type별 인덱스 생성 (검색 성능 최적화)
-- =============================================================================
-- Pipeline v5 듀얼 인덱스 검색을 위한 인덱스

CREATE INDEX IF NOT EXISTS idx_rag_chunks_chunk_type 
    ON public.rag_chunks(chunk_type);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_type 
    ON public.rag_chunks(document_id, chunk_type);

-- =============================================================================
-- 6. 마이그레이션 검증 함수
-- =============================================================================
-- 주석(시니어 개발자): 마이그레이션 완료 후 검증용

CREATE OR REPLACE FUNCTION public.verify_chunk_type_migration()
RETURNS TABLE (
    total_chunks BIGINT,
    null_chunk_type BIGINT,
    general_count BIGINT,
    rule_count BIGINT,
    example_count BIGINT,
    migration_status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE chunk_type IS NULL) AS null_count,
            COUNT(*) FILTER (WHERE chunk_type = 'general') AS gen_count,
            COUNT(*) FILTER (WHERE chunk_type = 'rule') AS rule_cnt,
            COUNT(*) FILTER (WHERE chunk_type = 'example') AS example_cnt
        FROM public.rag_chunks
    )
    SELECT 
        stats.total,
        stats.null_count,
        stats.gen_count,
        stats.rule_cnt,
        stats.example_cnt,
        CASE 
            WHEN stats.null_count = 0 THEN 'SUCCESS: All chunks have chunk_type'
            ELSE 'FAILED: ' || stats.null_count || ' chunks still have NULL chunk_type'
        END AS status
    FROM stats;
END;
$$;

COMMENT ON FUNCTION public.verify_chunk_type_migration IS 
    'Pipeline v5: chunk_type 마이그레이션 검증 함수';

-- =============================================================================
-- 7. 마이그레이션 결과 확인
-- =============================================================================
-- 실행 후 이 쿼리로 검증:
-- SELECT * FROM public.verify_chunk_type_migration();

-- 예상 결과:
-- total_chunks | null_chunk_type | general_count | rule_count | example_count | migration_status
-- -------------|-----------------|---------------|------------|---------------|------------------
-- 100          | 0               | 100           | 0          | 0             | SUCCESS: All chunks have chunk_type

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백 절차:
-- 1. 검증 함수 삭제
DROP FUNCTION IF EXISTS public.verify_chunk_type_migration();

-- 2. 인덱스 삭제
DROP INDEX IF EXISTS public.idx_rag_chunks_document_type;
DROP INDEX IF EXISTS public.idx_rag_chunks_chunk_type;

-- 3. chunk_type 기본값을 NULL로 복원 (선택적 - 데이터는 유지)
-- UPDATE public.rag_chunks SET chunk_type = NULL WHERE chunk_type = 'general';

-- 4. NOT NULL 제약 제거 (적용한 경우)
-- ALTER TABLE public.rag_chunks ALTER COLUMN chunk_type DROP NOT NULL;
*/

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
-- 완료 조건: SELECT COUNT(*) FROM rag_chunks WHERE chunk_type IS NULL = 0
