-- 사용자 개선사항을 저장할 테이블 생성
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, reviewed, implemented
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 피드백을 작성할 수 있도록 정책 설정
CREATE POLICY "Users can insert their own feedback"
  ON feedback
  FOR INSERT
  WITH CHECK (true);

-- 모든 사용자가 피드백을 읽을 수 있도록 정책 설정 (선택사항)
CREATE POLICY "Anyone can read feedback"
  ON feedback
  FOR SELECT
  USING (true);


