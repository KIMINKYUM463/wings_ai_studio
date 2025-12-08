# Cloud Storage 설정 가이드

Cloud Storage를 사용하여 큰 오디오 파일(30MB 이상)을 처리할 수 있습니다.

## 1. Google Cloud 프로젝트 설정

1. Google Cloud Console에서 프로젝트 생성 또는 선택
2. Cloud Storage API 활성화
3. Cloud Storage 버킷 생성

## 2. 서비스 계정 생성 및 권한 설정

1. **서비스 계정 생성:**
   ```bash
   gcloud iam service-accounts create video-renderer-sa \
     --display-name="Video Renderer Service Account"
   ```

2. **서비스 계정에 권한 부여:**
   ```bash
   # Storage Object Admin 권한 (읽기/쓰기)
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:video-renderer-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   ```

3. **서비스 계정 키 생성:**
   ```bash
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=video-renderer-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

## 3. 환경 변수 설정

### 로컬 개발 (.env.local)

```env
# Google Cloud 프로젝트 설정
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# 서비스 계정 키 파일 경로 (로컬 개발용)
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### Vercel 배포 (환경 변수)

1. Vercel 대시보드 > Settings > Environment Variables
2. 다음 변수 추가:
   - `GOOGLE_CLOUD_PROJECT_ID`: 프로젝트 ID
   - `GOOGLE_CLOUD_STORAGE_BUCKET`: 버킷 이름
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: 서비스 계정 키 JSON 전체 내용 (한 줄로)

### Cloud Run 서비스 (환경 변수)

Cloud Run 서비스 배포 시 다음 환경 변수 설정:

```bash
gcloud run services update video-renderer \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=your-project-id,GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name" \
  --region=asia-northeast3
```

또는 Cloud Run이 자동으로 인증을 처리하도록 설정 (권장):
- Cloud Run 서비스에 서비스 계정 연결:
  ```bash
  gcloud run services update video-renderer \
    --service-account=video-renderer-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
    --region=asia-northeast3
  ```

## 4. 버킷 생성

```bash
# 버킷 생성
gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l asia-northeast3 gs://your-bucket-name

# 버킷을 공개로 설정 (선택사항 - signed URL 사용 시 불필요)
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

## 5. 동작 방식

### 클라이언트 (Next.js)
1. 오디오 파일이 30MB 이상이면 자동으로 Cloud Storage에 업로드
2. Cloud Storage URL을 Cloud Run에 전송

### Cloud Run 서비스
1. `audioGcsUrl`이 있으면 Cloud Storage에서 다운로드
2. 렌더링 완료 후 영상이 10MB 이상이면 Cloud Storage에 업로드
3. Cloud Storage URL 반환

## 6. 비용 고려사항

- **Storage**: 저장된 데이터 양에 따라 (월 $0.020/GB)
- **Network Egress**: 다운로드 트래픽에 따라 (월 $0.12/GB)
- **Operations**: 읽기/쓰기 작업에 따라 (월 $0.05/10,000 operations)

예상 비용 (월 100개 영상, 평균 50MB):
- Storage: 약 $0.10
- Network: 약 $0.60
- Operations: 약 $0.01
- **총 약 $0.71/월**

## 7. 문제 해결

### 인증 오류
- 서비스 계정 키가 올바른지 확인
- 서비스 계정에 Storage 권한이 있는지 확인

### 업로드 실패
- 버킷 이름이 올바른지 확인
- 버킷이 존재하는지 확인
- 네트워크 연결 확인

### 다운로드 실패
- Cloud Run 서비스에 서비스 계정이 연결되어 있는지 확인
- Cloud Run 서비스에 Storage 권한이 있는지 확인





