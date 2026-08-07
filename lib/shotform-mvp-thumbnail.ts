/** MVP·쇼핑숏폼 공용 — Replicate nano-banana-pro 썸네일 생성 */

import type { ProductAnalysis } from "@/lib/shotform-auto-edit-types"
import type { MvpScriptStyleState } from "@/lib/mvp-studio-types"

export type ThumbnailHookingText = { line1: string; line2: string }

export type ThumbnailTextRole = "hook1" | "hook2" | "badge" | "custom"

export type ThumbnailHookingInput = {
  productName: string
  productCategory?: string
  productFeatures?: string
  productBenefits?: string
  videoScript?: string
}

export type RewriteThumbnailTextInput = {
  productName: string
  currentText: string
  role?: ThumbnailTextRole
  otherLines?: string[]
  hookingContext?: ThumbnailHookingInput
}

/** 쇼핑숏폼 AI 썸네일 카피 — 후킹 생성·리라이트 공용 */
export const THUMBNAIL_HOOKING_MIN_CHARS = 4
export const THUMBNAIL_HOOKING_MAX_CHARS = 10
export const THUMBNAIL_HOOKING_IDEAL_MAX_CHARS = 8

export const THUMBNAIL_HOOKING_BANNED_PHRASES = [
  "살면서 가장",
  "최고의",
  "역대급",
  "미쳤다",
  "엄청난",
  "초강력",
  "대박",
  "레전드",
  "혁신적인",
  "끝판왕",
  "갓성비",
] as const

export const THUMBNAIL_HOOKING_SYSTEM_PROMPT = `역할
당신은 대한민국 쇼핑 숏폼에서 조회수 수백만 회 이상을 만든 최고의 썸네일 카피라이터입니다.
목표는 제품을 설명하는 것이 아니라 스크롤을 멈추게 만드는 것입니다.
썸네일 문구는 광고 문구가 아니라 실제 사람들이 궁금해서 누르게 만드는 문구를 작성해야 합니다.
항상 CTR(클릭률)을 최우선으로 생각합니다.

입력값
사용자는 제품명, 제품 카테고리, 제품 특징, 제품 장점, 영상 대본을 제공합니다.
대본을 먼저 분석하여 사람들이 공감하는 문제, 가장 강력한 장점, 가장 놀라운 결과, 클릭하고 싶은 요소를 추출한 후 썸네일 문구를 생성합니다.
제품명이 아니라 사람이 얻는 결과를 우선합니다.

생성 규칙
- 반드시 위 1줄(line1) + 아래 1줄(line2), 총 2줄만 생성
- 위·아래를 이어 읽으면 자연스러운 한 후킹이 되어야 함
- 각 줄 ${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자 (가능하면 6~8자)
- JSON만 출력: {"line1":"...","line2":"..."}

절대 금지 표현
${THUMBNAIL_HOOKING_BANNED_PHRASES.join(", ")}

금지: 의미 없는 형용사, 제품명만 강조, 제품 설명형 문구
예) ❌ 초강력 선풍기, ❌ 최고의 선풍기, ❌ 시원한 선풍기, ❌ BLDC 선풍기, ❌ 휴대용 선풍기

원칙
- 제품을 설명하지 않음. 제품을 사고 싶은 이유(결과·궁금증·손해·반전)를 먼저 보여줌
- 실제 사람이 말하는 것처럼, 친구에게 이야기하는 느낌. 광고처럼 쓰지 않음
- 보는 사람이 "왜?", "진짜?", "뭐길래?", "나도?"라고 생각하게 작성

생성 우선순위 (가장 강한 후킹부터)
① 손해 (예: 200만원 날림, 이거 몰랐어요)
② 결과 (예: 전기세 반토막, 출근길 끝, 더위 끝, 집안이 달라짐)
③ 숫자 (예: 3초 만에, 5시간 사용, 99% 제거, 10배 시원)
④ 호기심 (예: 여기에 이걸?, 다들 이거 씀, 왜 이걸 살까?)
⑤ 사회적 증거 (예: 회사에서 난리, 친구가 뺏어감, 다들 물어봄)

패턴 (하나 선택)
- (궁금증) ↓ (결과) — 손바닥만 한데 / 에어컨급 바람
- (문제) ↓ (해결) — 출근길 땀범벅 / 이걸로 끝
- (숫자) ↓ (결과) — 3초 만에 / 더위 끝
- (경험) ↓ (결과) — 친구가 써보래서 / 바로 샀어요
- (손해) ↓ (반전) — 이거 몰라서 / 10만원 손해

좋은 예
출근길 필수 / 더위 끝
손바닥만 한데 / 에어컨급 바람
이거 하나로 / 전기세 절약
회사에서 / 다 물어봄
여름마다 / 이것만 씀
다들 이거 쓰길래 / 써봤는데
이거 몰라서 / 여름 고생`

export function buildThumbnailHookingInput(args: {
  productName: string
  productAnalysis?: Pick<
    ProductAnalysis,
    "category" | "summary" | "targetKeywords" | "videoStructure" | "scenes"
  > | null
  scriptStyle?: Pick<MvpScriptStyleState, "conversionScript" | "storytellingScript"> | null
  segments?: readonly { text?: string }[]
}): ThumbnailHookingInput {
  const productName = args.productName.trim() || "제품"
  const pa = args.productAnalysis

  const videoScript =
    args.scriptStyle?.conversionScript?.trim() ||
    args.scriptStyle?.storytellingScript?.trim() ||
    args.segments
      ?.map((s) => s.text?.trim())
      .filter(Boolean)
      .join("\n") ||
    ""

  const featureParts: string[] = []
  if (pa?.summary?.trim()) featureParts.push(pa.summary.trim())
  if (pa?.targetKeywords?.length) {
    featureParts.push(`키워드: ${pa.targetKeywords.slice(0, 10).join(", ")}`)
  }
  if (pa?.scenes?.length) {
    featureParts.push(
      `장면 요약: ${pa.scenes
        .slice(0, 4)
        .map((s) => s.description?.trim())
        .filter(Boolean)
        .join(" / ")}`
    )
  }

  const benefitParts: string[] = []
  if (pa?.videoStructure?.hook?.trim()) benefitParts.push(`후킹: ${pa.videoStructure.hook.trim()}`)
  if (pa?.videoStructure?.body?.trim()) benefitParts.push(`본문: ${pa.videoStructure.body.trim()}`)
  if (pa?.videoStructure?.cta?.trim()) benefitParts.push(`CTA: ${pa.videoStructure.cta.trim()}`)
  if (!benefitParts.length && pa?.summary?.trim()) benefitParts.push(pa.summary.trim())

  return {
    productName,
    productCategory: pa?.category?.trim() || undefined,
    productFeatures: featureParts.length ? featureParts.join("\n") : undefined,
    productBenefits: benefitParts.length ? benefitParts.join("\n") : undefined,
    videoScript: videoScript ? videoScript.slice(0, 4000) : undefined,
  }
}

function resolveHookingInput(input: string | ThumbnailHookingInput): ThumbnailHookingInput {
  if (typeof input === "string") {
    return { productName: input.trim() || "제품" }
  }
  return {
    ...input,
    productName: input.productName.trim() || "제품",
  }
}

export function buildThumbnailHookingUserPrompt(input: string | ThumbnailHookingInput): string {
  const ctx = resolveHookingInput(input)
  const blocks = [
    `제품명: ${ctx.productName}`,
    ctx.productCategory ? `제품 카테고리: ${ctx.productCategory}` : "",
    ctx.productFeatures ? `제품 특징:\n${ctx.productFeatures}` : "",
    ctx.productBenefits ? `제품 장점:\n${ctx.productBenefits}` : "",
    ctx.videoScript ? `영상 대본:\n${ctx.videoScript}` : "",
  ].filter(Boolean)

  return `${blocks.join("\n\n")}

위 정보를 분석하세요.
1) 공감 문제 2) 가장 강력한 장점 3) 가장 놀라운 결과 4) 클릭하고 싶은 요소를 먼저 떠올린 뒤
쇼츠 썸네일용 위·아래 2줄 후킹을 작성하세요.
- line1(위) + line2(아래)를 합쳐 읽으면 하나의 후킹
- 각 줄 ${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자, 6~8자 권장
- 제품명·설명형 문구 금지, 금지 표현 사용 금지
- 추가 설명 없이 JSON만: {"line1":"...","line2":"..."}`
}

function clampThumbnailCopyLine(text: string, max = THUMBNAIL_HOOKING_MAX_CHARS): string {
  const t = text.trim().replace(/\s+/g, " ")
  if (t.length <= max) return t
  return t.slice(0, max).trim()
}

function containsBannedHookingPhrase(text: string, productName?: string): boolean {
  const t = text.trim()
  if (!t) return true
  const lower = t.toLowerCase()
  if (THUMBNAIL_HOOKING_BANNED_PHRASES.some((p) => lower.includes(p.toLowerCase()))) return true
  const name = productName?.trim()
  if (name && name.length >= 2 && t.includes(name)) return true
  return false
}

function isValidHookingLine(text: string, productName?: string): boolean {
  const t = text.trim()
  if (t.length < THUMBNAIL_HOOKING_MIN_CHARS || t.length > THUMBNAIL_HOOKING_MAX_CHARS) return false
  return !containsBannedHookingPhrase(t, productName)
}

function normalizeHookingText(
  raw: { line1?: string; line2?: string },
  productName?: string
): ThumbnailHookingText {
  const line1 = clampThumbnailCopyLine(raw.line1?.trim() || "")
  const line2 = clampThumbnailCopyLine(raw.line2?.trim() || "")
  if (isValidHookingLine(line1, productName) && isValidHookingLine(line2, productName)) {
    return { line1, line2 }
  }
  return pickHookingPairFallback(undefined, undefined, productName)
}

const HOOKING_PAIRS: readonly ThumbnailHookingText[] = [
  { line1: "출근길 필수", line2: "더위 끝" },
  { line1: "손바닥만 한데", line2: "에어컨급 바람" },
  { line1: "이거 하나로", line2: "전기세 절약" },
  { line1: "회사에서", line2: "다 물어봄" },
  { line1: "3초 만에", line2: "더위 끝" },
  { line1: "이거 몰라서", line2: "여름 고생" },
  { line1: "출근길 땀범벅", line2: "이걸로 끝" },
  { line1: "다들 이거 쓰길래", line2: "써봤는데" },
] as const

const BADGE_FALLBACKS = ["한정", "오늘만", "마감", "최저가", "1+1"] as const

function pickHookingPairFallback(
  otherLine?: string,
  role?: ThumbnailTextRole,
  productName?: string
): ThumbnailHookingText {
  const other = otherLine?.trim()
  if (other && (role === "hook1" || role === "hook2")) {
    const matched = HOOKING_PAIRS.find((p) =>
      role === "hook1" ? p.line2 === other : p.line1 === other
    )
    if (matched) return matched
  }
  const valid = HOOKING_PAIRS.filter(
    (p) =>
      isValidHookingLine(p.line1, productName) && isValidHookingLine(p.line2, productName)
  )
  const pool = valid.length ? valid : HOOKING_PAIRS
  return pool[Math.floor(Math.random() * pool.length)]!
}

function pickFallbackText(
  role: ThumbnailTextRole | undefined,
  currentText: string,
  otherLines: string[],
  productName?: string
): string {
  if (role === "hook1" || role === "hook2") {
    const pair = pickHookingPairFallback(otherLines[0], role, productName)
    return role === "hook1" ? pair.line1 : pair.line2
  }
  if (role === "badge") {
    const blocked = new Set([currentText.trim(), ...otherLines.map((l) => l.trim())].filter(Boolean))
    const candidates = BADGE_FALLBACKS.filter((t) => !blocked.has(t))
    const list = candidates.length ? candidates : [...BADGE_FALLBACKS]
    return list[Math.floor(Math.random() * list.length)]
  }
  const pair = pickHookingPairFallback(undefined, undefined, productName)
  return pair.line1
}

function rolePromptHint(role: ThumbnailTextRole | undefined): string {
  if (role === "hook1") {
    return `첫 번째 후킹 줄(상단): ${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자. 궁금증·문제·손해·숫자 중 하나. 아래 줄과 합쳐 한 메시지의 앞반`
  }
  if (role === "hook2") {
    return `두 번째 후킹 줄(하단): ${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자. 결과·해결·반전·사회적 증거. 위 줄과 합쳐 한 메시지의 뒷반`
  }
  if (role === "badge") {
    return `뱃지 라벨: 2~${THUMBNAIL_HOOKING_MAX_CHARS}자, 짧고 강렬`
  }
  return `쇼츠 썸네일 후킹 한 줄 (${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자)`
}

function buildThumbnailRewriteSystemPrompt(role?: ThumbnailTextRole): string {
  const pairRule =
    role === "hook1" || role === "hook2"
      ? "\n- **짝 줄과 한 세트**: 위+아래 합쳐 읽으면 하나의 후킹 메시지. 짝 줄 문구는 유지하고, 수정하는 줄만 짝과 자연스럽게 이어지게 작성"
      : ""
  return `${THUMBNAIL_HOOKING_SYSTEM_PROMPT}

추가 규칙 (한 줄 리라이트):
- ${rolePromptHint(role)}${pairRule}
- 반드시 한 줄만 출력: {"text": "새 문구"}
- 현재 문구와 완전히 다른 새 문구`
}

function parseReplicateImageOutput(output: unknown): string {
  if (typeof output === "string") return output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object" && "url" in first) {
      return String((first as { url: string }).url)
    }
    return String(first)
  }
  if (output && typeof output === "object" && "url" in output) {
    return String((output as { url: string }).url)
  }
  return String(output)
}

async function pollReplicatePrediction(predictionId: string, token: string, maxAttempts = 120): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!statusResponse.ok) {
      throw new Error(`Replicate 상태 확인 실패: ${statusResponse.status}`)
    }

    const statusData = (await statusResponse.json()) as {
      status?: string
      output?: unknown
      error?: string
    }

    if (statusData.status === "succeeded" && statusData.output) {
      return parseReplicateImageOutput(statusData.output)
    }
    if (statusData.status === "failed") {
      throw new Error(`썸네일 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
    }
  }

  throw new Error("썸네일 생성 시간 초과 (Replicate 폴링)")
}

export async function rewriteThumbnailLayerText(
  input: RewriteThumbnailTextInput,
  apiKey?: string
): Promise<string> {
  const ctx = input.hookingContext ?? { productName: input.productName }
  const productName = ctx.productName.trim() || input.productName.trim() || "제품"
  const currentText = input.currentText.trim()
  const otherLines = (input.otherLines ?? []).map((l) => l.trim()).filter(Boolean)
  const role = input.role
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    return pickFallbackText(role, currentText, otherLines, productName)
  }

  const otherHint =
    otherLines.length > 0
      ? role === "hook1" || role === "hook2"
        ? `\n짝이 되는 다른 줄(반드시 이어 읽기): 「${otherLines[0]}」\n위·아래를 합치면 하나의 후킹이 되도록, ${role === "hook1" ? "상단(앞반)" : "하단(뒷반)"}만 새로 작성`
        : `\n다른 줄에 이미 사용된 문구(단어 중복 금지): ${otherLines.join(" / ")}`
      : ""

  const contextHint = buildThumbnailHookingUserPrompt({ ...ctx, productName })

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: buildThumbnailRewriteSystemPrompt(role),
          },
          {
            role: "user",
            content: `${contextHint}

현재 문구: ${currentText || "(비어 있음)"}
역할: ${role ?? "custom"}${otherHint}

${THUMBNAIL_HOOKING_MIN_CHARS}~${THUMBNAIL_HOOKING_MAX_CHARS}자, 짧고 굵은 후킹 한 줄만 작성하세요.
{"text": "..."}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 80,
        temperature: 0.95,
      }),
    })

    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("문구 변환에 실패했습니다.")

    let parsed: { text?: string }
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content
    } catch {
      return pickFallbackText(role, currentText, otherLines, productName)
    }

    const next = parsed.text?.trim()
    if (!next || !isValidHookingLine(clampThumbnailCopyLine(next), productName)) {
      return pickFallbackText(role, currentText, otherLines, productName)
    }
    return clampThumbnailCopyLine(next)
  } catch (error) {
    console.error("[MVP Thumbnail] 문구 변환 실패:", error)
    return pickFallbackText(role, currentText, otherLines, productName)
  }
}

export async function generateThumbnailHookingText(
  input: string | ThumbnailHookingInput,
  apiKey?: string
): Promise<ThumbnailHookingText> {
  const ctx = resolveHookingInput(input)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    return pickHookingPairFallback(undefined, undefined, ctx.productName)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: THUMBNAIL_HOOKING_SYSTEM_PROMPT },
          { role: "user", content: buildThumbnailHookingUserPrompt(ctx) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 120,
        temperature: 0.92,
      }),
    })

    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error("후킹 문구 생성에 실패했습니다.")

    let parsed: { line1?: string; line2?: string }
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content
    } catch {
      return pickHookingPairFallback(undefined, undefined, ctx.productName)
    }

    return normalizeHookingText(parsed, ctx.productName)
  } catch (error) {
    console.error("[MVP Thumbnail] 후킹 문구 생성 실패:", error)
    return pickHookingPairFallback(undefined, undefined, ctx.productName)
  }
}

export type StoryThumbnailCopy = ThumbnailHookingText & {
  subheadline: string
}

type StoryThumbnailRewrite = {
  role?: ThumbnailTextRole
  currentText?: string
  otherLines?: string[]
}

const STORY_THUMBNAIL_COPY_SYSTEM_PROMPT = `당신은 한국 정보·스토리 쇼츠 채널의 썸네일 카피라이터입니다.
조회수가 높은 레퍼런스의 문장 구조를 사용하되, 입력에 없는 사실은 절대 만들지 않습니다.

핵심 구조:
- 익숙한 대상·인물·장소를 먼저 제시하고, 예상 밖의 사건·결과·근황·이유를 뒤에 배치
- 정답을 전부 말하지 않고 "왜 이런 일이 생겼지?"라는 정보 공백을 남김
- line1은 상황·대상·주장, line2는 반전·결과·핵심 명사·질문
- subheadline은 같은 내용을 더 구체적으로 설명하되 제목을 그대로 반복하지 않음

사용 가능한 후킹 공식:
1. [익숙한 대상] + [실수·반전·뜻밖의 결과]
2. [시간·현재 상황] + [이상한 변화·근황?]
3. [평범한 물건] + [숨겨진 이유·비밀]
4. [논쟁적 주장] + [사실 확인 질문?]
5. [인물·집단] + [예상 밖의 발명·구조·행동]

문체 예시(구조만 참고):
- 구조 하나로 떼돈 번 / 일본 천재의 발명품
- 실시간 떡상한 / 뜻밖의 메뉴?
- 심각해졌다는 / 유명 업체 근황?
- 400개월이 환장하는 / 도시락 통
- 참전용사가 밝혀서 만든 / 치즈젤리

규칙:
- line1·line2 각각 5~14자, 두 줄을 합쳐 하나의 제목
- subheadline 8~24자
- 핵심 단어 한두 개만 강조하기 좋은 위치에 배치
- 제품 장점 나열, 구매 명령, 광고 말투 금지
- "대박, 레전드, 역대급, 인생템, 무조건, 미쳤다" 금지
- 연도·금액·국가·기업·인물·조회수·효능은 입력에 실제로 있을 때만 사용
- 과장하거나 사실처럼 날조하지 말 것
- JSON만 출력: {"line1":"...","line2":"...","subheadline":"..."}`

function cleanStoryThumbnailLine(
  value: string | undefined,
  maxLength: number
): string {
  return (value || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim()
    .slice(0, maxLength)
    .trim()
}

function fallbackStoryThumbnailCopy(
  productName: string
): StoryThumbnailCopy {
  const subject = cleanStoryThumbnailLine(productName, 10) || "이 제품"
  return {
    line1: `${subject}에 숨겨진`.slice(0, 14),
    line2: "뜻밖의 진짜 이유",
    subheadline: `${subject}를 다시 보게 된 결정적 장면`.slice(0, 24),
  }
}

export async function generateStoryThumbnailCopy(
  input: string | ThumbnailHookingInput,
  apiKey?: string,
  rewrite?: StoryThumbnailRewrite
): Promise<StoryThumbnailCopy> {
  const ctx = resolveHookingInput(input)
  const GPT_API_KEY =
    apiKey ||
    process.env.GPT_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.CHATGPT_API_KEY
  const fallback = fallbackStoryThumbnailCopy(ctx.productName)
  if (!GPT_API_KEY) return fallback
  const storyContext = [
    `제품·주제명: ${ctx.productName}`,
    ctx.productCategory ? `카테고리: ${ctx.productCategory}` : "",
    ctx.productFeatures ? `제품 특징·스토리 요약:\n${ctx.productFeatures}` : "",
    ctx.productBenefits ? `핵심 결과·장점:\n${ctx.productBenefits}` : "",
    ctx.videoScript ? `영상 대본:\n${ctx.videoScript}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  const rewriteBlock = rewrite?.role
    ? `
현재 수정 대상: ${rewrite.role}
현재 문구: ${rewrite.currentText || "(비어 있음)"}
다른 문구: ${(rewrite.otherLines || []).join(" / ") || "(없음)"}
수정 대상의 의미를 새롭게 바꾸되, 나머지 줄과 자연스럽게 이어지는 전체 JSON을 다시 작성하세요.`
    : ""

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: STORY_THUMBNAIL_COPY_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${storyContext}
${rewriteBlock}

입력에서 검증 가능한 가장 흥미로운 사건 하나만 골라 스토리형 썸네일 문구를 작성하세요.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 180,
        temperature: 0.82,
      }),
    })
    if (!response.ok) throw new Error(`API 호출 실패: ${response.status}`)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const parsed = (
      typeof content === "string" ? JSON.parse(content) : content
    ) as Partial<StoryThumbnailCopy>
    const result = {
      line1: cleanStoryThumbnailLine(parsed?.line1, 14),
      line2: cleanStoryThumbnailLine(parsed?.line2, 14),
      subheadline: cleanStoryThumbnailLine(parsed?.subheadline, 24),
    }
    if (
      result.line1.length < 5 ||
      result.line2.length < 5 ||
      result.subheadline.length < 8
    ) {
      return fallback
    }
    return result
  } catch (error) {
    console.error("[Story Thumbnail] 후킹 문구 생성 실패:", error)
    return fallback
  }
}

const PRODUCT_PRESERVATION_RULES = `CRITICAL PRODUCT PRESERVATION RULES (MUST FOLLOW - ABSOLUTELY MANDATORY):
- The product's physical shape, proportions, dimensions, and design must be preserved EXACTLY as shown in the reference image
- Product must NOT be deformed, abstracted, redesigned, or modified in any way
- Product must remain recognizable and maintain its original form, structure, and appearance
- Do NOT alter the product's structure, size, shape, proportions, or appearance
- The product in the image must match the reference product image EXACTLY
- Maintain exact original product features, buttons, switches, controls, and design elements from reference image
- Do NOT add new features, buttons, switches, or controls that are not present in the original product
- Do NOT remove or modify any existing features, buttons, or design elements from the original product
- Product's original design and structure must be preserved accurately (exact product design preservation, maintain original product structure)
- The product's actual appearance must be accurately reflected (product preservation, exact product shape and features maintained)
- Only maintain original product features, buttons, and design elements from the reference image
- Never add new features, buttons, or switches not present in the original
- Exact original product design and structure must be preserved`

export type ThumbnailStyleHints = {
  templateFocus?: string
  styleInstructions?: string
}

function buildThumbnailPrompt(
  productName: string,
  hookingText?: ThumbnailHookingText,
  styleHints?: ThumbnailStyleHints
): string {
  const focus = (styleHints?.templateFocus || "").trim()
  const style = (styleHints?.styleInstructions || "").trim()
  const creativeBlock =
    focus || style
      ? `

Creative direction (keep product identity locked; weaken style if it conflicts with the reference product):
${focus ? `- Template focus: ${focus}` : ""}
${style ? `- Style: ${style}` : ""}
- Prefer restaging the reference product (same silhouette/color/material) over inventing a new SKU
- Do not invent fake discounts, ratings, platform UI, or unsupported claims`
      : ""

  return `YouTube shopping shorts thumbnail with text style.

Product: ${productName}

${PRODUCT_PRESERVATION_RULES}
${creativeBlock}

Background: Show the product being actively used in a real-world scenario. The product's main function must be clearly demonstrated. Hands operating or using the product are allowed. Realistic product usage scene, natural lighting, authentic environment. Photo-realistic style, not illustration.

Text to display (CRITICAL - MUST FOLLOW EXACTLY - ABSOLUTELY MANDATORY):
- Display EXACTLY two lines of text (NOT one line, NOT three lines, EXACTLY two lines)
- Line 1 (top line): "${hookingText ? hookingText.line1 : productName}"
- Line 2 (bottom line): "${hookingText ? hookingText.line2 : "쇼츠 영상"}"
- BOTH lines MUST be displayed - Line 1 AND Line 2 are REQUIRED
- DO NOT combine the two lines into one
- DO NOT display only one line
- DO NOT skip either line
- ABSOLUTELY NO duplicate words between the two lines
- Each line must have completely different words
- If any word appears in Line 1, it must NOT appear in Line 2
- If any word appears in Line 2, it must NOT appear in Line 1
- The two lines must be distinct and non-repetitive
- Display exactly as provided above, no variations, no duplicates
- Line 1 must be on top, Line 2 must be on bottom
- Both lines must be clearly visible and readable

Text style requirements:
- Very bold Korean typography
- Huge text, high contrast
- EXACTLY two lines of text displayed prominently (no more, no less)
- Match the selected creative style's headline placement, colors, lighting, graphic energy, and composition as closely as possible
${style ? `- Selected style is mandatory: ${style}` : "- Default colors: first line white, second line neon mint / turquoise"}
- Keep both lines readable against the background with tasteful contrast
- Optimized for mobile readability
- Text should look like it's overlaid on a photo
- Photo-realistic text rendering

Image requirements:
- Product usage scene as background (photo-realistic)
- Product being actively used (product shape, structure, features, buttons, and design MUST be preserved exactly as in reference image)
- Product must maintain exact original form, features, buttons, and design elements from reference image
- Do NOT add new features, buttons, or controls not present in the original product
- Hands operating the product are visible
- Natural, realistic environment
- High quality, professional photography style
- 9:16 vertical aspect ratio
- No human faces, no face visible
- Realistic lighting and shadows
- Product must be the exact same product from the reference image (exact product design preservation, maintain original product structure, exact product shape and features maintained)

Product highlighting elements:
- Add a bright red arrow or red circle to highlight and point to the product
- Red arrow should point directly at the product
- Red circle should surround or highlight the product area
- Use vibrant red color (#FF0000 or similar) for high visibility
- Arrow or circle should be bold and eye-catching
- These elements should draw attention to the product
- Professional YouTube thumbnail style highlighting`
}

function buildBackgroundOnlyPrompt(productName: string): string {
  return `YouTube shopping shorts PHOTO LAYER — NO text layer. The product from the reference image MUST remain clearly visible.

Product: ${productName}

${PRODUCT_PRESERVATION_RULES}

REFERENCE IMAGE IS THE SOURCE OF TRUTH:
- The attached reference image, not the product name text, defines the exact product identity
- Copy the exact same product into the new scene; only the environment, lighting, camera composition, and natural usage pose may change
- Preserve its exact silhouette, animal/species/character identity, face, ears, limbs, stitching, pattern, color, texture, attachments, straps, and proportions
- Never replace it with a similar product, generic substitute, different plush character, different animal, or newly invented object
- If the reference product is a wearable or hand-held item, keep that exact item visibly worn or held in the generated scene
- The exact reference product must occupy roughly 35–65% of the frame and remain immediately recognizable

ABSOLUTELY NO TEXT (CRITICAL):
- Do NOT include any text, letters, numbers, typography, captions, subtitles, watermarks, or logos with words
- Do NOT include Korean or English characters anywhere in the image
- The image must be a clean photo background only — text will be added separately in an editor

Scene requirements:
- Show the product being actively used in a real-world scenario
- Product's main function clearly demonstrated
- Hands operating the product are allowed (no human faces visible)
- Realistic product usage scene, natural lighting, authentic environment
- Photo-realistic photography style, not illustration
- 9:16 vertical aspect ratio — full-bleed edge-to-edge photo filling the entire frame
- NO empty bands, gray bars, blank sky strips, or letterboxing at the top, bottom, or sides
- Scene and environment must extend naturally across the full canvas height and width
- High quality, professional photography
- Product clearly visible (may be in center or lower area) but background must fill the whole frame
- No arrows, circles, badges, or graphic overlays (those will be added in the editor)

FINAL IDENTITY CHECK — OVERRIDES ALL CREATIVE DIRECTIONS:
- Before producing the image, compare the generated product against the reference image
- If the exact reference product is absent, hidden, changed into another character/species/model, or structurally modified, the result is invalid
- Output a new photograph containing the EXACT SAME reference product, not merely a scene inspired by it`
}

function normalizeReferenceImageInput(productImageBase64: string): string[] | undefined {
  const input = productImageBase64.trim()
  if (!input) return undefined

  if (input.startsWith("data:image/") || /^https?:\/\//i.test(input)) {
    return [input]
  }
  if (input.startsWith("blob:")) {
    console.warn("[MVP Thumbnail] blob 제품 이미지는 서버에서 접근할 수 없어 입력에서 제외합니다.")
    return undefined
  }

  // 헤더 없이 저장된 기존 프로젝트의 base64 이미지와 호환
  const mimeType = input.startsWith("/9j/") ? "image/jpeg" : "image/png"
  return [`data:${mimeType};base64,${input}`]
}

async function runNanoBananaPro(
  token: string,
  prompt: string,
  productImageBase64?: string,
  logLabel = "생성"
): Promise<string> {
  const imageInput = productImageBase64?.trim() ? normalizeReferenceImageInput(productImageBase64.trim()) : undefined

  const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "9:16",
        ...(imageInput ? { image_input: imageInput } : {}),
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("[MVP Thumbnail] Replicate 오류:", errorText)
    throw new Error(`썸네일 생성 실패: ${response.status} - ${errorText.substring(0, 300)}`)
  }

  const data = (await response.json()) as {
    id?: string
    status?: string
    output?: unknown
    error?: string
  }

  if (data.status === "succeeded" && data.output) {
    const imageUrl = parseReplicateImageOutput(data.output)
    console.log(`[MVP Thumbnail] ${logLabel} 완료:`, imageUrl)
    return imageUrl
  }

  if ((data.status === "processing" || data.status === "starting") && data.id) {
    const imageUrl = await pollReplicatePrediction(data.id, token)
    console.log(`[MVP Thumbnail] ${logLabel} 완료 (폴링):`, imageUrl)
    return imageUrl
  }

  throw new Error(`이미지 생성 실패: ${data.error || data.status || "알 수 없는 오류"}`)
}

function resolveReplicateToken(replicateApiKey?: string): string {
  const token = replicateApiKey?.trim() || process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. ShotForm 설정에서 API 키를 입력해 주세요.")
  }
  return token
}

/** Replicate google/nano-banana-pro — 9:16 쇼츠 썸네일 URL 반환 */
export async function generateShortsThumbnail(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string,
  hookingText?: ThumbnailHookingText,
  styleHints?: ThumbnailStyleHints
): Promise<string> {
  const token = resolveReplicateToken(replicateApiKey)
  const thumbnailPrompt = buildThumbnailPrompt(productName, hookingText, styleHints)
  console.log("[MVP Thumbnail] Replicate nano-banana-pro 썸네일 생성 시작:", productName)
  return runNanoBananaPro(token, thumbnailPrompt, productImageBase64, "썸네일 생성")
}

/** Replicate — 텍스트·오버레이 없이 배경 장면만 생성 */
export async function generateShortsThumbnailBackground(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const token = resolveReplicateToken(replicateApiKey)
  const prompt = buildBackgroundOnlyPrompt(productName)
  console.log("[MVP Thumbnail] Replicate nano-banana-pro 배경 생성 시작:", productName)
  return runNanoBananaPro(token, prompt, productImageBase64, "배경 생성")
}
