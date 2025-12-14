-- 강사별 프로그램 매핑 테이블 생성
-- 각 강사가 어떤 프로그램을 제공하는지 정의

CREATE TABLE IF NOT EXISTS instructors_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor TEXT NOT NULL CHECK (instructor IN ('wings', 'onback')),
  program_name TEXT NOT NULL,
  program_path TEXT NOT NULL, -- 예: '/WingsAIStudio'
  program_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instructor, program_path)
);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_instructors_programs_updated_at ON instructors_programs;
CREATE TRIGGER update_instructors_programs_updated_at
  BEFORE UPDATE ON instructors_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_instructors_programs_instructor ON instructors_programs(instructor);
CREATE INDEX IF NOT EXISTS idx_instructors_programs_program_path ON instructors_programs(program_path);

-- RLS 정책
ALTER TABLE instructors_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instructors_programs_select_all" ON instructors_programs;
CREATE POLICY "instructors_programs_select_all" ON instructors_programs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "instructors_programs_insert_all" ON instructors_programs;
CREATE POLICY "instructors_programs_insert_all" ON instructors_programs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "instructors_programs_update_all" ON instructors_programs;
CREATE POLICY "instructors_programs_update_all" ON instructors_programs
  FOR UPDATE USING (true);

-- 초기 데이터 삽입 (윙스 강사의 WingsAIStudio 프로그램)
INSERT INTO instructors_programs (instructor, program_name, program_path, program_description)
VALUES 
  ('wings', 'WingsAIStudio', '/WingsAIStudio', '윙스 강사의 AI 스튜디오 프로그램')
ON CONFLICT (instructor, program_path) DO NOTHING;

