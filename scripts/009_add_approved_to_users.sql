-- users.approved: 관리자 승인 여부
-- 기존 회원 → true, 이후 신규 가입 → false

ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved BOOLEAN;

-- 이미 가입된 사용자(컬럼이 비어 있던 행)만 승인
UPDATE users
SET approved = true
WHERE approved IS NULL;

ALTER TABLE users
ALTER COLUMN approved SET DEFAULT false;

ALTER TABLE users
ALTER COLUMN approved SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_approved ON users(approved);
