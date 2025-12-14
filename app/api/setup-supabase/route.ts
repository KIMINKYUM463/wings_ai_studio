import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Supabase 테이블 자동 생성 시도 API
 * 
 * 이 API는 테이블이 존재하는지 확인하고, 없으면 생성 SQL을 반환합니다.
 * 
 * GET /api/setup-supabase
 */

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { 
          success: false,
          error: "Supabase 환경 변수가 설정되지 않았습니다." 
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log("[Setup Supabase] 테이블 확인 시작")

    // 테이블이 이미 존재하는지 확인
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .limit(1)

      if (error && error.code === "42P01") {
        // 테이블이 존재하지 않음
        return NextResponse.json({
          success: false,
          tableExists: false,
          message: "users 테이블이 존재하지 않습니다. 아래 SQL을 Supabase SQL Editor에서 실행해주세요.",
          sql: `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id BIGINT UNIQUE NOT NULL,
  email TEXT,
  nickname TEXT,
  profile_image_url TEXT,
  thumbnail_image_url TEXT,
  login_provider TEXT DEFAULT 'kakao',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_all" ON users;
CREATE POLICY "users_insert_all" ON users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_all" ON users;
CREATE POLICY "users_update_all" ON users
  FOR UPDATE USING (true);`,
          instructions: "Supabase 대시보드 > SQL Editor에서 위 SQL을 실행하세요."
        })
      }

      if (error) {
        throw error
      }

      // 테이블이 존재함
      return NextResponse.json({
        success: true,
        tableExists: true,
        message: "users 테이블이 이미 존재합니다. 카카오 로그인 시 자동으로 사용자 정보가 저장됩니다."
      })

    } catch (checkError: any) {
      if (checkError?.code === "42P01") {
        return NextResponse.json({
          success: false,
          tableExists: false,
          message: "users 테이블이 존재하지 않습니다.",
          sql: `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id BIGINT UNIQUE NOT NULL,
  email TEXT,
  nickname TEXT,
  profile_image_url TEXT,
  thumbnail_image_url TEXT,
  login_provider TEXT DEFAULT 'kakao',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
CREATE POLICY "users_select_all" ON users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_all" ON users;
CREATE POLICY "users_insert_all" ON users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_all" ON users;
CREATE POLICY "users_update_all" ON users
  FOR UPDATE USING (true);`
        })
      }

      throw checkError
    }

  } catch (error) {
    console.error("[Setup Supabase] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: `설정 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

