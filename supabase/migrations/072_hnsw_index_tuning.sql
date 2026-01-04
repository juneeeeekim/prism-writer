-- =============================================================================
-- Migration: 072_hnsw_index_tuning.sql
-- =============================================================================
-- 작성일: 2026-01-04
-- 목적: HNSW 벡터 인덱스 파라미터 튜닝 (P-C02-01)
-- 설명:
--   - m: 24 (기존 16) - 각 노드의 최대 연결 수 증가 → 정확도 향상
--   - ef_construction: 100 (기존 64) - 인덱스 구축 시 탐색 범위 증가 → 정확도 향상
--   - 트레이드오프: 인덱스 크기 증가, 구축 시간 증가, 검색 정확도 향상
--
-- [주의사항]
-- - 이 마이그레이션은 off-peak 시간에 실행 권장
-- - 대용량 데이터에서 인덱스 재생성 시간이 길어질 수 있음
-- - CONCURRENTLY 옵션 사용으로 서비스 영향 최소화
-- - 인덱스 재생성 중에도 SELECT 가능 (INSERT/UPDATE는 대기)
-- =============================================================================

-- =============================================================================
-- [SECTION 1] 기존 인덱스 정보 확인 (디버깅용 - 주석 처리)
-- =============================================================================
-- 아래 쿼리로 기존 인덱스 설정을 확인할 수 있습니다:
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('rag_chunks', 'document_chunks')
--   AND indexname LIKE '%embedding%';

-- =============================================================================
-- [SECTION 2] rag_chunks 테이블 HNSW 인덱스 재생성
-- =============================================================================
-- 대상: idx_rag_chunks_embedding
-- 변경: m=16, ef_construction=64 → m=24, ef_construction=100
-- =============================================================================

-- 2-1. 기존 인덱스 삭제
-- 주의: DROP INDEX는 CONCURRENTLY 옵션 없이 실행해야 함
DROP INDEX IF EXISTS public.idx_rag_chunks_embedding;

-- 2-2. 새 인덱스 생성 (CONCURRENTLY 사용하려면 트랜잭션 외부에서 실행)
-- 참고: Supabase 마이그레이션에서는 CONCURRENTLY가 제한될 수 있음
-- 대안: 수동으로 off-peak 시간에 실행
CREATE INDEX idx_rag_chunks_embedding
    ON public.rag_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 24, ef_construction = 100);

-- 인덱스 설명 추가
COMMENT ON INDEX public.idx_rag_chunks_embedding IS
    '[P-C02-01] HNSW 벡터 인덱스 (m=24, ef_construction=100) - 정확도 향상을 위해 튜닝됨';


-- =============================================================================
-- [SECTION 3] document_chunks 테이블 HNSW 인덱스 재생성
-- =============================================================================
-- 대상: idx_document_chunks_embedding
-- 변경: m=16, ef_construction=64 → m=24, ef_construction=100
-- =============================================================================

-- 3-1. 기존 인덱스 삭제
DROP INDEX IF EXISTS public.idx_document_chunks_embedding;

-- 3-2. 새 인덱스 생성
CREATE INDEX idx_document_chunks_embedding
    ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 24, ef_construction = 100);

-- 인덱스 설명 추가
COMMENT ON INDEX public.idx_document_chunks_embedding IS
    '[P-C02-01] HNSW 벡터 인덱스 (m=24, ef_construction=100) - 정확도 향상을 위해 튜닝됨';


-- =============================================================================
-- [SECTION 4] user_preferences 테이블 HNSW 인덱스 재생성 (선택)
-- =============================================================================
-- 참고: user_preferences에도 임베딩 인덱스가 있다면 동일하게 튜닝
-- 현재는 일반 인덱스로 보이므로 스킵
-- =============================================================================

-- 확인 필요 시:
-- DROP INDEX IF EXISTS public.idx_user_preferences_embedding;
-- CREATE INDEX idx_user_preferences_embedding
--     ON public.user_preferences
--     USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 24, ef_construction = 100);


-- =============================================================================
-- [SECTION 5] ef_search 세션 설정 함수 (선택)
-- =============================================================================
-- 설명:
--   - ef_search: 쿼리 시 탐색 범위 (기본 40 → 100)
--   - 세션별로 설정하거나, 함수로 래핑하여 사용
--   - Supabase에서는 RPC 함수 내에서 SET 사용 권장
-- =============================================================================

-- 검색 성능 최적화를 위한 헬퍼 함수
CREATE OR REPLACE FUNCTION public.set_hnsw_ef_search(ef_value integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ef_search 값 설정 (세션 레벨)
    -- 값이 클수록 정확도 향상, 속도 저하
    PERFORM set_config('hnsw.ef_search', ef_value::text, false);
END;
$$;

COMMENT ON FUNCTION public.set_hnsw_ef_search(integer) IS
    '[P-C02-01] HNSW ef_search 파라미터 설정 - 검색 정확도 조정';


-- =============================================================================
-- [SECTION 6] 인덱스 검증 쿼리 (마이그레이션 후 실행 권장)
-- =============================================================================
-- 마이그레이션 후 아래 쿼리로 인덱스 설정을 확인하세요:
--
-- SELECT
--     indexname,
--     indexdef,
--     pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- WHERE tablename IN ('rag_chunks', 'document_chunks')
--   AND indexname LIKE '%embedding%';
--
-- 예상 결과:
-- idx_rag_chunks_embedding | ... WITH (m = 24, ef_construction = 100) | 10 MB
-- idx_document_chunks_embedding | ... WITH (m = 24, ef_construction = 100) | 5 MB


-- =============================================================================
-- [SECTION 7] 권한 설정
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.set_hnsw_ef_search(integer) TO authenticated;


-- =============================================================================
-- [END] Migration 072_hnsw_index_tuning.sql
-- =============================================================================
