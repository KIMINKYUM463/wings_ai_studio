-- My 링크 테이블 권한 재설정 (저장 안 될 때 Supabase SQL Editor에서 실행)
ALTER TABLE IF EXISTS shotform_shopping_link_pages DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE shotform_shopping_link_pages TO anon, authenticated, service_role;
