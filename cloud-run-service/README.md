# Cloud Run 서비스 배포 가이드

## 1. Google Cloud SDK 설치 확인

```bash
gcloud --version
```

설치되어 있지 않다면: https://cloud.google.com/sdk/docs/install

## 2. 프로젝트 설정

```bash
# 프로젝트 설정
gcloud config set project test-ai-450613

# 리전 설정
gcloud config set run/region asia-northeast1
```

## 3. Docker 이미지 빌드 및 배포

```bash
# Docker 이미지 빌드
docker build -t gcr.io/test-ai-450613/video-renderer:latest .

# Google Container Registry에 푸시
docker push gcr.io/test-ai-450613/video-renderer:latest

# Cloud Run에 배포
gcloud run deploy my-project \
  --image gcr.io/test-ai-450613/video-renderer:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

## 4. 또는 간단하게 (소스에서 직접 배포)

```bash
# 현재 디렉토리에서 직접 배포
# 타임아웃 3600초(60분), 메모리 4GB, CPU 2코어 설정
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --memory 4Gi \
  --cpu 2 \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
```

**중요**: 긴 영상(15분 이상)을 렌더링하려면 타임아웃을 3600초(60분)로 설정해야 합니다.
- Vercel API Route는 최대 800초(약 13분)까지만 지원합니다.
- 15분 이상의 영상은 Cloud Run에 직접 요청하도록 프론트엔드가 자동으로 전환합니다.

## 5. 프론트엔드 환경 변수 설정

긴 영상(15분 이상)을 렌더링하려면 프론트엔드에 Cloud Run URL을 설정해야 합니다:

**로컬 개발 (.env.local)**:
```
NEXT_PUBLIC_CLOUD_RUN_RENDER_URL=https://my-project-350911437561.asia-northeast1.run.app
```

**Vercel 배포**:
Vercel 대시보드 > Settings > Environment Variables에서 추가:
- Key: `NEXT_PUBLIC_CLOUD_RUN_RENDER_URL`
- Value: Cloud Run 서비스 URL (예: `https://my-project-350911437561.asia-northeast1.run.app`)

**설정하지 않은 경우**:
- 15분 미만의 영상: Vercel API Route를 통해 자동으로 처리됩니다.
- 15분 이상의 영상: Vercel API Route를 사용하지만 타임아웃(800초)이 발생할 수 있습니다.

## 6. 테스트

배포 후 다음 URL로 테스트:
- GET: https://my-project-350911437561.asia-northeast1.run.app/
- POST: https://my-project-350911437561.asia-northeast1.run.app/render

## 7. 타임아웃 설정

- **Cloud Run 타임아웃**: 최대 3600초(60분)까지 설정 가능
- **Vercel API Route 타임아웃**: 최대 800초(약 13분) - Pro 플랜 제한
- **권장 설정**: 긴 영상(15분 이상)은 Cloud Run에 직접 요청하도록 프론트엔드가 자동으로 전환합니다.





