# Google Cloud 설정 가이드 (처음부터)

이 앱에서 사용하는 Google Cloud 설정을 **처음부터** 순서대로 정리했습니다.  
(롱폼: 영상 렌더링·GCS 업로드 / 숏폼: 별도 프로젝트 사용 가능)

---

## 빠른 참조: GCP에서 할 일 → 앱 환경 변수

| GCP에서 하는 일 | 앱에 넣을 환경 변수 |
|-----------------|---------------------|
| 프로젝트 생성 후 **프로젝트 ID** 확인 | `GOOGLE_CLOUD_PROJECT_ID` (롱폼) / `SHOPPING_GOOGLE_CLOUD_PROJECT_ID` (숏폼) |
| **Cloud Storage** 버킷 생성 후 버킷 이름 | `GOOGLE_CLOUD_STORAGE_BUCKET` / `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET` |
| **서비스 계정** 만들고 JSON 키 다운로드 | `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON 전체 붙여넣기) / `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY` (숏폼) |
| **Cloud Run** 렌더 서비스 URL 복사 | `CLOUD_RUN_RENDER_URL` (롱폼) / `SHOPPING_CLOUD_RUN_RENDER_URL` (숏폼) |

로컬만: JSON 파일 경로만 쓰려면 `GOOGLE_APPLICATION_CREDENTIALS`(또는 `SHOPPING_GOOGLE_APPLICATION_CREDENTIALS`)에 파일 경로 지정.

---

## 목차

1. [필요한 것](#1-필요한-것)
2. [프로젝트 만들기](#2-프로젝트-만들기)
3. [결제(빌링) 활성화](#3-결제빌링-활성화)
4. [API 사용 설정](#4-api-사용-설정)
5. [서비스 계정 만들기](#5-서비스-계정-만들기)
6. [Cloud Storage 버킷 만들기](#6-cloud-storage-버킷-만들기)
7. [Cloud Run (영상 렌더 서비스)](#7-cloud-run-영상-렌더-서비스)
8. [환경 변수 정리](#8-환경-변수-정리)
9. [롱폼 / 숏폼 분리 시](#9-롱폼--숏폼-분리-시)

---

## 1. 필요한 것

- Google 계정
- [Google Cloud Console](https://console.cloud.google.com/) 접속 가능
- (배포 시) Vercel 등에 환경 변수 입력 가능

---

## 2. 프로젝트 만들기

1. **Google Cloud Console** 접속: https://console.cloud.google.com/
2. 상단 프로젝트 선택 드롭다운 클릭 → **"새 프로젝트"** 선택.
3. **프로젝트 이름** 입력 (예: `wings-longform`, `wings-shortform`).
4. **위치**(조직)는 그대로 두거나 필요 시 변경.
5. **만들기** 클릭.
6. 만들어진 프로젝트를 선택한 뒤, 상단에서 **프로젝트 ID**를 확인해 두세요.  
   (예: `my-project-123456789` → 이 값을 나중에 `GOOGLE_CLOUD_PROJECT_ID`에 넣습니다.)

**숏폼을 롱폼과 다른 계정/프로젝트로 쓰려면**  
- 롱폼용 프로젝트 1개 (예: `wings-longform`)  
- 숏폼용 프로젝트 1개 (예: `wings-shortform`)  
이렇게 **프로젝트를 두 개** 만드시면 됩니다.

---

## 3. 결제(빌링) 활성화

1. 왼쪽 메뉴 **결제** (또는 상단 검색에서 "결제" 검색).
2. **결제 계정 연결** 또는 **무료 체험 시작** 진행.  
   (Cloud Run·GCS 사용량에 따라 과금될 수 있으므로, 예산/알림 설정을 권장합니다.)

---

## 4. API 사용 설정

사용하는 서비스에 맞게 아래 API를 **사용 설정**합니다.

1. 왼쪽 메뉴 **API 및 서비스** → **라이브러리**.
2. 아래 API를 검색한 뒤 **사용** 클릭.

| API 이름 | 검색어 | 용도 |
|----------|--------|------|
| **Cloud Storage API** | `Cloud Storage API` | 오디오·이미지·영상 파일 저장 (GCS) |
| **Cloud Run Admin API** | `Cloud Run Admin API` | 영상 렌더 서비스 배포·호출 시 필요 |

- 롱폼만 쓰는 프로젝트: 위 두 개 모두 사용 설정.
- 숏폼 전용 프로젝트: 마찬가지로 두 API 모두 사용 설정.

---

## 5. 서비스 계정 만들기

앱(Next.js 서버)이 GCP에 접근할 때 사용할 **서비스 계정**을 만듭니다.

1. 왼쪽 **IAM 및 관리자** → **서비스 계정**.
2. **서비스 계정 만들기** 클릭.
3. **서비스 계정 이름**: 예) `wings-app` 또는 `wings-render`.
4. **만들기 및 계속** → **역할 추가**에서 아래 역할을 추가합니다.

| 역할 이름 | 용도 |
|-----------|------|
| **Storage 객체 관리자** (또는 **Cloud Storage** > **Storage 객체 관리자**) | 버킷에 파일 업로드·삭제·공개 설정 |
| (Cloud Run 호출만 할 경우) **Cloud Run 호출자** | 서버에서 Cloud Run URL 호출 시 필요 (Run 서비스를 같은 프로젝트에 둘 때) |

5. **완료** 클릭.
6. 방금 만든 서비스 계정을 클릭 → **키** 탭 → **키 추가** → **새 키 만들기** → **JSON** 선택 → **만들기**.  
   - JSON 파일이 다운로드됩니다. **이 파일 내용**을 나중에 환경 변수 `GOOGLE_SERVICE_ACCOUNT_KEY`(또는 `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY`)에 넣습니다.
7. JSON 파일은 안전한 곳에 보관하고, **Git이나 공개 저장소에 올리지 마세요.**

**JSON 키 내용 사용 방법**

- **로컬 개발**:  
  - JSON 파일을 프로젝트 밖(예: `~/gcp-keys/wings-longform.json`)에 두고,  
  - 환경 변수 `GOOGLE_APPLICATION_CREDENTIALS=/절대경로/wings-longform.json` 로 지정.
- **Vercel 등 배포**:  
  - JSON **전체 내용**을 한 줄 문자열로 복사해서  
  - `GOOGLE_SERVICE_ACCOUNT_KEY` (또는 숏폼은 `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY`) 값에 붙여넣기.

---

## 6. Cloud Storage 버킷 만들기

오디오·이미지·영상 파일을 저장할 **버킷**을 만듭니다.

1. 왼쪽 **Cloud Storage** → **버킷**.
2. **만들기** 클릭.
3. **이름**: 전 세계에서 유일해야 함 (예: `wings-longform-media`, `wings-shortform-media`).
4. **위치 유형**: 리전(권장) 또는 다중 리전.
5. **스토리지 클래스**: Standard 권장.
6. **액세스 제어**: 균일한 액세스(권장).
7. **공개 액세스 방지**: "공개 액세스 방지" 유지. (앱에서 필요한 파일만 `make-public` 등으로 공개.)
8. **만들기** 클릭.

생성한 **버킷 이름**을 환경 변수 `GOOGLE_CLOUD_STORAGE_BUCKET`(또는 숏폼은 `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET`)에 넣습니다.

---

## 7. Cloud Run (영상 렌더 서비스)

앱은 **영상 렌더링**을 위해 Cloud Run의 `/render` 엔드포인트를 호출합니다.

- **롱폼**: `CLOUD_RUN_RENDER_URL` → 예: `https://your-render-service-xxxxx.run.app`
- **숏폼**: `SHOPPING_CLOUD_RUN_RENDER_URL` → 숏폼 전용 서비스 URL (다른 프로젝트 가능)

### 7-1. Cloud Run에 배포할 서비스가 이미 있는 경우

1. Cloud Console에서 **Cloud Run** → 해당 서비스 선택.
2. **URL** (예: `https://xxx.run.app`)을 복사.
3. 이 URL을 환경 변수에 넣습니다.  
   - 마지막 `/` 제거한 값만 넣으면 됩니다.  
   - 예: `CLOUD_RUN_RENDER_URL=https://your-render-service-xxxxx.run.app`  
   (앱이 자동으로 `/render` 경로를 붙여서 호출합니다.)

### 7-2. 아직 렌더 서비스를 안 만든 경우

- Cloud Run에 **영상 렌더용 서비스**(이미지+오디오+자막 합성 등)를 별도로 구현·배포해야 합니다.
- 배포가 끝나면 위처럼 **서비스 URL**만 환경 변수에 넣으면 됩니다.
- (선택) 인증이 필요하면 **CLOUD_RUN_AUTH_TOKEN** 또는 **SHOPPING_CLOUD_RUN_AUTH_TOKEN** 에 토큰을 넣어 두고, Cloud Run에서 Bearer 토큰 검증을 구현합니다.

---

## 8. 환경 변수 정리

로컬은 `.env.local`, Vercel은 **Settings → Environment Variables**에 아래를 넣습니다.

### 롱폼용 (한 프로젝트로 롱폼만 쓸 때)

| 변수 이름 | 설명 | 예시 |
|-----------|------|------|
| `GOOGLE_CLOUD_PROJECT_ID` | GCP 프로젝트 ID | `my-project-123456` |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | GCS 버킷 이름 | `wings-longform-media` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | 서비스 계정 JSON **전체** (한 줄 문자열) | `{"type":"service_account",...}` |
| 또는 `GOOGLE_APPLICATION_CREDENTIALS` | (로컬만) JSON 키 파일 경로 | `C:/keys/wings.json` |
| `CLOUD_RUN_RENDER_URL` | 롱폼 영상 렌더 Cloud Run URL | `https://render-xxx.run.app` |
| `CLOUD_RUN_AUTH_TOKEN` | (선택) Cloud Run 인증 토큰 | |

### 숏폼까지 쓸 때 (숏폼은 다른 프로젝트)

위 **롱폼용** 변수는 그대로 두고, **숏폼 전용** 변수를 추가합니다.

| 변수 이름 | 설명 | 예시 |
|-----------|------|------|
| `SHOPPING_GOOGLE_CLOUD_PROJECT_ID` | 숏폼용 GCP 프로젝트 ID | `my-shortform-project` |
| `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET` | 숏폼용 GCS 버킷 | `wings-shortform-media` |
| `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY` | 숏폼용 서비스 계정 JSON 전체 | `{"type":"service_account",...}` |
| `SHOPPING_CLOUD_RUN_RENDER_URL` | 숏폼용 Cloud Run 렌더 URL | `https://shopping-render-xxx.run.app` |
| `SHOPPING_CLOUD_RUN_AUTH_TOKEN` | (선택) 숏폼 Cloud Run 인증 | |

---

## 9. 롱폼 / 숏폼 분리 시

- **롱폼**: 위 2~8단계를 **프로젝트 A**에서 한 번 진행 → `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_STORAGE_BUCKET`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `CLOUD_RUN_RENDER_URL` 설정.
- **숏폼**: **프로젝트 B**를 새로 만들고, 2~8단계를 한 번 더 진행 → `SHOPPING_GOOGLE_CLOUD_PROJECT_ID`, `SHOPPING_GOOGLE_CLOUD_STORAGE_BUCKET`, `SHOPPING_GOOGLE_SERVICE_ACCOUNT_KEY`, `SHOPPING_CLOUD_RUN_RENDER_URL` 설정.

이렇게 하면 롱폼과 숏폼이 서로 다른 GCP 프로젝트(다른 아이디)를 사용해 충돌 없이 동작합니다.

---

## 체크리스트 (복사해서 사용)

- [ ] GCP 프로젝트 생성 (롱폼용 / 숏폼용 각각 필요 시)
- [ ] 결제(빌링) 활성화
- [ ] Cloud Storage API 사용 설정
- [ ] Cloud Run Admin API 사용 설정 (렌더 사용 시)
- [ ] 서비스 계정 생성 + Storage 객체 관리자 역할
- [ ] 서비스 계정 JSON 키 발급·보관
- [ ] Cloud Storage 버킷 생성
- [ ] Cloud Run 렌더 서비스 배포 후 URL 확인
- [ ] `.env.local` 또는 Vercel에 환경 변수 입력
- [ ] (숏폼 분리 시) 숏폼 전용 프로젝트에서 위 단계 반복 + `SHOPPING_*` 변수 설정

이 가이드대로 하면 Google Cloud 설정을 처음부터 끝까지 할 수 있습니다.  
특정 단계에서 에러가 나면, 사용한 API 이름·역할 이름·에러 메시지를 알려주시면 다음 단계까지 구체적으로 적어 드리겠습니다.
