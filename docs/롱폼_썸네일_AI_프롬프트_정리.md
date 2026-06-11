# 롱폼 · AI 썸네일 (프롬프트·출력 흐름 정리)

**구현:** `app/WingsAIStudio/longform/actions.ts`  
**UI:** `page.tsx` — `handleThumbnailGeneration`(문구), `handleAIGenerateThumbnail`(이미지)

기능 개요·API·폴링은 **`docs/롱폼_썸네일_생성_기능명세.md`** 참고. 이 문서는 **프롬프트가 무엇이고, 그 결과가 어떻게 이어지는지**만 압축 정리한다.

---

## 1. 전체 흐름

```text
[선택 A] 대본 → GPT → 썸네일 카피 2줄 (line1, line2) → 사용자가 합쳐서 thumbnailCustomText 등으로 편집

[선택 B] 참조 썸네일 이미지 URL + OpenAI 키
    → GPT-4o 비전 → 영문 "벤치마크 스타일 서술" (analyzedBenchmarkStyle)
    → (또는 URL만 넘기면 generateAIThumbnail 내부에서 analyzeThumbnailStyle 호출)

주제(topic) + Replicate 키 + 옵션(문구, 스타일, 벤치, 문구없음, 캐릭터)
    → 프롬프트 조합
    → Replicate nano-banana-pro → 이미지 URL
```

**이미지 한 장**이 나오는 구조이며, 문구는 GPT 2줄과 **별개로** `customText`(커스텀 문구)로 Replicate 프롬프트에 직접 실릴 수 있다.

---

## 2. 썸네일 카피 2줄 — `generateThumbnailText`

| 항목 | 내용 |
|------|------|
| 모델 | `gpt-4o-mini` |
| `temperature` | `0.8` |
| `max_tokens` | `200` |

**System (원문)**

```text
당신은 썸네일 텍스트 생성 전문가입니다. 대본을 분석하여 썸네일에 적합한 짧고 임팩트 있는 텍스트 2줄을 생성해주세요.
```

**User (템플릿)**

- `대본:\n` + `script.substring(0, 2000)`
- 선택: `제목: ${title}`
- 요청: 각 줄 **5~10자 내외**, 응답은 **`{"line1":"...","line2":"..."}`** JSON

**출력 처리:** 응답에서 `{...}` 를 찾아 `JSON.parse` → `line1`/`line2`. 실패 시 `"첫 줄"` / `"둘째 줄"` 폴백.

---

## 3. 벤치마크 썸네일 분석 — `analyzeThumbnailStyle` (비공개 함수)

| 항목 | 내용 |
|------|------|
| 모델 | `gpt-4o` |
| 입력 | 참조 이미지를 **data URL base64** 로 멀티모달 `image_url` |
| `temperature` | `0.2` |
| `max_tokens` | `1000` |

**역할:** 한국어 지시로 **레이아웃·텍스트 위치·색·타이포·구도·분위기**를 뽑되, **답변 본문은 영어**로 길게 쓰게 함. 이 문자열이 이후 Replicate 프롬프트의 **“BENCHMARK THUMBNAIL ANALYSIS”** 본문이 된다.

**텍스트 지시 핵심 (요약)**

1. 텍스트 위치·정렬·줄 수·텍스트/이미지 비율·여백  
2. 색·효과(그림자·외곽선·배경 박스)·폰트 추정  
3. 색 팔레트·톤  
4. 레이아웃·시각 스타일  
5. 예시 한 줄 형식(영문) 제시 후, **같은 레이아웃으로 썸네일을 다시 만들 수 있을 정도로 구체적으로** 영어로 작성하라고 요구.

원문 전체는 `actions.ts` 약 `4827`~`4863`행.

---

## 4. 이미지 생성 — `generateAIThumbnail` (Replicate 프롬프트)

**공통 출력 지시:** 유튜브 썸네일, **16:9**, 주제 문자열 `topic` 반영.  
Replicate `input`: `aspect_ratio: "16:9"`, `output_format: "png"`, (분기에 따라) `negative_prompt`.

### 4.1 `withoutText === true` (문구 없이 그림만)

- 주제 문자열에서 `제목|타이틀|텍스트|...` 등 **텍스트 연상 단어**를 정규식으로 지운 `visualTopic` 사용.
- **basePrompt** 요지: 순수 비주얼, **NO TEXT / NO LETTERS / …** 반복 강조, 텍스트 금지가 최우선.
- **negative_prompt**: `text`, `typography`, `Korean text`, `logos` 등 길게 나열.

### 4.2 벤치마크 영문 분석이 있을 때 (`analyzedBenchmarkStyle` 또는 분석된 `benchmarkStylePrompt`)

코드 곳곳에서 유사한 **영문 템플릿**이 반복된다. 골격은 다음과 같다.

```text
Create a YouTube thumbnail for video about: "{topic}".

🚨 CRITICAL: The following benchmark thumbnail analysis is your PRIMARY PROMPT.
Follow it EXACTLY (same layout, text position, colors, illustration style, visual elements).

BENCHMARK THUMBNAIL ANALYSIS (Follow this EXACTLY):
{벤치마크_영문_분석_전문}

MANDATORY REQUIREMENTS:
1. TEXT POSITION AND LAYOUT: ...
2. TEXT VISUAL PROPERTIES: ...
3. ILLUSTRATION STYLE: ...
4. COLOR SCHEME: ...
5. LAYOUT COMPOSITION: ...
6. VISUAL STYLE: ...

TEXT CONTENT: The text content should be: "{textContent}"
- textContent = customText가 있으면 그 문자열, 없으면 topic
- 벤치에 맞춰 같은 위치·스타일로 해당 문구를 넣으라는 지시

Maintain 16:9 aspect ratio.
```

`withoutText`이면서 벤치가 있으면, 위 블록 **앞에** 다시 `NO TEXT. NO LETTERS. ...` 전치가 붙는 분기가 있다(텍스트 금지와 벤치 복제 지시가 동시에 존재할 수 있음 — 구현상 디버깅·재주입 로직이 많음).

### 4.3 벤치 없음 — 기본 `basePrompt`

```text
YouTube thumbnail for video about: {topic}. High quality, eye-catching, professional thumbnail design.
Bright colors, clear text area, engaging composition. 16:9 aspect ratio.
```

- **`customText` 있음:** `Include text or visual elements related to: "{customText}".`
- **`characterDescription` 있음:** `The thumbnail should feature the main character: {characterDescription}.`
- **`imageStyle`** 에 따라 끝에 **영문 스타일 태그** 문자열 추가 (stickman / realistic / animation2 / animation3 등, `actions.ts` 내 `stylePrompt` 분기).

### 4.4 `customStylePrompt` (UI의 실사/애니 전용 블록 등)

`thumbnailStyle` 또는 `imageStyle`에서 만든 **긴 영문 스타일 문장**이 `customStylePrompt`로 들어오면, 벤치 없는 경로에서 `stylePrompt`와 함께 최종 문자열에 합쳐지는 식으로 쓰인다(정확한 결합은 `basePrompt` 이후 `prompt` 조립 분기 참고).

---

## 5. Replicate 호출 요약

| 필드 | 값 |
|------|-----|
| URL | `POST .../v1/models/google/nano-banana-pro/predictions` |
| 헤더 | `Authorization: Token {replicateApiKey}` |
| `input.prompt` | 위에서 조합한 최종 문자열 |
| `input.aspect_ratio` | `"16:9"` |
| `input.output_format` | `"png"` |
| `input.negative_prompt` | `withoutText`일 때 위 negative 문자열 |

완료 대기: **5초 간격** 폴링, 최대 **60회**.

---

## 6. UI에서 프롬프트에 들어가는 값 매핑

| UI·상태 | `generateAIThumbnail` 인자 |
|---------|---------------------------|
| 주제 또는 대본에서 뽑은 문자열 | `topic` |
| `thumbnailCustomText` | `customText` |
| 실사/애니 또는 `imageStyle` 기반 영문 블록 | `customStylePrompt` |
| 첫 씬 이미지 프롬프트에서 추출 | `characterDescription` |
| 문구 없이 체크 | `withoutText` |
| 벤치 이미지 URL(분석 전) | `benchmarkThumbnailUrl` |
| OpenAI 키 | `openaiApiKey` (URL 분석 시) |
| 이미 분석된 영문 스타일 | `analyzedBenchmarkStyle` (**있으면 URL은 보통 넘기지 않음**) |

---

## 7. 관련 문서

- 전체 동작·코드 위치: [`docs/롱폼_썸네일_생성_기능명세.md`](./롱폼_썸네일_생성_기능명세.md)

---

*정본 코드: `app/WingsAIStudio/longform/actions.ts` — `generateThumbnailText`, `analyzeThumbnailStyle`, `generateAIThumbnail`.*
