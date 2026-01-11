-- announcements 테이블에 link_url 필드 추가
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS link_url TEXT;

