# Cloud Run 쿼터 증가 요청 가이드

## 문제 상황

8GB 메모리 + 4 CPU 설정으로 배포 시 다음 오류 발생:
- **CPU 쿼터 초과**: 요청 400 vCPU, 허용 200 vCPU
- **메모리 쿼터 초과**: 요청 800GB, 허용 400GB

## 쿼터 증가 요청 방법

### 방법 1: Google Cloud Console에서 요청 (권장)

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/

2. **IAM & Admin > Quotas 이동**
   - 왼쪽 메뉴에서 "IAM & Admin" 클릭
   - "Quotas" 클릭

3. **필터 설정**
   - "Filter" 검색창에 다음 중 하나 입력:
     - `CpuAllocPerProjectRegion` (CPU 쿼터)
     - `MemAllocPerProjectRegion` (메모리 쿼터)
   - "Service" 드롭다운에서 "Cloud Run API" 선택
   - "Location" 드롭다운에서 "asia-northeast1" 선택

4. **쿼터 선택 및 증가 요청**
   - 원하는 쿼터 체크박스 선택
   - 상단 "EDIT QUOTAS" 버튼 클릭
   - "New limit"에 원하는 값 입력:
     - **CPU**: 400 vCPU (현재 200 → 400)
     - **메모리**: 800GB (현재 400 → 800)
   - "Justification"에 다음 내용 입력:
     ```
     수강생 300명을 위한 영상 렌더링 서비스입니다.
     현재 쿼터로는 충분한 인스턴스를 배포할 수 없어
     서비스 확장이 불가능합니다.
     ```
   - "Submit Request" 클릭

5. **승인 대기**
   - 보통 24-48시간 내에 승인됩니다
   - 이메일로 승인/거부 알림을 받습니다

### 방법 2: gcloud CLI로 요청

```bash
# CPU 쿼터 증가 요청
gcloud alpha service-quota update \
  --service=run.googleapis.com \
  --consumer=projects/test-ai-450613 \
  --metric=run.googleapis.com/cpu \
  --value=400 \
  --location=asia-northeast1

# 메모리 쿼터 증가 요청
gcloud alpha service-quota update \
  --service=run.googleapis.com \
  --consumer=projects/test-ai-450613 \
  --metric=run.googleapis.com/memory \
  --value=800 \
  --location=asia-northeast1
```

**참고**: `gcloud alpha` 명령어는 실험적 기능이므로 Console 사용을 권장합니다.

## 현재 쿼터 확인

```bash
# 현재 CPU 쿼터 확인
gcloud compute project-info describe \
  --project test-ai-450613 \
  --format="value(quotas[metric='CPUS_ALL_REGIONS'].limit)"

# 현재 메모리 쿼터 확인
gcloud compute project-info describe \
  --project test-ai-450613 \
  --format="value(quotas[metric='INSTANCES'].limit)"
```

## 쿼터 증가 후 배포

쿼터가 증가되면 다음 명령어로 배포:

```bash
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
  --max-instances 30 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
```

## 임시 해결책 (쿼터 증가 전)

쿼터 증가가 승인되기 전까지는 다음 설정으로 배포:

```bash
# 리소스 줄이기 (4GB + 2 CPU)
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
  --max-instances 30 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
```

이 설정으로는:
- 최대 동시 처리: 30개 요청
- 메모리: 각 요청당 4GB 사용 가능
- CPU: 각 요청당 2코어 사용 가능

## 비용 고려사항

쿼터 증가 후 8GB + 4 CPU 설정 사용 시:
- **최소 인스턴스 1개**: 약 $80-120/월
- **최대 인스턴스 30개**: 피크 시 약 $2400-3600/월
- **실제 사용량**: 트래픽에 따라 달라짐

## 참고 링크

- [Cloud Run 쿼터 문서](https://cloud.google.com/run/quotas)
- [쿼터 증가 요청 가이드](https://cloud.google.com/service-usage/docs/manage-quota)

