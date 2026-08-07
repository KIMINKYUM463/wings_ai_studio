-- 스토리 쇼핑 콘텐츠 발굴: 계정별 개인 채널/커스텀 그룹
CREATE TABLE IF NOT EXISTS story_shopping_user_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  group_key TEXT NOT NULL,
  group_name TEXT,
  description TEXT DEFAULT '',
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, group_key)
);

-- 이미 테이블만 만든 경우 컬럼 추가
ALTER TABLE story_shopping_user_channels
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_story_shopping_user_channels_user_id
  ON story_shopping_user_channels (user_id);

CREATE OR REPLACE FUNCTION update_story_shopping_user_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_story_shopping_user_channels_updated_at
  ON story_shopping_user_channels;
CREATE TRIGGER trigger_update_story_shopping_user_channels_updated_at
  BEFORE UPDATE ON story_shopping_user_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_story_shopping_user_channels_updated_at();
