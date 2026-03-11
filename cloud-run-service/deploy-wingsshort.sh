#!/bin/bash
# wingsshort(쇼핑 숏폼) Cloud Run 배포
# 이 레포의 cloud-run-service 폴더에서 실행 (POST /render 에 쇼핑 파이프라인 포함됨)

set -e
echo "=== wingsshort (쇼핑 숏폼) Cloud Run 배포 ==="

# 숏폼용 GCP 프로젝트 ID (wingsshort 서비스가 있는 프로젝트)
PROJECT_ID="${SHOPPING_GCP_PROJECT_ID:-}"
if [ -z "$PROJECT_ID" ]; then
  echo "환경 변수 SHOPPING_GCP_PROJECT_ID 를 설정하거나 아래에 프로젝트 ID를 입력하세요."
  echo "예: export SHOPPING_GCP_PROJECT_ID=your-shortform-project-id"
  read -p "GCP 프로젝트 ID: " PROJECT_ID
fi
if [ -z "$PROJECT_ID" ]; then
  echo "프로젝트 ID가 없어 종료합니다."
  exit 1
fi

# 리전 (wingsshort 서비스를 만든 리전과 동일하게)
REGION="${CLOUD_RUN_REGION:-asia-northeast3}"

gcloud config set project "$PROJECT_ID"

# 현재 디렉토리가 cloud-run-service 인지 확인
if [ ! -f "app.py" ] || [ ! -f "Dockerfile" ]; then
  echo "오류: app.py, Dockerfile 이 있는 디렉토리(cloud-run-service)에서 실행하세요."
  exit 1
fi

echo "배포 중: 프로젝트=$PROJECT_ID, 리전=$REGION, 서비스=wingsshort"
gcloud run deploy wingsshort \
  --source . \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 600 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 1

echo ""
echo "=== 배포 완료 ==="
echo "서비스 URL은 콘솔에서 확인하거나: gcloud run services describe wingsshort --region=$REGION --format='value(status.url)'"
echo "이 URL을 Vercel 환경 변수 SHOPPING_CLOUD_RUN_RENDER_URL 에 넣으세요 (끝 / 제외)."
echo "예: https://wingsshort-xxxxx.asia-northeast3.run.app"
echo ""
echo "숏폼 GCS 사용 시 Cloud Run 서비스에 환경 변수 설정:"
echo "  SHOPPING_GOOGLE_CLOUD_PROJECT_ID, SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET"
echo "  (콘솔: Cloud Run → wingsshort → 수정 → 변수 및 시크릿)"
echo "  또는: gcloud run services update wingsshort --region=$REGION --set-env-vars SHOPPING_GOOGLE_CLOUD_PROJECT_ID=...,SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET=..."
echo ""
