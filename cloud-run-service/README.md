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

## 8. 안정성 최적화 설정 (권장)

Cloud Run의 안정성을 높이기 위해 다음 설정을 추가했습니다:

### 주요 개선 사항

1. **최소 인스턴스 수 (min-instances: 1)**
   - 항상 최소 1개의 인스턴스를 유지하여 콜드 스타트 방지
   - 첫 요청 시 지연 시간 제거
   - ⚠️ **비용 발생**: 항상 실행 중이므로 월 약 $30-50 비용 발생

2. **최대 인스턴스 수 (max-instances: 10)**
   - 트래픽 증가 시 자동으로 최대 10개까지 확장
   - 동시 렌더링 작업 처리 가능

3. **동시 요청 수 (concurrency: 1)**
   - 각 인스턴스당 1개의 요청만 처리
   - 렌더링 작업 특성상 리소스 집약적이므로 단일 요청 처리 권장
   - 메모리 부족 방지

4. **CPU 스로틀링 (cpu-throttling)**
   - 요청이 없을 때 CPU 사용량 감소로 비용 절감
   - 최소 인스턴스 유지 시에도 비용 최적화

### 배포 명령어 (안정성 최적화)

```bash
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
```

### 비용 최적화 옵션

최소 인스턴스 없이 사용하려면 (콜드 스타트 발생 가능):

```bash
# min-instances 옵션 제거
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --memory 4Gi \
  --cpu 2 \
  --max-instances 10 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
```

### 헬스 체크

서비스 상태 확인:
- GET `https://your-service.run.app/health`
- GET `https://your-service.run.app/` (루트 경로)

응답 예시:
```json
{
  "status": "healthy",
  "service": "video-renderer",
  "timestamp": "2025-12-26T12:00:00",
  "version": "1.0.0"
}
```

### 모니터링

Google Cloud Console에서 다음을 모니터링할 수 있습니다:
- 인스턴스 수 (최소/최대)
- 요청 수 및 응답 시간
- 오류율
- CPU/메모리 사용량
- 비용

### 예상 비용 (최소 인스턴스 1개 유지 시)

- **인스턴스 유지 비용**: 약 $20-30/월 (리전, CPU/메모리 설정에 따라 다름)
- **요청 처리 비용**: 요청 수에 따라 추가 비용 발생
- **총 예상 비용**: 약 $30-50/월 (사용량에 따라 다름)

⚠️ **주의**: 최소 인스턴스를 설정하면 항상 비용이 발생합니다. 사용량이 적다면 최소 인스턴스를 제거하는 것을 고려하세요.





