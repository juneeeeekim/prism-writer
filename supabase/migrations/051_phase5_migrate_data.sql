-- =============================================================================
-- Phase 5: 멀티 프로젝트 시스템 - 데이터 마이그레이션
-- =============================================================================
-- 파일: supabase/migrations/051_phase5_migrate_data.sql
-- 생성일: 2025-12-31
-- 담당: Tech Lead
-- 
-- 주석(시니어 개발자): 이 마이그레이션은 기존 사용자의 데이터를
-- "기본 프로젝트"로 이관합니다. 멱등성을 보장하므로 여러 번 실행해도 안전합니다.
-- =============================================================================

-- =============================================================================
-- [P5-01-E] 기존 사용자 데이터 마이그레이션
-- =============================================================================

-- Step 1: 기존 사용자별 기본 프로젝트 생성
-- (이미 프로젝트가 있는 사용자는 건너뜀)
INSERT INTO public.projects (user_id, name, description, icon, status)
SELECT DISTINCT 
  ud.user_id,
  '기본 프로젝트',
  '기존 문서가 자동으로 마이그레이션된 프로젝트입니다.',
  '📁',
  'active'
FROM public.user_documents ud
WHERE ud.project_id IS NULL
  AND ud.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.user_id = ud.user_id 
    AND p.name = '기본 프로젝트'
  )
ON CONFLICT DO NOTHING;

-- Step 2: evaluation_logs에서 user_id가 있지만 프로젝트가 없는 사용자도 처리
INSERT INTO public.projects (user_id, name, description, icon, status)
SELECT DISTINCT 
  el.user_id,
  '기본 프로젝트',
  '기존 평가 기록이 자동으로 마이그레이션된 프로젝트입니다.',
  '📁',
  'active'
FROM public.evaluation_logs el
WHERE el.project_id IS NULL
  AND el.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.user_id = el.user_id 
    AND p.name = '기본 프로젝트'
  )
ON CONFLICT DO NOTHING;

-- Step 3: chat_sessions에서 user_id가 있지만 프로젝트가 없는 사용자도 처리
INSERT INTO public.projects (user_id, name, description, icon, status)
SELECT DISTINCT 
  cs.user_id,
  '기본 프로젝트',
  '기존 채팅 기록이 자동으로 마이그레이션된 프로젝트입니다.',
  '📁',
  'active'
FROM public.chat_sessions cs
WHERE cs.project_id IS NULL
  AND cs.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.user_id = cs.user_id 
    AND p.name = '기본 프로젝트'
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Step 4: 기존 문서를 기본 프로젝트에 연결
-- =============================================================================

UPDATE public.user_documents doc
SET project_id = (
  SELECT p.id FROM public.projects p 
  WHERE p.user_id = doc.user_id 
  AND p.name = '기본 프로젝트'
  LIMIT 1
)
WHERE doc.project_id IS NULL
  AND doc.user_id IS NOT NULL;

-- =============================================================================
-- Step 5: 기존 평가 기록을 기본 프로젝트에 연결
-- =============================================================================

UPDATE public.evaluation_logs log
SET project_id = (
  SELECT p.id FROM public.projects p 
  WHERE p.user_id = log.user_id 
  AND p.name = '기본 프로젝트'
  LIMIT 1
)
WHERE log.project_id IS NULL
  AND log.user_id IS NOT NULL;

-- =============================================================================
-- Step 6: 기존 채팅 세션을 기본 프로젝트에 연결
-- =============================================================================

UPDATE public.chat_sessions sess
SET project_id = (
  SELECT p.id FROM public.projects p 
  WHERE p.user_id = sess.user_id 
  AND p.name = '기본 프로젝트'
  LIMIT 1
)
WHERE sess.project_id IS NULL
  AND sess.user_id IS NOT NULL;

-- =============================================================================
-- Step 7: rag_templates도 마이그레이션 (테이블 존재 시)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rag_templates' 
    AND column_name = 'project_id'
  ) THEN
    EXECUTE '
      UPDATE public.rag_templates tpl
      SET project_id = (
        SELECT p.id FROM public.projects p 
        WHERE p.user_id = tpl.user_id 
        AND p.name = ''기본 프로젝트''
        LIMIT 1
      )
      WHERE tpl.project_id IS NULL
        AND tpl.user_id IS NOT NULL
    ';
  END IF;
END $$;

-- =============================================================================
-- 마이그레이션 결과 확인
-- =============================================================================

DO $$
DECLARE
  project_count INT;
  doc_migrated INT;
  eval_migrated INT;
  chat_migrated INT;
BEGIN
  SELECT COUNT(*) INTO project_count FROM public.projects WHERE name = '기본 프로젝트';
  SELECT COUNT(*) INTO doc_migrated FROM public.user_documents WHERE project_id IS NOT NULL;
  SELECT COUNT(*) INTO eval_migrated FROM public.evaluation_logs WHERE project_id IS NOT NULL;
  SELECT COUNT(*) INTO chat_migrated FROM public.chat_sessions WHERE project_id IS NOT NULL;

  RAISE NOTICE '[Phase5] 051_phase5_migrate_data.sql 마이그레이션 완료';
  RAISE NOTICE '  - 기본 프로젝트 수: %', project_count;
  RAISE NOTICE '  - 연결된 문서 수: %', doc_migrated;
  RAISE NOTICE '  - 연결된 평가 수: %', eval_migrated;
  RAISE NOTICE '  - 연결된 채팅 수: %', chat_migrated;
END $$;
