-- announcements 테이블에 image_url 필드 추가
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS image_url TEXT;

