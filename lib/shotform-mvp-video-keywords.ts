/**
 * MVP — YouTube·TikTok·Instagram URL → 한국어 **제품 관련** 키워드 추출
 * (대본/자막 + 영상 프레임 Vision OCR 정밀 분석)
 */

import { runShoppingFrameOcr } from "@/lib/shotform-shopping-frame-ocr"
import { fetchAndCropStoryboardCell, parseStoryboardCellApiPath } from "@/lib/youtube-storyboard-crop"
import { fetchYoutubeStoryboardCellCandidates } from "@/lib/youtube-storyboard-keyframes"
import { fetchYoutubeTranscript } from "@/lib/youtube-transcript"

export type MvpVideoUrlPlatform = "youtube" | "tiktok" | "instagram"

export type MvpVideoKeywordEvidence = "title" | "transcript" | "ocr" | "author"

export type MvpVideoKeywordItem = {
  keyword: string
  reason?: string
  evidence?: MvpVideoKeywordEvidence
}

export type MvpVideoKeywordDataQuality = "high" | "medium" | "low"

export type MvpVideoKeywordAnalysis = {
  url: string
  platform: MvpVideoUrlPlatform
  title: string
  author: string
  thumbnail: string
  productName: string
  category: string
  summary: string
  searchFeatures: string[]
  transcriptExcerpt: string
  ocrNotes: string
  framesAnalyzed: number
  hasTranscript: boolean
  hasOcr: boolean
  evidenceSources: MvpVideoKeywordEvidence[]
  dataQuality: MvpVideoKeywordDataQuality
  qualityNote: string
  keywords: MvpVideoKeywordItem[]
}

export function detectMvpVideoUrlPlatform(rawUrl: string): MvpVideoUrlPlatform | null {
  const u = rawUrl.trim().toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("tiktok.com")) return "tiktok"
  if (u.includes("instagram.com")) return "instagram"
  return null
}

export function isSupportedMvpVideoUrl(rawUrl: string): boolean {
  return detectMvpVideoUrlPlatform(rawUrl) !== null
}

function youtubeIdFromUrl(link: string): string | null {
  try {
    const u = new URL(link)
    const v = u.searchParams.get("v")
    if (v && /^[\w-]{11}$/.test(v)) return v
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/)
    if (shorts) return shorts[1]!
  } catch {
    return null
  }
  return null
}

type OembedMeta = { title?: string; author_name?: string; thumbnail_url?: string }

async function fetchOembed(url: string, platform: MvpVideoUrlPlatform): Promise<OembedMeta | null> {
  const endpoints: string[] = []
  if (platform === "youtube") {
    endpoints.push(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
  } else if (platform === "tiktok") {
    endpoints.push(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
  } else {
    endpoints.push(`https://www.instagram.com/oembed?url=${encodeURIComponent(url)}`)
  }
  endpoints.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
        next: { revalidate: 0 },
      })
      if (!r.ok) continue
      const json = (await r.json().catch(() => null)) as OembedMeta | null
      if (json && (json.title || json.author_name)) return json
    } catch {
      continue
    }
  }
  return null
}

async function storyboardCellToDataUrl(cellPath: string): Promise<string | null> {
  const path = cellPath.startsWith("/") ? cellPath : `/${cellPath}`
  const parsed = parseStoryboardCellApiPath(path)
  if (!parsed) return null
  try {
    const buf = await fetchAndCropStoryboardCell(
      parsed.sheetUrl,
      parsed.col,
      parsed.row,
      parsed.cols,
      parsed.rows
    )
    return `data:image/jpeg;base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

/** 영상 썸네일 + YouTube 스토리보드 컷(장면별) → Vision 입력 */
async function collectVideoVisionImages(
  platform: MvpVideoUrlPlatform,
  url: string,
  oembedThumb: string
): Promise<string[]> {
  const frames: string[] = []
  const thumbs: string[] = []
  if (oembedThumb.startsWith("http")) thumbs.push(oembedThumb)

  if (platform === "youtube") {
    const ytId = youtubeIdFromUrl(url)
    if (ytId) {
      thumbs.push(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`)
      const cells = await fetchYoutubeStoryboardCellCandidates(ytId, 24)
      const step = Math.max(1, Math.floor(cells.length / 8))
      const picks = cells.filter((_, i) => i % step === 0).slice(0, 8)
      for (const cell of picks) {
        const dataUrl = await storyboardCellToDataUrl(cell.imageUrl)
        if (dataUrl) frames.push(dataUrl)
      }
    }
  }

  return [...new Set([...frames, ...thumbs])].slice(0, 8)
}

/** 종류만 가리키는 말. 이것만으로는 다른 제품이 같이 검색된다. */
const GENERIC_PRODUCT_KEYWORDS = new Set([
  "텐트",
  "난방",
  "난방텐트",
  "온열",
  "보온",
  "침대",
  "매트",
  "매트리스",
  "이불",
  "담요",
  "쿠션",
  "방석",
  "전기장판",
  "캠핑",
  "겨울",
  "추위",
  "리뷰",
  "추천",
  "제품",
  "상품",
  "후기",
  "쇼츠",
  "숏폼",
])

function isSpecificProductKeyword(keyword: string): boolean {
  const compact = keyword.replace(/\s+/g, "")
  if (compact.length < 4 || GENERIC_PRODUCT_KEYWORDS.has(compact)) return false
  const parts = keyword.split(/\s+/).filter(Boolean)
  if (parts.length === 1 && GENERIC_PRODUCT_KEYWORDS.has(parts[0]!)) return false
  return parts.some((part) => !GENERIC_PRODUCT_KEYWORDS.has(part))
}

function ensureStrArr(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const s = String(entry).trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

const VALID_EVIDENCE = new Set<MvpVideoKeywordEvidence>(["title", "transcript", "ocr", "author"])

function ensureKeywordItems(raw: unknown, max = 10): MvpVideoKeywordItem[] {
  if (!Array.isArray(raw)) return []
  const out: MvpVideoKeywordItem[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry === "string") {
      const keyword = entry.trim()
      if (!keyword || seen.has(keyword)) continue
      seen.add(keyword)
      out.push({ keyword })
    } else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>
      const keyword = String(o.keyword || o.ko || o.text || "").trim()
      if (!keyword || seen.has(keyword)) continue
      seen.add(keyword)
      const evRaw = String(o.evidence || "").trim().toLowerCase()
      const evidence = VALID_EVIDENCE.has(evRaw as MvpVideoKeywordEvidence)
        ? (evRaw as MvpVideoKeywordEvidence)
        : undefined
      out.push({
        keyword,
        reason: typeof o.reason === "string" ? o.reason.trim() : undefined,
        evidence,
      })
    }
    if (out.length >= max) break
  }
  return out
}

function inferDataQuality(args: {
  hasTitle: boolean
  hasTranscript: boolean
  hasOcr: boolean
  frameCount: number
}): MvpVideoKeywordDataQuality {
  if (args.hasTranscript && args.hasOcr && args.frameCount >= 3) return "high"
  if (args.hasTranscript && args.hasOcr) return "high"
  if (args.hasTranscript || args.hasOcr) return "medium"
  return args.hasTitle ? "low" : "low"
}

function buildEvidenceSources(args: {
  hasTitle: boolean
  hasAuthor: boolean
  hasTranscript: boolean
  hasOcr: boolean
}): MvpVideoKeywordEvidence[] {
  const out: MvpVideoKeywordEvidence[] = []
  if (args.hasTitle) out.push("title")
  if (args.hasAuthor) out.push("author")
  if (args.hasTranscript) out.push("transcript")
  if (args.hasOcr) out.push("ocr")
  return out
}

export async function runMvpVideoKeywordAnalysis(args: {
  url: string
  apiKey: string
}): Promise<MvpVideoKeywordAnalysis> {
  const url = args.url.trim()
  const platform = detectMvpVideoUrlPlatform(url)
  if (!platform) {
    throw new Error("YouTube·TikTok·Instagram 영상 URL만 지원합니다.")
  }

  const oembed = await fetchOembed(url, platform)
  const title = oembed?.title?.trim() || ""
  const author = oembed?.author_name?.trim() || ""
  const thumbnail = oembed?.thumbnail_url?.trim() || ""

  let transcript = ""
  if (platform === "youtube") {
    const ytId = youtubeIdFromUrl(url)
    if (ytId) transcript = await fetchYoutubeTranscript(ytId)
  }

  const visionImages = await collectVideoVisionImages(platform, url, thumbnail)
  const videoOcrNotes =
    visionImages.length > 0
      ? await runShoppingFrameOcr(args.apiKey, visionImages, {
          imageContext:
            "쇼핑·제품 리뷰 숏폼 영상입니다. 썸네일·영상 장면 컷에서 제품 외형·브랜드·화면 자막·가격·스펙 텍스트만 정확히 읽어 주세요. 인물 얼굴·채널명만 있으면 '제품 없음'으로 표시.",
        })
      : ""

  const hasTitle = title.length > 0
  const hasAuthor = author.length > 0
  const hasTranscript = transcript.length >= 20
  const hasOcr = videoOcrNotes.length >= 10

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [
    {
      type: "text",
      text: `영상 URL: ${url}
플랫폼: ${platform}
영상 제목: ${title || "(없음)"}
작성자: ${author || "(없음)"}
시간축으로 자른 장면: ${visionImages.length}장. 각 장면에서 제품의 형태·색·재질·부품·설치 위치를 따로 보라.

=== 대본·자막 ===
${(transcript || "(자막 없음)").slice(0, 4500)}

=== 장면에 적힌 글자 ===
${(videoOcrNotes || "(없음)").slice(0, 2800)}`,
    },
    ...visionImages.slice(0, 6).map((image) => ({
      type: "image_url" as const,
      image_url: { url: image, detail: "low" as const },
    })),
  ]

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 1600,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `당신은 쇼핑 숏폼의 제품을 장면 단위로 보는 분석가입니다.
첨부된 장면 이미지와 자막만 보고, 화면에 나온 그 제품 하나를 다른 제품과 구분하는 검색어만 만듭니다.
이 검색어는 나중에 도우인·샤오홍슈에서 같은 제품을 찾을 때 씁니다.

보는 순서:
1. 장면마다 제품이 어떻게 생겼는지 적는다. 형태, 색, 재질, 지퍼·창·폴대·코드 같은 부품, 침대 위·바닥·벽 같은 설치 위치.
2. 자막과 화면 글자에서 그 생김새와 맞는 말만 남긴다. 화면에 없는 브랜드·가격·스펙은 만들지 않는다.
3. 키워드는 그 생김새가 들어간 한국어 구로만 쓴다.

키워드 규칙:
- 4~6개. 한 키워드는 2~5단어.
- 모든 키워드에 실제로 본 구분 특징이 하나 이상 들어가야 한다. 예: "침대 위 사각 실내텐트", "지퍼문 난방텐트", "핑크 접이식 바닥텐트".
- 종류만 있는 말은 금지한다. 텐트, 난방, 난방텐트, 매트리스, 전기장판, 이불, 캠핑, 겨울처럼 다른 제품도 같이 걸리는 단어는 단독으로 쓰지 않는다.
- 리뷰, 추천, 구독, 쇼츠, 채널명, 사람 이름은 넣지 않는다.

searchFeatures는 화면에서 확인한 생김새 태그 4~8개다.
evidence는 transcript, ocr, title 중 하나다.
dataQuality는 장면과 자막이 둘 다 있으면 high, 하나만 있으면 medium, 제목뿐이면 low다.

JSON만:
{"productName":"","category":"","summary":"","searchFeatures":[],"keywords":[{"keyword":"","reason":"","evidence":""}],"dataQuality":"high|medium|low","qualityNote":""}`,
        },
        { role: "user" as const, content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`AI 키워드 추출 실패 (${res.status}): ${t.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 응답이 비어 있습니다.")

  const parsed = JSON.parse(content) as Record<string, unknown>
  const productName = String(parsed.productName || title || "").trim()
  const category = String(parsed.category || "").trim()
  let keywords = ensureKeywordItems(parsed.keywords, 8).filter((item) =>
    isSpecificProductKeyword(item.keyword)
  )
  const searchFeatures = ensureStrArr(parsed.searchFeatures, 8).filter(isSpecificProductKeyword)

  if (keywords.length === 0 && searchFeatures.length > 0) {
    keywords = searchFeatures.slice(0, 6).map((k) => ({ keyword: k, evidence: "ocr" as const }))
  }
  if (keywords.length === 0 && isSpecificProductKeyword(productName)) {
    keywords = [{ keyword: productName, evidence: hasTranscript ? "transcript" : hasTitle ? "title" : undefined }]
  }

  const aiQuality = parsed.dataQuality
  const dataQuality: MvpVideoKeywordDataQuality =
    aiQuality === "high" || aiQuality === "medium" || aiQuality === "low"
      ? aiQuality
      : inferDataQuality({ hasTitle, hasTranscript, hasOcr, frameCount: visionImages.length })

  let qualityNote = String(parsed.qualityNote || "").trim()
  if (!qualityNote) {
    if (hasTranscript && hasOcr) {
      qualityNote = `TTS·음성 자동 자막 ${transcript.length}자 + 영상 ${visionImages.length}장 OCR을 분석했습니다.`
    } else if (hasTranscript) {
      qualityNote = "자막·음성(TTS) 자동 자막 기반 분석입니다."
    } else if (hasOcr) {
      qualityNote = `영상 ${visionImages.length}장 OCR 기반입니다. YouTube 자막·자동 자막이 없어 음성 대본 분석은 생략되었습니다.`
    } else {
      qualityNote = "제목 위주 분석입니다. YouTube 영상·자막이 있는 URL을 권장합니다."
    }
  }

  return {
    url,
    platform,
    title: title || productName,
    author,
    thumbnail: thumbnail || visionImages.find((u) => u.startsWith("http")) || "",
    productName,
    category,
    summary: String(parsed.summary || "").trim(),
    searchFeatures,
    transcriptExcerpt: transcript.slice(0, 500),
    ocrNotes: videoOcrNotes,
    framesAnalyzed: visionImages.length,
    hasTranscript,
    hasOcr,
    evidenceSources: buildEvidenceSources({ hasTitle, hasAuthor, hasTranscript, hasOcr }),
    dataQuality,
    qualityNote,
    keywords,
  }
}
