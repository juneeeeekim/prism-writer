-- =============================================================================
-- [PATTERN] Add pattern_type column to rag_chunks table
-- =============================================================================
-- 목적: 청크에 패턴 타입(훅/CTA/비유 등)을 태깅하여 패턴 기반 검색 지원
-- 날짜: 2026-01-03
-- 영향: rag_chunks 테이블 (기존 데이터 영향 없음 - NULL 허용)
-- =============================================================================

-- [STEP 1] pattern_type 컬럼 추가
-- 기존 데이터는 NULL로 유지되어 영향 없음
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS pattern_type TEXT;

-- [STEP 2] 검색 성능을 위한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_chunks_pattern_type ON rag_chunks(pattern_type);

-- [STEP 3] 유효한 패턴 타입만 허용하는 제약조건
-- 구조: hook, problem, cause, solution, evidence, cta
-- 설득: metaphor, contrast, statistics, rebuttal
-- 리듬: question, repetition
ALTER TABLE rag_chunks DROP CONSTRAINT IF EXISTS check_pattern_type;
ALTER TABLE rag_chunks ADD CONSTRAINT check_pattern_type 
  CHECK (pattern_type IS NULL OR pattern_type IN (
    'hook',        -- 도입 훅
    'problem',     -- 문제 정의
    'cause',       -- 원인 분석
    'solution',    -- 해결책 제시
    'evidence',    -- 근거/증거
    'cta',         -- 행동 유도
    'metaphor',    -- 비유/은유
    'contrast',    -- 대비/비교
    'statistics',  -- 숫자/통계
    'rebuttal',    -- 반박 선제처리
    'question',    -- 질문 활용
    'repetition'   -- 반복 구조
  ));

-- [STEP 4] 스키마 리로드
NOTIFY pgrst, 'reload schema';
