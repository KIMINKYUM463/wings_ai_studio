# TTS (Text-to-Speech) 생성 기능 - API 가이드

## 📋 개요
대본 텍스트를 음성으로 변환하는 TTS 기능입니다. 여러 TTS 서비스를 지원합니다.

---

## 🔌 지원 TTS 서비스

### 1. Superton API

#### 기본 정보
- **API 엔드포인트**: `https://supertoneapi.com/v1/text-to-speech/{voiceId}`
- **HTTP 메서드**: `POST`
- **인증 방식**: 커스텀 헤더 (`x-sup-api-key`)
- **Content-Type**: `application/json`
- **응답 형식**: WAV 파일 (ArrayBuffer)

#### 제한사항
- **최대 텍스트 길이**: 300자
- **초과 시 처리**: 자동으로 청크로 분할하여 생성 후 합치기

#### 요청 예시

```json
{
  "text": "대본 텍스트",
  "language": "ko",
  "style": "neutral",
  "model": "sona_speech_1"
}
```

#### 요청 헤더
```json
{
  "Content-Type": "application/json",
  "x-sup-api-key": "{apiKey}"
}
```

#### 응답 처리
- **단일 청크**: base64 인코딩된 WAV 파일 반환
- **다중 청크**: WAV 파일들을 합쳐서 하나의 파일로 반환

---

### 2. TTSMaker Pro API

#### 기본 정보
- **API 엔드포인트**: `https://api.ttsmaker.com/v2/create-tts-order`
- **HTTP 메서드**: `POST`
- **인증 방식**: API Key (요청 body에 포함)
- **Content-Type**: `application/json`
- **응답 형식**: MP3 파일 URL

#### 요청 예시

```json
{
  "api_key": "{TTSMAKER_API_KEY}",
  "text": "대본 텍스트",
  "voice_id": 101,
  "audio_format": "mp3",
  "audio_speed": 1.0,
  "audio_volume": 1,
  "audio_pitch": 0,
  "audio_high_quality": 0,
  "text_paragraph_pause_time": 0,
  "emotion_style_key": "",
  "emotion_intensity": 1
}
```

#### Voice ID 매핑

| Voice 이름 | Voice ID | Pitch |
|-----------|----------|-------|
| `한국어 여성 1` | 101 | 0 |
| `한국어 남성 1` | 102 | 0 |
| `한국어 여성 2` | 103 | 0 |
| `한국어 남성 2` | 104 | 0 |

#### 응답 처리
1. **주문 생성**: `order_id` 반환
2. **상태 확인**: 폴링으로 완료 확인
3. **다운로드**: 완료 후 `audio_url`에서 MP3 다운로드

---

### 3. ElevenLabs API

#### 기본 정보
- **API 엔드포인트**: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/with-timestamps`
- **HTTP 메서드**: `POST`
- **인증 방식**: API Key (`xi-api-key` 헤더)
- **Content-Type**: `application/json`
- **응답 형식**: MP3 파일 + 타임스탬프 데이터

#### 제한사항
- **최대 텍스트 길이**: 5000자

#### 요청 예시

```json
{
  "text": "대본 텍스트",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

#### 요청 헤더
```json
{
  "Accept": "application/json",
  "Content-Type": "application/json",
  "xi-api-key": "{apiKey}"
}
```

#### 응답 형식
```json
{
  "audio": "base64_encoded_mp3",
  "alignment": {
    "characters": [
      {
        "char": "문",
        "start": 0.0,
        "end": 0.1
      }
    ]
  }
}
```

---

### 4. Google Cloud Text-to-Speech API

#### 기본 정보
- **API 엔드포인트**: `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key={apiKey}`
- **HTTP 메서드**: `POST`
- **인증 방식**: API Key (쿼리 파라미터)
- **Content-Type**: `application/json`
- **응답 형식**: Base64 인코딩된 MP3 + 타임포인트

#### 요청 예시

```json
{
  "input": {
    "ssml": "<speak><mark name=\"subtitle_0\"/>대본 텍스트</speak>"
  },
  "voice": {
    "languageCode": "ko-KR",
    "name": "ko-KR-Neural2-C",
    "ssmlGender": "MALE"
  },
  "audioConfig": {
    "audioEncoding": "MP3",
    "speakingRate": 1.0,
    "pitch": 0
  },
  "enableTimePointing": ["SSML_MARK"]
}
```

#### 지원 Voice 모델
- `ko-KR-Neural2-C`: 남성 목소리 (기본)
- `ko-KR-Neural2-B`: 여성 목소리
- `ko-KR-Neural2-D`: 남성 목소리 (다른 톤)

#### SSML 형식
```xml
<speak>
  <mark name="subtitle_0"/>첫 번째 자막 텍스트
  <mark name="subtitle_1"/>두 번째 자막 텍스트
</speak>
```

#### 응답 형식
```json
{
  "audioContent": "base64_encoded_mp3",
  "timepoints": [
    {
      "markName": "subtitle_0",
      "timeSeconds": 0.0
    },
    {
      "markName": "subtitle_1",
      "timeSeconds": 2.5
    }
  ]
}
```

---

## 📋 텍스트 분할 처리

### Superton API (300자 제한)

```javascript
// 텍스트가 300자를 초과하는 경우 분할
const MAX_TEXT_LENGTH = 300
const textChunks = []

while (remainingText.length > MAX_TEXT_LENGTH) {
  let chunk = remainingText.substring(0, MAX_TEXT_LENGTH)
  
  // 마지막 문장 끝 찾기
  const lastPeriod = Math.max(
    chunk.lastIndexOf("."),
    chunk.lastIndexOf("!"),
    chunk.lastIndexOf("?")
  )
  
  // 문장 끝이 70% 이상 위치에 있으면 문장 끝에서 나누기
  let splitIndex = MAX_TEXT_LENGTH
  if (lastPeriod > MAX_TEXT_LENGTH * 0.7) {
    splitIndex = lastPeriod + 1
  } else {
    // 쉼표나 공백에서 나누기
    const lastComma = chunk.lastIndexOf(",")
    const lastSpace = chunk.lastIndexOf(" ")
    if (lastComma > MAX_TEXT_LENGTH * 0.8) {
      splitIndex = lastComma + 1
    } else if (lastSpace > MAX_TEXT_LENGTH * 0.8) {
      splitIndex = lastSpace + 1
    }
  }
  
  chunk = remainingText.substring(0, splitIndex).trim()
  textChunks.push(chunk)
  remainingText = remainingText.substring(splitIndex).trim()
}

// 마지막 남은 텍스트 추가
if (remainingText.length > 0) {
  textChunks.push(remainingText)
}
```

### WAV 파일 합치기 (Superton)

```javascript
// 여러 WAV 파일 합치기
// 1. 첫 번째 파일의 헤더 유지
// 2. 나머지 파일의 데이터 부분만 합치기
// 3. 헤더의 파일 크기 업데이트

const firstBuffer = new Uint8Array(audioBuffers[0])
let dataStartIndex = 0

// "data" 청크 찾기
for (let i = 0; i < firstBuffer.length - 4; i++) {
  if (firstBuffer[i] === 0x64 && firstBuffer[i+1] === 0x61 && 
      firstBuffer[i+2] === 0x74 && firstBuffer[i+3] === 0x61) {
    dataStartIndex = i + 8 // "data" + 4바이트 크기
    break
  }
}

const header = firstBuffer.slice(0, dataStartIndex)
const dataParts = []

// 모든 파일의 데이터 부분 추출
for (const buffer of audioBuffers) {
  const bufferArray = new Uint8Array(buffer)
  let dataStart = 0
  for (let i = 0; i < bufferArray.length - 4; i++) {
    if (bufferArray[i] === 0x64 && bufferArray[i+1] === 0x61 && 
        bufferArray[i+2] === 0x74 && bufferArray[i+3] === 0x61) {
      dataStart = i + 8
      break
    }
  }
  dataParts.push(bufferArray.slice(dataStart))
}

// 헤더의 파일 크기 업데이트
const totalDataLength = dataParts.reduce((sum, part) => sum + part.length, 0)
const newFileSize = header.length + totalDataLength - 8

header[4] = newFileSize & 0xFF
header[5] = (newFileSize >> 8) & 0xFF
header[6] = (newFileSize >> 16) & 0xFF
header[7] = (newFileSize >> 24) & 0xFF

// data 청크 크기 업데이트
for (let i = 0; i < header.length - 4; i++) {
  if (header[i] === 0x64 && header[i+1] === 0x61 && 
      header[i+2] === 0x74 && header[i+3] === 0x61) {
    header[i+4] = totalDataLength & 0xFF
    header[i+5] = (totalDataLength >> 8) & 0xFF
    header[i+6] = (totalDataLength >> 16) & 0xFF
    header[i+7] = (totalDataLength >> 24) & 0xFF
    break
  }
}

// 합친 버퍼 생성
const combinedBuffer = new Uint8Array(header.length + totalDataLength)
combinedBuffer.set(header, 0)
let offset = header.length
for (const dataPart of dataParts) {
  combinedBuffer.set(dataPart, offset)
  offset += dataPart.length
}
```

---

## 📋 구현 가이드

### Superton TTS 함수 예시

```javascript
async function generateTTSWithSuperton(text, voiceId, apiKey, style, language, model) {
  const MAX_TEXT_LENGTH = 300
  const trimmedText = text.trim()
  
  // 텍스트가 300자를 초과하는 경우 분할
  if (trimmedText.length > MAX_TEXT_LENGTH) {
    // 분할 로직 (위 참고)
    const textChunks = splitTextIntoChunks(trimmedText, MAX_TEXT_LENGTH)
    
    // 각 청크를 개별적으로 TTS 생성
    const audioBuffers = []
    for (const chunk of textChunks) {
      const response = await fetch(
        `https://supertoneapi.com/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sup-api-key": apiKey,
          },
          body: JSON.stringify({
            text: chunk,
            language: language || "ko",
            style: style || "neutral",
            model: model || "sona_speech_1",
          }),
        }
      )
      
      if (!response.ok) {
        throw new Error(`TTS 생성 실패: ${response.status}`)
      }
      
      const audioBuffer = await response.arrayBuffer()
      audioBuffers.push(audioBuffer)
    }
    
    // WAV 파일 합치기 (위 참고)
    const combinedBuffer = combineWavFiles(audioBuffers)
    const audioBase64 = Buffer.from(combinedBuffer).toString("base64")
    return `data:audio/wav;base64,${audioBase64}`
  }
  
  // 300자 이하인 경우 단일 요청
  const response = await fetch(
    `https://supertoneapi.com/v1/text-to-speech/${voiceId}`,
    {
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
    }
  )
  
  if (!response.ok) {
    throw new Error(`TTS 생성 실패: ${response.status}`)
  }
  
  const audioBuffer = await response.arrayBuffer()
  const audioBase64 = Buffer.from(audioBuffer).toString("base64")
  return `data:audio/wav;base64,${audioBase64}`
}
```

### Google TTS 함수 예시

```javascript
async function generateTTSWithGoogle(text, apiKey, voiceModel = "ko-KR-Neural2-C") {
  // SSML 생성
  const ssmlText = `<speak><mark name="subtitle_0"/>${text}</speak>`
  
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { ssml: ssmlText },
        voice: {
          languageCode: "ko-KR",
          name: voiceModel,
          ssmlGender: "MALE",
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0,
        },
        enableTimePointing: ["SSML_MARK"],
      }),
    }
  )
  
  if (!response.ok) {
    throw new Error(`Google TTS API 오류: ${response.status}`)
  }
  
  const data = await response.json()
  const audioContent = data.audioContent
  const timepoints = data.timepoints || []
  
  // Base64 디코딩하여 오디오 버퍼 생성
  const audioBuffer = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })
  const audioUrl = URL.createObjectURL(audioBlob)
  
  return {
    audioUrl,
    audioBuffer,
    timepoints,
  }
}
```

---

## ⚠️ 주의사항

1. **텍스트 길이 제한**: 각 TTS 서비스마다 최대 텍스트 길이가 다릅니다.
2. **청크 분할**: 긴 텍스트는 자연스러운 위치에서 나누어야 합니다.
3. **파일 형식**: Superton은 WAV, 나머지는 MP3를 사용합니다.
4. **타임스탬프**: Google TTS와 ElevenLabs는 자막 동기화를 위한 타임스탬프를 제공합니다.
5. **API 키 관리**: 각 서비스의 API 키를 안전하게 관리해야 합니다.

---

## 📌 요약

- **지원 서비스**: Superton, TTSMaker, ElevenLabs, Google Cloud TTS
- **주요 기능**: 
  - 텍스트를 음성으로 변환
  - 긴 텍스트 자동 분할 및 합치기
  - 자막 동기화를 위한 타임스탬프 제공
- **출력 형식**: WAV (Superton), MP3 (기타)
- **언어**: 한국어 (ko-KR) 기본 지원

---

**문서 작성일**: 2024년  
**버전**: 1.0









