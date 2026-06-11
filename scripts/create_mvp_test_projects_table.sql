-- MVP 테스트 프로젝트 테이블
CREATE TABLE IF NOT EXISTS mvp_test_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mvp_test_projects_user_id ON mvp_test_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_mvp_test_projects_updated_at ON mvp_test_projects(updated_at DESC);

CREATE OR REPLACE FUNCTION update_mvp_test_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mvp_test_projects_updated_at ON mvp_test_projects;
CREATE TRIGGER trigger_update_mvp_test_projects_updated_at
  BEFORE UPDATE ON mvp_test_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_mvp_test_projects_updated_at();

-- RLS 기본 ON이면 anon 키로 insert 불가 → 비활성화 (쇼핑숏폼 shopping_projects 와 동일)
ALTER TABLE mvp_test_projects DISABLE ROW LEVEL SECURITY;

GRANT ALL ON mvp_test_projects TO anon, authenticated, service_role;
