@echo off
REM Cloud Run 서비스 배포 스크립트 (Windows)

echo === Cloud Run 서비스 배포 시작 ===

REM 프로젝트 설정
gcloud config set project test-ai-450613

REM 리전 설정
gcloud config set run/region asia-northeast1

REM 소스에서 직접 배포
echo 배포 중...
gcloud run deploy my-project ^
  --source . ^
  --platform managed ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --port 8080 ^
  --timeout 900 ^
  --memory 4Gi ^
  --cpu 2 ^
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage

echo === 배포 완료 ===
echo 서비스 URL: https://my-project-350911437561.asia-northeast1.run.app

pause

