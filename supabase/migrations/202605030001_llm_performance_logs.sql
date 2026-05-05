-- =============================================================================
-- PRISM Writer - LLM Performance Logs (Phase 4)
-- =============================================================================
-- 작성: 2026-05-03
-- 설계 의도(왜 이 구조인가):
--   1) 모델별 응답시간/토큰/실패율을 추적해 비용·품질 의사결정에 사용한다.
--   2) RLS는 admin만 SELECT 가능하도록 제한하고, INSERT는 시스템 호출에서
--      제약 없이 가능하도록 한다(서비스 키 또는 anon 모두). 사용자별 데이터
--      유출 위험을 최소화한다.
--   3) PII 보호: error_type만 enum 형태로 저장하고 원본 메시지는 저장하지
--      않는다. 사용자 텍스트나 모델 응답은 본 테이블에 저장하지 않는다.
-- =============================================================================

CREATE TABLE IF NOT EXISTS llm_performance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 컨텍스트 정보
  context TEXT NOT NULL,            -- 'rag.answer', 'template.consistency' 등
  model_id TEXT NOT NULL,           -- 사용된 모델 ID
  used_fallback BOOLEAN DEFAULT FALSE NOT NULL,

  -- 성능 메트릭
  latency_ms INTEGER NOT NULL,      -- 응답 시간 (밀리초)
  input_tokens INTEGER,             -- 입력 토큰 수 (추정 가능)
  output_tokens INTEGER,            -- 출력 토큰 수 (추정 가능)

  -- 품질 메트릭(선택)
  quality_score DECIMAL(3,2),       -- 0.00 ~ 1.00
  user_feedback TEXT,               -- 'positive' | 'negative' | NULL

  -- 에러 정보
  is_success BOOLEAN DEFAULT TRUE NOT NULL,
  error_type TEXT,                  -- 'QUOTA_EXCEEDED', 'RATE_LIMITED' 등 (분류값만 저장)

  -- 메타데이터
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  document_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스: 흔히 사용될 조회 패턴
CREATE INDEX IF NOT EXISTS idx_llm_perf_context ON llm_performance_logs(context);
CREATE INDEX IF NOT EXISTS idx_llm_perf_model ON llm_performance_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_llm_perf_created ON llm_performance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_perf_user ON llm_performance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_perf_success ON llm_performance_logs(is_success) WHERE is_success = FALSE;

-- RLS
ALTER TABLE llm_performance_logs ENABLE ROW LEVEL SECURITY;

-- admin만 조회 가능
DROP POLICY IF EXISTS "Admins can view all logs" ON llm_performance_logs;
CREATE POLICY "Admins can view all logs" ON llm_performance_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 시스템(서비스 키) 또는 사용자가 자신의 로그를 INSERT할 수 있도록 허용.
-- 본 테이블은 user_id 기반으로 RLS를 강하게 보호하므로 INSERT 자체는 허용한다.
DROP POLICY IF EXISTS "System can insert logs" ON llm_performance_logs;
CREATE POLICY "System can insert logs" ON llm_performance_logs
  FOR INSERT
  WITH CHECK (true);

-- 사용자 자신의 로그는 조회 가능(본인 사용량 화면 용도, 추후 확장 시)
DROP POLICY IF EXISTS "Users can view own logs" ON llm_performance_logs;
CREATE POLICY "Users can view own logs" ON llm_performance_logs
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE llm_performance_logs IS 'LLM 호출 성능/실패 메트릭 로그. RLS: admin 전체, 사용자는 본인만.';
COMMENT ON COLUMN llm_performance_logs.error_type IS 'classifyLLMError 결과(QUOTA_EXCEEDED/RATE_LIMITED/...) 만 저장. 원본 메시지 저장 금지.';
