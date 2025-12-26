#!/bin/bash

# Cloud Run 서비스 배포 스크립트 (안정성 최적화 버전)

echo "=== Cloud Run 서비스 배포 시작 (안정성 최적화) ==="

# 프로젝트 설정
gcloud config set project test-ai-450613

# 리전 설정
gcloud config set run/region asia-northeast1

# 소스에서 직접 배포 (안정성 최적화 설정)
echo "배포 중... (최소 인스턴스 1개 유지, 콜드 스타트 방지)"
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage

echo ""
echo "=== 배포 완료 ==="
echo "서비스 URL: https://my-project-350911437561.asia-northeast1.run.app"
echo ""
echo "안정성 설정:"
echo "  - 최소 인스턴스: 1개 (항상 실행 중, 콜드 스타트 방지)"
echo "  - 최대 인스턴스: 10개 (트래픽 증가 시 자동 확장)"
echo "  - 동시 요청 수: 1개/인스턴스 (렌더링 작업 특성상 단일 요청 처리)"
echo "  - CPU 스로틀링: 활성화 (비용 최적화)"
echo "  - 타임아웃: 3600초 (60분)"
echo "  - 메모리: 4GB"
echo "  - CPU: 2코어"
echo ""
echo "⚠️  주의: 최소 인스턴스 1개 유지로 인해 항상 비용이 발생합니다."
echo "   예상 비용: 약 $30-50/월 (리전, 사용량에 따라 다름)"





