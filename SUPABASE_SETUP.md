# Supabase 설정 가이드

## 현재 설정된 정보

- **Project URL**: `https://swbuzbiuemdaxwmjuygi.supabase.co`
- **Anon Key**: 설정됨

## 추가로 필요한 정보

### Service Role Key (필수)

카카오 로그인 사용자 정보를 Supabase에 저장하려면 **Service Role Key**가 필요합니다.

**확인 방법:**
1. Supabase 대시보드 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. Settings > API 이동
4. **Service Role Key** (secret) 복사
   - ⚠️ 이 키는 비밀입니다! 공개하지 마세요!

## 환경 변수 설정

### 로컬 개발 (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://swbuzbiuemdaxwmjuygi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YnV6Yml1ZW1kYXh3bWp1eWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTEzNjMsImV4cCI6MjA4MTI2NzM2M30.fhFPAsRggN_MUq-3XeQerjdjOcQ8jEvpHqPitN6sGHw
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 배포 환경 (Vercel)

1. Vercel 대시보드 > Settings > Environment Variables
2. 다음 변수 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://swbuzbiuemdaxwmjuygi.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (위 anon key)
   - `SUPABASE_SERVICE_ROLE_KEY`: (Service Role Key - Supabase에서 복사)

## 테이블 생성

1. Supabase 대시보드 > SQL Editor
2. `scripts/005_create_users_table.sql` 파일 내용 복사
3. SQL Editor에 붙여넣고 실행 (Run 버튼)

## 확인 방법

1. 테이블 생성 확인:
   - Table Editor > `users` 테이블이 있는지 확인

2. 카카오 로그인 테스트:
   - 메인 페이지에서 카카오 로그인
   - 로그인 성공 후 Table Editor > users 테이블에서 사용자 정보 확인

