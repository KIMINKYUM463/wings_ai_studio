# WingsAIStudio 롱폼 기능 조교 메뉴얼

## 📋 목차
1. [API 키 개요](#api-키-개요)
2. [기능별 API 사용 현황](#기능별-api-사용-현황)
3. [문제 발생 시 확인 사항](#문제-발생-시-확인-사항)
4. [API 키 발급 방법](#api-키-발급-방법)
5. [에러 코드별 해결 방법](#에러-코드별-해결-방법)

---

## 🔑 API 키 개요

WingsAIStudio 롱폼 기능에서 사용되는 API 키는 총 **7개**입니다:

| API | 저장 키 이름 | 필수 여부 | 용도 |
|-----|------------|---------|------|
| **OpenAI** | `openai_api_key` | ✅ 필수 | 대본 생성, 제목/설명 생성, 이미지 프롬프트, 자막 동기화 |
| **Gemini** | `gemini_api_key` | ✅ 필수 | 대본 생성, 콘텐츠 타입 추천, 이미지 스타일 분석 |
| **Replicate** | `replicate_api_key` | ✅ 필수 | 이미지 생성, 이미지→비디오 변환 |
| **ElevenLabs** | `elevenlabs_api_key` | ⚠️ 선택 | TTS (음성 합성) - ElevenLabs 음성 사용 시 |
| **TTSMaker** | `ttsmaker_api_key` | ⚠️ 선택 | TTS (음성 합성) - TTSMaker 음성 사용 시 |
| **Supertone** | `supertone_api_key` | ⚠️ 선택 | TTS (음성 합성) - Supertone 음성 사용 시 |
| **YouTube Data API** | `wings_youtube_data_api_key` | ⚠️ 선택 | 트렌딩 토픽 분석, 채널 분석 |

---

## 🎯 기능별 API 사용 현황

### 1. 주제 및 카테고리 선택
- **사용 API**: YouTube Data API (`wings_youtube_data_api_key`)
- **기능**: 트렌딩 토픽 가져오기
- **확인 위치**: 설정 → API 키 설정 → YouTube Data API Key
- **문제 발생 시**: 
  - "트렌딩 토픽을 가져올 수 없습니다" 오류
  - 트렌딩 토픽이 비어있음

### 2. 콘텐츠 타입 추천
- **사용 API**: Gemini API (`gemini_api_key`)
- **기능**: 선택한 주제에 맞는 콘텐츠 타입 추천
- **확인 위치**: 설정 → API 키 설정 → Gemini API Key
- **문제 발생 시**:
  - "Gemini API 키를 설정해주세요" 알림
  - 콘텐츠 타입 추천이 작동하지 않음

### 3. 대본 기획
- **사용 API**: Gemini API (`gemini_api_key`)
- **기능**: 선택한 주제와 콘텐츠 타입(Type A, B, C, D, 커스텀)에 맞는 대본 기획안 생성
- **확인 위치**: 설정 → API 키 설정 → Gemini API Key
- **문제 발생 시**:
  - "Gemini API 키를 설정해주세요" 알림
  - "콘텐츠 타입을 선택해주세요" 알림 (Type A, B, C, D 또는 커스텀 타입 중 하나 필수)
  - "커스텀 타입을 선택하셨습니다. 원하는 대본 구조를 입력해주세요" 알림 (커스텀 타입 선택 시)
  - 대본 기획안이 생성되지 않음
  - 대본 기획 생성이 실패함

### 4. 대본 생성
- **사용 API**: 
  - **Gemini API** (`gemini_api_key`) - 기본 대본 생성
  - **OpenAI API** (`openai_api_key`) - 대본 개선/정제
- **기능**: 
  - Gemini: 전체 대본 생성
  - OpenAI: 장면 분해, 대본 개선
- **확인 위치**: 
  - 설정 → API 키 설정 → Gemini API Key
  - 설정 → API 키 설정 → OpenAI API Key
- **문제 발생 시**:
  - "Gemini API 키를 설정해주세요" 알림
  - "OpenAI API 키가 필요합니다" 알림
  - 대본이 생성되지 않음
  - 대본 개선이 작동하지 않음

### 5. 이미지 생성
- **사용 API**: 
  - **Replicate API** (`replicate_api_key`) - 이미지 생성
  - **OpenAI API** (`openai_api_key`) - 이미지 프롬프트 생성
- **기능**: 
  - OpenAI: 이미지 프롬프트 생성 (한국어 → 영어)
  - Replicate: 실제 이미지 생성
- **확인 위치**: 
  - 설정 → API 키 설정 → Replicate API Key
  - 설정 → API 키 설정 → OpenAI API Key
- **문제 발생 시**:
  - "Replicate API 키가 필요합니다" 알림
  - "OpenAI API 키를 설정해주세요" 알림
  - 이미지가 생성되지 않음
  - 이미지 생성이 매우 느림

### 6. 이미지 스타일 분석
- **사용 API**: Gemini API (`gemini_api_key`)
- **기능**: 업로드한 이미지를 분석하여 스타일 프롬프트 생성
- **확인 위치**: 설정 → API 키 설정 → Gemini API Key
- **문제 발생 시**:
  - 이미지 분석이 작동하지 않음
  - 스타일 프롬프트가 생성되지 않음

### 7. 음성 합성 (TTS)
- **사용 API**: 
  - **ElevenLabs API** (`elevenlabs_api_key`) - ElevenLabs 음성 사용 시
  - **TTSMaker API** (`ttsmaker_api_key`) - TTSMaker 음성 사용 시
  - **Supertone API** (`supertone_api_key`) - Supertone 음성 사용 시
- **기능**: 텍스트를 음성으로 변환
- **확인 위치**: 
  - 설정 → API 키 설정 → ElevenLabs API Key
  - 설정 → API 키 설정 → TTSMaker API Key
  - 설정 → API 키 설정 → Supertone API Key
- **문제 발생 시**:
  - "API 키가 필요합니다" 알림 (선택한 음성에 따라 다름)
  - 음성이 생성되지 않음
  - 음성 생성이 실패함

### 8. 자막 동기화
- **사용 API**: OpenAI API (`openai_api_key`) - Whisper API 사용
- **기능**: 음성과 텍스트를 정확히 동기화하여 자막 생성
- **확인 위치**: 설정 → API 키 설정 → OpenAI API Key
- **문제 발생 시**:
  - "OpenAI API 키 없음, Whisper API 건너뜀" 경고
  - 자막이 정확하지 않음 (대체 방식 사용 시)
  - 자막 동기화가 작동하지 않음

### 9. 제목/설명 생성
- **사용 API**: OpenAI API (`openai_api_key`)
- **기능**: 
  - YouTube 제목 생성
  - YouTube 설명 생성
  - 쇼츠 제목 생성
- **확인 위치**: 설정 → API 키 설정 → OpenAI API Key
- **문제 발생 시**:
  - "OpenAI API 키가 필요합니다" 알림
  - 제목/설명이 생성되지 않음

### 10. 썸네일 생성
- **사용 API**: 
  - **Replicate API** (`replicate_api_key`) - 이미지 생성
  - **OpenAI API** (`openai_api_key`) - 썸네일 텍스트 추출
- **기능**: YouTube 썸네일 이미지 생성
- **확인 위치**: 
  - 설정 → API 키 설정 → Replicate API Key
  - 설정 → API 키 설정 → OpenAI API Key
- **문제 발생 시**:
  - "Replicate API 키가 필요합니다" 알림
  - "OpenAI API 키가 필요합니다" 알림
  - 썸네일이 생성되지 않음

### 11. 이미지→비디오 변환
- **사용 API**: Replicate API (`replicate_api_key`)
- **기능**: 정적 이미지를 동영상으로 변환
- **확인 위치**: 설정 → API 키 설정 → Replicate API Key
- **문제 발생 시**:
  - "Replicate API 키가 필요합니다" 알림
  - 비디오 변환이 실패함

### 12. YouTube 업로드
- **사용 API**: YouTube OAuth (토큰 기반)
- **기능**: 생성된 영상을 YouTube에 업로드
- **확인 위치**: 설정 → YouTube 연결
- **문제 발생 시**:
  - "YouTube 계정이 연결되지 않았습니다" 알림
  - "YouTube 토큰이 만료되었습니다" 알림
  - 업로드가 실패함

---

## 🔍 문제 발생 시 확인 사항

### 체크리스트

#### 1단계: 기본 API 키 확인
- [ ] OpenAI API 키가 입력되어 있는가?
- [ ] Gemini API 키가 입력되어 있는가?
- [ ] Replicate API 키가 입력되어 있는가?

#### 2단계: 기능별 API 키 확인
- [ ] 사용하려는 기능에 필요한 API 키가 모두 입력되어 있는가?
  - TTS 사용 시: ElevenLabs/TTSMaker/Supertone 중 하나 이상
  - YouTube 트렌딩 사용 시: YouTube Data API Key
  - 이미지 생성 시: Replicate + OpenAI
  - 자막 동기화 시: OpenAI

#### 3단계: API 키 유효성 확인
- [ ] API 키가 올바른 형식인가? (공백, 특수문자 확인)
- [ ] API 키가 만료되지 않았는가?
- [ ] API 키에 충분한 크레딧/할당량이 있는가?

#### 4단계: 브라우저 확인
- [ ] 브라우저 개발자 도구(F12) → Console에서 에러 메시지 확인
- [ ] Network 탭에서 API 호출 실패 여부 확인
- [ ] LocalStorage에 API 키가 저장되어 있는지 확인
  ```javascript
  // 브라우저 콘솔에서 실행
  console.log(localStorage.getItem("openai_api_key"))
  console.log(localStorage.getItem("gemini_api_key"))
  console.log(localStorage.getItem("replicate_api_key"))
  ```

---

## 📝 API 키 발급 방법

### 1. OpenAI API 키
1. https://platform.openai.com 접속
2. 로그인 후 API Keys 메뉴 클릭
3. "Create new secret key" 클릭
4. 키 이름 입력 후 생성
5. **주의**: 키는 한 번만 표시되므로 복사해서 안전하게 보관

### 2. Gemini API 키
1. https://aistudio.google.com/app/apikey 접속
2. Google 계정으로 로그인
3. "Create API Key" 클릭
4. 프로젝트 선택 또는 새로 만들기
5. 생성된 키 복사

### 3. Replicate API 키
1. https://replicate.com 접속
2. 회원가입/로그인
3. Account Settings → API Tokens 메뉴
4. "Create token" 클릭
5. 토큰 이름 입력 후 생성

### 4. ElevenLabs API 키
1. https://elevenlabs.io 접속
2. 회원가입/로그인
3. Profile → API Key 메뉴
4. 기존 키 확인 또는 새로 생성

### 5. TTSMaker API 키
1. https://ttsmaker.com 접속
2. 회원가입/로그인
3. API 메뉴에서 키 확인

### 6. Supertone API 키
1. https://supertone.ai 접속
2. 회원가입/로그인
3. API 설정에서 키 확인

### 7. YouTube Data API 키
1. https://console.cloud.google.com 접속
2. 프로젝트 생성 또는 선택
3. "API 및 서비스" → "라이브러리" 메뉴
4. "YouTube Data API v3" 검색 후 활성화
5. "사용자 인증 정보" → "사용자 인증 정보 만들기" → "API 키"
6. 생성된 키 복사

---

## ⚠️ 에러 코드별 해결 방법

### OpenAI API 오류

#### `401 Unauthorized`
- **원인**: API 키가 잘못되었거나 만료됨
- **해결**: 
  1. 설정에서 API 키 재입력
  2. OpenAI 대시보드에서 키 유효성 확인
  3. 키에 충분한 크레딧이 있는지 확인

#### `429 Too Many Requests`
- **원인**: API 사용량 한도 초과
- **해결**: 
  1. 잠시 대기 후 재시도
  2. OpenAI 대시보드에서 사용량 확인
  3. 필요시 플랜 업그레이드

#### `500 Internal Server Error`
- **원인**: OpenAI 서버 문제
- **해결**: 
  1. 잠시 후 재시도
  2. OpenAI 상태 페이지 확인: https://status.openai.com

### Gemini API 오류

#### `400 Bad Request`
- **원인**: API 키가 잘못되었거나 요청 형식 오류
- **해결**: 
  1. API 키 재입력
  2. Gemini API 할당량 확인

#### `403 Forbidden`
- **원인**: API 키 권한 없음 또는 할당량 초과
- **해결**: 
  1. Google Cloud Console에서 API 활성화 확인
  2. 할당량 확인 및 증가 요청

### Replicate API 오류

#### `401 Unauthorized`
- **원인**: API 키가 잘못됨
- **해결**: 
  1. Replicate 대시보드에서 키 확인
  2. 키 재입력

#### `402 Payment Required`
- **원인**: 계정 크레딧 부족
- **해결**: 
  1. Replicate 계정에 크레딧 충전
  2. 결제 정보 확인

### TTS API 오류

#### ElevenLabs: `401 Unauthorized`
- **원인**: API 키 오류 또는 할당량 초과
- **해결**: 
  1. ElevenLabs 대시보드에서 키 확인
  2. 할당량 확인

#### TTSMaker: 연결 실패
- **원인**: API 키 오류 또는 서버 문제
- **해결**: 
  1. TTSMaker 웹사이트에서 서비스 상태 확인
  2. API 키 재입력

#### Supertone: `401 Unauthorized`
- **원인**: API 키 오류
- **해결**: 
  1. Supertone 대시보드에서 키 확인
  2. 키 재입력

### YouTube API 오류

#### `403 Forbidden`
- **원인**: API 키 오류 또는 할당량 초과
- **해결**: 
  1. Google Cloud Console에서 할당량 확인
  2. API 키 권한 확인

#### `401 Unauthorized` (OAuth)
- **원인**: YouTube 토큰 만료
- **해결**: 
  1. 설정에서 YouTube 재연결
  2. 토큰 갱신

---

## 💡 추가 팁

### API 키 백업
- 설정 페이지에서 "API 키를 메모장으로 저장" 기능 사용
- 정기적으로 API 키를 안전한 곳에 백업

### API 사용량 모니터링
- 각 API 제공업체의 대시보드에서 사용량 확인
- 예상치 못한 사용량 증가 시 확인 필요

### 문제 해결 순서
1. **API 키 입력 확인** → 가장 흔한 원인
2. **브라우저 콘솔 확인** → 구체적인 에러 메시지 확인
3. **API 제공업체 상태 확인** → 서버 문제인지 확인
4. **할당량/크레딧 확인** → 결제 문제인지 확인
5. **다른 브라우저/기기에서 테스트** → 브라우저 문제인지 확인

---

## 📞 지원 연락처

문제가 지속될 경우:
1. 브라우저 콘솔의 에러 메시지 스크린샷
2. 사용 중인 기능과 발생한 문제 설명
3. API 키 입력 여부 확인 결과

위 정보를 포함하여 문의해주세요.

