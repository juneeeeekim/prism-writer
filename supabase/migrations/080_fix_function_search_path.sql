-- =============================================================================
-- Migration: 080_fix_function_search_path.sql
-- =============================================================================
-- 작성일: 2026-01-07
-- 목적: Function Search Path Mutable 보안 경고 해결
-- 설명:
--   - Supabase Security Advisor 경고: function_search_path_mutable
--   - 모든 함수에 SET search_path = '' 추가
--   - 이 SQL은 Supabase DB에서 자동 생성된 정확한 시그니처 기반
--
-- [생성 방법]
-- SELECT 'ALTER FUNCTION public.' || proname || '(' || 
--        pg_get_function_identity_arguments(oid) || 
--        ') SET search_path = '''';' AS alter_statement
-- FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
-- =============================================================================

BEGIN;

-- =============================================================================
-- [SECTION 1] 트리거/유틸리티 함수 (파라미터 없음)
-- =============================================================================

ALTER FUNCTION public.cleanup_deleted_projects() SET search_path = '';
ALTER FUNCTION public.cleanup_old_messages_by_tier() SET search_path = '';
ALTER FUNCTION public.create_project_rag_preferences() SET search_path = '';
ALTER FUNCTION public.get_rag_daily_stats_admin() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.is_admin() SET search_path = '';
ALTER FUNCTION public.run_project_cleanup() SET search_path = '';
ALTER FUNCTION public.sync_chunk_category() SET search_path = '';
ALTER FUNCTION public.update_project_rag_preferences_updated_at() SET search_path = '';
ALTER FUNCTION public.update_rag_documents_updated_at() SET search_path = '';
ALTER FUNCTION public.update_rag_rule_candidates_updated_at() SET search_path = '';
ALTER FUNCTION public.update_role_limits() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_user_documents_updated_at() SET search_path = '';
ALTER FUNCTION public.verify_chunk_type_migration() SET search_path = '';


-- =============================================================================
-- [SECTION 2] 단순 파라미터 함수
-- =============================================================================

ALTER FUNCTION public.cleanup_old_rag_logs(p_days integer) SET search_path = '';
ALTER FUNCTION public.detect_chunk_type(content text) SET search_path = '';
ALTER FUNCTION public.get_chunk_type_stats(user_id_param uuid) SET search_path = '';
ALTER FUNCTION public.get_rag_stats(p_user_id uuid, p_days integer) SET search_path = '';
ALTER FUNCTION public.increment_daily_usage(p_user_id uuid, p_date date) SET search_path = '';
ALTER FUNCTION public.set_hnsw_ef_search(ef_value integer) SET search_path = '';
ALTER FUNCTION public.update_monthly_summary(p_user_id uuid, p_tokens integer, p_cost numeric) SET search_path = '';


-- =============================================================================
-- [SECTION 3] 벡터 검색 함수
-- =============================================================================

-- match_documents
ALTER FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer, filter_user_id uuid) SET search_path = '';

-- match_document_chunks (2개 오버로드)
ALTER FUNCTION public.match_document_chunks(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text) SET search_path = '';
ALTER FUNCTION public.match_document_chunks(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text, project_id_param uuid) SET search_path = '';

-- match_document_chunks_by_pattern
ALTER FUNCTION public.match_document_chunks_by_pattern(query_embedding vector, pattern_type_param text, project_id_param uuid, user_id_param uuid, match_threshold double precision, match_count integer) SET search_path = '';

-- match_user_preferences (2개 오버로드)
ALTER FUNCTION public.match_user_preferences(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid) SET search_path = '';
ALTER FUNCTION public.match_user_preferences(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text) SET search_path = '';

-- search_document_chunks_by_type
ALTER FUNCTION public.search_document_chunks_by_type(query_embedding vector, user_id_param uuid, document_id_param uuid, chunk_type_filter text, match_count integer) SET search_path = '';

-- search_similar_chunks
ALTER FUNCTION public.search_similar_chunks(query_embedding vector, user_id_param uuid, match_count integer) SET search_path = '';

-- search_similar_chunks_v2
ALTER FUNCTION public.search_similar_chunks_v2(query_embedding vector, user_id_param uuid, match_count integer, chunk_type_filter text) SET search_path = '';


COMMIT;

-- =============================================================================
-- [END] Migration 080_fix_function_search_path.sql
-- =============================================================================
-- 총 31개 함수 수정
-- 적용 후 Security Advisor에서 function_search_path_mutable 경고 확인
-- =============================================================================
