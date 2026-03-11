# Cloud Run 렌더 세팅 (숏폼)

Cloud Run으로 숏폼 영상 렌더링을 쓰려면 **두 단계**가 있습니다.

---

## 1. Vercel에 URL만 넣기 (서비스 배포 후)

Cloud Run 서비스를 **먼저** 배포한 뒤, 나온 URL을 Vercel 환경 변수에 넣습니다.

1. Vercel → 프로젝트 → **Settings** → **Environment Variables**
2. 새 변수 추가:
   - **Name**: `SHOPPING_CLOUD_RUN_RENDER_URL`
   - **Value**: Cloud Run 서비스 URL (예: `https://wingsshort-xxxxx.asia-northeast3.run.app`)
   - 마지막 `/` 없이 입력
3. **Save** 후 **Redeploy**

이렇게 하면 앱이 `POST {SHOPPING_CLOUD_RUN_RENDER_URL}/render` 로 요청을 보냅니다.

---

## 2. wingsshort 서비스에 POST /render 배포하기

**이 레포의 `cloud-run-service`** 에 이미 **쇼핑 숏폼 렌더 로직**이 들어 있습니다.  
`app.py` 에서 `type === "shopping"` 이면 썸네일 + 영상 3개 concat + 자막 + TTS 로 1080×1920 영상을 만든 뒤 `videoBase64` 또는 GCS `videoUrl` 로 응답합니다.

### 2-1. 배포 방법 (이 레포 소스로 배포)

1. **gcloud CLI** 설치 및 로그인  
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) 설치 후 `gcloud auth login`, `gcloud config set project <숏폼용 프로젝트 ID>`

2. **프로젝트 루트**에서 `cloud-run-service` 로 이동 후 배포 스크립트 실행:
   ```bash
   cd cloud-run-service
   export SHOPPING_GCP_PROJECT_ID=your-shortform-project-id   # wingsshort가 있는 GCP 프로젝트 ID
   chmod +x deploy-wingsshort.sh
   ./deploy-wingsshort.sh
   ```
   - 프로젝트 ID를 물어보면 **wingsshort 서비스를 만든 GCP 프로젝트 ID** 입력 (예: `project-493a61f2-cda9-4bb2-823`).
   - 리전은 기본 `asia-northeast3` (다르면 `export CLOUD_RUN_REGION=리전이름` 후 실행).

3. 배포가 끝나면 콘솔에 나온 **서비스 URL** 복사  
   - 또는:  
     `gcloud run services describe wingsshort --region=asia-northeast3 --format='value(status.url)'`

4. **Vercel** → `SHOPPING_CLOUD_RUN_RENDER_URL` = 위 URL (끝 `/` 제외)

5. (선택) 영상이 커서 GCS로 내려줄 때:  
   Cloud Run 서비스 **wingsshort**에 환경 변수 설정:
   - `SHOPPING_GOOGLE_CLOUD_PROJECT_ID` = 숏폼용 GCP 프로젝트 ID  
   - `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET` = 숏폼용 버킷 이름  
   (GCP 콘솔 → Cloud Run → wingsshort → 수정 → 변수 및 시크릿)

### 2-2. 이미 wingsshort 서비스가 있는 경우

이미 **wingsshort** 라는 이름으로 Cloud Run 서비스를 만들어 두었지만, 아직 "플레이스홀더"만 있다면:

- 위처럼 **같은 프로젝트·같은 리전**에서 `deploy-wingsshort.sh` 를 실행하면 **기존 wingsshort 서비스가 이 레포 코드로 업데이트**됩니다.
- 배포 후에는 **POST /render** 가 쇼핑 스펙을 처리하고, **GET /** 는 헬스 체크용으로 동작합니다.

### 2-3. 수동 배포 (콘솔)

1. [Google Cloud Console](https://console.cloud.google.com/) → 숏폼용 프로젝트 선택
2. **Cloud Run** → **wingsshort** 서비스 클릭 (없으면 "서비스 만들기"로 새로 생성)
3. **수정 및 배포 새 버전** → **컨테이너** 탭에서:
   - **소스 리포지토리**에 이 레포 연결 후, 소스 경로를 `cloud-run-service` 로 지정해 빌드  
   - 또는 **컨테이너 이미지 URL**에 직접 이미지 주소 입력 (로컬에서 `docker build` / `gcloud builds submit` 으로 이미지 만든 경우)
4. **인증**: "모든 사용자 허용" 또는 "인증 필요" (Vercel에서 Bearer 사용 시)
5. 배포 후 **서비스 URL** 복사 → Vercel `SHOPPING_CLOUD_RUN_RENDER_URL` 에 설정

### 2-4. 요청 스펙 (참고)

- **POST /render** body: `type: "shopping"`, `duration`, `audioGcsUrl` 또는 `audioBase64`, `subtitles[]`, `thumbnailImageUrl` 또는 `thumbnailImage`, `videoSegments[]` (각 `url`, `startTime`, `endTime`), `config` (선택, `width`, `height`).
- 자세한 스펙은 `서버_렌더링_기획.md` 참고.

---

## 요약

| 단계 | 할 일 |
|------|--------|
| 1 | `cloud-run-service` 폴더에서 `deploy-wingsshort.sh` 실행 (숏폼용 GCP 프로젝트/리전 설정) |
| 2 | 배포된 **wingsshort** 서비스 URL 복사 |
| 3 | Vercel에 **SHOPPING_CLOUD_RUN_RENDER_URL** = 그 URL 로 설정 후 Redeploy |
| 4 | (선택) GCS 사용 시 wingsshort에 `SHOPPING_GOOGLE_CLOUD_*` 환경 변수 설정 |
