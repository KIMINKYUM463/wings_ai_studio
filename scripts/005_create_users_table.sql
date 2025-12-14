-- 카카오 로그인 사용자 테이블 생성
-- users 테이블: 카카오 로그인 사용자 정보 저장

-- users 테이블 생성
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id BIGINT UNIQUE NOT NULL, -- 카카오 사용자 ID
  email TEXT,
  nickname TEXT,
  profile_image_url TEXT,
  thumbnail_image_url TEXT,
  login_provider TEXT DEFAULT 'kakao', -- 로그인 제공자 (kakao, google 등)
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- RLS 정책 (모든 사용자가 읽기 가능, 자신의 정보만 수정 가능)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_all" ON users;
CREATE POLICY "users_insert_all" ON users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_all" ON users;
CREATE POLICY "users_update_all" ON users
  FOR UPDATE USING (true);

-- 사용 방법:
-- 1. Supabase 대시보드 → SQL Editor에서 이 스크립트 실행
-- 2. 카카오 로그인 시 자동으로 users 테이블에 저장됨
-- 3. Supabase 대시보드 → Table Editor → users 테이블에서 사용자 목록 확인 가능

