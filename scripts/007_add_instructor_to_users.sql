-- users 테이블에 강사 정보 추가
-- instructor 컬럼: 'wings' (윙스), 'onback' (온백), NULL (미지정)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS instructor TEXT CHECK (instructor IN ('wings', 'onback'));

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_instructor ON users(instructor) WHERE instructor IS NOT NULL;

