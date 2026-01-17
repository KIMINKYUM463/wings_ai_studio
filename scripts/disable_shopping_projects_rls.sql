-- 쇼핑 숏폼 프로젝트 테이블의 RLS 비활성화
-- 이미 테이블이 생성되어 있고 RLS가 활성화된 경우 이 SQL을 실행하세요

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view their own shopping projects" ON shopping_projects;
DROP POLICY IF EXISTS "Users can create their own shopping projects" ON shopping_projects;
DROP POLICY IF EXISTS "Users can update their own shopping projects" ON shopping_projects;
DROP POLICY IF EXISTS "Users can delete their own shopping projects" ON shopping_projects;

-- RLS 비활성화
ALTER TABLE shopping_projects DISABLE ROW LEVEL SECURITY;


