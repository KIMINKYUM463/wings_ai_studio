# Cloud Storage 버킷 생성 가이드

Cloud Storage 버킷을 생성하는 방법을 안내합니다.

## 방법 1: Google Cloud Console 사용 (GUI)

### 1단계: Cloud Storage 페이지 접속
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (상단에서 프로젝트 선택)
3. 왼쪽 메뉴에서 **"Cloud Storage"** > **"버킷"** 클릭
   - 또는 검색창에 "Cloud Storage" 입력

### 2단계: 버킷 생성
1. **"버킷 만들기"** 버튼 클릭

### 3단계: 버킷 설정
1. **버킷 이름 입력**
   - 예: `video-renderer-storage`
   - 전역적으로 고유한 이름이어야 함
   - 소문자, 숫자, 하이픈(-)만 사용 가능

2. **위치 선택**
   - **위치 유형**: "리전" 선택
   - **리전**: `asia-northeast3` (서울) 또는 원하는 리전 선택
   - **참고**: Cloud Run 서비스와 같은 리전 선택 권장

3. **스토리지 클래스 선택**
   - **Standard**: 자주 액세스하는 데이터 (권장)
   - **Nearline**: 월 1회 미만 액세스
   - **Coldline**: 분기별 액세스
   - **Archive**: 연 1회 미만 액세스

4. **액세스 제어**
   - **"공개 액세스 방지"**: 체크 해제 (공개 버킷으로 설정)
   - 또는 나중에 개별 파일만 공개 설정 가능

5. **고급 설정** (선택사항)
   - **라이프사이클**: 자동 삭제 규칙 설정 가능
   - **암호화**: 기본값 사용 권장

### 4단계: 생성 완료
1. **"만들기"** 버튼 클릭
2. 버킷이 생성되면 목록에 표시됨

---

## 방법 2: gcloud CLI 사용 (명령줄)

### 사전 준비
1. [Google Cloud SDK 설치](https://cloud.google.com/sdk/docs/install)
2. 인증 설정:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

### 버킷 생성 명령어
```bash
# 기본 버킷 생성
gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l asia-northeast3 gs://your-bucket-name

# 예시
gsutil mb -p my-video-project -c STANDARD -l asia-northeast3 gs://video-renderer-storage
```

### 옵션 설명
- `-p YOUR_PROJECT_ID`: 프로젝트 ID 지정
- `-c STANDARD`: 스토리지 클래스 (STANDARD, NEARLINE, COLDLINE, ARCHIVE)
- `-l asia-northeast3`: 리전 (서울)
- `gs://your-bucket-name`: 버킷 이름 (전역적으로 고유해야 함)

### 버킷을 공개로 설정 (선택사항)
```bash
# 버킷 전체를 공개로 설정
gsutil iam ch allUsers:objectViewer gs://your-bucket-name

# 또는 개별 파일만 공개 설정 (권장)
# 코드에서 blob.make_public() 사용
```

---

## 방법 3: Python 스크립트 사용

```python
from google.cloud import storage

# 클라이언트 생성
storage_client = storage.Client(project='YOUR_PROJECT_ID')

# 버킷 생성
bucket_name = 'your-bucket-name'
bucket = storage_client.create_bucket(
    bucket_name,
    location='asia-northeast3',
    storage_class='STANDARD'
)

print(f'Bucket {bucket_name} created.')
```

---

## 버킷 이름 규칙

- 전역적으로 고유해야 함
- 3-63자 길이
- 소문자, 숫자, 하이픈(-)만 사용 가능
- 하이픈으로 시작하거나 끝날 수 없음
- IP 주소 형식 불가 (예: 192.168.1.1)

**좋은 예:**
- `video-renderer-storage`
- `my-video-bucket-2024`
- `video-storage-asia`

**나쁜 예:**
- `Video_Renderer` (대문자 사용)
- `my bucket` (공백 사용)
- `192.168.1.1` (IP 주소 형식)

---

## 리전 선택 가이드

### 권장 리전 (한국 사용자)
- **asia-northeast3** (서울) - 가장 빠름
- **asia-northeast1** (도쿄) - 빠름
- **asia-northeast2** (오사카) - 빠름

### 기타 리전
- **us-central1** (아이오와) - 미국 중부
- **europe-west1** (벨기에) - 유럽

**참고**: Cloud Run 서비스와 같은 리전을 선택하면 데이터 전송 비용이 절감됩니다.

---

## 생성 확인

### Google Cloud Console에서 확인
1. Cloud Storage > 버킷 메뉴에서 생성된 버킷 확인

### gcloud CLI로 확인
```bash
gsutil ls
```

### Python으로 확인
```python
from google.cloud import storage

storage_client = storage.Client()
buckets = list(storage_client.list_buckets())
for bucket in buckets:
    print(bucket.name)
```

---

## 다음 단계

버킷 생성 후:

1. **환경 변수 설정** (`.env.local`):
   ```env
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
   ```

2. **서비스 계정 권한 설정**:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:video-renderer-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   ```

3. **테스트**:
   - 개발 서버 재시작
   - 영상 렌더링 시도 (30MB 이상 오디오)

---

## 문제 해결

### "버킷 이름이 이미 사용 중입니다" 오류
- 다른 이름 사용 (전역적으로 고유해야 함)
- 다른 프로젝트에서 이미 사용 중일 수 있음

### "권한이 없습니다" 오류
- 프로젝트에 Cloud Storage API가 활성화되어 있는지 확인
- 적절한 권한이 있는지 확인

### API 활성화
```bash
gcloud services enable storage-api.googleapis.com
```





