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
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

## 5. 테스트

배포 후 다음 URL로 테스트:
- GET: https://my-project-350911437561.asia-northeast1.run.app/
- POST: https://my-project-350911437561.asia-northeast1.run.app/render





