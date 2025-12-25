-- =============================================================================
-- Pipeline v4 Migration Test - 데이터 정합성 검증 스크립트
-- =============================================================================
-- Supabase SQL Editor에서 실행하여 결과 확인
-- =============================================================================

-- =============================================================================
-- MT-1: 기존 rag_chunks 데이터에 chunk_type 기본값 적용 확인
-- =============================================================================

SELECT '=== MT-1: rag_chunks chunk_type 검증 ===' as test_name;

-- 1-1. NULL 개수 확인 (0이어야 함)
SELECT 
    'MT-1-A: chunk_type IS NULL 개수' as check_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM rag_chunks 
WHERE chunk_type IS NULL;

-- 1-2. chunk_type 분포 확인
SELECT 
    'MT-1-B: chunk_type 분포' as check_name,
    chunk_type,
    COUNT(*) as count
FROM rag_chunks 
GROUP BY chunk_type
ORDER BY count DESC;

-- 1-3. 전체 청크 수 확인
SELECT 
    'MT-1-C: 전체 청크 수' as check_name,
    COUNT(*) as total_chunks
FROM rag_chunks;

-- =============================================================================
-- MT-2: 기존 telemetry_logs 데이터에 run_type 기본값 적용 확인
-- =============================================================================

SELECT '=== MT-2: telemetry_logs run_type 검증 ===' as test_name;

-- 2-1. NULL 개수 확인 (0이어야 함)
SELECT 
    'MT-2-A: run_type IS NULL 개수' as check_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM telemetry_logs 
WHERE run_type IS NULL;

-- 2-2. run_type 분포 확인
SELECT 
    'MT-2-B: run_type 분포' as check_name,
    run_type,
    COUNT(*) as count
FROM telemetry_logs 
GROUP BY run_type
ORDER BY count DESC;

-- 2-3. 전체 로그 수 확인
SELECT 
    'MT-2-C: 전체 로그 수' as check_name,
    COUNT(*) as total_logs
FROM telemetry_logs;

-- =============================================================================
-- MT-3: 신규 테이블 RLS 정책 확인 (template_validation_samples)
-- =============================================================================

SELECT '=== MT-3: template_validation_samples RLS 검증 ===' as test_name;

-- 3-1. 테이블 존재 확인
SELECT 
    'MT-3-A: 테이블 존재 여부' as check_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'template_validation_samples'
    ) THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END as result;

-- 3-2. RLS 활성화 확인
SELECT 
    'MT-3-B: RLS 활성화 여부' as check_name,
    relname as table_name,
    CASE WHEN relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_class 
WHERE relname = 'template_validation_samples';

-- 3-3. RLS 정책 목록 확인
SELECT 
    'MT-3-C: RLS 정책 목록' as check_name,
    policyname as policy_name,
    cmd as operation
FROM pg_policies 
WHERE tablename = 'template_validation_samples';

-- 3-4. 현재 샘플 수 확인
SELECT 
    'MT-3-D: 현재 샘플 수' as check_name,
    COUNT(*) as sample_count
FROM template_validation_samples;

-- =============================================================================
-- 결과 요약
-- =============================================================================

SELECT '=== 테스트 완료 ===' as summary;
