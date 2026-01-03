-- =============================================================================
-- [PATTERN] Add rag_rule_candidates table
-- =============================================================================
-- 목적: 패턴 추출 LLM 결과를 저장하는 후보 테이블
-- 날짜: 2026-01-03
-- 영향: 신규 테이블 추가
-- =============================================================================

-- [STEP 1] 테이블 생성
CREATE TABLE IF NOT EXISTS rag_rule_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 관계
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 패턴 정보
  pattern_type TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  why_it_works TEXT,
  query_hints TEXT[],
  evidence_quote TEXT,
  evidence_chunk_ids UUID[],
  
  -- 상태 관리
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'selected', 'filled', 'published', 'rejected')),
  
  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [STEP 2] 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rag_rule_candidates_project_id ON rag_rule_candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_rag_rule_candidates_status ON rag_rule_candidates(status);
CREATE INDEX IF NOT EXISTS idx_rag_rule_candidates_pattern_type ON rag_rule_candidates(pattern_type);

-- [STEP 3] RLS 정책 활성화
ALTER TABLE rag_rule_candidates ENABLE ROW LEVEL SECURITY;

-- [STEP 4] RLS 정책 추가 (소유자만 접근)
DROP POLICY IF EXISTS "Users can view own rule candidates" ON rag_rule_candidates;
CREATE POLICY "Users can view own rule candidates" ON rag_rule_candidates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own rule candidates" ON rag_rule_candidates;
CREATE POLICY "Users can insert own rule candidates" ON rag_rule_candidates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own rule candidates" ON rag_rule_candidates;
CREATE POLICY "Users can update own rule candidates" ON rag_rule_candidates
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own rule candidates" ON rag_rule_candidates;
CREATE POLICY "Users can delete own rule candidates" ON rag_rule_candidates
  FOR DELETE USING (auth.uid() = user_id);

-- [STEP 5] updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_rag_rule_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rag_rule_candidates_updated_at ON rag_rule_candidates;
CREATE TRIGGER trigger_rag_rule_candidates_updated_at
  BEFORE UPDATE ON rag_rule_candidates
  FOR EACH ROW EXECUTE FUNCTION update_rag_rule_candidates_updated_at();

-- [STEP 6] 스키마 리로드
NOTIFY pgrst, 'reload schema';
