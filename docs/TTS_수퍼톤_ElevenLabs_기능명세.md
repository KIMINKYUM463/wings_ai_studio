# 수퍼톤(SuperTone) · ElevenLabs TTS 기능 명세

WingsAIStudio 저장소 기준. 클라이언트는 **Next.js API Route**로 프록시하여 외부 TTS API를 호출합니다.

---

## 1. 공통

| 항목 | 내용 |
|------|------|
| **키 저장(클라이언트)** | `lib/api-keys.ts` — `getApiKey()` |
| **수퍼톤** | 로컬스토리지 `supertone_api_key`, 서버 env `SUPERTONE_API_KEY` |
| **ElevenLabs** | 로컬스토리지 `elevenlabs_api_key`, 서버 env `ELEVENLABS_API_KEY` |
| **주요 사용 화면** | `app/WingsAIStudio/longform/page.tsx`, `shorts`, `WingsAIStudioShotForm/shopping/page.tsx` 등 — `supertone-` / `elevenlabs-` 프리픽스로 목소리 선택 후 `fetch("/api/...")` |

---

## 2. 수퍼톤 (SuperTone)

### 2.1 기능 개요

- **음성 목록 조회:** API Route `GET /api/supertone-voices?apiKey=...`
- **TTS 합성:** API Route `POST /api/supertone-tts`
- **외부 API 베이스 URL:** `https://supertoneapi.com`
- **인증:** HTTP 헤더 `x-sup-api-key: {API_KEY}` (Bearer 아님)

### 2.2 외부 API 매핑

| 내부 Route | 메서드 | 외부 URL | 용도 |
|------------|--------|----------|------|
| `/api/supertone-voices` | GET | `GET https://supertoneapi.com/v1/voices` | 음성 목록 |
| `/api/supertone-tts` | POST | `POST https://supertoneapi.com/v1/text-to-speech/{voiceId}` | WAV 오디오 |

### 2.3 TTS 요청/응답 (앱 기준)

**`POST /api/supertone-tts` JSON body**

| 필드 | 필수 | 설명 |
|------|------|------|
| `text` | O | 합성할 문장 |
| `voiceId` | O | 수퍼톤 음성 ID |
| `apiKey` | O | 수퍼톤 API 키 |
| `style` | | 기본 `neutral` |
| `language` | | 기본 `ko` |
| `model` | | 기본 `sona_speech_1` |

**응답 (성공):**

```json
{ "success": true, "audioBase64": "<base64>", "audioUrl": "data:audio/wav;base64,..." }
```

### 2.4 비즈니스 규칙 (구현)

- **최대 300자/요청:** 수퍼톤 API 제한으로, 300자 초과 시 문장 경계(`.!?`)·쉼표·공백 기준으로 **청크 분할** 후 각각 호출, 반환된 **WAV를 PCM data 영역만 이어 붙여 단일 WAV**로 합침.
- **오디오 형식:** WAV 스트림 (`arrayBuffer` → base64 data URL).

### 2.5 소스 파일

- 전체 구현: **`app/api/supertone-tts/route.ts`**
- 음성 목록: **`app/api/supertone-voices/route.ts`**

---

## 3. ElevenLabs

### 3.1 기능 개요

- **음성 목록 조회:** `GET /api/elevenlabs-voices?apiKey=...`
- **TTS 합성:** `POST /api/elevenlabs-tts`
- **외부 베이스 URL:** `https://api.elevenlabs.io`
- **인증:** HTTP 헤더 `xi-api-key: {API_KEY}`

### 3.2 외부 API 매핑

| 내부 Route | 메서드 | 외부 URL | 용도 |
|------------|--------|----------|------|
| `/api/elevenlabs-voices` | GET | `GET https://api.elevenlabs.io/v1/voices` | 목소리 목록 |
| `/api/elevenlabs-tts` | POST | `POST .../v1/text-to-speech/{voiceId}/with-timestamps` | MP3 + **alignment**(자막 싱크용) |

### 3.3 TTS 요청/응답 (앱 기준)

**`POST /api/elevenlabs-tts` JSON body**

| 필드 | 필수 | 설명 |
|------|------|------|
| `text` | O | 합성 텍스트 (최대 5000자, 초과 시 400) |
| `voiceId` | O | ElevenLabs `voice_id` |
| `apiKey` | O | ElevenLabs API 키 |

**외부 요청 본문 (고정):**

- `model_id`: **`eleven_multilingual_v2`**
- `voice_settings`: `stability: 0.7`, `similarity_boost: 0.75`

**응답 (성공):**

```json
{
  "success": true,
  "audioBase64": "...",
  "audioUrl": "data:audio/mpeg;base64,...",
  "alignment": { ... } | null
}
```

- `/with-timestamps` 응답에 `audio`가 없으면 **일반** `POST .../text-to-speech/{voiceId}` (Accept: `audio/mpeg`)로 폴백.

### 3.4 롱폼 등 UI에서의 음성 ID 형식

- 한국어 직접 합성: `elevenlabs-{voiceId}`
- 다국어(번역 후 합성): `elevenlabs-{en|ja|...}-{voiceId}` — 상세는 `app/WingsAIStudio/longform/docs` 및 `page.tsx`의 `buildElevenLabsSelectedVoiceId` 참고.

### 3.5 소스 파일

- TTS: **`app/api/elevenlabs-tts/route.ts`**
- 음성 목록: **`app/api/elevenlabs-voices/route.ts`**

---

## 4. 핵심 코드 발췌

### 4.1 수퍼톤 TTS — 인증·본문·분할 진입

`app/api/supertone-tts/route.ts`

```typescript
const apiUrl = `https://supertoneapi.com/v1/text-to-speech/${voiceId}`

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-sup-api-key": apiKey,
  },
  body: JSON.stringify({
    text: trimmedText,
    language: language || "ko",
    style: style || "neutral",
    model: model || "sona_speech_1",
  }),
})
```

- 300자 초과 분기에서 동일 URL로 청크마다 반복 호출 후 WAV 병합(같은 파일 내 구현).

### 4.2 수퍼톤 음성 목록

`app/api/supertone-voices/route.ts`

```typescript
const apiUrl = "https://supertoneapi.com/v1/voices"
await fetch(apiUrl, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "x-sup-api-key": trimmedApiKey,
    "User-Agent": "WingsAIStudio/1.0",
  },
})
// 응답: data.items | data.voices | 배열 등 형식 정규화 → { success, voices }
```

### 4.3 ElevenLabs TTS — with-timestamps + 폴백

`app/api/elevenlabs-tts/route.ts`

```typescript
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
  {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: ttsText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.75,
      },
    }),
  }
)
// data.alignment, data.audio | audio_base64 처리, 없으면 /text-to-speech/{voiceId} 폴백
```

### 4.4 ElevenLabs 음성 목록 + 정규화

`app/api/elevenlabs-voices/route.ts`

```typescript
await fetch("https://api.elevenlabs.io/v1/voices", {
  headers: { Accept: "application/json", "xi-api-key": apiKey },
})
// { voices: [...] } → { id: voice_id || id, name, ... }
```

### 4.5 API 키 유틸

`lib/api-keys.ts`

```typescript
export function getApiKey(
  keyType: "openai" | "elevenlabs" | "replicate" | "gemini" | "supertone" | "ttsmaker_api_key"
): string | null
// elevenlabs → localStorage "elevenlabs_api_key"
// supertone  → localStorage "supertone_api_key"
```

---

## 5. 전체 코드 파일 (경로만)

실제 **전문**은 아래 파일을 IDE에서 열면 됩니다.

| 구분 | 경로 |
|------|------|
| 수퍼톤 TTS | [`app/api/supertone-tts/route.ts`](../app/api/supertone-tts/route.ts) |
| 수퍼톤 목록 | [`app/api/supertone-voices/route.ts`](../app/api/supertone-voices/route.ts) |
| ElevenLabs TTS | [`app/api/elevenlabs-tts/route.ts`](../app/api/elevenlabs-tts/route.ts) |
| ElevenLabs 목록 | [`app/api/elevenlabs-voices/route.ts`](../app/api/elevenlabs-voices/route.ts) |
| 키 헬퍼 | [`lib/api-keys.ts`](../lib/api-keys.ts) |

(위 링크는 저장소 루트 `docs/` 기준 상대 경로입니다.)

---

## 6. 요약 표

| | 수퍼톤 | ElevenLabs |
|--|--------|------------|
| 목록 Route | `GET /api/supertone-voices` | `GET /api/elevenlabs-voices` |
| TTS Route | `POST /api/supertone-tts` | `POST /api/elevenlabs-tts` |
| 인증 헤더 | `x-sup-api-key` | `xi-api-key` |
| 오디오 | WAV | MPEG (with-timestamps 시 JSON 내 오디오 필드) |
| 특이사항 | 300자 초과 시 청크+WAV 병합 | `eleven_multilingual_v2`, alignment 자막용 |
| 기본 모델(수퍼톤 body) | `sona_speech_1` | (ElevenLabs) `eleven_multilingual_v2` |

---

*문서 생성 기준: 저장소 `app/api/*` 및 `lib/api-keys.ts` 구현.*
