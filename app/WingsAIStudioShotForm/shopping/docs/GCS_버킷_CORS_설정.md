# GCS 버킷 CORS 설정 (Google Cloud에서 하기)

맞아요, **Google Cloud에서 설정하는 것**이에요.  
다만 Storage 버킷 CORS는 **콘솔 메뉴에는 없고**, 콘솔 안에 있는 **Cloud Shell**에서 명령 한 번으로 넣는 방식입니다.

---

## 왜 하면 되나요?

배포된 사이트(wingsaistudio.com)에서 **서버 다운로드** 누르면  
"Access to fetch... has been blocked by CORS policy" / "Failed to fetch" 같은 오류가 나는 경우,  
**wings_short 버킷**에 "이 사이트에서 오는 요청 허용" 설정을 해줘야 합니다. 그게 CORS 설정이에요.

---

## Google Cloud 콘솔에서 하는 방법 (PC에 별도 설치 없음)

### 1단계: Google Cloud 콘솔 들어가기

1. 브라우저에서 [https://console.cloud.google.com](https://console.cloud.google.com) 접속
2. 로그인 후 **숏폼용 프로젝트** 선택 (예: `project-493a61f2-cda9-4bb2-823` 같은 거)

### 2단계: Cloud Shell 열기

1. 오른쪽 **위쪽**에 있는 **터미널(>_)** 아이콘 클릭  
   → 화면 아래쪽에 검은 터미널 창(Cloud Shell)이 뜹니다.  
2. 여기서는 **Google Cloud 쪽에서 제공하는 환경**이라, `gcloud`, `gsutil` 같은 걸 따로 설치하지 않아도 됩니다.

### 3단계: CORS 설정 파일 만들기

Cloud Shell에서 아래 **한 줄씩** 입력하고 Enter 치세요.

```bash
cat > cors-config.json << 'EOF'
[
  {
    "origin": [
      "https://wingsaistudio.com",
      "https://www.wingsaistudio.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "method": ["GET", "PUT", "POST", "HEAD", "DELETE", "OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Methods",
      "Access-Control-Allow-Headers",
      "Access-Control-Expose-Headers"
    ],
    "maxAgeSeconds": 3600
  }
]
EOF
```

(맨 끝 `EOF` 입력 후 Enter 한 번 더 치면 파일이 만들어집니다.)

### 4단계: wings_short 버킷에 CORS 적용

아래 **한 줄** 입력 후 Enter:

```bash
gsutil cors set cors-config.json gs://wings_short
```

끝나면 `Setting CORS on gs://wings_short/...` 같은 메시지가 나오면 **적용된 것**이에요.

### 5단계: 확인 (하고 싶을 때만)

```bash
gsutil cors get gs://wings_short
```

방금 넣은 CORS 내용이 그대로 나오면 설정이 제대로 들어간 겁니다.

---

## 정리

- **설정하는 곳**: Google Cloud (GCS 버킷 `wings_short`)
- **하는 방법**: Google Cloud 콘솔 → Cloud Shell(터미널 아이콘) 열고 → 위 3단계·4단계 명령 실행
- **PC에 설치할 것**: 없음 (콘솔에서 다 함)

이렇게 한 번 해두면 배포된 페이지에서 **서버 다운로드** 할 때 CORS 오류 없이 동작해야 합니다.
