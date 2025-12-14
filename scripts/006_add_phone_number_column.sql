-- users 테이블에 phone_number 컬럼 추가
-- 카카오 로그인 시 전화번호 수집을 위한 컬럼

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 전화번호 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;

