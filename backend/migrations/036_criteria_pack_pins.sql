-- =============================================================================
-- PRISM Writer - CriteriaPack Pins Table (Pipeline v5)
-- =============================================================================
-- 파일: backend/migrations/036_criteria_pack_pins.sql
-- 역할: 사용자별 Pin 상태 저장 테이블
-- 생성일: 2025-12-25
--
-- 주석(시니어 개발자):
-- 사용자가 특정 규칙/예시를 Pin하면 해당 상태를 서버에 저장합니다.
-- 멀티 디바이스 동기화를 위해 필요합니다.
-- =============================================================================

-- =============================================================================
-- 1. 테이블 생성: criteria_pack_pins
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.criteria_pack_pins (
    -- -------------------------------------------------------------------------
    -- 기본 ID
    -- -------------------------------------------------------------------------
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- -------------------------------------------------------------------------
    -- 사용자 및 항목 참조
    -- -------------------------------------------------------------------------
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,  -- rag_chunks.id 참조
    item_type TEXT NOT NULL CHECK (item_type IN ('rule', 'example')),
    template_id UUID,  -- 특정 템플릿에만 적용 (NULL이면 전역)
    
    -- -------------------------------------------------------------------------
    -- 메타데이터
    -- -------------------------------------------------------------------------
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- -------------------------------------------------------------------------
    -- 유니크 제약: 사용자 + 항목 + 템플릿 조합당 하나의 Pin만 허용
    -- -------------------------------------------------------------------------
    CONSTRAINT unique_pin_per_user_item_template UNIQUE(user_id, item_id, template_id)
);

-- =============================================================================
-- 2. 인덱스 생성
-- =============================================================================

-- 사용자별 Pin 목록 조회
CREATE INDEX IF NOT EXISTS idx_criteria_pack_pins_user_id 
    ON public.criteria_pack_pins(user_id);

-- 사용자 + 템플릿별 Pin 목록 조회
CREATE INDEX IF NOT EXISTS idx_criteria_pack_pins_user_template 
    ON public.criteria_pack_pins(user_id, template_id);

-- =============================================================================
-- 3. RLS (Row Level Security) 활성화
-- =============================================================================

ALTER TABLE public.criteria_pack_pins ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS 정책 정의
-- =============================================================================

-- 사용자는 본인의 Pin만 조회 가능
DROP POLICY IF EXISTS "Users can view own pins" ON public.criteria_pack_pins;
CREATE POLICY "Users can view own pins"
    ON public.criteria_pack_pins
    FOR SELECT
    USING (auth.uid() = user_id);

-- 사용자는 본인의 Pin만 생성 가능
DROP POLICY IF EXISTS "Users can insert own pins" ON public.criteria_pack_pins;
CREATE POLICY "Users can insert own pins"
    ON public.criteria_pack_pins
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 사용자는 본인의 Pin만 삭제 가능
DROP POLICY IF EXISTS "Users can delete own pins" ON public.criteria_pack_pins;
CREATE POLICY "Users can delete own pins"
    ON public.criteria_pack_pins
    FOR DELETE
    USING (auth.uid() = user_id);

-- 사용자는 본인의 Pin만 수정 가능
DROP POLICY IF EXISTS "Users can update own pins" ON public.criteria_pack_pins;
CREATE POLICY "Users can update own pins"
    ON public.criteria_pack_pins
    FOR UPDATE
    USING (auth.uid() = user_id);

-- =============================================================================
-- 5. 코멘트 추가
-- =============================================================================

COMMENT ON TABLE public.criteria_pack_pins IS 
    'Pipeline v5: 사용자별 CriteriaPack Pin 상태 저장';

COMMENT ON COLUMN public.criteria_pack_pins.item_id IS 
    '핀된 항목 ID (rag_chunks.id)';

COMMENT ON COLUMN public.criteria_pack_pins.item_type IS 
    '항목 유형: rule (규칙) 또는 example (예시)';

COMMENT ON COLUMN public.criteria_pack_pins.template_id IS 
    '특정 템플릿에만 적용 (NULL이면 전역 Pin)';

-- =============================================================================
-- ==================== 롤백 스크립트 (ROLLBACK SECTION) =======================
-- =============================================================================
/*
-- 롤백 절차:
DROP POLICY IF EXISTS "Users can update own pins" ON public.criteria_pack_pins;
DROP POLICY IF EXISTS "Users can delete own pins" ON public.criteria_pack_pins;
DROP POLICY IF EXISTS "Users can insert own pins" ON public.criteria_pack_pins;
DROP POLICY IF EXISTS "Users can view own pins" ON public.criteria_pack_pins;
DROP INDEX IF EXISTS public.idx_criteria_pack_pins_user_template;
DROP INDEX IF EXISTS public.idx_criteria_pack_pins_user_id;
DROP TABLE IF EXISTS public.criteria_pack_pins;
*/

-- =============================================================================
-- 마이그레이션 완료
-- =============================================================================
