# Cloud Run 서버 문제 진단 및 해결 가이드

## 🔍 1단계: 문제 진단

### 방법 1: 브라우저에서 직접 확인

브라우저 주소창에 다음 URL을 입력하세요:
```
https://my-project-350911437561.asia-northeast1.run.app/health
```

**정상 응답 예시:**
```json
{
  "status": "healthy",
  "service": "video-renderer",
  "timestamp": "2025-12-26T18:35:33",
  "version": "1.0.0"
}
```

**문제가 있는 경우:**
- ❌ 응답이 없음 (타임아웃)
- ❌ 404 오류 (서비스가 없음)
- ❌ 500 오류 (서버 내부 오류)
- ❌ 연결 거부 (서비스가 다운됨)

### 방법 2: Google Cloud Console에서 확인

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 선택: `test-ai-450613`
3. **Cloud Run** 메뉴로 이동
4. 서비스 목록에서 `my-project` 확인

**확인 사항:**
- ✅ 서비스 상태가 "Running"인지
- ✅ 최근 요청이 있는지
- ✅ 오류 로그가 있는지
- ✅ 인스턴스 수 (최소 1개가 실행 중인지)

### 방법 3: gcloud CLI로 확인

```bash
# 서비스 상태 확인
gcloud run services describe my-project \
  --region asia-northeast1 \
  --project test-ai-450613

# 로그 확인
gcloud run services logs read my-project \
  --region asia-northeast1 \
  --project test-ai-450613 \
  --limit 50
```

## 🛠️ 2단계: 문제별 해결 방법

### 문제 1: 서비스가 아예 없거나 삭제됨

**증상:**
- 404 오류
- Google Cloud Console에 서비스가 없음

**해결 방법:**
서비스를 다시 배포하세요:

```bash
cd cloud-run-service

# Linux/Mac
./deploy.sh

# Windows
deploy.bat
```

### 문제 2: 서비스는 있지만 응답이 없음 (콜드 스타트)

**증상:**
- 첫 요청 시 10-30초 지연
- 타임아웃 오류
- "Failed to fetch" 오류

**원인:**
- 최소 인스턴스가 설정되지 않아서 인스턴스가 종료됨
- 첫 요청 시 인스턴스를 새로 시작해야 함

**해결 방법:**
최소 인스턴스 1개를 유지하도록 재배포:

```bash
cd cloud-run-service

# 배포 스크립트 실행 (이미 최소 인스턴스 설정 포함)
./deploy.sh  # Linux/Mac
# 또는
deploy.bat   # Windows
```

이 스크립트는 자동으로 다음 설정을 적용합니다:
- `--min-instances 1` (항상 1개 인스턴스 유지)
- `--max-instances 10` (트래픽 증가 시 확장)
- `--concurrency 1` (안정적인 처리)

### 문제 3: 서비스는 실행 중이지만 오류 발생

**증상:**
- 500 오류
- 렌더링 실패
- 로그에 Python 오류 메시지

**해결 방법:**

1. **로그 확인:**
```bash
gcloud run services logs read my-project \
  --region asia-northeast1 \
  --project test-ai-450613 \
  --limit 100
```

2. **코드 수정 후 재배포:**
   - `app.py` 파일 수정
   - 배포 스크립트 실행

### 문제 4: CORS 오류

**증상:**
- 브라우저 콘솔에 CORS 오류
- "Access-Control-Allow-Origin" 오류

**해결 방법:**

`app.py`의 `allowed_origins` 리스트에 도메인 추가:

```python
allowed_origins = [
    'https://wingsaistudio.com', 
    'http://localhost:3000',
    'https://your-domain.com'  # 추가
]
```

수정 후 재배포:
```bash
./deploy.sh  # 또는 deploy.bat
```

### 문제 5: 메모리 부족 또는 타임아웃

**증상:**
- 렌더링 중 오류
- 메모리 부족 오류
- 타임아웃 오류

**해결 방법:**

리소스를 늘려서 재배포:

```bash
gcloud run deploy my-project \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --memory 8Gi \        # 4Gi → 8Gi로 증가
  --cpu 4 \             # 2 → 4로 증가
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 1 \
  --cpu-throttling \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=test-ai-450613,GOOGLE_CLOUD_STORAGE_BUCKET=video-renderer-storage
```

## 📋 3단계: 일반적인 재배포 절차

### 전체 재배포 (권장)

```bash
# 1. 프로젝트 디렉토리로 이동
cd cloud-run-service

# 2. 배포 스크립트 실행
# Linux/Mac:
chmod +x deploy.sh
./deploy.sh

# Windows:
deploy.bat
```

### 수동 배포 (세부 설정 필요 시)

```bash
# Google Cloud SDK 로그인 확인
gcloud auth list

# 프로젝트 설정
gcloud config set project test-ai-450613
gcloud config set run/region asia-northeast1

# 배포 (안정성 최적화 설정 포함)
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

## 🔧 4단계: 설정 확인 및 수정

### 현재 설정 확인

```bash
gcloud run services describe my-project \
  --region asia-northeast1 \
  --project test-ai-450613 \
  --format="value(spec.template.spec.containers[0].resources.limits)"
```

### 최소 인스턴스 확인

```bash
gcloud run services describe my-project \
  --region asia-northeast1 \
  --project test-ai-450613 \
  --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/minScale')"
```

**예상 결과:** `1` (최소 인스턴스 1개)

### 최소 인스턴스가 0이거나 없으면

다시 배포하세요:
```bash
./deploy.sh  # 또는 deploy.bat
```

## 🚨 5단계: 긴급 복구

### 서비스가 완전히 다운된 경우

1. **Google Cloud Console에서 확인:**
   - Cloud Run > Services > my-project
   - 상태 확인

2. **즉시 재배포:**
```bash
cd cloud-run-service
./deploy.sh  # 또는 deploy.bat
```

3. **배포 완료 후 확인:**
```bash
# 헬스 체크
curl https://my-project-350911437561.asia-northeast1.run.app/health
```

## 📊 6단계: 모니터링 설정

### Google Cloud Console에서 모니터링

1. **Cloud Run 서비스 페이지:**
   - Metrics 탭: 요청 수, 오류율, 응답 시간
   - Logs 탭: 실시간 로그 확인
   - Revisions 탭: 배포 버전 확인

2. **알림 설정:**
   - Cloud Monitoring > Alerting Policies
   - 오류율이 높을 때 알림 받기
   - 인스턴스가 다운될 때 알림 받기

## ✅ 체크리스트

문제 해결 전 확인 사항:

- [ ] Google Cloud SDK가 설치되어 있고 로그인되어 있는가?
- [ ] 프로젝트 ID가 올바른가? (`test-ai-450613`)
- [ ] 리전이 올바른가? (`asia-northeast1`)
- [ ] 서비스 이름이 올바른가? (`my-project`)
- [ ] 환경 변수가 올바르게 설정되어 있는가?
- [ ] 배포 스크립트에 실행 권한이 있는가? (Linux/Mac)

## 💡 자주 묻는 질문

### Q: 배포가 실패하면?
A: 로그를 확인하세요:
```bash
gcloud run services logs read my-project \
  --region asia-northeast1 \
  --limit 50
```

### Q: 비용이 걱정되면?
A: `--min-instances 1` 옵션을 제거하면 비용이 절감되지만, 콜드 스타트가 발생할 수 있습니다.

### Q: 배포 후에도 여전히 오류가 발생하면?
A: 
1. 브라우저 캐시 삭제
2. 몇 분 기다린 후 다시 시도 (배포 완료 대기)
3. Google Cloud Console에서 서비스 상태 확인

### Q: 로컬에서 테스트할 수 있나요?
A: 네, Docker를 사용하여 로컬에서 실행할 수 있습니다:
```bash
cd cloud-run-service
docker build -t video-renderer .
docker run -p 8080:8080 video-renderer
```

## 📞 추가 도움

문제가 계속되면:
1. Google Cloud Console의 로그 확인
2. 브라우저 개발자 도구(F12)의 네트워크 탭 확인
3. 오류 메시지의 전체 내용 확인

