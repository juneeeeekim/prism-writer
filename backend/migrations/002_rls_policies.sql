-- =============================================================================
-- PRISM Writer - Row Level Security (RLS) Policies
-- =============================================================================
-- 파일: backend/migrations/002_rls_policies.sql
-- 역할: 사용자별 데이터 격리를 위한 RLS 정책 설정
-- 실행: 001_initial_schema.sql 실행 후 이 파일 실행
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS 활성화
-- -----------------------------------------------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. documents 테이블 정책
-- -----------------------------------------------------------------------------
-- 자신의 문서만 조회 가능
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = user_id);

-- 자신의 문서만 삽입 가능
CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 자신의 문서만 수정 가능
CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 자신의 문서만 삭제 가능
CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. chunks 테이블 정책 (documents를 통한 간접 권한)
-- -----------------------------------------------------------------------------
-- 자신의 문서에 속한 청크만 조회 가능
CREATE POLICY "Users can view chunks of own documents"
    ON chunks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = chunks.document_id 
            AND d.user_id = auth.uid()
        )
    );

-- 자신의 문서에만 청크 삽입 가능
CREATE POLICY "Users can insert chunks into own documents"
    ON chunks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = document_id 
            AND d.user_id = auth.uid()
        )
    );

-- 자신의 문서 청크만 삭제 가능
CREATE POLICY "Users can delete chunks of own documents"
    ON chunks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = chunks.document_id 
            AND d.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 4. drafts 테이블 정책 (가장 중요!)
-- -----------------------------------------------------------------------------
-- 자신의 글만 조회 가능
CREATE POLICY "Users can view own drafts"
    ON drafts FOR SELECT
    USING (auth.uid() = user_id);

-- 자신의 글만 삽입 가능
CREATE POLICY "Users can insert own drafts"
    ON drafts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 자신의 글만 수정 가능
CREATE POLICY "Users can update own drafts"
    ON drafts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 자신의 글만 삭제 가능
CREATE POLICY "Users can delete own drafts"
    ON drafts FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. draft_references 테이블 정책 (drafts를 통한 간접 권한)
-- -----------------------------------------------------------------------------
-- 자신의 글에 연결된 참조만 조회 가능
CREATE POLICY "Users can view references of own drafts"
    ON draft_references FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM drafts d 
            WHERE d.id = draft_references.draft_id 
            AND d.user_id = auth.uid()
        )
    );

-- 자신의 글에만 참조 삽입 가능
CREATE POLICY "Users can insert references into own drafts"
    ON draft_references FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM drafts d 
            WHERE d.id = draft_id 
            AND d.user_id = auth.uid()
        )
    );

-- 자신의 글 참조만 삭제 가능
CREATE POLICY "Users can delete references of own drafts"
    ON draft_references FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM drafts d 
            WHERE d.id = draft_references.draft_id 
            AND d.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 6. ingestion_jobs 테이블 정책
-- -----------------------------------------------------------------------------
-- 자신의 문서 작업만 조회 가능
CREATE POLICY "Users can view jobs of own documents"
    ON ingestion_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = ingestion_jobs.document_id 
            AND d.user_id = auth.uid()
        )
    );

-- =============================================================================
-- RLS 정책 테스트 쿼리
-- =============================================================================
-- 아래 쿼리들은 정책 적용 후 테스트용으로 사용하세요.
-- 
-- 1. 테스트 사용자로 로그인 후:
--    SELECT * FROM drafts;  -- 자신의 글만 보여야 함
--
-- 2. 다른 사용자의 글 직접 조회 시도:
--    SELECT * FROM drafts WHERE user_id = 'other-user-uuid';  -- 결과 없음
--
-- 3. 다른 사용자의 글 삽입 시도:
--    INSERT INTO drafts (user_id, title) VALUES ('other-user-uuid', 'Test');
--    -- ERROR: new row violates row-level security
--
-- =============================================================================
