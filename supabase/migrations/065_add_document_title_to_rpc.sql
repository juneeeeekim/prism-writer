-- =============================================================================
-- [CITATION-FIX] Add document_title to match_document_chunks RPC
-- =============================================================================
-- 문제: 검색 결과에 문서 제목이 없어 "Untitled"로 표시됨
-- 해결: user_documents.title을 결과에 포함하여 파일명 연동
-- 날짜: 2026-01-03
-- =============================================================================

-- 기존 함수 삭제 후 새로 생성 (반환 테이블 구조 변경)
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), float, int, uuid, text, uuid);

CREATE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid,
  category_param text DEFAULT NULL,
  project_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float,
  document_title text  -- [CITATION-FIX] 문서 제목 추가
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- [SECURITY] 프로젝트 ID가 없으면 검색 결과를 반환하지 않음 (격리 강화)
  IF project_id_param IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) as similarity,
    ud.title as document_title  -- [CITATION-FIX] 문서 제목 반환
  FROM rag_chunks rc
  JOIN user_documents ud ON rc.document_id = ud.id
  WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
    AND ud.user_id = user_id_param
    AND (category_param IS NULL OR ud.category = category_param)
    AND ud.project_id = project_id_param
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
