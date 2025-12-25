-- =============================================================================
-- RAG 데이터 진단 스크립트 (관리자용)
-- =============================================================================
-- 수정: auth.uid() 제거 (SQL Editor에서는 세션이 없어 NULL 반환됨)
-- 전체 문서를 조회하여 내 파일이 있는지 확인합니다.

SELECT
    d.title as document_title,      -- 파일명 확인
    d.status as processing_status,  -- 상태 (completed 여야 함)
    d.created_at as uploaded_at,    -- 업로드 시간
    COUNT(c.id) as total_chunks,    -- 청크 개수 (0이면 안됨)
    COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END) as embedded_chunks, -- 임베딩 개수
    d.id as doc_id,
    d.user_id                       -- 사용자 ID
FROM
    public.rag_documents d
LEFT JOIN
    public.rag_chunks c ON d.id = c.document_id
GROUP BY
    d.id, d.title, d.status, d.created_at, d.user_id
ORDER BY
    d.created_at DESC
LIMIT 10; -- 최근 10개만 조회
