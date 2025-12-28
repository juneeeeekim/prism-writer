-- 테이블 목록 조회 (documents vs articles 확인)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('documents', 'articles');

-- articles 테이블의 category 컬럼 정보 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name = 'category';

-- documents 테이블의 category 컬럼 정보 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'category';
