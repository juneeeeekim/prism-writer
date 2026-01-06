-- ============================================================================
-- Migration: 076_project_rag_preferences.sql
-- Purpose: P4 Adaptive Threshold System - 프로젝트별 RAG 임계값 저장
-- Date: 2026-01-06
-- Related: 2601062127_Adaptive_Threshold_System_체크리스트.md
-- ============================================================================

-- ============================================================================
-- 1. project_rag_preferences 테이블 생성
--    - 프로젝트 단위로 학습된 RAG 임계값을 저장
--    - 각 사용자+프로젝트 조합당 하나의 레코드
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_rag_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- RAG 임계값들
    groundedness_threshold FLOAT DEFAULT 0.7,    -- 근거 검증 임계값 (0.4 ~ 0.95)
    critique_threshold FLOAT DEFAULT 0.6,        -- 관련도 평가 임계값
    retrieval_threshold FLOAT DEFAULT 0.5,       -- 검색 필요도 임계값
    
    -- 학습 통계
    feedback_count INT DEFAULT 0,                -- 총 피드백/이벤트 수
    positive_ratio FLOAT DEFAULT 0.5,            -- 긍정 피드백 비율
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- 사용자+프로젝트 조합 유니크 제약
    UNIQUE(user_id, project_id)
);

-- 코멘트
COMMENT ON TABLE project_rag_preferences IS 'P4: 프로젝트별 개인화된 RAG 임계값 저장';
COMMENT ON COLUMN project_rag_preferences.groundedness_threshold IS 'Self-RAG Groundedness 검증 임계값 (기본 0.7)';
COMMENT ON COLUMN project_rag_preferences.feedback_count IS '학습에 사용된 총 이벤트 수';

-- ============================================================================
-- 2. 인덱스 생성
--    - 사용자별, 프로젝트별 조회 최적화
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_project_rag_prefs_user 
    ON project_rag_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_project_rag_prefs_project 
    ON project_rag_preferences(project_id);
CREATE INDEX IF NOT EXISTS idx_project_rag_prefs_user_project 
    ON project_rag_preferences(user_id, project_id);

-- ============================================================================
-- 3. RLS (Row Level Security) 정책
--    - 사용자는 본인의 프로젝트 preferences만 접근 가능
-- ============================================================================
ALTER TABLE project_rag_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 데이터만 조회
CREATE POLICY "Users can read own project preferences"
    ON project_rag_preferences FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: 본인 데이터만 생성
CREATE POLICY "Users can insert own project preferences"
    ON project_rag_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 데이터만 수정
CREATE POLICY "Users can update own project preferences"
    ON project_rag_preferences FOR UPDATE
    USING (auth.uid() = user_id);

-- DELETE: 본인 데이터만 삭제
CREATE POLICY "Users can delete own project preferences"
    ON project_rag_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. updated_at 자동 갱신 트리거
-- ============================================================================
CREATE OR REPLACE FUNCTION update_project_rag_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_project_rag_prefs_updated_at
    BEFORE UPDATE ON project_rag_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_project_rag_preferences_updated_at();

-- ============================================================================
-- Migration Complete
-- ============================================================================
