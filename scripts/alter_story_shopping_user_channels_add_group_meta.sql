-- 이미 story_shopping_user_channels 테이블을 만든 경우 실행
ALTER TABLE story_shopping_user_channels
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
