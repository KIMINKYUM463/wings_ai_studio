# 업데이트 내용 관리 가이드

## Supabase 테이블 생성

1. Supabase 대시보드 접속
2. SQL Editor로 이동
3. `scripts/create_announcements_table.sql` 파일 내용을 복사하여 실행

## 업데이트 내용 작성 방법

### 방법 1: API 직접 호출 (관리자용)

환경 변수에 `ADMIN_PASSWORD`를 설정한 후, 다음 API를 호출합니다:

```bash
# 새 업데이트 내용 생성
curl -X POST http://localhost:3000/api/announcements \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d '{
    "title": "업데이트 제목",
    "content": "업데이트 내용\n여러 줄로 작성 가능합니다.",
    "is_active": true
  }'

# 기존 업데이트 수정
curl -X PUT http://localhost:3000/api/announcements/update \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d '{
    "id": "업데이트_ID",
    "title": "수정된 제목",
    "content": "수정된 내용",
    "is_active": true
  }'
```

### 방법 2: Supabase 대시보드에서 직접 작성

1. Supabase 대시보드 > Table Editor > `announcements` 테이블 선택
2. "Insert row" 클릭
3. 다음 필드 입력:
   - `title`: 업데이트 제목
   - `content`: 업데이트 내용 (여러 줄 가능)
   - `is_active`: `true` (활성화)
4. 저장

## 환경 변수 설정

`.env.local` 또는 Vercel 환경 변수에 추가:

```env
ADMIN_PASSWORD=your_secure_password_here
```

## 동작 방식

1. 사용자가 WingsAIStudio 메인 페이지에 접속
2. 비밀번호 인증 완료 후 업데이트 내용 자동 조회
3. 활성화된(`is_active = true`) 최신 업데이트가 있고, 사용자가 아직 보지 않은 경우 팝업 표시
4. 사용자가 "확인" 버튼을 클릭하면 해당 업데이트 ID가 localStorage에 저장되어 다시 표시되지 않음

## 팝업 표시 조건

- `is_active = true`인 업데이트만 표시
- 사용자가 아직 본 적이 없는 업데이트만 표시 (localStorage 기반)
- 최신 업데이트 1개만 표시

