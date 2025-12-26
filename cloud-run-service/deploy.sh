#!/bin/bash

# Cloud Run 서비스 배포 스크립트 (균형잡힌 설정 - 수강생 300명 대응)

echo "=== Cloud Run 서비스 배포 시작 (균형잡힌 설정) ==="
echo "수강생 300명 대응 최적화 설정"

# 프로젝트 설정
gcloud config set project test-ai-450613

# 리전 설정
gcloud config set run/region asia-northeast1

# 소스에서 직접 배포 (균형잡힌 설정)
echo "배포 중... (8GB 메모리, 4 CPU, 최대 인스턴스 20개)"
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --memory 8Gi \
  --cpu 4 \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage

echo ""
echo "=== 배포 완료 ==="
echo "서비스 URL: https://my-project-gs3pokkvsa-an.a.run.app"
echo ""
echo "균형잡힌 설정 (수강생 300명 대응):"
echo "  - 최소 인스턴스: 1개 (항상 실행 중, 콜드 스타트 방지)"
echo "  - 최대 인스턴스: 20개 (트래픽 증가 시 자동 확장)"
echo "  - 동시 요청 수: 1개/인스턴스 (렌더링 작업 특성상 단일 요청 처리)"
echo "  - 최대 동시 처리: 20개 요청 (20개 인스턴스)"
echo "  - CPU 스로틀링: 활성화 (비용 최적화)"
echo "  - 타임아웃: 3600초 (60분)"
echo "  - 메모리: 8GB (인스턴스당)"
echo "  - CPU: 4코어 (인스턴스당)"
echo ""
echo "⚠️  주의:"
echo "   - 최소 인스턴스 1개 유지로 인해 항상 비용이 발생합니다."
echo "   - 예상 비용: 약 $80-120/월 (리전, 사용량에 따라 다름)"
echo "   - 쿼터 사용량: CPU 80 vCPU / 200 vCPU, 메모리 160GB / 400GB"





