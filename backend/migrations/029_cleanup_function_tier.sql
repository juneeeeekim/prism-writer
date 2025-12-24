-- =================================================================
-- [CHAT HISTORY] Tier-based Message Cleanup Function
-- Free 사용자: 30일, Premium 사용자: 90일 보관
-- 마이그레이션: 029_cleanup_function_tier.sql
-- =================================================================

-- 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS cleanup_old_messages(INTEGER);

-- Tier 기반 메시지 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_old_messages_by_tier()
RETURNS TABLE (
    deleted_messages_count BIGINT,
    deleted_sessions_count BIGINT,
    free_deleted BIGINT,
    premium_deleted BIGINT
) AS $$
DECLARE
    free_msg_count BIGINT := 0;
    premium_msg_count BIGINT := 0;
    sess_count BIGINT := 0;
    free_retention INTEGER := 30;     -- Free 사용자: 30일
    premium_retention INTEGER := 90;  -- Premium 사용자: 90일
BEGIN
    -- =========================================================================
    -- 1. Free 사용자 (tier < 2) 메시지 삭제 (30일)
    -- =========================================================================
    WITH deleted_free_messages AS (
        DELETE FROM chat_messages cm
        WHERE cm.created_at < NOW() - (free_retention || ' days')::INTERVAL
        AND EXISTS (
            SELECT 1 FROM chat_sessions cs
            JOIN profiles p ON cs.user_id = p.id
            WHERE cs.id = cm.session_id
            AND p.tier < 2  -- Free, Pending
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO free_msg_count FROM deleted_free_messages;
    
    -- =========================================================================
    -- 2. Premium 사용자 (tier >= 2) 메시지 삭제 (90일)
    -- =========================================================================
    WITH deleted_premium_messages AS (
        DELETE FROM chat_messages cm
        WHERE cm.created_at < NOW() - (premium_retention || ' days')::INTERVAL
        AND EXISTS (
            SELECT 1 FROM chat_sessions cs
            JOIN profiles p ON cs.user_id = p.id
            WHERE cs.id = cm.session_id
            AND p.tier >= 2  -- Premium, Special, Admin
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO premium_msg_count FROM deleted_premium_messages;
    
    -- =========================================================================
    -- 3. 메시지가 없는 빈 세션 삭제 (모든 사용자)
    -- =========================================================================
    WITH deleted_sessions AS (
        DELETE FROM chat_sessions cs
        WHERE NOT EXISTS (
            SELECT 1 FROM chat_messages cm 
            WHERE cm.session_id = cs.id
        )
        AND cs.created_at < NOW() - (free_retention || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO sess_count FROM deleted_sessions;
    
    -- 결과 반환
    deleted_messages_count := free_msg_count + premium_msg_count;
    deleted_sessions_count := sess_count;
    free_deleted := free_msg_count;
    premium_deleted := premium_msg_count;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수 실행 권한 설정
GRANT EXECUTE ON FUNCTION cleanup_old_messages_by_tier() TO service_role;

-- =================================================================
-- 사용 예시
-- =================================================================
-- SELECT * FROM cleanup_old_messages_by_tier();

-- =================================================================
-- Supabase pg_cron 스케줄링 (Pro Tier 필요)
-- =================================================================
/*
SELECT cron.schedule(
    'cleanup-old-chat-messages-by-tier',
    '0 3 * * *',  -- 매일 오전 3시 (KST 기준 정오)
    $$SELECT * FROM cleanup_old_messages_by_tier()$$
);
*/
