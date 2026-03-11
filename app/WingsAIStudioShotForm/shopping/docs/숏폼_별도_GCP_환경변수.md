# 숏폼(쇼핑) — 롱폼과 다른 Google Cloud 프로젝트 사용

롱폼과 같은 GCP 프로젝트를 쓰면 리소스·한도·권한이 섞일 수 있으므로, **숏폼은 별도 GCP 프로젝트(다른 프로젝트 ID)**를 쓰도록 구성할 수 있습니다.

---

## 1. 환경 변수 정리

### 롱폼용 (기존)

| 환경 변수 | 용도 |
|-----------|------|
| `CLOUD_RUN_RENDER_URL` | 롱폼 영상 렌더링 Cloud Run URL |
| `CLOUD_RUN_AUTH_TOKEN` | (선택) 롱폼 Cloud Run 인증 토큰 |
| `GOOGLE_CLOUD_PROJECT_ID` | 롱폼 GCP 프로젝트 ID |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | 롱폼 GCS 버킷 이름 |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | 롱폼 서비스 계정 JSON (문자열) |
| `GOOGLE_APPLICATION_CREDENTIALS` | (로컬) 롱폼 서비스 계정 JSON 파일 경로 |

### 숏폼(쇼핑) 전용 — 별도 프로젝트

| 환경 변수 | 용도 |
|-----------|------|
| `SHOPPING_CLOUD_RUN_RENDER_URL` | **숏폼 전용** Cloud Run 렌더 서비스 URL (다른 프로젝트에 배포) |
| `SHOPPING_CLOUD_RUN_AUTH_TOKEN` | (선택) 숏폼 Cloud Run 인증 토큰 |
| `SHOPPING_GOOGLE_CLOUD_PROJECT_ID` | **숏폼 전용** GCP 프로젝트 ID |
| `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET` | **숏폼 전용** GCS 버킷 이름 |
| `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY` | **숏폼 전용** 서비스 계정 JSON (문자열) |
| `SHOPPING_GOOGLE_APPLICATION_CREDENTIALS` | (로컬) 숏폼 서비스 계정 JSON 파일 경로 |

- **렌더 API** (`POST /api/ai/render`): `body.type === "shopping"`이면 **반드시** `SHOPPING_CLOUD_RUN_RENDER_URL`만 사용합니다. `CLOUD_RUN_RENDER_URL`로는 폴백하지 않습니다.
- **GCS 업로드** (`/api/upload-to-gcs/signed-url`): `body.scope === "shopping"`이면 `SHOPPING_GOOGLE_CLOUD_PROJECT_ID`, `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET`, `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY`를 사용합니다.

---

## 2. 구현 방법 요약

1. **새 GCP 프로젝트 생성**  
   - Google Cloud Console에서 롱폼과 다른 프로젝트 생성 (예: `my-project-longform` / `my-project-shortform`).

2. **숏폼 프로젝트에서 사용할 리소스**  
   - Cloud Run: 숏폼 전용 렌더 서비스 배포 (쇼핑 스펙 `type: "shopping"` 처리).  
   - GCS: 숏폼 전용 버킷 1개 생성.  
   - 서비스 계정: 해당 프로젝트에서 생성 후 JSON 키 발급.

3. **환경 변수 설정**  
   - Vercel(또는 배포 환경):  
     - `SHOPPING_CLOUD_RUN_RENDER_URL` = 숏폼 Cloud Run URL  
     - `SHOPPING_CLOUD_RUN_AUTH_TOKEN` = (필요 시)  
     - `SHOPPING_GOOGLE_CLOUD_PROJECT_ID` = 숏폼 프로젝트 ID  
     - `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET` = 숏폼 버킷 이름  
     - `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY` = 숏폼 서비스 계정 JSON 문자열  
   - 로컬: 위와 동일하거나, `SHOPPING_GOOGLE_APPLICATION_CREDENTIALS`에 JSON 파일 경로 지정.

4. **클라이언트(쇼핑) 호출 시**  
   - 렌더: `POST /api/ai/render` body에 `type: "shopping"` 포함 → 서버가 `SHOPPING_CLOUD_RUN_RENDER_URL`로만 요청.  
   - GCS 업로드: `POST /api/upload-to-gcs/signed-url` body에 `scope: "shopping"` 포함 → 서버가 숏폼용 프로젝트/버킷 사용.

이렇게 하면 롱폼과 숏폼이 서로 다른 GCP 프로젝트(다른 아이디)를 사용해 충돌 없이 동작합니다.
