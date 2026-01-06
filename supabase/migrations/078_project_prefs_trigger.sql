-- ============================================================================
-- Migration: 078_project_prefs_trigger.sql
-- Purpose: P4 Adaptive Threshold System - 프로젝트 생성 시 자동 preferences 생성
-- Date: 2026-01-06
-- Related: 2601062127_Adaptive_Threshold_System_체크리스트.md P4-01-04
-- ============================================================================

-- ============================================================================
-- 1. 프로젝트 생성 시 기본 preferences 자동 생성 함수
--    - 새 프로젝트가 생성되면 기본 임계값으로 preferences 레코드 생성
--    - ON CONFLICT DO NOTHING으로 중복 방지
-- ============================================================================
CREATE OR REPLACE FUNCTION create_project_rag_preferences()
RETURNS TRIGGER AS $$
BEGIN
    -- 새 프로젝트에 대한 기본 RAG preferences 생성
    INSERT INTO project_rag_preferences (user_id, project_id)
    VALUES (NEW.user_id, NEW.id)
    ON CONFLICT (user_id, project_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_project_rag_preferences() IS 
    'P4: 프로젝트 생성 시 자동으로 기본 RAG preferences 레코드 생성';

-- ============================================================================
-- 2. 트리거 생성
--    - projects 테이블에 INSERT 후 실행
-- ============================================================================
DROP TRIGGER IF EXISTS on_project_created_rag_prefs ON projects;

CREATE TRIGGER on_project_created_rag_prefs
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_project_rag_preferences();

-- ============================================================================
-- 3. 기존 프로젝트에 대한 preferences 백필 (Backfill)
--    - 이미 존재하는 프로젝트들에 대해 preferences 레코드 생성
-- ============================================================================
INSERT INTO project_rag_preferences (user_id, project_id)
SELECT user_id, id
FROM projects
WHERE deleted_at IS NULL
ON CONFLICT (user_id, project_id) DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================
