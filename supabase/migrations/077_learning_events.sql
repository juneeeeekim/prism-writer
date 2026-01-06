-- ============================================================================
-- Migration: 077_learning_events.sql
-- Purpose: P4 Adaptive Threshold System - 학습 이벤트 로그 저장
-- Date: 2026-01-06
-- Related: 2601062127_Adaptive_Threshold_System_체크리스트.md P4-01-03
-- ============================================================================

-- ============================================================================
-- 1. learning_event_type ENUM 생성
--    - 가중치가 적용되는 모든 학습 신호 유형
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE learning_event_type AS ENUM (
        'chat_helpful',         -- 👍 도움됨 (가중치 0.3)
        'chat_not_helpful',     -- 👎 아니요 (가중치 0.3)
        'chat_hallucination',   -- 🚨 틀린 정보 (가중치 0.5)
        'eval_override',        -- 평가 점수 수정 (가중치 0.8)
        'rubric_adopt',         -- 루브릭 채택 (가중치 0.5)
        'doc_reupload',         -- 문서 재업로드 (가중치 0.4)
        'example_pin'           -- 예시 Pin (가중치 0.3)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE learning_event_type IS 'P4: 학습 신호 유형 (Adaptive Threshold)';

-- ============================================================================
-- 2. learning_events 테이블 생성
--    - 모든 학습 이벤트를 기록하여 추적 및 분석 가능
--    - 프로젝트별로 격리
-- ============================================================================
CREATE TABLE IF NOT EXISTS learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 이벤트 정보
    event_type learning_event_type NOT NULL,
    event_data JSONB DEFAULT '{}',              -- 상세 정보 (messageId, scoreDiff 등)
    
    -- 학습 파라미터
    influence_weight FLOAT NOT NULL,            -- 적용된 가중치
    applied_adjustment FLOAT NOT NULL,          -- 실제 임계값 조정값
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 코멘트
COMMENT ON TABLE learning_events IS 'P4: 학습 이벤트 로그 - 임계값 조정 추적';
COMMENT ON COLUMN learning_events.event_data IS 'JSON 형태의 상세 정보 (messageId, templateId 등)';
COMMENT ON COLUMN learning_events.influence_weight IS 'SIGNAL_CONFIG에서 정의된 가중치';
COMMENT ON COLUMN learning_events.applied_adjustment IS '실제로 임계값에 적용된 조정값';

-- ============================================================================
-- 3. 인덱스 생성
--    - 사용자+프로젝트별 조회, 시간순 정렬 최적화
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_learning_events_user_project
    ON learning_events(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_created
    ON learning_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_type
    ON learning_events(event_type);

-- ============================================================================
-- 4. RLS (Row Level Security) 정책
--    - 사용자는 본인의 학습 이벤트만 접근 가능
-- ============================================================================
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 데이터만 조회
CREATE POLICY "Users can read own learning events"
    ON learning_events FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: 본인 데이터만 생성
CREATE POLICY "Users can insert own learning events"
    ON learning_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 데이터만 삭제 (정리용)
CREATE POLICY "Users can delete own learning events"
    ON learning_events FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
