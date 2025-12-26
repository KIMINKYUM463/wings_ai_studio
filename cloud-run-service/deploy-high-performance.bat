@echo off
REM Cloud Run 서비스 배포 스크립트 (Windows, 고성능 버전 - 16GB 메모리, 8 CPU)

echo === Cloud Run 서비스 배포 시작 (고성능 설정) ===
echo ⚠️  주의: 이 설정은 쿼터 한계 근처에서 작동합니다.
echo    최대 인스턴스 20개로 제한하여 쿼터 내에서 안전하게 사용합니다.

REM 프로젝트 설정
gcloud config set project test-ai-450613

REM 리전 설정
gcloud config set run/region asia-northeast1

REM 소스에서 직접 배포 (고성능 설정)
echo 배포 중... (16GB 메모리, 8 CPU, 최대 인스턴스 20개)
gcloud run deploy my-project ^
  --source . ^
  --platform managed ^
  --region asia-northeast1 ^
  --allow-unauthenticated ^
  --port 8080 ^
  --timeout 3600 ^
  --memory 16Gi ^
  --cpu 8 ^
  --min-instances 1 ^
  --max-instances 20 ^
  --concurrency 1 ^
  --cpu-throttling ^
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage

echo.
echo === 배포 완료 ===
echo 서비스 URL: https://my-project-gs3pokkvsa-an.a.run.app
echo.
echo 고성능 설정:
echo   - 최소 인스턴스: 1개 (항상 실행 중, 콜드 스타트 방지)
echo   - 최대 인스턴스: 20개 (쿼터 내에서 안전하게 설정)
echo   - 동시 요청 수: 1개/인스턴스 (렌더링 작업 특성상 단일 요청 처리)
echo   - CPU 스로틀링: 활성화 (비용 최적화)
echo   - 타임아웃: 3600초 (60분)
echo   - 메모리: 16GB
echo   - CPU: 8코어
echo.
echo ⚠️  주의:
echo    - 최소 인스턴스 1개 유지로 인해 항상 비용이 발생합니다.
echo    - 예상 비용: 약 $120-200/월 (리전, 사용량에 따라 다름)
echo    - 쿼터 사용량: CPU 160 vCPU / 200 vCPU, 메모리 320GB / 400GB

pause

