-- =============================================================================
-- Migration: 037_assistant_sessions_schema.sql
-- Description: Create tables for Assistant Sessions (Outline/Evaluation) with RLS
-- =============================================================================

-- 1. assistant_sessions (통합 세션 테이블)
CREATE TABLE IF NOT EXISTS assistant_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('outline', 'evaluation')),
    title TEXT DEFAULT '새 세션',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user_type 
    ON assistant_sessions(user_id, session_type);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_updated 
    ON assistant_sessions(updated_at DESC);

-- RLS
ALTER TABLE assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
    ON assistant_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
    ON assistant_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
    ON assistant_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
    ON assistant_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_assistant_sessions_updated_at
    BEFORE UPDATE ON assistant_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 2. outline_results (목차 제안 결과)
CREATE TABLE IF NOT EXISTS outline_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES assistant_sessions(id) ON DELETE CASCADE NOT NULL,
    topic TEXT NOT NULL,
    outline_content JSONB NOT NULL,
    reference_docs UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outline_results_session 
    ON outline_results(session_id);

-- RLS (Child Table)
ALTER TABLE outline_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outline results"
    ON outline_results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = outline_results.session_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own outline results"
    ON outline_results FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = session_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own outline results"
    ON outline_results FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = outline_results.session_id
            AND s.user_id = auth.uid()
        )
    );


-- 3. evaluation_results (평가 결과)
CREATE TABLE IF NOT EXISTS evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES assistant_sessions(id) ON DELETE CASCADE NOT NULL,
    evaluated_text TEXT NOT NULL,
    result_json JSONB NOT NULL, -- 평가 결과 전체
    overall_score DECIMAL(3,1),
    criteria_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evaluation_results_session 
    ON evaluation_results(session_id);

-- RLS (Child Table)
ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evaluation results"
    ON evaluation_results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = evaluation_results.session_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own evaluation results"
    ON evaluation_results FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = session_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own evaluation results"
    ON evaluation_results FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM assistant_sessions s
            WHERE s.id = evaluation_results.session_id
            AND s.user_id = auth.uid()
        )
    );
