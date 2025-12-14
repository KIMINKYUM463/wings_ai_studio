# 카카오톡 로그인 설정 가이드

## 1. 카카오 개발자 콘솔에서 앱 등록

1. **카카오 개발자 콘솔 접속**
   - https://developers.kakao.com 접속
   - 카카오 계정으로 로그인

2. **내 애플리케이션 만들기**
   - 내 애플리케이션 > 애플리케이션 추가하기
   - 앱 이름: "부스텍AI" (또는 원하는 이름)
   - 사업자명: 입력 (개인 개발자도 가능)

3. **REST API 키 확인**
   - 앱 선택 > 앱 설정 > 앱 키
   - **REST API 키** 복사 (이것이 `KAKAO_REST_API_KEY`)

## 2. 카카오 로그인 활성화

1. **카카오 로그인 활성화**
   - 제품 설정 > 카카오 로그인
   - 활성화 설정: ON

2. **Redirect URI 등록**
   - Redirect URI 등록
   - 로컬 개발: `http://localhost:3000/api/kakao/callback`
   - 배포 환경: `https://wingsaistudio.com/api/kakao/callback`
   - (또는 실제 도메인에 맞게 수정)

3. **동의 항목 설정**
   - 제품 설정 > 카카오 로그인 > 동의항목
   - 필수 동의: 닉네임, 프로필 사진
   - 선택 동의: 카카오계정(이메일) (필요시)

## 3. 환경 변수 설정

### 로컬 개발 (.env.local)

```env
KAKAO_REST_API_KEY=your_rest_api_key_here
KAKAO_REDIRECT_URI=http://localhost:3000/api/kakao/callback
```

### 배포 환경 (Vercel)

1. Vercel 대시보드 > Settings > Environment Variables
2. 다음 변수 추가:
   - `KAKAO_REST_API_KEY`: 카카오 REST API 키
   - `KAKAO_REDIRECT_URI`: `https://wingsaistudio.com/api/kakao/callback` (실제 도메인에 맞게 수정)

## 4. 구현된 기능

### API 엔드포인트

- `GET /api/kakao/auth` - 카카오 로그인 시작
- `GET /api/kakao/callback` - 카카오 로그인 콜백 처리
- `GET /api/kakao/user` - 현재 로그인한 사용자 정보 조회
- `POST /api/kakao/logout` - 로그아웃

### 메인 페이지 기능

- 카카오 로그인 버튼 (헤더)
- 로그인 상태 표시 (프로필 이미지, 닉네임)
- 로그아웃 버튼

## 5. 사용자 정보 구조

로그인 성공 시 다음 정보가 세션에 저장됩니다:

```typescript
{
  id: number,              // 카카오 사용자 ID
  email: string,            // 이메일 (동의한 경우)
  nickname: string,         // 닉네임
  profileImage: string,     // 프로필 이미지 URL
  thumbnailImage: string,   // 썸네일 이미지 URL
  accessToken: string,      // 액세스 토큰 (서버에서만 사용)
  loginTime: string,        // 로그인 시간
}
```

## 6. 보안 고려사항

- 액세스 토큰은 httpOnly 쿠키에 저장되어 클라이언트에서 직접 접근 불가
- 쿠키는 HTTPS 환경에서만 전송 (production)
- 세션 유효기간: 30일

## 7. 문제 해결

### 로그인이 안 되는 경우

1. **Redirect URI 확인**
   - 카카오 개발자 콘솔에 등록한 Redirect URI와 환경 변수의 `KAKAO_REDIRECT_URI`가 정확히 일치해야 합니다.
   - 도메인, 프로토콜(http/https), 경로 모두 일치해야 합니다.

2. **REST API 키 확인**
   - 환경 변수에 올바른 REST API 키가 설정되어 있는지 확인

3. **카카오 로그인 활성화 확인**
   - 카카오 개발자 콘솔에서 카카오 로그인이 활성화되어 있는지 확인

### 콜백 오류

- URL 파라미터에 `kakao_error`가 있으면 오류 메시지가 표시됩니다.
- 브라우저 콘솔에서 상세 오류 로그 확인

