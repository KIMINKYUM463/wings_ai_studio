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
  const out: string[] = []
  if (oembedThumb.startsWith("http")) out.push(oembedThumb)

  if (platform === "youtube") {
    const ytId = youtubeIdFromUrl(url)
    if (ytId) {
      out.push(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`)
      const cells = await fetchYoutubeStoryboardCellCandidates(ytId, 12)
      const picks = cells.filter((_, i) => i % Math.max(1, Math.floor(cells.length / 4)) === 0).slice(0, 4)
      for (const cell of picks) {
        const dataUrl = await storyboardCellToDataUrl(cell.imageUrl)
        if (dataUrl) out.push(dataUrl)
      }
    }
  }

  return [...new Set(out)].slice(0, 4)
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1600,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `당신은 쇼핑 숏폼·제품 리뷰 영상 분석 전문가입니다.
**대본(자막)·영상 제목·장면 OCR**만 근거로, 영상에서 다루는 **제품/카테고리와 직접 관련된** 한국어 검색 키워드만 추출합니다.
(이후 抖音·小红书에서 비슷한 제품·사용 장면 영상을 찾을 검색어)

## 분석 순서 (내부 추론)
1. **대본 분석** — 제품명·브랜드·기능·사용 장면·문제 해결 포인트가 나오는 구간만 추출. 인사·구독·채널 소개·BGM만 있으면 제품 정보 없음으로 처리.
2. **이미지/OCR 분석** — 제품 실물·포장·화면 UI·자막 텍스트에서 확인된 특징만. 추측 금지.
3. **제품 특정** — productName: 영상이 실제로 홍보/리뷰하는 핵심 상품 1개.
4. **키워드** — searchFeatures·keywords는 **제품 검색에 쓸 구문만**. 인물·채널·일반 브이로그 키워드 제외.

## 절대 금지
- 대본·OCR·제목에 **없는** 스펙·브랜드·가격 지어내기
- "영상", "리뷰", "추천", "구독", "좋아요", "쇼츠", "브이로그" 단독 키워드
- 인물 소개·채널명·일반 여행·먹방 등 **제품과 무관한** 키워드
- 제품과 무관한 키워드는 keywords 배열에 **넣지 말 것**

## 출력
- searchFeatures: 6~12개, 제품 특징·용도 태그 (근거 있는 것만)
- keywords: 6~10개, **제품·카테고리·기능·사용장면** 관련 한국어 검색어 (2~12자)
- evidence: "transcript"|"ocr"|"title"|"author"
- dataQuality: high=자막+OCR, medium=하나, low=제목 위주

JSON만:
{"productName":"","category":"","summary":"","searchFeatures":[],"keywords":[{"keyword":"","reason":"","evidence":""}],"dataQuality":"high|medium|low","qualityNote":""}`,
        },
        {
          role: "user" as const,
          content: `영상 URL: ${url}
플랫폼: ${platform}
영상 제목: ${title || "(없음)"}
작성자: ${author || "(없음)"}
분석한 영상 장면/썸네일: ${visionImages.length}장

=== 대본·자막 (전문) ===
${(transcript || "(자막 없음 — 제목·OCR 위주로 분석)").slice(0, 4500)}

=== 영상 장면·썸네일 OCR ===
${(videoOcrNotes || "(OCR 없음)").slice(0, 2800)}`,
        },
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
  let keywords = ensureKeywordItems(parsed.keywords, 10)
  const searchFeatures = ensureStrArr(parsed.searchFeatures, 12)

  if (keywords.length === 0 && searchFeatures.length > 0) {
    keywords = searchFeatures.slice(0, 6).map((k) => ({ keyword: k, evidence: "ocr" as const }))
  }
  if (keywords.length === 0 && productName) {
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
