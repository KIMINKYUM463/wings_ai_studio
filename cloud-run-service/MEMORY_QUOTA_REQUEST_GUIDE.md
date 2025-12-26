# 메모리 쿼터 증가 요청 가이드

## 단계별 가이드

### 1. Google Cloud Console 접속
- https://console.cloud.google.com/
- 프로젝트: `test-ai-450613` 선택

### 2. IAM & Admin > Quotas 이동
- 왼쪽 메뉴: "IAM & Admin" 클릭
- "Quotas" 클릭

### 3. 메모리 쿼터 검색 및 선택
- **필터 검색창에 입력**: 
  - `MemAllocPerProjectRegion` 
  - 또는 `Total memory allocation`
  - 또는 `메모리 할당`
  
- **Service 필터**: "Cloud Run Admin API" 선택
- **Location 필터**: "asia-northeast1" 선택

### 4. 쿼터 선택
- 검색 결과에서 다음 항목 찾기:
  - **이름**: "Total memory allocation, in bytes, per project per region"
  - **현재 값**: `429,496,729,600` bytes (약 400GB)
  - **조정 가능 여부**: "예" (Yes)

- 해당 행의 **체크박스 선택**

### 5. 쿼터 수정
- 상단 "EDIT QUOTAS" (할당량 수정) 버튼 클릭
- 또는 선택한 쿼터 행에서 "할당량 수정" 아이콘 클릭

### 6. 새 값 입력
- **"새 값" (New value)** 입력란에 다음 값 입력:
  ```
  858993459200
  ```
  - 이는 800GB를 bytes로 변환한 값입니다
  - 현재 값(400GB)의 2배입니다

### 7. Justification (사유) 입력
다음 내용을 입력하세요:

```
수강생 300명을 위한 영상 렌더링 서비스입니다.

현재 설정:
- 인스턴스당 리소스: 8GB 메모리 + 4 CPU
- 최대 인스턴스 수: 30개
- 인스턴스당 동시 실행: 1개 (concurrency: 1)

필요한 이유:
1. 동시 렌더링 요청 처리: 최대 30명의 수강생이 동시에
   영상을 생성할 수 있어야 합니다
2. 렌더링 작업 특성: 각 작업은 5-60분 소요되며,
   고해상도 이미지(1920x1080) 및 오디오 처리를 위해
   인스턴스당 8GB 메모리가 필요합니다
3. 서비스 안정성: 쿼터 한계에 도달하면 새로운 요청이
   429 오류로 거부되어 사용자 경험이 저하됩니다
4. 확장성: 향후 수강생 수가 증가할 경우를 대비하여
   충분한 여유를 확보해야 합니다

현재 쿼터(400GB)로는:
- 최대 50개 인스턴스(8GB)까지 가능하지만,
- 다른 서비스도 리소스를 사용하므로
- 실제로는 30개 인스턴스 정도가 안전한 한계입니다

따라서 메모리 쿼터를 800GB로 증가시켜
안정적인 서비스 운영을 보장하고자 합니다.
```

### 8. 요청 제출
- "완료" (Done) 버튼 클릭
- 하단 "요청 제출" (Submit Request) 버튼 클릭

### 9. 승인 대기
- 보통 24-48시간 내에 승인됩니다
- 이메일로 승인/거부 알림을 받습니다
- Google Cloud Console의 Quotas 페이지에서 상태 확인 가능

## 참고 사항

### 메모리 값 계산
- 현재 값: 429,496,729,600 bytes = 400GB
- 요청 값: 858,993,459,200 bytes = 800GB
- 계산: 400GB × 2 = 800GB

### CPU와 메모리 쿼터는 별도로 요청
- CPU 쿼터 증가 요청과 메모리 쿼터 증가 요청은 **별도로** 진행해야 합니다
- 각각 "EDIT QUOTAS" 버튼을 클릭하여 개별적으로 요청하세요

### 요청 순서
1. CPU 쿼터 증가 요청 먼저 진행
2. 메모리 쿼터 증가 요청 진행
3. 또는 동시에 진행 가능 (각각 별도 요청)

## 승인 후 확인

승인되면 다음 명령어로 배포:

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

