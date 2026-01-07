-- =============================================================================
-- Migration: 081_fix_search_path_public.sql
-- =============================================================================
-- 작성일: 2026-01-07
-- 목적: search_path 설정 수정 - 빈 문자열 대신 'public'으로 설정
-- 
-- [문제]
-- - SET search_path = '' 으로 설정 시 vector 타입 등 public 스키마 객체 접근 불가
-- - RAG 검색 함수에서 500 에러 발생
--
-- [해결]
-- - SET search_path = 'public' 으로 변경
-- - 이렇게 하면 다른 스키마 검색은 막으면서 public은 접근 가능
-- =============================================================================

BEGIN;

-- =============================================================================
-- [SECTION 1] 트리거/유틸리티 함수
-- =============================================================================

ALTER FUNCTION public.cleanup_deleted_projects() SET search_path = 'public';
ALTER FUNCTION public.cleanup_old_messages_by_tier() SET search_path = 'public';
ALTER FUNCTION public.create_project_rag_preferences() SET search_path = 'public';
ALTER FUNCTION public.get_rag_daily_stats_admin() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.is_admin() SET search_path = 'public';
ALTER FUNCTION public.run_project_cleanup() SET search_path = 'public';
ALTER FUNCTION public.sync_chunk_category() SET search_path = 'public';
ALTER FUNCTION public.update_project_rag_preferences_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_rag_documents_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_rag_rule_candidates_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_role_limits() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.update_user_documents_updated_at() SET search_path = 'public';
ALTER FUNCTION public.verify_chunk_type_migration() SET search_path = 'public';


-- =============================================================================
-- [SECTION 2] 단순 파라미터 함수
-- =============================================================================

ALTER FUNCTION public.cleanup_old_rag_logs(p_days integer) SET search_path = 'public';
ALTER FUNCTION public.detect_chunk_type(content text) SET search_path = 'public';
ALTER FUNCTION public.get_chunk_type_stats(user_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.get_rag_stats(p_user_id uuid, p_days integer) SET search_path = 'public';
ALTER FUNCTION public.increment_daily_usage(p_user_id uuid, p_date date) SET search_path = 'public';
ALTER FUNCTION public.set_hnsw_ef_search(ef_value integer) SET search_path = 'public';
ALTER FUNCTION public.update_monthly_summary(p_user_id uuid, p_tokens integer, p_cost numeric) SET search_path = 'public';


-- =============================================================================
-- [SECTION 3] 벡터 검색 함수 (가장 중요!)
-- =============================================================================

-- match_documents
ALTER FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer, filter_user_id uuid) SET search_path = 'public';

-- match_document_chunks (2개 오버로드)
ALTER FUNCTION public.match_document_chunks(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text) SET search_path = 'public';
ALTER FUNCTION public.match_document_chunks(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text, project_id_param uuid) SET search_path = 'public';

-- match_document_chunks_by_pattern
ALTER FUNCTION public.match_document_chunks_by_pattern(query_embedding vector, pattern_type_param text, project_id_param uuid, user_id_param uuid, match_threshold double precision, match_count integer) SET search_path = 'public';

-- match_user_preferences (2개 오버로드)
ALTER FUNCTION public.match_user_preferences(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid) SET search_path = 'public';
ALTER FUNCTION public.match_user_preferences(query_embedding vector, match_threshold double precision, match_count integer, user_id_param uuid, category_param text) SET search_path = 'public';

-- search_document_chunks_by_type
ALTER FUNCTION public.search_document_chunks_by_type(query_embedding vector, user_id_param uuid, document_id_param uuid, chunk_type_filter text, match_count integer) SET search_path = 'public';

-- search_similar_chunks
ALTER FUNCTION public.search_similar_chunks(query_embedding vector, user_id_param uuid, match_count integer) SET search_path = 'public';

-- search_similar_chunks_v2
ALTER FUNCTION public.search_similar_chunks_v2(query_embedding vector, user_id_param uuid, match_count integer, chunk_type_filter text) SET search_path = 'public';


COMMIT;

-- =============================================================================
-- [END] Migration 081_fix_search_path_public.sql
-- =============================================================================
-- 총 31개 함수 수정
-- 적용 후 RAG 검색 및 기타 기능 정상 동작 확인 필요
-- =============================================================================
