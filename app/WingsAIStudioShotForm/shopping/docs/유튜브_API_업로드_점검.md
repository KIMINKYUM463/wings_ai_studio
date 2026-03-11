# 공장 자동화 · 유튜브 API 업로드 구현 점검

## 1. YouTube API 사용 여부

**구현됨.** `googleapis` 패키지로 **YouTube Data API v3**를 사용합니다.

- **업로드 API** (`app/api/youtube/upload/route.ts`)
  - `google.youtube({ version: "v3", auth: oauth2Client })`
  - `youtube.videos.insert()` 로 영상 업로드 (제목, 설명, 태그, 예약 공개 시간 지원)
  - `youtube.thumbnails.set()` 로 썸네일 업로드 (선택)

---

## 2. OAuth 인증 흐름

| 단계 | 경로 | 역할 |
|------|------|------|
| 1 | `POST /api/youtube/auth` | 설정에서 Client ID/Secret 받아 쿠키에 임시 저장 후 Google 로그인 URL 반환 |
| 2 | 사용자 | Google 로그인 및 권한 동의 (youtube.upload, youtube.readonly) |
| 3 | `GET /api/youtube/callback` | `code`로 토큰 교환 → **공장 자동화** 연동 시 `youtube_tokens` 쿠키에 저장 → 쇼핑 페이지로 리다이렉트 + 채널명 표시 |

- 공장 자동화용 연동 시 **반드시** `state=shopping_factory` 로 호출해야 콜백에서 `youtube_tokens` 쿠키가 설정됩니다.
- 쇼핑 설정 화면의 "YouTube 채널과 연동"은 `/api/youtube/auth?state=shopping_factory` 로 호출하므로 정상 동작합니다.

---

## 3. 업로드 API (`POST /api/youtube/upload`)

- **토큰**
  - 본문의 `tokens` 없으면 **쿠키 `youtube_tokens`** 사용 (공장 자동화 자동 업로드 시 이 경로 사용).
- **Client ID / Secret**
  - 본문의 `clientId`, `clientSecret` 또는 환경 변수 `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` (토큰 갱신용).
- **영상**
  - `videoUrl: "blob:"` 이면 **본문의 `videoBase64`** 필수 (클라이언트가 blob → base64로 전달).
- **예약 공개**
  - `scheduledTime` (ISO 8601) 있으면 해당 시각에 공개되도록 업로드.

공장 자동화에서 호출할 때는 **쿠키에 저장된 토큰** + **localStorage의 Client ID/Secret**(또는 env)으로 동작하도록 되어 있습니다.

---

## 4. 공장 자동화에서 업로드 호출 위치

| 위치 | 파일:라인 부근 | 언제 |
|------|----------------|------|
| 수동 흐름 (공장 예약 완료) | `page.tsx` ~4395 | 서버 렌더 완료 후, `youtubeChannelName` 있으면 자동으로 `POST /api/youtube/upload` 호출. `videoBase64`, title, description, tags, scheduledTime, clientId, clientSecret 전달. |
| 백그라운드 파이프라인 | `page.tsx` ~6056 | 썸네일 → 서버 렌더 → PC 다운로드 후, `localStorage`의 채널명 있으면 자동으로 `POST /api/youtube/upload` 호출. 동일 인자. |
| 목록에서 재시도 | `page.tsx` ~10248 | "유튜브에 업로드" 클릭 시, 저장된 blob → base64 후 동일 API 호출. |

세 경우 모두 **같은 업로드 API**를 쓰며, **유튜브 API(v3 videos.insert)** 를 사용합니다.

---

## 5. 업로드가 안 될 수 있는 경우

1. **토큰 쿠키 없음**
   - 공장 자동화 설정에서 "YouTube 채널과 연동"을 **한 번도 완료하지 않음** → `youtube_tokens` 쿠키가 없어 401.
   - **조치:** 설정(톱니바퀴) → YouTube 연동 다시 진행.

2. **다른 도메인/브라우저**
   - 연동은 A 도메인에서, 공장 자동화 실행은 B 도메인(또는 시크릿/다른 브라우저) → 쿠키가 없음.
   - **조치:** 실제로 공장 자동화을 쓰는 도메인/브라우저에서 한 번 더 연동.

3. **Client ID/Secret 없음**
   - 토큰 만료 시 갱신하려면 Client ID/Secret이 필요한데, 본문에도 없고 env에도 없으면 500.
   - **조치:** 공장 자동화 설정에 Client ID/Secret 입력 후 저장(localStorage에 들어가고, 호출 시 본문으로 전달됨).

4. **Google 쿼터/권한**
   - YouTube Data API 할당량 초과 또는 앱 검증 미완료 등으로 API가 실패할 수 있음.
   - **조치:** Google Cloud Console에서 YouTube Data API v3 사용량·오류 로그 확인.

---

## 6. 정리

- **유튜브 API를 사용한 업로드는 구현되어 있음** (OAuth → 쿠키 토큰 → `POST /api/youtube/upload` → `youtube.videos.insert`).
- 공장 자동화에서는 **서버 렌더(Cloud Run) 완료 후** 위 업로드 API를 자동 호출하고, 실패 시 목록에 "유튜브 미업로드" + "유튜브에 업로드"로 재시도 가능합니다.
- "예약 완료인데 유튜브에 없다"면 위 5번 항목(토큰·도메인·Client ID/Secret·쿼터)을 순서대로 확인하는 것이 좋습니다.
