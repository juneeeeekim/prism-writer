-- =========================================================
-- Phase P1-A: Chat Messages Metadata
-- =========================================================

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 인덱스 추가 (metadata 내부 필드 조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata ON public.chat_messages USING gin (metadata);

-- 코멘트
COMMENT ON COLUMN public.chat_messages.metadata IS '메시지 관련 메타데이터 (Citation 결과, 토큰 사용량 등)';
