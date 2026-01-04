-- =============================================================================
-- Migration: 073_vacuum_analyze.sql
-- =============================================================================
-- 작성일: 2026-01-04
-- 목적: 테이블 통계 업데이트 (P-C02-02)
-- 설명:
--   - VACUUM: 삭제된 행의 공간 회수, 테이블 정리
--   - ANALYZE: 테이블 통계 수집 → 쿼리 플래너 최적화
--   - P-C02-01 인덱스 재생성 후 반드시 실행 권장
--
-- [주의사항]
-- - VACUUM은 테이블 락을 잡지 않음 (읽기/쓰기 가능)
-- - ANALYZE는 통계 수집을 위해 샘플링 수행
-- - 대용량 테이블에서는 시간이 걸릴 수 있음
-- - 이 마이그레이션은 off-peak 시간에 실행 권장
-- =============================================================================

-- =============================================================================
-- [SECTION 1] RAG 관련 테이블 VACUUM ANALYZE
-- =============================================================================
-- 대상: 벡터 검색에 사용되는 핵심 테이블
-- 효과: 쿼리 플래너가 정확한 통계 기반으로 최적 실행 계획 선택
-- =============================================================================

-- 1-1. rag_chunks 테이블 (벡터 검색 핵심)
-- 설명: 문서 청크 + 임베딩 벡터 저장
VACUUM ANALYZE public.rag_chunks;

-- 1-2. rag_documents 테이블 (문서 메타데이터)
-- 설명: 문서 정보 저장
VACUUM ANALYZE public.rag_documents;

-- 1-3. document_chunks 테이블 (새 청크 테이블)
-- 설명: 프로젝트별 문서 청크 저장
VACUUM ANALYZE public.document_chunks;

-- 1-4. user_documents 테이블 (사용자 문서)
-- 설명: 사용자별 업로드 문서 저장
VACUUM ANALYZE public.user_documents;


-- =============================================================================
-- [SECTION 2] 캐시 및 세션 테이블 VACUUM ANALYZE
-- =============================================================================
-- 대상: 자주 업데이트되는 테이블
-- 효과: 삭제된 행 공간 회수, 통계 최신화
-- =============================================================================

-- 2-1. embedding_cache 테이블 (P-C01-01에서 생성)
-- 설명: 임베딩 캐시 저장
-- 주의: 테이블이 없으면 에러 발생하므로 조건부 실행 필요
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'embedding_cache'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.embedding_cache';
        RAISE NOTICE '[VACUUM] embedding_cache completed';
    ELSE
        RAISE NOTICE '[VACUUM] embedding_cache table does not exist, skipping';
    END IF;
END $$;

-- 2-2. chat_sessions 테이블 (채팅 세션)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chat_sessions'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.chat_sessions';
        RAISE NOTICE '[VACUUM] chat_sessions completed';
    END IF;
END $$;

-- 2-3. chat_messages 테이블 (채팅 메시지)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chat_messages'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.chat_messages';
        RAISE NOTICE '[VACUUM] chat_messages completed';
    END IF;
END $$;


-- =============================================================================
-- [SECTION 3] 사용자 관련 테이블 VACUUM ANALYZE
-- =============================================================================

-- 3-1. user_preferences 테이블 (사용자 선호도)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_preferences'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.user_preferences';
        RAISE NOTICE '[VACUUM] user_preferences completed';
    END IF;
END $$;

-- 3-2. profiles 테이블 (사용자 프로필)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.profiles';
        RAISE NOTICE '[VACUUM] profiles completed';
    END IF;
END $$;


-- =============================================================================
-- [SECTION 4] 평가 및 로깅 테이블 VACUUM ANALYZE
-- =============================================================================

-- 4-1. evaluation_logs 테이블 (평가 로그)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'evaluation_logs'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.evaluation_logs';
        RAISE NOTICE '[VACUUM] evaluation_logs completed';
    END IF;
END $$;

-- 4-2. embedding_usage 테이블 (임베딩 사용량)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'embedding_usage'
    ) THEN
        EXECUTE 'VACUUM ANALYZE public.embedding_usage';
        RAISE NOTICE '[VACUUM] embedding_usage completed';
    END IF;
END $$;


-- =============================================================================
-- [SECTION 5] 통계 확인 쿼리 (마이그레이션 후 실행 권장)
-- =============================================================================
-- 마이그레이션 후 아래 쿼리로 통계를 확인하세요:
--
-- SELECT
--     relname AS table_name,
--     n_live_tup AS live_rows,
--     n_dead_tup AS dead_rows,
--     last_vacuum,
--     last_analyze
-- FROM pg_stat_user_tables
-- WHERE relname IN ('rag_chunks', 'rag_documents', 'document_chunks', 'user_documents')
-- ORDER BY relname;
--
-- 예상 결과:
-- table_name       | live_rows | dead_rows | last_vacuum | last_analyze
-- -----------------+-----------+-----------+-------------+-------------
-- document_chunks  | 1000      | 0         | 2026-01-04  | 2026-01-04
-- rag_chunks       | 5000      | 0         | 2026-01-04  | 2026-01-04
-- rag_documents    | 100       | 0         | 2026-01-04  | 2026-01-04
-- user_documents   | 100       | 0         | 2026-01-04  | 2026-01-04


-- =============================================================================
-- [SECTION 6] 인덱스 사용 확인 쿼리 (선택)
-- =============================================================================
-- EXPLAIN ANALYZE로 벡터 검색 시 인덱스 사용 확인:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM rag_chunks
-- ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector(1536)
-- LIMIT 5;
--
-- 예상 결과에 'Index Scan using idx_rag_chunks_embedding' 포함되어야 함


-- =============================================================================
-- [END] Migration 073_vacuum_analyze.sql
-- =============================================================================
