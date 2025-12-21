-- 롱폼 프로젝트 테이블 생성
CREATE TABLE IF NOT EXISTS longform_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- 사용자 식별자 (이메일 또는 사용자 ID)
  name TEXT NOT NULL, -- 프로젝트 이름
  description TEXT, -- 프로젝트 설명 (선택사항)
  data JSONB NOT NULL, -- 프로젝트 데이터 (모든 작업 내용)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (사용자별 프로젝트 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_longform_projects_user_id ON longform_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_longform_projects_updated_at ON longform_projects(updated_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_longform_projects_updated_at ON longform_projects;
CREATE TRIGGER update_longform_projects_updated_at
  BEFORE UPDATE ON longform_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책 설정 (선택사항 - 필요시 활성화)
-- ALTER TABLE longform_projects ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 프로젝트만 조회/수정/삭제 가능 (RLS 활성화 시)
-- CREATE POLICY "Users can view their own projects" ON longform_projects
--   FOR SELECT USING (auth.uid()::text = user_id);
-- 
-- CREATE POLICY "Users can insert their own projects" ON longform_projects
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);
-- 
-- CREATE POLICY "Users can update their own projects" ON longform_projects
--   FOR UPDATE USING (auth.uid()::text = user_id);
-- 
-- CREATE POLICY "Users can delete their own projects" ON longform_projects
--   FOR DELETE USING (auth.uid()::text = user_id);

