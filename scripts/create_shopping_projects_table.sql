-- 쇼핑 숏폼 프로젝트 테이블 생성
CREATE TABLE IF NOT EXISTS shopping_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (사용자별 프로젝트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_shopping_projects_user_id ON shopping_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_projects_updated_at ON shopping_projects(updated_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_shopping_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_shopping_projects_updated_at ON shopping_projects;
CREATE TRIGGER trigger_update_shopping_projects_updated_at
  BEFORE UPDATE ON shopping_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_shopping_projects_updated_at();

-- RLS (Row Level Security) 정책 설정 (선택사항 - 필요시 활성화)
-- ALTER TABLE shopping_projects ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로젝트만 조회/수정/삭제 가능 (RLS 활성화 시)
-- CREATE POLICY "Users can view their own shopping projects" ON shopping_projects
--   FOR SELECT USING (true);
-- 
-- CREATE POLICY "Users can insert their own shopping projects" ON shopping_projects
--   FOR INSERT WITH CHECK (true);
-- 
-- CREATE POLICY "Users can update their own shopping projects" ON shopping_projects
--   FOR UPDATE USING (true);
-- 
-- CREATE POLICY "Users can delete their own shopping projects" ON shopping_projects
--   FOR DELETE USING (true);

