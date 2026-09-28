"use server"

import { spawnSync } from "child_process"
import { randomUUID } from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { createMvpProjectsClient } from "@/lib/supabase/mvp-projects"
import {
  getHqAvatarById,
  type HqShoppingAvatar,
} from "@/lib/hq-shopping-avatars"
import { clampHqDurationSec } from "@/lib/hq-shopping-duration"
import {
  assertFfmpegExecutable,
  hasFfmpeg,
  resolveFfmpegPath,
} from "@/lib/ffmpeg-binaries"
import { generateImageWithNanobanana } from "./actions"

/** 초당 한국어 말하기 분량(글자) — UGC 자연 톤 기준 대략치 */
function targetScriptCharRange(durationSec: number): { min: number; max: number } {
  const min = Math.max(18, Math.round(durationSec * 4.2))
  const max = Math.round(durationSec * 6.2)
  return { min, max }
}

function fallbackHqScript(
  durationSec: number,
  editDescription?: string,
  productName?: string,
  productKindHint?: string
): string {
  const name = (productName || "").trim() || "이 제품"
  const edit = (editDescription || "").trim()
  const tip = edit ? ` ${edit.replace(/\s+/g, " ").slice(0, 40)}` : ""
  const kind = (productKindHint || "").trim()
  const isDrinkware = /텀블러|컵|보틀|물병|mug|tumbler|bottle|cup/i.test(`${name} ${kind}`)
  const isSkincare = /크림|세럼|스킨|화장품|마스크|로션|cream|serum|skincare/i.test(
    `${name} ${kind}`
  )

  if (isDrinkware) {
    // 손잡이·물 등 사진에 없을 수 있는 요소는 대본에 넣지 않음 (형상 왜곡 유발)
    if (durationSec <= 5) return `${name} 보냉 진짜 잘 돼요.${tip} 추천!`.trim()
    if (durationSec <= 8)
      return `요즘 ${name}만 들고 다녀요.${tip} 가볍고 오래 시원해서 좋아요.`.trim()
    if (durationSec <= 10)
      return `${name}으로 바꾸고 나서 휴대가 편해졌어요.${tip} 용량도 딱 좋고 추천합니다.`.trim()
    if (durationSec <= 12)
      return `출퇴근할 때 ${name} 없으면 허전해요.${tip} 보냉·보온 다 되고 디자인도 깔끔해서 만족이에요.`.trim()
    return `오늘 소개하는 ${name}, 제가 매일 쓰는 텀블러예요.${tip} 휴대하기 좋고 온도 유지가 좋아서 고민 중이면 한번 써보세요.`.trim()
  }

  if (isSkincare) {
    if (durationSec <= 5) return `${name}, 촉촉해서 좋아요.${tip} 추천해요!`.trim()
    if (durationSec <= 8)
      return `요즘 ${name} 바르고 있어요.${tip} 자극 적고 촉촉해서 추천해요.`.trim()
    return `솔직히 ${name} 처음엔 반신반의했는데, 써보니 피부가 편안해졌어요.${tip} 저도 매일 쓰는 중이에요.`.trim()
  }

  if (durationSec <= 5) {
    return `${name}, 진짜 좋아요.${tip} 한번만 써보세요!`.trim()
  }
  if (durationSec <= 8) {
    return `요즘 ${name} 계속 쓰고 있어요.${tip} 생각보다 만족스러워서 추천해요!`.trim()
  }
  if (durationSec <= 10) {
    return `솔직히 ${name} 처음엔 반신반의했는데, 써보니 생각보다 훨씬 괜찮아요.${tip} 저도 지금 매일 쓰는 중이에요.`.trim()
  }
  if (durationSec <= 12) {
    return `${name}, 왜 이렇게 늦게 알았을까요?${tip} 사용감이 좋고 결과가 만족스러워서 주변에도 추천하고 있어요.`.trim()
  }
  return `오늘 소개할 ${name}, 제가 요즘 제일 자주 꺼내 쓰는 아이템이에요.${tip} 사용이 간단하고 만족스러워서, 고민 중이시면 한번 꼭 써보세요.`.trim()
}

type HqVisionProductInsight = {
  categoryKo: string
  productGuessKo: string
  talkingPoints: string[]
}

async function analyzeHqProductImage(params: {
  productImageUrl: string
  productName?: string
  openaiApiKey: string
}): Promise<HqVisionProductInsight | null> {
  const imageUrl = params.productImageUrl.trim()
  if (!imageUrl) return null
  if (!(imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("data:image/"))) {
    return null
  }

  const nameHint = (params.productName || "").trim()
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 280,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `당신은 쇼핑 제품 이미지 분석가입니다.
첨부 이미지에서 실제 보이는 제품만 파악하세요.
절대 추측으로 다른 카테고리(예: 화장품/피부)를 지어내지 마세요.
talkingPoints는 사진에 보이는 형태·색·재질·구성품만 기반으로 하세요.
사진에 없는 손잡이·뚜껑·물/얼음/김 등은 talkingPoints에 넣지 마세요.
JSON만 반환:
{"categoryKo":"카테고리(예: 텀블러/보틀, 주방용품, 스킨케어, 전자제품 등)","productGuessKo":"제품 추정명","talkingPoints":["한국어 판매포인트 2~4개"]}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `사용자 입력 제품명 힌트: ${nameHint || "(없음)"}
이미지 속 제품을 정확히 분류하고, 사진에 실제로 보이는 특징만 판매 포인트로 적어주세요.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    console.warn("[HQ Shopping] 제품 이미지 분석 실패:", await res.text())
    return null
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = (data.choices?.[0]?.message?.content || "").trim()
  try {
    const parsed = JSON.parse(raw) as Partial<HqVisionProductInsight>
    const categoryKo = String(parsed.categoryKo || "").trim()
    const productGuessKo = String(parsed.productGuessKo || "").trim()
    const talkingPoints = Array.isArray(parsed.talkingPoints)
      ? parsed.talkingPoints.map((t) => String(t).trim()).filter(Boolean).slice(0, 4)
      : []
    if (!categoryKo && !productGuessKo) return null
    return { categoryKo, productGuessKo, talkingPoints }
  } catch (error) {
    console.warn("[HQ Shopping] 제품 이미지 분석 JSON 파싱 실패:", error, raw)
    return null
  }
}

/**
 * 선택 길이에 맞춘 한국어 쇼핑 숏폼 대본 생성
 * — 제품 이미지가 있으면 비전으로 품목을 먼저 파악한 뒤 대본 작성
 */
export async function generateHqShoppingScript(params: {
  durationSec: number
  editDescription?: string
  avatarId?: string
  productName?: string
  /** 업로드된 제품 사진(http/data URL) — 카테고리 오인 방지용 */
  productImageUrl?: string
  openaiApiKey?: string
}): Promise<string> {
  const durationSec = clampHqDurationSec(params.durationSec)
  const { min, max } = targetScriptCharRange(durationSec)
  const avatar = getHqAvatarById(params.avatarId)
  const productName = (params.productName || "").trim()
  const productImageUrl = (params.productImageUrl || "").trim()
  const openaiApiKey =
    params.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ""

  if (!openaiApiKey) {
    return fallbackHqScript(durationSec, params.editDescription, productName)
  }

  let vision: HqVisionProductInsight | null = null
  if (productImageUrl) {
    try {
      vision = await analyzeHqProductImage({
        productImageUrl,
        productName,
        openaiApiKey,
      })
    } catch (error) {
      console.warn("[HQ Shopping] 제품 이미지 분석 예외:", error)
    }
  }

  const edit = (params.editDescription || "").trim()
  const resolvedName =
    productName || vision?.productGuessKo || ""
  const categoryKo = vision?.categoryKo || ""
  const talkingPoints = vision?.talkingPoints?.join(" / ") || ""

  const system = `당신은 한국어 쇼츠/릴스용 제품 소개 대본 작가입니다.
말하는 속도에 맞춰 ${durationSec}초 분량의 자연스러운 구어체 대본만 작성하세요.
목표 글자 수: ${min}~${max}자(공백 포함).
규칙:
- 한국어만, 따옴표/괄호/이모지/해시태그/영어 설명 금지
- 나레이션·지문·효과음 표기 없이 실제 말할 대사만
- 과장 광고 톤을 피하고 UGC처럼 친근하게
- 반드시 이미지/카테고리에 맞는 제품만 말하세요
- 사진에 없는 부품·소품을 말하지 마세요 (예: 손잡이 없는데 '손잡이', 물 없는데 '물이 나와요')
- 텀블러·컵·보틀이면 보냉/보온/휴대/용량 등 일반 체감만. 사진에 손잡이가 보일 때만 손잡이 언급
- 스킨케어가 아니면 '피부가 부드러워졌어요' 같은 화장품 멘트를 절대 쓰지 마세요
- 제품명이 있으면 대본에 자연스럽게 1회 이상 포함 (남발 금지)
- 제품명이 없으면 카테고리 추정명 또는 '이거/이 제품'으로 지칭`

  const userText = `화자 페르소나: ${avatar.personaKo} (${avatar.nameKo}, ${avatar.ageLabelKo})
제품명(사용자 입력): ${productName || "(미입력)"}
이미지 분석 카테고리: ${categoryKo || "(분석 없음)"}
이미지 분석 제품 추정: ${vision?.productGuessKo || "(분석 없음)"}
이미지 기반 판매 포인트: ${talkingPoints || "(없음)"}
영상 길이: 정확히 ${durationSec}초
편집 메모: ${edit || "(없음)"}
위 정보를 바탕으로, 실제 제품에 맞는 대사만 출력하세요.`

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [{ type: "text", text: userText }]

  // 비전 분석이 실패했더라도 대본 단계에서 이미지를 다시 보여 줌
  if (productImageUrl && (productImageUrl.startsWith("http") || productImageUrl.startsWith("data:image/"))) {
    userContent.push({
      type: "image_url",
      image_url: { url: productImageUrl, detail: "low" },
    })
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.55,
        max_tokens: 300,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    })
    if (!res.ok) {
      console.warn("[HQ Shopping] 대본 생성 API 실패:", await res.text())
      return fallbackHqScript(
        durationSec,
        params.editDescription,
        resolvedName,
        categoryKo
      )
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = (data.choices?.[0]?.message?.content || "")
      .replace(/^["'「『]|["'」』]$/g, "")
      .trim()
    if (!text || text.length < 8) {
      return fallbackHqScript(
        durationSec,
        params.editDescription,
        resolvedName,
        categoryKo
      )
    }
    return text
  } catch (error) {
    console.warn("[HQ Shopping] 대본 생성 예외:", error)
    return fallbackHqScript(
      durationSec,
      params.editDescription,
      resolvedName,
      categoryKo
    )
  }
}

function requireReplicateToken(replicateApiKey?: string) {
  const token =
    replicateApiKey?.trim() ||
    process.env.REPLICATE_API_TOKEN?.trim() ||
    process.env.REPLICATE_API_KEY?.trim()
  if (!token) {
    throw new Error(
      "Replicate API 키가 설정되지 않았습니다. 스튜디오 설정(shotform_replicate_api_key) 또는 서버 환경변수를 확인해주세요."
    )
  }
  return token
}

/** public/hq-avatars 사전 생성 PNG → data URL (인물 identity lock용) */
function loadHqAvatarPortraitDataUrl(avatar: HqShoppingAvatar): string | undefined {
  try {
    const relative = avatar.previewSrc.replace(/^\//, "")
    const filePath = path.join(process.cwd(), "public", relative)
    if (!fs.existsSync(filePath)) return undefined
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/png"
    return `data:${mime};base64,${buf.toString("base64")}`
  } catch (error) {
    console.warn("[HQ Shopping] 아바타 포트레이트 로드 실패:", error)
    return undefined
  }
}

async function pollReplicatePrediction(
  getUrl: string,
  token: string,
  label: string
): Promise<unknown> {
  let attempts = 0
  const maxAttempts = 180
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2500))
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${label} 폴링 실패: ${res.status} ${text}`)
    }
    const data = (await res.json()) as {
      status?: string
      output?: unknown
      error?: string
      urls?: { get?: string }
    }
    if (data.status === "succeeded") return data.output
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`${label} 실패: ${data.error || data.status}`)
    }
    attempts += 1
  }
  throw new Error(`${label} 시간 초과`)
}

function extractOutputUrl(output: unknown): string | null {
  if (!output) return null
  if (typeof output === "string") return output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object" && "url" in (first as object)) {
      const url = (first as { url?: unknown }).url
      return typeof url === "string" ? url : null
    }
  }
  if (typeof output === "object" && output && "url" in output) {
    const url = (output as { url?: unknown }).url
    return typeof url === "string" ? url : null
  }
  return null
}

/** 제품 사진 등 HQ 에셋 업로드 → public URL (video-sources 우선, shotform-assets 폴백) */
export async function uploadHqShoppingAsset(
  userId: string,
  projectId: string,
  dataUrlOrBase64: string,
  fileName: string
): Promise<string> {
  const match = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/)
  const contentType = match?.[1] || "image/jpeg"
  const base64 = match?.[2] || dataUrlOrBase64.replace(/^data:[^;]+;base64,/, "")
  const buffer = Buffer.from(base64, "base64")
  if (!buffer.length) throw new Error("업로드할 이미지가 비어 있습니다.")

  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg"
  const safeName = fileName.replace(/[^\w.-]+/g, "_") || `asset_${Date.now()}`
  const stamp = Date.now()
  const primaryPath = `hq-shopping/${userId}/${projectId}/${stamp}_${safeName}.${ext}`
  const fallbackPath = `ai-shopping-hq/${userId}/${projectId}/${stamp}_${safeName}.${ext}`

  const supabase = await createMvpProjectsClient()

  // 일반 AI쇼핑숏폼 TTS와 동일: video-sources 가 실제 존재하는 버킷
  const primary = await supabase.storage.from("video-sources").upload(primaryPath, buffer, {
    contentType,
    upsert: true,
  })
  if (!primary.error) {
    const { data } = supabase.storage.from("video-sources").getPublicUrl(primaryPath)
    return data.publicUrl
  }

  console.warn(
    "[HQ Shopping] video-sources 업로드 실패, shotform-assets 폴백:",
    primary.error.message
  )

  const fallback = await supabase.storage.from("shotform-assets").upload(fallbackPath, buffer, {
    contentType,
    upsert: true,
  })
  if (fallback.error) {
    throw new Error(
      `HQ 에셋 업로드 실패: ${primary.error.message} / fallback: ${fallback.error.message}`
    )
  }

  const { data } = supabase.storage.from("shotform-assets").getPublicUrl(fallbackPath)
  return data.publicUrl
}

function sanitizeHqEditNote(editDescription?: string): string {
  return (editDescription || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180)
}

function isSeedanceSensitiveError(message: string): boolean {
  return /sensitive|flagged as sensitive|\(E005\)|E005/i.test(message)
}

function isSeedanceCopyrightError(message: string): boolean {
  return /copyright|intellectual property|trademark|related to copyright/i.test(message)
}

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isSeedancePolicyError(message: string): boolean {
  return (
    isSeedanceSensitiveError(message) ||
    isSeedanceCopyrightError(message) ||
    /flagged|safety|moderation|nsfw|blocked/i.test(message)
  )
}

/** 모든 자동 재시도 소진 후에만 사용자에게 보이는 메시지 */
function explainHqSeedanceError(error: unknown): Error {
  const msg = errText(error)
  if (isSeedanceCopyrightError(msg)) {
    return new Error(
      "Seedance 2.5 자동 재시도(로고 제거·안전 프롬프트·샷 분리·480p) 후에도 저작권 필터에 걸렸습니다. 브랜드 로고가 거의 안 보이는 제품 사진으로 다시 올려주세요. (1.5로는 내려가지 않습니다)"
    )
  }
  if (isSeedanceSensitiveError(msg) || isSeedancePolicyError(msg)) {
    return new Error(
      "Seedance 2.5 자동 재시도 후에도 안전 필터(E005)에 걸렸습니다. 다른 제품 사진으로 다시 시도해 주세요. (1.5로는 내려가지 않습니다)"
    )
  }
  const short = msg.replace(/^Seedance 2\.[05] 실패:\s*/i, "").slice(0, 240)
  return new Error(`Seedance 2.5 생성 실패(자동 재시도 소진, 1.5 미사용): ${short}`)
}

/** 로고/브랜드 텍스트 제거한 제품 스틸 — E005/저작권 회피용 */
async function makeDebrandedProductStill(params: {
  productUrl: string
  token: string
  openaiApiKey?: string
}): Promise<string | null> {
  const prompt = `Product-only vertical 9:16 commercial photo.
Recreate the EXACT product silhouette, proportions, color, and material from the reference.
CRITICAL: remove ALL logos, brand names, trademark symbols, printed text, and labels. Plain unbranded surfaces.
Do NOT invent new handles, lids, straps, liquid, ice, or accessories.
No people, no hands. Clean bright tabletop, soft daylight, photoreal.`
  try {
    const url = await generateImageWithNanobanana(
      prompt,
      "product",
      params.productUrl,
      params.token,
      0,
      undefined,
      "9:16",
      "nano-banana",
      "product-recompose",
      params.openaiApiKey,
      undefined,
      "product"
    )
    return url || null
  } catch {
    return null
  }
}

/** 안전 톤으로 인물+제품 재합성 (얼굴·제품 형태 유지, 로고 제거) */
async function makeSafeComposeStill(params: {
  productUrl: string
  characterRef: string
  avatar: HqShoppingAvatar
  token: string
  openaiApiKey?: string
}): Promise<string | null> {
  const prompt = `Vertical 9:16 wholesome online-shopping photo, safe for work.
A fully clothed ${params.avatar.appearanceEn} stands waist-up in a bright living-room lifestyle setting.
Match the character reference face identity exactly. Modest everyday clothes.
They hold the EXACT product shape/color from the product reference at chest level — product fully visible, not covering the face.
Remove all brand logos/text from the product. No invented water/handles/parts.
Soft daylight, friendly smile, no text overlay, non-sexual, family-friendly retail ad.`
  try {
    const url = await generateImageWithNanobanana(
      prompt,
      "product",
      params.productUrl,
      params.token,
      0,
      undefined,
      "9:16",
      "nano-banana",
      "product-recompose",
      params.openaiApiKey,
      params.characterRef,
      "person"
    )
    return url || null
  } catch {
    return null
  }
}

/** 정책 준수 + 멀티샷 — 제품만 [Image1], 인물은 텍스트 페르소나(얼굴 이미지 없음) */
function buildPolicyFirstMultiShotPrompt(params: {
  avatar: HqShoppingAvatar
  durationSec: number
  script: string
  productName?: string
}) {
  const name = (params.productName || "").trim() || "the product"
  const { intro, closing } = splitSpokenLines(params.script)
  const line1 = (intro || params.script).trim().replace(/"/g, "").slice(0, 100)
  const line2 = (closing || "").trim().replace(/"/g, "").slice(0, 60)
  const persona = params.avatar.personaKo
  const hostDesc = `${persona} (${params.avatar.appearanceEn})`

  const shots =
    params.durationSec <= 8
      ? `Shot 1: PRODUCT HERO — unbranded item from [Image1] on a bright clean tabletop, slow push-in, soft daylight, no people. Soft room tone. [Cut to]
Shot 2: HOST INTRO — a fictional ${hostDesc} holds the SAME product from [Image1] at chest level in a bright living-room lifestyle background, medium shot, eye contact, and says: "${line1}" [Cut to]
Shot 3: FEATURE — close detail of a real part already on [Image1] (color/material only; no new parts), then same host type smiling with the same product.`
      : `Shot 1: PRODUCT HERO — unbranded item from [Image1] on a bright tabletop, slow orbit/push-in, no people. Soft room tone. [Cut to]
Shot 2: HOST INTRO — a fictional ${hostDesc} presents the SAME product from [Image1] in a cozy bright indoor lifestyle set, medium shot, and says: "${line1}" [Cut to]
Shot 3: FEATURE — real detail already visible on [Image1], gentle handheld feel, same product geometry. Soft ambience. [Cut to]
Shot 4: CLOSING — same fictional ${persona} host + same product, friendly wrap-up${line2 ? `, says: "${line2}"` : ""}.`

  return `Create a ${params.durationSec}-second vertical 9:16 Korean shopping short-form with REAL editorial cuts (not one continuous talking-head take).

POLICY (must follow):
- Family-friendly, fully clothed, non-sexual, safe for all ages retail.
- No readable brand logos, trademarks, celebrity likeness, or copyrighted characters.
- Product must match [Image1] shape/color/parts exactly — do NOT invent water, ice, steam, handles, lids, or accessories.
- Host is a FICTIONAL original character described in text only — do NOT copy any real person's face. No celebrity lookalikes.
- Do NOT require a face reference image. Invent a fitting face for: ${persona}.
- Product name context only (do not render text on screen): ${name}.

REFERENCE:
- [Image1] = unbranded PRODUCT ground truth only (no people in this image)

${shots}

Audio: native Korean voice with lip sync on talking shots; soft room tone under voice. No on-screen captions.`
}

/** E005 회피용 짧은 버전 (재시도용) */
function buildUltraSafeMultiShotPrompt(params: {
  avatar: HqShoppingAvatar
  durationSec: number
  script: string
  productName?: string
}) {
  return buildPolicyFirstMultiShotPrompt(params)
}

function buildUltraSafeStillPrompt(
  durationSec: number,
  script: string,
  avatar?: HqShoppingAvatar
) {
  const spoken = script.trim().replace(/"/g, "").slice(0, 80)
  const persona = avatar?.personaKo || "Korean shopping host"
  const look = avatar?.appearanceEn || "fictional original character, not a real person"
  return `Animate / extend from this product still into a ${durationSec}s vertical 9:16 Korean shopping video with editorial cuts.
POLICY: family-friendly, fully clothed, no logos on screen, no invented product parts/liquid.
Host is a fictional ${persona} (${look}) — invent a suitable face; do not copy a real person.
Shot 1: push-in on the product in frame. Soft room tone. [Cut to]
Shot 2: the fictional ${persona} talks to camera holding the same product and says: "${spoken}" [Cut to]
Shot 3: product detail then friendly closing.
Keep product shape identical to the still.`
}

function buildComposePrompt(
  avatar: HqShoppingAvatar,
  editDescription?: string,
  mode: "standard" | "safe" | "debrand" = "standard"
) {
  const edit = sanitizeHqEditNote(editDescription)
  const debrand =
    mode === "debrand"
      ? `
IMPORTANT COPYRIGHT-SAFE RULES:
Do NOT render any brand logos, trademark symbols, brand text, celebrity likeness, or copyrighted characters.
Keep the product as a generic unbranded item with the same overall shape, color, and material only.
Blank or plain surfaces where logos would be.`
      : `
If the product has tiny logos, keep them minimal; prefer clean product surfaces without readable brand text.`

  return `Family-friendly vertical 9:16 commercial shopping photo for an online store.
A fully clothed ${avatar.appearanceEn} stands in a bright clean indoor lifestyle setting.
The person holds the product from the reference photo with both hands at chest level, clearly in front of the torso — product is fully visible and is the visual focus.
Medium shot from waist up, polite friendly smile, looking at camera like a shopping host.
Keep clothing modest and everyday. No revealing outfits. No beauty application on lips/skin. No close-up of face touching the product.
Preserve overall product shape, color, and materials.
Soft daylight, realistic phone-camera look, no text overlays, no watermark, no subtitle.
Safe for work, non-sexual, suitable for all ages retail advertisement.
${debrand}
${edit ? `Extra scene note (keep wholesome): ${edit}` : ""}`
}

/** Seedance 2.5 공식 멀티샷 문법용 샷 플랜 (한 요청 안에 Shot 1/2/3…) */
function buildHqShotPlan(durationSec: number): Array<{
  label: string
  start: number
  end: number
  direction: string
  spoken?: boolean
}> {
  if (durationSec <= 5) {
    return [
      {
        label: "product-hero",
        start: 0,
        end: 1.5,
        direction:
          "only the exact product from [Image1] on a clean table, slow push-in, no people, no invented props",
      },
      {
        label: "host-intro",
        start: 1.5,
        end: 4,
        spoken: true,
        direction:
          "the exact host from [Image2] holds the exact product from [Image1], medium shot, looks at camera and speaks",
      },
      {
        label: "feature",
        start: 4,
        end: 5,
        direction:
          "close-up of a real part already on [Image1] (color/material/handle only if visible). No new parts",
      },
    ]
  }
  if (durationSec <= 8) {
    return [
      {
        label: "product-hero",
        start: 0,
        end: 2,
        direction:
          "exact product from [Image1], product hero, no liquid/steam unless already in photo",
      },
      {
        label: "host-intro",
        start: 2,
        end: 5.5,
        spoken: true,
        direction:
          "exact host from [Image2] presents exact product from [Image1], talking to camera",
      },
      {
        label: "feature",
        start: 5.5,
        end: 8,
        direction:
          "feature detail of real attributes on [Image1] while host still holds/presents naturally",
      },
    ]
  }
  if (durationSec <= 10) {
    return [
      {
        label: "product-hero",
        start: 0,
        end: 2.2,
        direction: "exact [Image1] product hero only",
      },
      {
        label: "host-intro",
        start: 2.2,
        end: 6.2,
        spoken: true,
        direction:
          "exact [Image2] host holding exact [Image1], speaking to camera",
      },
      {
        label: "feature",
        start: 6.2,
        end: 8.4,
        direction: "feature close of real parts on [Image1] only",
      },
      {
        label: "closing",
        start: 8.4,
        end: 10,
        spoken: true,
        direction: "same host + same product, friendly wrap-up look to camera",
      },
    ]
  }
  // 12~15초
  return [
    {
      label: "product-hero",
      start: 0,
      end: 2.5,
      direction: "exact [Image1] product hero, no invented environment gags",
    },
    {
      label: "host-intro",
      start: 2.5,
      end: 7,
      spoken: true,
      direction:
        "exact [Image2] host holds exact [Image1], Korean narration, eye contact",
    },
    {
      label: "feature",
      start: 7,
      end: 10.5,
      direction:
        "feature montage of real attributes already on [Image1] (material, lid, handle only if present)",
    },
    {
      label: "closing",
      start: 10.5,
      end: durationSec,
      spoken: true,
      direction: "same host + same product recommending the item",
    },
  ]
}

function buildProductIdentityLock(): string {
  return `PRODUCT IDENTITY LOCK: Match [Image1] exactly — silhouette, proportions, color, material, part count, lid/handle presence. Do NOT invent water, ice, steam, pouring, condensation, extra handles, lids, straps, or accessories. Never morph the product between shots.`
}

function buildHostIdentityLock(avatar: HqShoppingAvatar): string {
  return `HOST (TEXT ONLY — no face reference image): A fictional ${avatar.personaKo}. ${avatar.appearanceEn}. Original character only; never imitate a real celebrity or uploaded face photo.`
}

/** 대사를 소개샷 / 클로징에 나눠 넣기 */
function splitSpokenLines(script: string): { intro: string; closing: string } {
  const spoken = script.trim().replace(/"/g, "").replace(/\s+/g, " ")
  if (!spoken) return { intro: "", closing: "" }
  const parts = spoken.split(/(?<=[.!?。…])\s+/).filter(Boolean)
  if (parts.length <= 1) {
    const mid = Math.max(8, Math.floor(spoken.length * 0.7))
    return { intro: spoken.slice(0, mid).trim(), closing: spoken.slice(mid).trim() }
  }
  const cut = Math.max(1, Math.ceil(parts.length * 0.7))
  return {
    intro: parts.slice(0, cut).join(" ").trim(),
    closing: parts.slice(cut).join(" ").trim() || parts[parts.length - 1],
  }
}

/**
 * Seedance 2.5 한 요청 멀티샷 프롬프트
 * — 공식 문법: Shot N: … [Cut to] + 대사는 따옴표
 */
function buildMultiShotNarrationPrompt(params: {
  avatar: HqShoppingAvatar
  durationSec: number
  script: string
  productName?: string
  editDescription?: string
  mode?: "standard" | "safe" | "debrand"
}) {
  const name = (params.productName || "").trim() || "the product"
  const edit = sanitizeHqEditNote(params.editDescription)
  const shots = buildHqShotPlan(params.durationSec)
  const { intro, closing } = splitSpokenLines(params.script)
  let spokenIdx = 0

  const shotLines = shots.map((s, i) => {
    const n = i + 1
    let line = `Shot ${n}: ${s.direction}. Camera: one clear move only.`
    if (s.spoken) {
      const lineText = spokenIdx === 0 ? intro || params.script.trim() : closing || intro
      spokenIdx += 1
      line += ` The host says: "${lineText.replace(/"/g, "")}"`
    } else {
      line += " Soft room tone only, no dialogue."
    }
    if (i < shots.length - 1) line += " [Cut to]"
    return line
  })

  const debrand =
    params.mode === "debrand"
      ? "Omit readable brand logos/trademark text; keep real shape/color/material."
      : "Keep logos minimal if present; do not invent new logos."

  return `Create a ${params.durationSec}-second vertical 9:16 Korean shopping short-form with REAL editorial cuts between shots (not one continuous talking-head take).
This must look edited: product hero → host intro → feature → (closing if listed).

References:
- [Image1] = PRODUCT ground truth
- [Image2] = HOST ground truth
Use both. Product name context: ${name}.

${buildProductIdentityLock()}
${buildHostIdentityLock(params.avatar)}

${shotLines.join("\n")}

Rules: hard cuts required; do not stay on a single static zoom; family-friendly; fully clothed; no invented props.
${debrand}
${edit ? `Extra notes: ${edit}` : ""}`
}

function buildComposeIdentityPrompt(
  avatar: HqShoppingAvatar,
  editDescription?: string
) {
  const edit = sanitizeHqEditNote(editDescription)
  return `Vertical 9:16 photoreal still for shopping short.
The person must match the character reference face EXACTLY (same identity, age, hair). Do not invent a different person.
The person holds the EXACT product from the product reference: same silhouette, color, parts — no invented water/handles/accessories.
Medium shot, chest-up, polite smile, product clearly visible in hands at chest level (not covering face).
Bright indoor lifestyle, modest clothing, no text/watermark.
${edit ? `Scene note: ${edit}` : ""}`
}

function buildVideoPromptFromStill(
  avatar: HqShoppingAvatar,
  durationSec: number,
  script: string,
  editDescription?: string,
  mode: "standard" | "safe" | "debrand" = "debrand"
) {
  const { intro, closing } = splitSpokenLines(script)
  const edit = sanitizeHqEditNote(editDescription)
  const shots = buildHqShotPlan(durationSec)
  let spokenIdx = 0
  const shotLines = shots.map((s, i) => {
    const dir = s.direction
      .replace(/\[Image1\]/g, "the product in this still")
      .replace(/\[Image2\]/g, "the same person in this still")
    let line = `Shot ${i + 1}: ${dir}.`
    if (s.spoken) {
      const lineText = spokenIdx === 0 ? intro || script.trim() : closing || intro
      spokenIdx += 1
      line += ` Host says: "${lineText.replace(/"/g, "")}"`
    }
    if (i < shots.length - 1) line += " [Cut to]"
    return line
  })

  return `Animate this still into a ${durationSec}s vertical 9:16 Korean narrated shopping intro with MULTIPLE editorial cuts.
Keep the SAME face and SAME product geometry in every shot.
${shotLines.join("\n")}
No silent product-only zoom. No invented liquid/handles/parts.
${mode === "safe" ? "Conservative wholesome retail tone." : ""}
${edit ? `Notes: ${edit}` : ""}`
}

type HqClipSpec = {
  label: string
  durationSec: number
  prompt: string
  refs: "product" | "both" | "compose"
}

/** 샷별 생성용 — Seedance 최소 ~4초이므로 8초 미만은 단일 멀티샷만 사용 */
function buildPerShotClipSpecs(params: {
  durationSec: number
  script: string
  avatar: HqShoppingAvatar
  productName?: string
  editDescription?: string
  hasCompose: boolean
}): HqClipSpec[] | null {
  const total = params.durationSec
  if (total < 8) return null

  const { intro, closing } = splitSpokenLines(params.script)
  const name = (params.productName || "").trim() || "the product"
  const edit = sanitizeHqEditNote(params.editDescription)
  const locks = `${buildProductIdentityLock()}\n${buildHostIdentityLock(params.avatar)}\n${edit ? `Notes: ${edit}` : ""}`

  // 3클립: 제품 / 소개(대사) / 특징+클로징
  let d1 = 4
  let d2 = Math.max(4, Math.round(total * 0.45))
  let d3 = total - d1 - d2
  if (d3 < 4) {
    d2 = total - d1 - 4
    d3 = 4
  }
  if (d2 < 4) {
    d1 = 4
    d2 = 4
    d3 = Math.max(4, total - 8)
  }

  return [
    {
      label: "product-hero",
      durationSec: d1,
      refs: "product",
      prompt: `Vertical 9:16 shopping product hero, ${d1} seconds.
Show ONLY the exact product from [Image1] for "${name}". Slow gentle push-in on a clean bright table.
No people. Soft ambient room tone only. No dialogue.
${locks}`,
    },
    {
      label: "host-intro",
      durationSec: d2,
      refs: "product",
      prompt: `Vertical 9:16 shopping host intro, ${d2} seconds.
A fictional ${params.avatar.personaKo} (${params.avatar.appearanceEn}) holds the exact product from [Image1] for "${name}".
Medium shot, eye contact, natural talking motion.
The host says: "${(intro || params.script).replace(/"/g, "")}"
Native Korean voice + lip sync. Family-friendly. Invent a fitting original face — not a real person photo.
${locks}`,
    },
    {
      label: "feature-closing",
      durationSec: d3,
      refs: "product",
      prompt: `Vertical 9:16 shopping feature + closing, ${d3} seconds.
Start with a brief close-up of a REAL part already on the product from [Image1], then medium shot of the same fictional ${params.avatar.personaKo} holding the same product.
${closing ? `The host says: "${closing.replace(/"/g, "")}"` : "Friendly wrap-up smile, soft room tone."}
No invented water/handles/parts. Same product shape. Original fictional host face only.
${locks}`,
    },
  ]
}

async function runSeedance25Prediction(params: {
  token: string
  prompt: string
  durationSec: number
  generateAudio: boolean
  imageUrl?: string
  referenceImages?: string[]
  resolution?: "480p" | "720p"
  seed?: number
}): Promise<string> {
  const apiUrl = "https://api.replicate.com/v1/models/bytedance/seedance-2.5/predictions"
  const modelInput: Record<string, unknown> = {
    prompt: params.prompt,
    duration: params.durationSec,
    resolution: params.resolution || "720p",
    aspect_ratio: "9:16",
    generate_audio: params.generateAudio,
  }
  if (typeof params.seed === "number" && Number.isFinite(params.seed)) {
    modelInput.seed = Math.trunc(params.seed)
  }

  const refs = (params.referenceImages || []).filter(Boolean)
  if (refs.length > 0) {
    // reference_images 와 image(first frame) 는 동시 사용 불가
    modelInput.reference_images = refs.slice(0, 30)
  } else if (params.imageUrl) {
    modelInput.image = params.imageUrl
  } else {
    throw new Error("Seedance 2.5 입력 이미지가 없습니다.")
  }

  const createRes = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: modelInput }),
  })

  if (!createRes.ok) {
    const errorText = await createRes.text()
    throw new Error(`Seedance 2.5 요청 실패: ${createRes.status} — ${errorText}`)
  }

  const created = (await createRes.json()) as {
    output?: unknown
    status?: string
    error?: string
    urls?: { get?: string }
  }

  let output = created.output
  if (!output && created.urls?.get) {
    output = await pollReplicatePrediction(created.urls.get, params.token, "Seedance 2.5")
  } else if (created.status && created.status !== "succeeded" && created.urls?.get) {
    output = await pollReplicatePrediction(created.urls.get, params.token, "Seedance 2.5")
  }

  const videoUrl = extractOutputUrl(output)
  if (!videoUrl) {
    throw new Error("Seedance 2.5 영상 URL을 받지 못했습니다.")
  }
  return videoUrl
}

async function downloadUrlToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`영상 다운로드 실패: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function concatVideoUrlsToMp4(urls: string[]): Promise<Buffer> {
  if (urls.length === 0) throw new Error("합칠 클립이 없습니다.")
  if (urls.length === 1) return downloadUrlToBuffer(urls[0])
  assertFfmpegExecutable()

  const dir = path.join(os.tmpdir(), "hq-seedance-concat", randomUUID())
  fs.mkdirSync(dir, { recursive: true })
  try {
    const normalized: string[] = []
    const bin = resolveFfmpegPath()
    for (let i = 0; i < urls.length; i++) {
      const rawPath = path.join(dir, `raw_${i}.mp4`)
      const normPath = path.join(dir, `norm_${i}.mp4`)
      fs.writeFileSync(rawPath, await downloadUrlToBuffer(urls[i]))
      const r = spawnSync(
        bin,
        [
          "-y",
          "-i",
          rawPath,
          "-vf",
          "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-shortest",
          normPath,
        ],
        { encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
      )
      if (r.status !== 0) {
        throw new Error(`클립 정규화 실패: ${(r.stderr || "").slice(-400)}`)
      }
      normalized.push(normPath)
    }

    const listPath = path.join(dir, "list.txt")
    fs.writeFileSync(
      listPath,
      normalized.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
      "utf8"
    )
    const outPath = path.join(dir, "out.mp4")
    const concat = spawnSync(
      bin,
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      { encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
    )
    if (concat.status !== 0) {
      throw new Error(`클립 이어붙이기 실패: ${(concat.stderr || "").slice(-400)}`)
    }
    return fs.readFileSync(outPath)
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

async function uploadHqVideoBuffer(buffer: Buffer): Promise<string> {
  const stamp = Date.now()
  const primaryPath = `hq-shopping/videos/${stamp}_${randomUUID().slice(0, 8)}.mp4`
  const fallbackPath = `ai-shopping-hq/videos/${stamp}_${randomUUID().slice(0, 8)}.mp4`
  const supabase = await createMvpProjectsClient()

  const primary = await supabase.storage.from("video-sources").upload(primaryPath, buffer, {
    contentType: "video/mp4",
    upsert: true,
  })
  if (!primary.error) {
    const { data } = supabase.storage.from("video-sources").getPublicUrl(primaryPath)
    return data.publicUrl
  }

  const fallback = await supabase.storage.from("shotform-assets").upload(fallbackPath, buffer, {
    contentType: "video/mp4",
    upsert: true,
  })
  if (fallback.error) {
    throw new Error(
      `HQ 영상 업로드 실패: ${primary.error.message} / ${fallback.error.message}`
    )
  }
  const { data } = supabase.storage.from("shotform-assets").getPublicUrl(fallbackPath)
  return data.publicUrl
}

type HqRecreateResult = {
  previewImageUrl: string
  videoUrl: string
  durationSec: number
  avatarId: string
  script: string
  usedEngine?: string
  usedFallback?: boolean
  hasNarration?: boolean
  multiShotMode?: "seedance25-single" | "seedance25-per-shot"
  attemptLog?: string[]
}

/**
 * 고퀄리티 — Seedance 2.5만 사용.
 * 처음부터 정책 준수 입력(디브랜드 제품 + 안전 합성 + 정책형 멀티샷 프롬프트)으로 요청.
 * 실패 시에만 시드/해상도/샷분리를 바꿔 2.5 재시도. (1.5 폴백 없음)
 *
 * 같은 projectId로 동시에 두 번 돌리면 비용만 늘고 로그가 섞이므로 단일 실행으로 잠급니다.
 */
const hqRecreateInflight = new Map<string, Promise<HqRecreateResult>>()

export async function recreateHqShoppingVideo(params: {
  productImageUrl: string
  avatarId?: string
  editDescription?: string
  productName?: string
  script?: string
  durationSec?: number
  replicateApiKey?: string
  openaiApiKey?: string
  /** 동시 실행 방지용 */
  projectId?: string
}): Promise<HqRecreateResult> {
  const lockKey =
    (params.projectId || "").trim() ||
    `anon:${(params.productImageUrl || "").slice(0, 120)}:${params.avatarId || ""}`

  const existing = hqRecreateInflight.get(lockKey)
  if (existing) {
    console.warn(
      "[HQ Shopping] 이미 생성 중인 작업이 있어 중복 요청을 거부합니다:",
      lockKey.slice(0, 80)
    )
    throw new Error(
      "이미 이 프로젝트의 영상 생성이 진행 중입니다. 끝날 때까지 기다려 주세요. (이전 Recreate가 서버에서 아직 돌고 있을 수 있습니다)"
    )
  }

  const run = recreateHqShoppingVideoUnlocked(params).finally(() => {
    if (hqRecreateInflight.get(lockKey) === run) {
      hqRecreateInflight.delete(lockKey)
    }
  })
  hqRecreateInflight.set(lockKey, run)
  return run
}

async function recreateHqShoppingVideoUnlocked(params: {
  productImageUrl: string
  avatarId?: string
  editDescription?: string
  productName?: string
  script?: string
  durationSec?: number
  replicateApiKey?: string
  openaiApiKey?: string
  projectId?: string
}): Promise<HqRecreateResult> {
  const token = requireReplicateToken(params.replicateApiKey)
  const avatar = getHqAvatarById(params.avatarId)
  const productUrl = params.productImageUrl?.trim()
  if (!productUrl) throw new Error("제품 사진이 필요합니다.")

  const durationSec = clampHqDurationSec(params.durationSec)
  let script = (params.script || "").trim()
  if (!script) {
    script = await generateHqShoppingScript({
      durationSec,
      editDescription: params.editDescription,
      avatarId: avatar.id,
      productName: params.productName,
      productImageUrl: productUrl,
      openaiApiKey: params.openaiApiKey,
    })
  }

  // 샘플 얼굴 PNG는 UI 선택용 — Seedance에는 얼굴 이미지를 넣지 않음(페르소나 텍스트만)
  const attemptLog: string[] = []
  const log = (msg: string) => {
    attemptLog.push(msg)
    console.log("[HQ Shopping]", msg)
  }

  let previewImageUrl = productUrl
  let debrandedProductUrl: string | null = null

  const ensureDebranded = async (force = false) => {
    if (debrandedProductUrl && !force) return debrandedProductUrl
    log("정책 준비: 제품 로고 제거(디브랜드) 스틸 생성…")
    debrandedProductUrl = await makeDebrandedProductStill({
      productUrl,
      token,
      openaiApiKey: params.openaiApiKey,
    })
    if (debrandedProductUrl) {
      previewImageUrl = debrandedProductUrl
      log("디브랜드 제품 스틸 준비 완료")
    } else {
      log("디브랜드 실패 — 원본 사용(필터 위험 높음)")
    }
    return debrandedProductUrl
  }

  type Attempt = {
    label: string
    run: () => Promise<string>
  }

  const okResult = (
    videoUrl: string,
    opts: {
      engine: string
      multiShotMode: HqRecreateResult["multiShotMode"]
      usedFallback?: boolean
      hasNarration?: boolean
    }
  ): HqRecreateResult => ({
    previewImageUrl: debrandedProductUrl || productUrl,
    videoUrl,
    durationSec,
    avatarId: avatar.id,
    script,
    usedEngine: opts.engine,
    usedFallback: opts.usedFallback ?? false,
    hasNarration: opts.hasNarration ?? true,
    multiShotMode: opts.multiShotMode,
    attemptLog,
  })

  const tryAttempts = async (
    attempts: Attempt[],
    mode: HqRecreateResult["multiShotMode"],
    engine = "seedance-2.5"
  ): Promise<HqRecreateResult | null> => {
    for (const attempt of attempts) {
      try {
        log(`시도: ${attempt.label}`)
        const videoUrl = await attempt.run()
        log(`성공: ${attempt.label}`)
        return okResult(videoUrl, { engine, multiShotMode: mode })
      } catch (error) {
        const msg = errText(error)
        log(`실패(${attempt.label}): ${msg.slice(0, 180)}`)
        if (isSeedancePolicyError(msg)) {
          log("→ 정책 필터 — 다음 변형으로 계속(Seedance 2.5만)")
        }
      }
    }
    return null
  }

    // ── 0) 제품만 디브랜드 후, 인물은 페르소나 텍스트로 Seedance 2.5 요청 ──
  log(`정책 우선: 제품 디브랜드 + 페르소나「${avatar.personaKo}」(얼굴 이미지 미사용)`)
  const debranded = (await ensureDebranded()) || productUrl
  const policyPrompt = buildPolicyFirstMultiShotPrompt({
    avatar,
    durationSec,
    script,
    productName: params.productName,
  })

  // ── 1) 첫 요청: 제품 레퍼런스만 + 텍스트 인물 ──
  {
    const stage1: Attempt[] = [
      {
        label: "s2-policy-product-ref-persona",
        run: () =>
          runSeedance25Prediction({
            token,
            referenceImages: [debranded],
            prompt: policyPrompt,
            durationSec,
            generateAudio: true,
            resolution: "720p",
          }),
      },
      {
        label: "s2-policy-product-i2v-persona",
        run: () =>
          runSeedance25Prediction({
            token,
            imageUrl: debranded,
            prompt: buildUltraSafeStillPrompt(durationSec, script, avatar),
            durationSec,
            generateAudio: true,
            resolution: "720p",
          }),
      },
    ]
    const hit = await tryAttempts(stage1, "seedance25-single")
    if (hit) return hit
  }

  // ── 2) 샷별 2.5 (제품 레퍼런스만) ──
  const clips = buildPerShotClipSpecs({
    durationSec,
    script,
    avatar,
    productName: params.productName,
    editDescription: undefined,
    hasCompose: false,
  })

  if (clips && hasFfmpeg()) {
    log(`페르소나 텍스트 + 제품만으로 샷별 Seedance 2.5 ${clips.length}클립 시도`)
    try {
      const clipUrls: string[] = []
      for (const clip of clips) {
        log(`클립 시도: ${clip.label}`)
        const url = await runSeedance25Prediction({
          token,
          referenceImages: [debranded],
          prompt: clip.prompt,
          durationSec: clip.durationSec,
          generateAudio: clip.label !== "product-hero",
        })
        clipUrls.push(url)
        log(`클립 성공: ${clip.label}`)
      }
      log("클립 이어붙이기(ffmpeg)…")
      const merged = await concatVideoUrlsToMp4(clipUrls)
      const videoUrl = await uploadHqVideoBuffer(merged)
      log("샷별 Seedance 2.5 완료")
      return okResult(videoUrl, {
        engine: "seedance-2.5-per-shot",
        multiShotMode: "seedance25-per-shot",
        usedFallback: true,
        hasNarration: true,
      })
    } catch (error) {
      log(`샷별 실패: ${errText(error).slice(0, 180)}`)
    }
  }

    // ── 3) Seedance 2.5만 라운드 재시도 (입력 재생성 + 480p/시드) ──
  const MAX_S2_ROUNDS = 10
  for (let round = 1; round <= MAX_S2_ROUNDS; round++) {
    log(`Seedance 2.5 재시도 라운드 ${round}/${MAX_S2_ROUNDS}`)
    const debrandedRound = (await ensureDebranded(round >= 2)) || productUrl
    const still = debrandedRound
    const seed = 1000 + round * 97
    const resolution: "480p" | "720p" = round >= 2 ? "480p" : "720p"
    const prompt = buildPolicyFirstMultiShotPrompt({
      avatar,
      durationSec,
      script,
      productName: params.productName,
    })

    const roundAttempts: Attempt[] = [
      {
        label: `s2-r${round}-ref-${resolution}-audio`,
        run: () =>
          runSeedance25Prediction({
            token,
            referenceImages: [debrandedRound],
            prompt,
            durationSec,
            generateAudio: true,
            resolution,
            seed,
          }),
      },
      {
        label: `s2-r${round}-compose-${resolution}-audio`,
        run: () =>
          runSeedance25Prediction({
            token,
            imageUrl: still,
            prompt: buildUltraSafeStillPrompt(durationSec, script, avatar),
            durationSec,
            generateAudio: true,
            resolution,
            seed: seed + 1,
          }),
      },
      {
        label: `s2-r${round}-compose-480-silent`,
        run: () =>
          runSeedance25Prediction({
            token,
            imageUrl: still,
            prompt: buildUltraSafeStillPrompt(durationSec, script, avatar),
            durationSec,
            generateAudio: false,
            resolution: "480p",
            seed: seed + 3,
          }),
      },
    ]

    if (hasFfmpeg() && durationSec >= 8) {
      roundAttempts.push({
        label: `s2-r${round}-pershot-bundle`,
        run: async () => {
          const dProduct = 4
          const dHost = Math.max(4, durationSec - 8)
          const dClose = 4
          const res: "480p" | "720p" = round >= 2 ? "480p" : "720p"
          const productClip = await runSeedance25Prediction({
            token,
            referenceImages: [debrandedRound],
            prompt: `Vertical 9:16 product hero ${dProduct}s. Unbranded product from [Image1], slow push-in, no people. Family-friendly, no logos.`,
            durationSec: dProduct,
            generateAudio: false,
            resolution: res,
            seed: seed + 10,
          })
          const hostClip = await runSeedance25Prediction({
            token,
            imageUrl: still,
            prompt: buildUltraSafeStillPrompt(dHost, script, avatar),
            durationSec: dHost,
            generateAudio: true,
            resolution: res,
            seed: seed + 11,
          })
          const closeClip = await runSeedance25Prediction({
            token,
            imageUrl: still,
            prompt: `Animate this shopping still ${dClose}s. Same person, same product, friendly close. Family-friendly.`,
            durationSec: dClose,
            generateAudio: false,
            resolution: "480p",
            seed: seed + 12,
          })
          const merged = await concatVideoUrlsToMp4([productClip, hostClip, closeClip])
          return uploadHqVideoBuffer(merged)
        },
      })
    }

    const hit = await tryAttempts(roundAttempts, "seedance25-single", "seedance-2.5")
    if (hit) {
      const lastOk = [...attemptLog].reverse().find((l) => l.startsWith("성공:")) || ""
      if (lastOk.includes("pershot")) {
        hit.multiShotMode = "seedance25-per-shot"
        hit.usedEngine = "seedance-2.5-per-shot"
        hit.usedFallback = true
        hit.hasNarration = true
      } else if (lastOk.includes("silent")) {
        hit.hasNarration = false
        hit.usedFallback = true
      }
      log(`Seedance 2.5 성공 (라운드 ${round})`)
      return hit
    }
    log(`라운드 ${round} 실패 — 정책 입력 다시 만들고 계속`)
  }

  throw explainHqSeedanceError(
    new Error(
      "Seedance 2.5 정책형 요청·재시도를 모두 소진했습니다. 로고가 거의 안 보이는 제품 사진으로 바꿔 다시 Recreate 해주세요. (1.5로는 내려가지 않습니다)"
    )
  )
}
