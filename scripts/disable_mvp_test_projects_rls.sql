-- MVP 테스트 프로젝트 테이블 RLS 비활성화
-- 테이블 생성 후 insert/select가 막히면 이 SQL을 Supabase SQL Editor에서 실행하세요.

ALTER TABLE IF EXISTS mvp_test_projects DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mvp test projects" ON mvp_test_projects;
DROP POLICY IF EXISTS "Users can insert their own mvp test projects" ON mvp_test_projects;
DROP POLICY IF EXISTS "Users can update their own mvp test projects" ON mvp_test_projects;
DROP POLICY IF EXISTS "Users can delete their own mvp test projects" ON mvp_test_projects;

GRANT ALL ON mvp_test_projects TO anon, authenticated, service_role;
