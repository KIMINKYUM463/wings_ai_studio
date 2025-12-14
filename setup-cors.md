# Google Cloud Storage CORS 설정 가이드

## 문제
클라이언트에서 직접 Cloud Storage에 업로드할 때 CORS 오류가 발생합니다.

## 해결 방법

### 방법 1: gsutil 명령어 사용 (권장)

1. **CORS 설정 파일 생성**
   - 프로젝트에 `cors-config.json` 파일이 생성되어 있습니다.

2. **CORS 설정 적용**
   ```bash
   gsutil cors set cors-config.json gs://video-renderer-storage
   ```

3. **설정 확인**
   ```bash
   gsutil cors get gs://video-renderer-storage
   ```

### 방법 2: Google Cloud Console 사용

1. Google Cloud Console 접속: https://console.cloud.google.com
2. 프로젝트 선택: `test-ai-450613`
3. Cloud Storage > 버킷 메뉴
4. `video-renderer-storage` 버킷 선택
5. **구성** 탭 클릭
6. **CORS 구성** 섹션에서 **CORS 구성 편집** 클릭
7. 다음 JSON 내용 붙여넣기:

```json
[
  {
    "origin": ["https://wingsaistudio.com", "https://www.wingsaistudio.com", "http://localhost:3000"],
    "method": ["GET", "PUT", "POST", "HEAD", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

8. **저장** 클릭

## 설정 확인

설정이 제대로 적용되었는지 확인하려면:

```bash
gsutil cors get gs://video-renderer-storage
```

다음과 같은 내용이 표시되어야 합니다:
```json
[
  {
    "maxAgeSeconds": 3600,
    "method": ["GET", "PUT", "POST", "HEAD", "DELETE"],
    "origin": ["https://wingsaistudio.com", "https://www.wingsaistudio.com", "http://localhost:3000"],
    "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"]
  }
]
```

## 참고

- `origin`: 업로드를 허용할 도메인 목록
- `method`: 허용할 HTTP 메서드 (PUT이 필수)
- `responseHeader`: 응답에 포함할 헤더
- `maxAgeSeconds`: preflight 요청 캐시 시간

