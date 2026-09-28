import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import type { CtrThumbnailPackageOption } from "@/lib/longform-v2/youtube/youtubeCtrThumbnailPackageKo"

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const keys = loadApiKeys()
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      geminiApiKey: keys.gemini,
      replicateApiKey: keys.replicate,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `요청 실패 (${res.status})`)
  }
  return data as T
}

export async function resolveGeminiKeyForApi(): Promise<string> {
  return loadApiKeys().gemini || ""
}

export async function resolveOpenAiKeyForApi(): Promise<string> {
  return ""
}

export async function resolveReplicateKeyForApi(): Promise<string> {
  return loadApiKeys().replicate || ""
}

/** CTR 패키지 — 웹 longform-v2 라우트 */
export async function postThumbnailCtrPackage(body: {
  scriptExcerpt: string
  videoTitle?: string
  topic?: string
  outputLanguage?: string
  count?: number
}) {
  return postJson<{ options: CtrThumbnailPackageOption[] }>("/api/longform-v2/thumbnail-ctr-package", {
    script: body.scriptExcerpt,
    videoTitle: body.videoTitle,
    topic: body.topic,
    count: body.count,
  })
}

export type ThumbnailImageResult = {
  imageUrl: string
  /** 서버에서 내려준 data URL — CORS 없이 바로 배경에 사용 */
  imageDataUrl?: string
  base64?: string
  mimeType?: string
}

/** 배경 이미지 생성 */
export async function postThumbnailImage(body: {
  topic?: string
  imagePromptEn?: string
  prompt?: string
  videoTitle?: string
  withoutText?: boolean
  imageModel?: string
  imageStyle?: string
  thumbnailStyle?: string | null
  customStylePrompt?: string
  promptPrebuilt?: boolean
  analyzedBenchmarkStyle?: string
  imagesLocaleMode?: string
  scriptExcerpt?: string
  styleCategory?: string
  styleTemplateId?: string
}): Promise<ThumbnailImageResult> {
  return postJson<ThumbnailImageResult>("/api/longform-v2/thumbnail-image", {
    imagePromptEn: body.imagePromptEn || body.prompt || body.topic,
    prompt: body.prompt || body.topic,
    videoTitle: body.videoTitle,
    topic: body.topic,
    withoutText: body.withoutText ?? true,
    imageModel: body.imageModel,
    imageStyle: body.imageStyle,
    thumbnailStyle: body.thumbnailStyle,
    customStylePrompt: body.customStylePrompt,
    promptPrebuilt: body.promptPrebuilt,
    analyzedBenchmarkStyle: body.analyzedBenchmarkStyle,
    imagesLocaleMode: body.imagesLocaleMode,
    scriptExcerpt: body.scriptExcerpt,
    styleCategory: body.styleCategory,
    styleTemplateId: body.styleTemplateId,
  })
}

/** URL → base64 (가능하면 서버 imageDataUrl 사용 권장) */
export async function fetchUrlAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/i)
    if (m?.[2]) return { base64: m[2], mimeType: m[1] || "image/png" }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error("이미지 다운로드 실패")
  const blob = await res.blob()
  const mimeType = blob.type || "image/png"
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("base64 변환 실패"))
    reader.readAsDataURL(blob)
  })
  const i = dataUrl.indexOf(",")
  return {
    base64: i >= 0 ? dataUrl.slice(i + 1) : dataUrl,
    mimeType,
  }
}

function notPorted(name: string): never {
  throw new Error(
    `${name} API는 웹 이식 중입니다. CTR 패키지·배경 이미지 생성은 사용 가능합니다.`,
  )
}

/** CTR 패키지 1옵션 → line1/line2 */
export async function postThumbnailText(body: {
  script?: string
  title?: string
  topic?: string
  outputLanguage?: string
}): Promise<{ line1: string; line2: string }> {
  const { options } = await postThumbnailCtrPackage({
    scriptExcerpt: body.script || body.topic || body.title || "",
    videoTitle: body.title,
    topic: body.topic,
    outputLanguage: body.outputLanguage,
    count: 8,
  })
  const opt = options.find((o) => o.mainLine1?.trim() && o.mainLine2?.trim()) ?? options[0]
  if (!opt?.mainLine1?.trim()) throw new Error("CTR 패키지에서 문구를 받지 못했습니다.")
  return { line1: opt.mainLine1.trim(), line2: (opt.mainLine2 || "").trim() }
}

/** 템플릿 슬롯 카피 — CTR 패키지 결과를 replacements 맵으로 */
export async function postThumbnailTemplateCopy(body: {
  templateId?: string
  topic?: string
  scriptExcerpt?: string
  videoTitle?: string
  outputLanguage?: string
  frames?: { frameId: string; layers: { textKey: string; maxCharacters?: number }[] }[]
}): Promise<{ replacements: Record<string, string> }> {
  const { options } = await postThumbnailCtrPackage({
    scriptExcerpt: body.scriptExcerpt || body.topic || "",
    videoTitle: body.videoTitle,
    topic: body.topic,
    outputLanguage: body.outputLanguage,
    count: 8,
  })
  const opt = options.find((o) => o.mainLine1?.trim() && o.mainLine2?.trim()) ?? options[0]
  if (!opt) throw new Error("CTR 패키지 결과가 비어 있습니다.")

  const layers = body.frames?.[0]?.layers ?? []
  const line1 = opt.mainLine1.trim()
  const line2 = (opt.mainLine2 || "").trim()
  const sub = opt.subCopies?.[0]?.trim() || ""
  const replacements: Record<string, string> = {}

  const assign = (key: string, text: string, max?: number) => {
    if (!text) return
    replacements[key] = max && max > 0 ? text.slice(0, max) : text
  }

  // 슬롯 키 휴리스틱
  for (const layer of layers) {
    const k = layer.textKey.toLowerCase()
    if (k.includes("hook") || k === "line1" || k.includes("top")) {
      assign(layer.textKey, line1, layer.maxCharacters)
    } else if (k.includes("highlight") || k.includes("sub") || k === "accent") {
      assign(layer.textKey, sub || line2, layer.maxCharacters)
    } else if (k.includes("main") || k === "line2" || k.includes("title")) {
      assign(layer.textKey, line2, layer.maxCharacters)
    }
  }

  // 순서 폴백: 비어 있는 슬롯에 line1 → line2 → sub
  const pool = [line1, line2, sub].filter(Boolean)
  let pi = 0
  for (const layer of layers) {
    if (replacements[layer.textKey]?.trim()) continue
    if (pool[pi]) {
      assign(layer.textKey, pool[pi]!, layer.maxCharacters)
      pi++
    }
  }

  if (!Object.keys(replacements).length) {
    if (layers[0]) assign(layers[0].textKey, line1, layers[0].maxCharacters)
    if (layers[1]) assign(layers[1].textKey, line2, layers[1].maxCharacters)
  }

  return { replacements }
}

export async function postThumbnailThreeSlotCopy(body: {
  topic?: string
  scriptExcerpt?: string
  videoTitle?: string
  outputLanguage?: string
  slots?: { slotKey: string; maxCharacters?: number }[]
}): Promise<{ replacements: Record<string, string> }> {
  return postThumbnailTemplateCopy({
    topic: body.topic,
    scriptExcerpt: body.scriptExcerpt,
    videoTitle: body.videoTitle,
    outputLanguage: body.outputLanguage,
    frames: [
      {
        frameId: "main",
        layers: (body.slots ?? []).map((s) => ({
          textKey: s.slotKey,
          maxCharacters: s.maxCharacters,
        })),
      },
    ],
  })
}

export async function postThumbnailVerify(..._args: unknown[]) {
  return notPorted("thumbnail-verify")
}
export async function postThumbnailVerifyImprove(..._args: unknown[]) {
  return notPorted("thumbnail-verify-improve")
}
export async function postThumbnailHookSuggestions(..._args: unknown[]) {
  return notPorted("thumbnail-hook-suggestions")
}
export async function postThumbnailTextRewrite(..._args: unknown[]) {
  return notPorted("thumbnail-text-rewrite")
}
export async function postThumbnailCopyCombos(..._args: unknown[]) {
  return notPorted("thumbnail-copy-combos")
}
export async function postThumbnailSubCopies(..._args: unknown[]) {
  return notPorted("thumbnail-sub-copies")
}
export async function postThumbnailTemplateAnalyze(..._args: unknown[]) {
  return notPorted("thumbnail-template-analyze")
}
export async function postThumbnailBenchmarkAnalyze(..._args: unknown[]) {
  return notPorted("thumbnail-benchmark-analyze")
}
export async function postThumbnailReferenceRemix(..._args: unknown[]) {
  return notPorted("thumbnail-reference-remix")
}
export async function postGenerateAiThumbnail(..._args: unknown[]) {
  const body = (_args[0] || {}) as { topic?: string; customText?: string }
  return postThumbnailImage({
    topic: body.topic,
    imagePromptEn: body.topic,
  })
}

export async function postGenerateElementSticker(..._args: unknown[]) {
  return notPorted("thumbnail-element-sticker")
}
