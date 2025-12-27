-- =============================================================================
-- PRISM Writer - Hallucination Feedback Table Migration
-- =============================================================================
-- 파일: backend/migrations/038_hallucination_feedback.sql
-- 역할: 환각 답변 피드백 저장 테이블 생성
-- 생성일: 2025-12-27
-- 
-- [RAG 환각 방지 업그레이드]
-- - 사용자 피드백 수집 (긍정/부정 + 코멘트)
-- - 자동 탐지 결과 참조 저장
-- - FK 제약조건으로 데이터 무결성 보장
-- =============================================================================

-- =============================================================================
-- [섹션 1] 테이블 생성
-- =============================================================================

CREATE TABLE IF NOT EXISTS hallucination_feedback (
    -- -------------------------------------------------------------------------
    -- Primary Key
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- -------------------------------------------------------------------------
    -- 사용자 및 세션 참조
    -- FK 제약조건: ON DELETE CASCADE로 관련 데이터 자동 삭제
    -- -------------------------------------------------------------------------
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    message_id UUID,  -- 특정 메시지 참조 (있을 경우)
    
    -- -------------------------------------------------------------------------
    -- 컨텍스트 데이터 (환각 분석용)
    -- -------------------------------------------------------------------------
    user_query TEXT NOT NULL,
    retrieved_docs JSONB,  -- 검색된 문서 목록 [{title, chunkId}, ...]
    model_response TEXT NOT NULL,
    model_id TEXT,
    
    -- -------------------------------------------------------------------------
    -- 사용자 피드백
    -- -------------------------------------------------------------------------
    is_positive BOOLEAN NOT NULL,  -- true: 좋음, false: 개선 필요
    feedback_type TEXT DEFAULT 'other' 
        CHECK (feedback_type IN ('hallucination', 'quality', 'other')),
    user_comment TEXT,  -- 사용자 코멘트 (선택)
    
    -- -------------------------------------------------------------------------
    -- 자동 탐지 결과 (참고용)
    -- -------------------------------------------------------------------------
    auto_detected_hallucination BOOLEAN DEFAULT FALSE,
    detection_confidence DECIMAL(3,2),  -- 0.00 ~ 1.00
    matched_pattern TEXT,  -- 매칭된 정규식 패턴
    
    -- -------------------------------------------------------------------------
    -- 메타데이터
    -- -------------------------------------------------------------------------
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- [섹션 2] 인덱스
-- =============================================================================

-- 자동 탐지된 피드백 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_hallucination_feedback_auto 
    ON hallucination_feedback(auto_detected_hallucination);

-- 사용자별 피드백 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_hallucination_feedback_user 
    ON hallucination_feedback(user_id);

-- 피드백 유형별 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_hallucination_feedback_type 
    ON hallucination_feedback(feedback_type);

-- 최신순 정렬용 인덱스
CREATE INDEX IF NOT EXISTS idx_hallucination_feedback_created 
    ON hallucination_feedback(created_at DESC);

-- =============================================================================
-- [섹션 3] Row Level Security (RLS)
-- =============================================================================

ALTER TABLE hallucination_feedback ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 피드백 INSERT 허용
CREATE POLICY "Users can insert their own feedback"
    ON hallucination_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 피드백 SELECT 허용
CREATE POLICY "Users can view their own feedback"
    ON hallucination_feedback FOR SELECT
    USING (auth.uid() = user_id);

-- 관리자(service_role) 전체 접근 허용
CREATE POLICY "Service role has full access"
    ON hallucination_feedback FOR ALL
    USING (auth.role() = 'service_role');

-- =============================================================================
-- [섹션 4] 주석
-- =============================================================================

COMMENT ON TABLE hallucination_feedback IS 
    'RAG 환각 답변에 대한 사용자 피드백 저장 테이블';

COMMENT ON COLUMN hallucination_feedback.is_positive IS 
    '사용자 평가: true=좋은 답변, false=개선 필요';

COMMENT ON COLUMN hallucination_feedback.feedback_type IS 
    '피드백 유형: hallucination(환각), quality(품질), other(기타)';

COMMENT ON COLUMN hallucination_feedback.auto_detected_hallucination IS 
    '자동 환각 탐지 여부 (hallucinationDetector.ts에서 탐지)';

-- =============================================================================
-- [완료] 마이그레이션 완료
-- =============================================================================
-- 
-- 실행 방법:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 내용 전체 복사/붙여넣기
-- 3. Run 클릭
-- 
-- 확인 방법:
-- SELECT * FROM hallucination_feedback LIMIT 1;
-- 
-- =============================================================================
