-- =================================================================
-- [CHAT HISTORY] Message Cleanup Function
-- 30일 이상 오래된 메시지 자동 삭제 함수
-- =================================================================

-- 오래된 메시지 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_old_messages(retention_days INTEGER DEFAULT 30)
RETURNS TABLE (
    deleted_messages_count BIGINT,
    deleted_sessions_count BIGINT
) AS $$
DECLARE
    msg_count BIGINT;
    sess_count BIGINT;
BEGIN
    -- 1. 오래된 메시지 삭제
    WITH deleted_messages AS (
        DELETE FROM chat_messages
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO msg_count FROM deleted_messages;
    
    -- 2. 메시지가 없는 빈 세션 삭제
    WITH deleted_sessions AS (
        DELETE FROM chat_sessions cs
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_messages cm 
            WHERE cm.session_id = cs.id
        )
        AND cs.created_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO sess_count FROM deleted_sessions;
    
    deleted_messages_count := msg_count;
    deleted_sessions_count := sess_count;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION cleanup_old_messages(INTEGER) TO service_role;

-- 사용 예시:
-- SELECT * FROM cleanup_old_messages(30);  -- 30일 이상 메시지 삭제
-- SELECT * FROM cleanup_old_messages(7);   -- 7일 이상 메시지 삭제 (테스트용)

-- =================================================================
-- 옵션: Supabase Scheduled Functions (pg_cron)
-- 주의: pg_cron은 Supabase Pro 플랜 이상에서만 사용 가능
-- =================================================================

-- pg_cron이 활성화된 경우 아래 주석을 해제하여 사용
/*
SELECT cron.schedule(
    'cleanup-old-chat-messages',
    '0 3 * * *',  -- 매일 오전 3시 (KST 기준 정오)
    $$SELECT cleanup_old_messages(30)$$
);
*/

-- 스케줄 확인
-- SELECT * FROM cron.job;

-- 스케줄 삭제
-- SELECT cron.unschedule('cleanup-old-chat-messages');
