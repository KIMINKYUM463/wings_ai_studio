import { createHash } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"

/** Apify 동기 호출·LLM 등으로 길어질 수 있음. 미설정 시 Vercel 기본(초단위)에서 연결이 끊기면 Apify 런이 ABORTED로 보일 수 있음. */
export const maxDuration = 300
import {
  dedupeVideoRows,
  serpGoogleImagesAsKeyframes,
  serpYoutubeSearch,
} from "@/lib/serpapi-product-search"
import { collectApifyVideoCandidatesBudgeted } from "@/lib/apify-product-search"
import { executeLiteProductSearch } from "@/lib/shotform-product-search-lite"
import { fetchYoutubeTranscript } from "@/lib/youtube-transcript"
import { fetchYoutubeStoryboardCellCandidates } from "@/lib/youtube-storyboard-keyframes"
import { runShoppingFrameOcr } from "@/lib/shotform-shopping-frame-ocr"
import {
  fetchAndCropStoryboardCell,
  keyframeImageToDataUrl,
  parseStoryboardCellApiPath,
} from "@/lib/youtube-storyboard-crop"

/** POST /api/product-search — 자막·OCR·AI·SerpApi·벤치마킹 검색어(플랫폼별 8)·유사도 재평가 등 */
/** 벤치마킹용: 플랫폼별 Serp·UI에 쓰는 검색어 개수(언어 혼합 8개) */
const SEARCH_QUERIES_PER_PLATFORM = 8
/** SerpApi YouTube 검색 엔진 호출 상한(1건 분석당, 우선 키워드 2개) */
const SERP_YOUTUBE_ENGINE_CAP = 2
type SearchQueries = {
  youtube: string[]
  tiktok: string[]
  xiaohongshu: string[]
  douyin: string[]
}

type Analysis = {
  productName: string
  category: string
  /** UI용 1~2개 한글 태그 (예: 홈리빙, 수납/정리) */
  categoryTags: string[]
  targetKeywords: string[]
  searchQueries: SearchQueries
  /** Serp 실검색에 우선 사용할 플랫폼별 2문구(OR 1회 호출용). searchQueries 8개와 별도로 엄선 */
  serpPriorityQueries: SearchQueries
  /** 명세 §8 — 제품 특징(설명용 문장/불릿) */
  productTraits?: string[]
  /** 영상 분석 후 검색용으로 쓰는 짧은 특징 태그(크기·용도·방식·광고각 등). 플랫폼 검색어 생성의 입력 */
  searchFeatures?: string[]
  /** 명세 §4·8 — 사용 장면 */
  usageScene?: string
  /** 명세 §8 — 제품 형태 */
  productForm?: string
  /** 명세 §4 — 쇼핑 키워드 */
  shoppingKeywords?: string[]
  /** 명세 §4 — 광고 문구 */
  adCopyLines?: string[]
  /** 명세 §8 — 타겟 고객 */
  targetCustomer?: string
}

type KeyframeItem = {
  index: number
  imageUrl: string
  label?: string
}

/** 명세 §11 — 후보 영상 AI 유사도(썸네일은 텍스트·문맥 기반 추정) */
type VideoSimilarity = {
  sameProductType: boolean
  shoppingVideo: boolean
  keywordSimilarity: number
  /** 썸네일 미전달 시 제목·문맥 추정 또는 null */
  visualSimilarity: number | null
  finalScore: number
  rationale?: string
}

type VideoResult = {
  platform: string
  title: string
  thumbnail: string
  videoUrl: string
  url: string
  author: string
  /** 숏폼/롱폼 필터용 */
  contentLength?: "short" | "long" | "unknown"
  /** 명세 §12 — 제목·키워드 기반 사전 관련도 */
  relevanceScore?: number
  /** 명세 §11·§12 — LLM 최종 유사도 */
  similarity?: VideoSimilarity
}

function detectPlatform(rawUrl: string): string {
  const u = rawUrl.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
  if (u.includes("tiktok.com")) return "tiktok"
  if (u.includes("instagram.com")) return "instagram"
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu"
  if (u.includes("douyin.com") || u.includes("iesdouyin.com") || u.includes("v.douyin.com") || u.includes("m.douyin.com"))
    return "douyin"
  return "unknown"
}

async function fetchOembed(url: string): Promise<{ title?: string; author_name?: string; thumbnail_url?: string } | null> {
  const platform = detectPlatform(url)
  try {
    if (platform === "youtube") {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { next: { revalidate: 0 } }
      )
      if (!r.ok) return null
      return r.json()
    }
    if (platform === "tiktok") {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { next: { revalidate: 0 } })
      if (!r.ok) return null
      return r.json()
    }
  } catch {
    return null
  }
  return null
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\//, "").split("/")[0] || null
    }
    if (u.pathname.startsWith("/shorts/")) {
      return u.pathname.split("/")[2]?.split("?")[0] || null
    }
    const v = u.searchParams.get("v")
    if (v) return v
  } catch {
    return null
  }
  return null
}

function ensureStrArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
}

/** 벤치마크/일부 LLM이 `{ "query": "中文", "ko": "..." }` 형태로 주는 검색어를 문자열로 승격 */
function searchQueryEntryToString(entry: unknown): string {
  if (typeof entry === "string") return entry.trim()
  if (!entry || typeof entry !== "object") return ""
  const o = entry as Record<string, unknown>
  if (typeof o.query === "string" && o.query.trim()) return o.query.trim()
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim()
  if (typeof o.ko === "string" && o.ko.trim()) return o.ko.trim()
  return ""
}

function ensureSearchQueryArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of v) {
    const s = searchQueryEntryToString(entry)
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

function normalizeSerpPriorityQueries(sq: SearchQueries, raw: unknown, productName: string): SearchQueries {
  const keys = ["youtube", "tiktok", "xiaohongshu", "douyin"] as const
  const rawObj =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: SearchQueries = { youtube: [], tiktok: [], xiaohongshu: [], douyin: [] }
  const fill = productName.trim() || "쇼핑"
  for (const k of keys) {
    const fromAi = ensureSearchQueryArr(rawObj[k], 2)
    const fb = sq[k].filter((x) => String(x).trim())
    const merged: string[] = []
    for (const x of fromAi) {
      const t = String(x).trim()
      if (t && merged.length < 2 && !merged.some((m) => m.toLowerCase() === t.toLowerCase())) merged.push(t)
    }
    for (const x of fb) {
      if (merged.length >= 2) break
      const t = String(x).trim()
      if (t && !merged.some((m) => m.toLowerCase() === t.toLowerCase())) merged.push(t)
    }
    if (merged.length === 0) merged.push(fb[0] ? String(fb[0]).trim() : fill)
    if (merged.length === 1) {
      const cand = fb[1] ? String(fb[1]).trim() : ""
      const second =
        cand && cand.toLowerCase() !== merged[0].toLowerCase()
          ? cand
          : `${merged[0]} unboxing`.trim()
      merged.push(second)
    }
    out[k] = merged.slice(0, 2)
  }
  return out
}

function normalizeAnalysis(parsed: Record<string, unknown>): Analysis {
  const empty: SearchQueries = {
    youtube: [],
    tiktok: [],
    xiaohongshu: [],
    douyin: [],
  }
  const sqRaw = parsed.searchQueries
  const sq =
    sqRaw && typeof sqRaw === "object"
      ? (sqRaw as Record<string, unknown>)
      : ({} as Record<string, unknown>)
  const mergedQueries: SearchQueries = { ...empty }
  for (const key of Object.keys(empty) as (keyof SearchQueries)[]) {
    mergedQueries[key] = ensureSearchQueryArr(sq[key], SEARCH_QUERIES_PER_PLATFORM)
  }
  const tags = ensureStrArr(parsed.categoryTags, 6)
  const primaryCat = String(parsed.category || "기타").trim() || "기타"
  const categoryTags =
    tags.length >= 2 ? tags.slice(0, 2) : tags.length === 1 ? [tags[0], primaryCat] : [primaryCat, "쇼핑"]

  const productName = String(parsed.productName || "상품 미상").trim() || "상품 미상"

  return {
    productName,
    category: primaryCat,
    categoryTags,
    targetKeywords: ensureStrArr(parsed.targetKeywords, 24),
    searchQueries: mergedQueries,
    serpPriorityQueries: normalizeSerpPriorityQueries(mergedQueries, parsed.serpPriorityQueries, productName),
    productTraits: ensureStrArr(parsed.productTraits, 14),
    searchFeatures: ensureStrArr(
      Array.isArray(parsed.searchFeatures)
        ? parsed.searchFeatures
        : Array.isArray(parsed.features)
          ? parsed.features
          : [],
      16
    ),
    usageScene: typeof parsed.usageScene === "string" ? parsed.usageScene.trim() : "",
    productForm: typeof parsed.productForm === "string" ? parsed.productForm.trim() : "",
    shoppingKeywords: ensureStrArr(parsed.shoppingKeywords, 20),
    adCopyLines: ensureStrArr(parsed.adCopyLines, 10),
    targetCustomer: typeof parsed.targetCustomer === "string" ? parsed.targetCustomer.trim() : "",
  }
}

function canonicalKeyframeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ""
    return `${u.origin}${u.pathname}`
  } catch {
    return url.trim()
  }
}

/** Serp에서 같은 URL이 여러 쿼리로 중복 수집될 때 먼저 제거(바이트 해시 전 단계) */
function dedupeKeyframeItemsByCanonicalUrl(items: KeyframeItem[]): KeyframeItem[] {
  const seen = new Set<string>()
  const out: KeyframeItem[] = []
  for (const it of items) {
    const k = canonicalKeyframeUrl(it.imageUrl)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ ...it, index: out.length + 1 })
  }
  return out
}

function youtubeStaticKeyframeCandidates(ytId: string): KeyframeItem[] {
  /** 동일 영상 CDN(i.ytimg)만 사용. img.youtube 이중 호스트는 같은 그림이 바이트만 달라 중복 노출되기 쉬워 제외. */
  const base = `https://i.ytimg.com/vi/${ytId}`
  const paths = ["/1.jpg", "/2.jpg", "/3.jpg", "/maxresdefault.jpg", "/hqdefault.jpg", "/mqdefault.jpg"] as const
  return paths.map((path, i) => ({
    index: i + 1,
    imageUrl: `${base}${path}`,
    label: `yt${path.replace(/\./g, "")}`,
  }))
}

function collectAnchorPhrasesForVideo(a: Analysis): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = s.trim()
    if (t.length < 2) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }
  push(a.productName)
  for (const k of a.targetKeywords) push(k)
  for (const k of a.shoppingKeywords || []) push(k)
  for (const t of a.categoryTags) push(t)
  for (const k of a.productTraits || []) push(k)
  for (const k of a.searchFeatures || []) push(k)
  for (const plat of Object.keys(a.searchQueries) as (keyof SearchQueries)[]) {
    for (const q of a.searchQueries[plat] || []) push(q)
  }
  for (const plat of Object.keys(a.serpPriorityQueries) as (keyof SearchQueries)[]) {
    for (const q of a.serpPriorityQueries[plat] || []) push(q)
  }
  return out.slice(0, 48)
}

/** SerpApi: YouTube 엔진만(serpPriorityQueries 상위 2키워드, 각 1회). TikTok·샤오홍슈·더우인은 Apify. */
async function collectYoutubeSerpCandidates(
  serpApiKey: string,
  analysis: Analysis
): Promise<{ rows: VideoResult[]; serpEngineCalls: number }> {
  const pq = analysis.serpPriorityQueries
  let all: VideoResult[] = []
  const queries = pq.youtube.map((s) => s.trim()).filter(Boolean).slice(0, SERP_YOUTUBE_ENGINE_CAP)
  const batches = await Promise.all(queries.map((q) => serpYoutubeSearch(serpApiKey, q, 14)))
  for (const batch of batches) {
    all = dedupeVideoRows([...all, ...batch])
  }
  return { rows: all, serpEngineCalls: queries.length }
}

function phraseMatchesHaystack(phrase: string, fullText: string, hayLower: string): boolean {
  if (phrase.length < 2) return false
  if (/^[\x00-\x7F]+$/.test(phrase)) return hayLower.includes(phrase.toLowerCase())
  return fullText.includes(phrase)
}

/** 명세 §12 — 제목·채널에 제품 앵커(상품명·검색어·키워드)가 붙는지 강하게 평가 */
function relevanceScoreVideo(r: VideoResult, a: Analysis): number {
  if (r.author === "검색 링크 (MVP)") return 2
  const full = `${r.title} ${r.author}`
  const hay = full.toLowerCase()
  let s = 0
  const anchors = collectAnchorPhrasesForVideo(a)
  for (const phrase of anchors) {
    if (!phraseMatchesHaystack(phrase, full, hay)) continue
    const len = phrase.length
    if (len >= 8) s += 18
    else if (len >= 5) s += 14
    else if (len >= 3) s += 10
    else s += 6
  }
  const pn = (a.productName || "").trim()
  if (pn.length >= 2 && full.includes(pn)) s += 16
  return s
}

function sortByShoppingRelevance(rows: VideoResult[], a: Analysis): VideoResult[] {
  return [...rows]
    .map((r) => ({ ...r, relevanceScore: relevanceScoreVideo(r, a) }))
    .sort((x, y) => (y.relevanceScore ?? 0) - (x.relevanceScore ?? 0))
}

/** 너무 주제에서 벗어난 영상은 제외하되, 결과가 비지 않도록 최소 점수는 낮춥니다. */
function filterVideosByProductRelevance(rows: VideoResult[], analysis: Analysis): VideoResult[] {
  const scored = sortByShoppingRelevance(rows, analysis)
  const nonMvp = (xs: VideoResult[]) => xs.filter((r) => r.author !== "검색 링크 (MVP)")
  let min = 12
  while (min >= 0) {
    const kept = scored.filter((r) => r.author === "검색 링크 (MVP)" || (r.relevanceScore ?? 0) >= min)
    if (nonMvp(kept).length >= 6 || min <= 0) return kept
    min -= 3
  }
  return scored
}

const APIFY_VIDEO_PLATFORMS = new Set(["tiktok", "xiaohongshu", "douyin"])

/** LLM이 50점 미만으로 걸러도 Apify 동기 수집 스냅샷에 있던 TikTok/샤오홍슈/더우인 URL은 목록 하단에 붙인다 */
function mergeApifySnapshotTailIntoRanked(
  ranked: VideoResult[],
  apifySnapshot: VideoResult[],
  analysis: Analysis
): VideoResult[] {
  if (apifySnapshot.length === 0) return ranked
  const inRanked = new Set(ranked.map((r) => r.url.trim().toLowerCase()))
  const missing = apifySnapshot.filter(
    (r) => APIFY_VIDEO_PLATFORMS.has(r.platform) && !inRanked.has(r.url.trim().toLowerCase())
  )
  if (missing.length === 0) return ranked
  const tail = sortByShoppingRelevance(missing, analysis)
  return dedupeVideoRows([...ranked, ...tail])
}

function clampScore0to100(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function runLlmSimilarityScoresForChunk(
  apiKey: string,
  baseBlock: string,
  chunk: VideoResult[]
): Promise<VideoSimilarity[]> {
  if (chunk.length === 0) return []
  const enumerated = chunk
    .map(
      (c, i) =>
        `${i + 1}. [${c.platform}] 제목: ${c.title}\n   썸네일 URL: ${c.thumbnail || "(없음)"}\n   작성자/출처: ${c.author}\n   URL: ${c.url}`
    )
    .join("\n\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.15,
      max_tokens: 3200,
      response_format: { type: "json_object" as const },
      messages: [
        {
          role: "system" as const,
          content: `쇼핑·제품 광고 숏폼 유사도 심사자. 기준 영상에서 추출한 상품 정보와 후보를 비교한다.

출력: JSON 한 객체, 키 "scores"만. scores는 후보 목록과 동일한 개수의 배열이며, scores[i]는 입력 목록의 i번째 후보만 설명한다.

각 scores[i] 필드:
- finalScore: 0~100 정수. 50 미만은 기준 상품·쇼핑 숏폼과 무관하거나 노이즈로 본다.
- 90~100 매우 유사, 70~89 유사, 50~69 약간 관련.
- sameProductType: 같은/매우 근접한 상품군·용도면 true.
- shoppingVideo: 언박싱·리뷰·세일·쇼핑 성격이면 true. 뉴스·게임·무관 VLOG면 false.
- keywordSimilarity: 제목·작성자 텍스트가 기준 상품/키워드와 얼마나 맞는지 0~100.
- visualSimilarity: 썸네일 URL이 있으면 제품·쇼핑 연관이 있어 보이는지, 없으면 제목·플랫폼·URL 맥락으로 추정한 0~100 (추정치임을 전제로 채운다).
- rationale: 한국어 한 줄.`,
        },
        {
          role: "user" as const,
          content: `${baseBlock}\n\n후보 목록(순서 고정, ${chunk.length}개):\n\n${enumerated}`,
        },
      ],
    }),
  })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content || typeof content !== "string") return []
  let parsed: { scores?: unknown[] }
  try {
    parsed = JSON.parse(content) as { scores?: unknown[] }
  } catch {
    return []
  }
  const scores = Array.isArray(parsed.scores) ? parsed.scores : []
  const out: VideoSimilarity[] = []
  for (let i = 0; i < chunk.length; i++) {
    const s = scores[i] as Record<string, unknown> | undefined
    if (!s || typeof s !== "object") {
      out.push({
        sameProductType: false,
        shoppingVideo: false,
        keywordSimilarity: 0,
        visualSimilarity: null,
        finalScore: 0,
      })
      continue
    }
    const vis = s.visualSimilarity
    out.push({
      sameProductType: Boolean(s.sameProductType),
      shoppingVideo: Boolean(s.shoppingVideo),
      keywordSimilarity: clampScore0to100(s.keywordSimilarity),
      visualSimilarity: vis === null || vis === undefined ? null : clampScore0to100(vis),
      finalScore: clampScore0to100(s.finalScore),
      rationale: typeof s.rationale === "string" ? s.rationale.trim().slice(0, 220) : undefined,
    })
  }
  return out
}

/** 명세 §11·§12: 후보 대량 수집 후 LLM으로 재점수화, finalScore 50 미만 제외, 상위 최대 120 */
async function applyLlmSimilarityRerankAndFilter(args: {
  apiKey: string
  analysis: Analysis
  base: { url: string; platform: string; title: string; transcript: string; ocrNotes: string }
  candidates: VideoResult[]
}): Promise<{ rows: VideoResult[]; llmUsed: boolean }> {
  const { apiKey, analysis, base, candidates } = args
  if (candidates.length === 0) return { rows: [], llmUsed: false }

  const baseBlock = [
    `기준 영상 URL: ${base.url}`,
    `플랫폼: ${base.platform}`,
    `제목: ${base.title}`,
    `추론 상품명: ${analysis.productName}`,
    `카테고리: ${analysis.category}`,
    `특징: ${(analysis.productTraits || []).join(" / ")}`,
    `검색 특징 태그: ${(analysis.searchFeatures || []).join(" / ") || "-"}`,
    `사용 장면: ${analysis.usageScene || "-"}`,
    `제품 형태: ${analysis.productForm || "-"}`,
    `쇼핑 키워드: ${(analysis.shoppingKeywords || []).slice(0, 10).join(", ")}`,
    `타겟 키워드: ${analysis.targetKeywords.slice(0, 14).join(", ")}`,
    `자막 발췌: ${base.transcript.slice(0, 720)}`,
    `OCR 발췌: ${base.ocrNotes.slice(0, 520)}`,
  ].join("\n")

  const CHUNK = 26
  const chunks: VideoResult[][] = []
  for (let i = 0; i < candidates.length; i += CHUNK) {
    chunks.push(candidates.slice(i, i + CHUNK))
  }
  const parts = await Promise.all(chunks.map((chunk) => runLlmSimilarityScoresForChunk(apiKey, baseBlock, chunk)))
  for (let ci = 0; ci < parts.length; ci++) {
    if (parts[ci].length !== chunks[ci].length) return { rows: [], llmUsed: false }
  }
  const allScores = parts.flat()

  if (allScores.length !== candidates.length) return { rows: [], llmUsed: false }
  const maxScore = Math.max(...allScores.map((s) => s.finalScore))
  if (maxScore <= 0) return { rows: [], llmUsed: false }

  const merged: VideoResult[] = candidates.map((row, idx) => ({
    ...row,
    similarity: allScores[idx],
  }))
  const kept = merged.filter((r) => (r.similarity?.finalScore ?? 0) >= 50)
  kept.sort((a, b) => (b.similarity?.finalScore ?? 0) - (a.similarity?.finalScore ?? 0))
  return { rows: kept.slice(0, 120), llmUsed: true }
}

async function runAnalysis(args: {
  title: string
  description: string
  transcript: string
  ocrNotes: string
  url: string
  platform: string
  apiKey: string
}): Promise<Analysis> {
  const { title, description, transcript, ocrNotes, url, platform, apiKey } = args
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 3200,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content: `당신은 쇼핑 숏폼·라이브커머스 분석가입니다. 자막·화면 OCR·제목·설명을 종합해 **영상이 파는 상품**을 추론하고, 벤치마킹 수준의 **플랫폼별 검색어**를 만듭니다.

## 절대 금지
- 상품명만 번역·로마자 치환한 “번역기 검색어”
- 플랫폼마다 거의 같은 8개 문장만 언어만 바꾼 것
- 자막/OCR에 근거 없는 환상 스펙

## 내부 추론 파이프라인(출력 JSON에 반드시 녹일 것)
**STEP 1 — 영상 이해**  
제품 형태, 사용 장면, 크기/휴대성, 사용 방식(손잡이/탁상/걸이/넥밴드 등), 광고 포인트(풍량·배터리·소음·가격)를 자막·OCR·제목에서 끌어올립니다.

**STEP 2 — searchFeatures**  
위 이해를 바탕으로 검색에 쓸 **짧은 특징 태그 6~12개**(한글 2~6글자 위주, 필요 시 숫자/영문 혼합). 예: 대형, 휴대용, 탁상형, 배터리형, 강풍, 접이식, 야외, 여름필수 등. **OCR/자막에 안 나오면 넣지 말 것.**

**STEP 3 — 특징 → 검색 구문**  
각 searchQueries 항목은 **상품명 단독이 아니라** (특징 또는 사용장면 또는 카테고리) + (제품군) 형태를 섞습니다.

**STEP 4 — 플랫폼 문화(톤)**  
- **youtube**: SerpApi YouTube 검색용 — 한국 쇼핑·리뷰 숏폼 제목 스타일 + 글로벌 영어 혼합.  
- **tiktok**: Apify TikTok 검색용 — 영어 위주 **review / unboxing / test / portable … / summer must-have** 류가 자연스럽게 섞이게.  
- **xiaohongshu**: Apify(RedNote 검색)용 — **8개 모두 간체 중국어만**(영어·한국어 문구 금지). 실제 검색창에 넣을 구문: 제품군+특징·시즌·리뷰 의도(测评/开箱/好物分享/夏日必备/便携/手持 등). 예시 톤: 折叠风扇、便携风扇、手持风扇、夏日必备、好物分享 와 비슷한 **간체 쇼핑 검색어**로 채울 것.
- **douyin**: Apify(더우인 검색)용 — **8개 모두 간체 중국어** 우선(영어는 글로벌 브랜드명 등 불가피할 때만). 推荐/测评/爆款/便携/手持/挂腰 등 **더우인 실검 패턴**을 섞을 것.  

**STEP 5 — 키워드 확장**  
베이스 한 구(예: portable fan)에 수식어·용도·계절·배터리 등을 붙인 **서로 다른 8개**로 펼칩니다(의미 중복 최소화).

**STEP 6 — 검색 의도(intent)**  
전체 **32개** searchQueries(플랫폼 4×8) 중 **최소 절반 이상**에 아래 류의 의도가 **자연스럽게** 섞이게: 리뷰·언박싱·테스트/실측·데모·사용기·비교·추천·할인(해당 시). 영어면 review/unboxing/test/demo/comparison, 중국 플랫폼이면 测评/开箱/好物/推荐 등.

## serpPriorityQueries (비용·우선순위 — 매우 중요)
- **YouTube(SerpApi)**: 실제 Serp 호출에 먼저 쓸 검색어 **정확히 2개**.
- **TikTok**: **정확히 2개** 문자열(중복 금지). 서버는 통합 후보 풀에서 **상위 2문구**를 골라 TikTok Apify에 넣음.
- **xiaohongshu**: **정확히 2개** 문자열(중복 금지). **간체 중국어**로 쓸 것(샤오홍슈 Apify는 **serpPriorityQueries.xiaohongshu → searchQueries.xiaohongshu** 순으로 이 2개와 8개를 우선 사용; TikTok 통합 2문구와 동일할 필요 없음).
- **douyin**: **정확히 2개** 문자열(중복 금지). **간체 중국어**로 쓸 것(더우인 Apify는 **serpPriorityQueries.douyin → searchQueries.douyin** 순으로 이 2개와 8개를 우선 사용; TikTok·샤오홍슈와 같은 통합 2문구를 쓰지 않음).
- 각 배열은 **정확히 2개** 문자열. **youtube·tiktok·xiaohongshu·douyin** 네 플랫폼만 출력한다(Instagram·Baidu는 사용하지 않음).
- 상품명 단독만 넣지 말 것.

## searchQueries 출력 규칙(매우 중요)
- 각 플랫폼 배열은 **정확히 ${SEARCH_QUERIES_PER_PLATFORM}개** 문자열(중복·공백 금지).
- youtube: **한국어 4개 + 영어 4개**(앞 4 ko 뒤 4 en 권장).
- tiktok: **영어 4개 + 한국어 4개**.
- xiaohongshu: **간체 중국어 8개 전부**(영어·로마자 검색어 금지; 브랜드도 중국어 표기 우선).
- douyin: **간체 중국어 8개 전부**(영어는 글로벌 고유명사 등 최소한만).

객체 { "query": "...", "ko": "..." }는 필요 시만 사용. 서버는 query(없으면 ko)를 검색 문자열로 씀.
반드시 JSON 한 객체만 출력.`,
      },
      {
        role: "user" as const,
        content: `다음 쇼핑/제품 홍보 숏폼을 분석해 JSON으로 출력하세요.

영상 URL: ${url}
플랫폼: ${platform}
영상 제목: ${title || "(없음)"}
영상 설명(메타): ${(description || "").slice(0, 2000)}

자막(가능 시 자동 추출, 없으면 빈 값처럼 다룸):
${(transcript || "(자막 없음 또는 추출 실패)").slice(0, 3800)}

화면 텍스트·OCR(비전 분석, 없으면 없음):
${(ocrNotes || "(OCR 없음)").slice(0, 2200)}

다음 키를 가진 JSON만 출력:
{
  "productName": "한글 상품명",
  "category": "대표 카테고리 한 줄",
  "categoryTags": ["태그1", "태그2"],
  "targetKeywords": ["쇼핑/숏폼 제목에 나올 법한 짧은 구문", "..."],
  "searchFeatures": ["검색용 짧은 특징 태그", "..."],
  "productTraits": ["제품 설명용 특징 문장/불릿"],
  "usageScene": "사용 장면 한 문장",
  "productForm": "제품 형태·구조 한 문장",
  "shoppingKeywords": ["쇼핑/카테고리 키워드"],
  "adCopyLines": ["광고 문구 후보 1", "2"],
  "targetCustomer": "타겟 고객 한 문장",
  "serpPriorityQueries": {
    "youtube": ["Serp YouTube에 먼저 쓸 검색어1", "검색어2"],
    "tiktok": ["Apify 1차 검색1", "1차 검색2"],
    "xiaohongshu": ["Apify 1차 간체1", "간체2"],
    "douyin": ["Apify 1차 간체1", "간체2"]
  },
  "searchQueries": {
    "youtube": ["q1","q2","q3","q4","q5","q6","q7","q8"],
    "tiktok": ["q1","q2","q3","q4","q5","q6","q7","q8"],
    "xiaohongshu": ["q1","q2","q3","q4","q5","q6","q7","q8"],
    "douyin": ["q1","q2","q3","q4","q5","q6","q7","q8"]
  }
}

요구사항:
1) **searchFeatures**는 STEP2 규칙(6~12개, 짧은 태그, 자막/OCR 근거).
2) **targetKeywords**는 10~18개. 상품명만 반복 금지. 특징·장면·계절·배터리·풍량·리뷰/언박싱 의도를 섞음.
3) **serpPriorityQueries** 위 네 플랫폼 각각 정확히 2개. YouTube는 Serp에 그대로 쓰이고, TikTok은 **통합 TOP2**, 샤오홍슈·더우인은 각각 **xiaohongshu / douyin** 배열(serpPriority → searchQueries 순)을 우선해 Apify 검색어를 고른다.
4) **searchQueries** 각 8개는 STEP3~6을 반영. 플랫폼 톤·언어 비율·intent 비율을 반드시 지킴.
5) q1~q8 자리에 실제 검색어 문자열만 넣음.

xiaohongshu·douyin는 문자열 배열이 기본. 필요 시 { "query": "中文", "ko": "한글 설명" } 객체 허용(서버는 query 우선).`,
      },
    ],
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI 오류: ${res.status} ${t.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("AI 응답이 비어 있습니다.")
  const parsed = JSON.parse(content) as Record<string, unknown>
  return normalizeAnalysis(parsed)
}

async function youtubeShortSearch(
  apiKey: string,
  q: string
): Promise<VideoResult[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&maxResults=18&q=${encodeURIComponent(q)}&regionCode=KR&relevanceLanguage=ko&key=${encodeURIComponent(apiKey)}`
  const r = await fetch(url)
  if (!r.ok) return []
  const data = await r.json()
  const items = data.items || []
  return items.map((item: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } } }) => {
    const id = item.id?.videoId
    if (!id) return null
    const sn = item.snippet
    const thumb = sn?.thumbnails?.high?.url || sn?.thumbnails?.medium?.url || ""
    return {
      platform: "youtube",
      title: sn?.title || "(제목 없음)",
      thumbnail: thumb,
      videoUrl: `https://www.youtube.com/embed/${id}`,
      url: `https://www.youtube.com/watch?v=${id}`,
      author: sn?.channelTitle || "",
      contentLength: "short" as const,
    }
  }).filter(Boolean) as VideoResult[]
}

/** Vision·중복 제거 후에도 부족하면, 초기 dedupe 풀에서 URL 기준으로 최대 target장까지 채운다(역검색 슬롯 6장 맞춤). */
function fillKeyframesToCountFromPool(current: KeyframeItem[], pool: KeyframeItem[], target: number): KeyframeItem[] {
  const cap = Math.max(0, target)
  if (current.length >= cap) return current.slice(0, cap)
  const seen = new Set(current.map((k) => canonicalKeyframeUrl(k.imageUrl)))
  const out: KeyframeItem[] = current.map((k) => ({ ...k }))
  for (const k of pool) {
    if (out.length >= cap) break
    const c = canonicalKeyframeUrl(k.imageUrl)
    if (seen.has(c)) continue
    seen.add(c)
    out.push({ ...k, index: out.length + 1 })
  }
  return out
}

/** 동일 바이트(또는 가져오기 실패 시 동일 URL) 이미지는 순서상 앞선 한 장만 유지하고 index를 1부터 다시 매깁니다. */
async function dedupeKeyframesByPayload(items: KeyframeItem[], origin?: string): Promise<KeyframeItem[]> {
  if (items.length === 0) return []

  const tagged = await Promise.all(
    items.map(async (item) => {
      try {
        const cellPath = item.imageUrl.startsWith("/") ? item.imageUrl : item.imageUrl
        const parsed = parseStoryboardCellApiPath(cellPath)
        if (parsed) {
          const buf = await fetchAndCropStoryboardCell(
            parsed.sheetUrl,
            parsed.col,
            parsed.row,
            parsed.cols,
            parsed.rows
          )
          const digest = createHash("sha256").update(buf).digest("hex")
          return { item, trackKey: `h:${digest}` as const }
        }
        const fetchUrl =
          item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://")
            ? item.imageUrl
            : origin
              ? `${origin.replace(/\/$/, "")}${item.imageUrl.startsWith("/") ? item.imageUrl : `/${item.imageUrl}`}`
              : item.imageUrl
        const res = await fetch(fetchUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(12_000),
          headers:
            fetchUrl.includes("i.ytimg.com") || fetchUrl.includes("img.youtube.com")
              ? {
                  Referer: "https://www.youtube.com/",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
              : undefined,
        })
        if (!res.ok) {
          return { item, trackKey: `u:${canonicalKeyframeUrl(item.imageUrl)}` as const }
        }
        const buf = Buffer.from(await res.arrayBuffer())
        const digest = createHash("sha256").update(buf).digest("hex")
        return { item, trackKey: `h:${digest}` as const }
      } catch {
        return { item, trackKey: `u:${canonicalKeyframeUrl(item.imageUrl)}` as const }
      }
    })
  )

  const seen = new Set<string>()
  const out: KeyframeItem[] = []
  for (const { item, trackKey } of tagged) {
    if (seen.has(trackKey)) continue
    seen.add(trackKey)
    out.push({ ...item, index: out.length + 1 })
  }
  return out
}

const KEYFRAME_CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"] as const

function labelYoutubeKeyframesForSearch(items: KeyframeItem[]): KeyframeItem[] {
  return items.map((k, i) => ({
    ...k,
    index: i + 1,
    label: `역검색용 이미지 ${KEYFRAME_CIRCLED[i] ?? String(i + 1)}`,
  }))
}

const KEYFRAME_VISION_POOL_MAX = 14

/**
 * 같은 영상에서 온 썸네일 후보 중, 시각적으로 중복인 장면을 줄이고 제품이 잘 보이는 컷만 고른다(ffmpeg 없이 가능한 범위).
 */
async function selectProductKeyframesWithVision(
  apiKey: string,
  analysis: Analysis,
  items: KeyframeItem[],
  maxKeep: number,
  origin: string
): Promise<KeyframeItem[] | null> {
  const pool = items.slice(0, KEYFRAME_VISION_POOL_MAX)
  if (pool.length <= 1) return null

  const intro = `아래 이미지는 모두 같은 쇼핑·제품 홍보 영상에서 뽑은 **개별 장면 컷**입니다. 번호는 전달 순서입니다(첫 이미지=1번).

추론 판매 상품: ${analysis.productName}
카테고리: ${analysis.category}
형태: ${analysis.productForm || "-"}
검색 특징 태그: ${(analysis.searchFeatures || []).join(", ") || "-"}
특징: ${(analysis.productTraits || []).join(", ") || "-"}

과제(반드시 준수):
1) **chosen에 들어가는 번호들은 서로 시각적으로 구별되는 서로 다른 장면이어야 한다.** 같은 자막·같은 포즈·같은 구도가 보이면 그중 **가장 선명한 번호 하나만** 넣는다(같은 장면을 두 번 이상 절대 넣지 않는다).
2) 제품(본 광고의 상품)이 크고 초점이 맞은 컷을 우선한다.
3) 제품이 거의 안 보이거나 심하게 흔들린 컷은 제외한다.

반드시 JSON 한 객체만 출력한다.
형식: {"chosen":[1,3,5]} — chosen은 남길 후보 번호(1~${pool.length} 정수)를, 앞쪽일수록 더 좋은 역검색용 장면이 되게 **서로 다른 장면**만 최대 ${maxKeep}개 이하로 나열한다.`

  const visionUrls = await Promise.all(pool.map((kf) => keyframeImageToDataUrl(kf.imageUrl, origin)))
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [
    { type: "text", text: intro },
    ...visionUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "low" as const },
    })),
  ]

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: "json_object" as const },
        messages: [{ role: "user" as const, content }],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content
    if (!raw || typeof raw !== "string") return null
    const parsed = JSON.parse(raw) as { chosen?: unknown }
    const arr = Array.isArray(parsed.chosen) ? parsed.chosen : []
    const chosen: number[] = []
    const seen = new Set<number>()
    for (const x of arr) {
      const n = typeof x === "number" ? x : typeof x === "string" ? parseInt(String(x).trim(), 10) : NaN
      if (!Number.isFinite(n) || n < 1 || n > pool.length || seen.has(n)) continue
      seen.add(n)
      chosen.push(Math.floor(n))
      if (chosen.length >= maxKeep) break
    }
    if (chosen.length === 0) return null
    const out: KeyframeItem[] = []
    const seenCanon = new Set<string>()
    for (const idx of chosen) {
      const kf = pool[idx - 1]
      const c = canonicalKeyframeUrl(kf.imageUrl)
      if (seenCanon.has(c)) continue
      seenCanon.add(c)
      out.push(kf)
      if (out.length >= maxKeep) break
    }
    if (out.length > 0) return out
    if (chosen.length > 0) return [pool[chosen[0] - 1]]
    return null
  } catch {
    return null
  }
}

/** 1차 선별 후에도 같은 장면이 남았을 때, 최종 목록만 다시 보고 시각적 중복만 제거한다. */
async function collapseNearDuplicateKeyframes(
  apiKey: string,
  items: KeyframeItem[],
  maxKeep: number,
  origin: string
): Promise<KeyframeItem[]> {
  const pool = items.slice(0, 8)
  if (pool.length <= 1) return pool

  const intro = `아래 ${pool.length}장은 모두 같은 광고/숏폼에서 뽑은 **개별 장면 컷**입니다(번호 1~${pool.length}).

과제: **서로 다른 장면**만 남기십시오. 화면 구성·자막·인물 포즈·제품 각도가 같거나 거의 같으면 **하나의 번호만** keep에 넣으십시오. 같은 장면을 두 번 넣으면 안 됩니다.
제품이 선명하게 보이는 컷을 우선합니다.

JSON만: {"keep":[1,3]} — keep은 남길 번호(1~${pool.length}), 최대 ${maxKeep}개, 최소 1개, **서로 시각적으로 구별되는 번호만**.`

  const visionUrls = await Promise.all(pool.map((kf) => keyframeImageToDataUrl(kf.imageUrl, origin)))
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } }
  > = [
    { type: "text", text: intro },
    ...visionUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "low" as const },
    })),
  ]

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.05,
        max_tokens: 128,
        response_format: { type: "json_object" as const },
        messages: [{ role: "user" as const, content }],
      }),
    })
    if (!res.ok) return pool.slice(0, maxKeep)
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content
    if (!raw || typeof raw !== "string") return pool.slice(0, maxKeep)
    const parsed = JSON.parse(raw) as { keep?: unknown }
    const arr = Array.isArray(parsed.keep) ? parsed.keep : []
    const keepIdx: number[] = []
    const seen = new Set<number>()
    for (const x of arr) {
      const n = typeof x === "number" ? x : typeof x === "string" ? parseInt(String(x).trim(), 10) : NaN
      if (!Number.isFinite(n) || n < 1 || n > pool.length || seen.has(n)) continue
      seen.add(n)
      keepIdx.push(Math.floor(n))
      if (keepIdx.length >= maxKeep) break
    }
    if (keepIdx.length === 0) return pool.slice(0, maxKeep)
    const out: KeyframeItem[] = []
    const seenCanon = new Set<string>()
    for (const i of keepIdx) {
      const kf = pool[i - 1]
      const c = canonicalKeyframeUrl(kf.imageUrl)
      if (seenCanon.has(c)) continue
      seenCanon.add(c)
      out.push(kf)
      if (out.length >= maxKeep) break
    }
    return out.length > 0 ? out : pool.slice(0, 1)
  } catch {
    return pool.slice(0, maxKeep)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const productImageDataUrl =
      typeof body.productImageDataUrl === "string" && body.productImageDataUrl.startsWith("data:image/")
        ? body.productImageDataUrl.slice(0, 4_500_000)
        : undefined
    const openaiApiKey =
      (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      ""
    const youtubeDataApiKey =
      (typeof body.youtubeDataApiKey === "string" && body.youtubeDataApiKey.trim()) ||
      process.env.YOUTUBE_API_KEY ||
      ""
    const clientSerpApiKey =
      typeof body.serpApiKey === "string" && body.serpApiKey.trim() ? body.serpApiKey.trim() : ""
    const clientApifyToken =
      typeof body.apifyApiKey === "string" && body.apifyApiKey.trim() ? body.apifyApiKey.trim() : ""

    if (!url && !productImageDataUrl) {
      return NextResponse.json({ error: "제품 URL 또는 제품 사진이 필요합니다." }, { status: 400 })
    }
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에 shotform_openai_api_key를 저장하거나 서버에 OPENAI_API_KEY를 설정하세요." },
        { status: 400 }
      )
    }

    const effectiveUrl = url || "image://product-upload"
    if (url) {
      let urlObj: URL
      try {
        urlObj = new URL(url)
      } catch {
        return NextResponse.json({ error: "유효한 URL 형식이 아닙니다." }, { status: 400 })
      }
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return NextResponse.json({ error: "http(s) URL만 지원합니다." }, { status: 400 })
      }
    }

    const searchMode =
      typeof body.mode === "string" && body.mode.trim().toLowerCase() === "full"
        ? "full"
        : typeof body.mode === "string" && body.mode.trim().toLowerCase() === "lite"
          ? "lite"
          : (process.env.PRODUCT_SEARCH_MODE || "lite").toLowerCase() === "full"
            ? "full"
            : "lite"

    const platformEarly = url ? detectPlatform(url) : productImageDataUrl ? "shopping" : "unknown"
    const oembedEarly = url ? await fetchOembed(url) : null
    const titleEarly = oembedEarly?.title || ""
    const authorEarly = oembedEarly?.author_name || ""
    const thumbEarly = oembedEarly?.thumbnail_url || ""
    const ytIdEarly = platformEarly === "youtube" && url ? extractYoutubeId(url) : null
    const inputThumbnailEarly =
      thumbEarly ||
      (ytIdEarly ? `https://img.youtube.com/vi/${ytIdEarly}/hqdefault.jpg` : "") ||
      productImageDataUrl ||
      ""

    if (searchMode === "lite") {
      const transcriptLite = ytIdEarly ? await fetchYoutubeTranscript(ytIdEarly) : ""
      const lite = await executeLiteProductSearch({
        url: effectiveUrl,
        platform: platformEarly,
        title: titleEarly,
        author: authorEarly,
        thumbnail: inputThumbnailEarly,
        youtubeVideoId: ytIdEarly,
        transcript: transcriptLite,
        openaiApiKey,
        youtubeDataApiKey: youtubeDataApiKey || null,
        productImageDataUrl,
      })

      const ocrPreview =
        lite.pipeline.done.includes("openai_vision_ocr") && lite.keyframes?.[0]?.label
          ? `${lite.keyframes[0].label} 기반 Vision OCR`
          : ""

      return NextResponse.json({
        input: {
          url: effectiveUrl,
          platform: platformEarly,
          title:
            titleEarly ||
            (productImageDataUrl ? "(제품 사진 업로드 — Vision 분석)" : "(oEmbed 없음 — 페이지·Vision 추정)"),
          thumbnail: inputThumbnailEarly,
          author: authorEarly,
          youtubeVideoId: ytIdEarly,
        },
        analysis: lite.analysis,
        results: lite.results,
        keyframes: lite.keyframes,
        keyframesSource: lite.keyframesSource,
        pipeline: lite.pipeline,
        signals: {
          transcriptLength: transcriptLite.length,
          ocrLength: lite.pipeline.done.includes("openai_vision_ocr") ? 1 : 0,
          transcriptPreview: transcriptLite.slice(0, 320),
          ocrPreview,
          serpEngineCalls: 0,
          serpEngineCallCap: 0,
          apifyHttpCalls: 0,
        },
        flags: {
          llmSimilarityRerank: false,
          keyframesVisionCurated: false,
          skipVideoCandidateChecks: true,
          liteMode: true,
        },
        notice: lite.notice,
      })
    }

    const skipVideoCandidateChecks =
      process.env.PRODUCT_SEARCH_SKIP_VIDEO_CANDIDATE_CHECKS === "1" ||
      process.env.PRODUCT_SEARCH_SKIP_VIDEO_CANDIDATE_CHECKS?.toLowerCase() === "true" ||
      body.skipVideoCandidateChecks === true

    const platform = detectPlatform(url)
    const oembed = await fetchOembed(url)
    const title = oembed?.title || ""
    const author = oembed?.author_name || ""
    const thumbIn = oembed?.thumbnail_url || ""
    const ytId = platform === "youtube" ? extractYoutubeId(url) : null
    const inputThumbnail =
      thumbIn || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "")

    const metaDescription = ""

    /** 명세 §6·7: 자막 + 화면 OCR (다운로드·ffmpeg 없이 가능한 범위) */
    const transcript = ytId ? await fetchYoutubeTranscript(ytId) : ""
    const visionUrls = [inputThumbnail, ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : ""].filter(
      (u): u is string => Boolean(u)
    )
    const ocrNotes = visionUrls.length > 0 ? await runShoppingFrameOcr(openaiApiKey, visionUrls) : ""

    const analysis = await runAnalysis({
      title,
      description: metaDescription,
      transcript,
      ocrNotes,
      url,
      platform,
      apiKey: openaiApiKey,
    })

    const serpApiKey = clientSerpApiKey || (process.env.SERPAPI_KEY || "").trim() || null

    const requestOrigin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    let keyframesRaw: KeyframeItem[] = []
    let keyframesSource = "none"

    /** '이미지로 영상 찾기' — YouTube storyboard에서 장면별 컷을 잘라 제품이 보이는 프레임을 고른다 */
    const youtubeVideoForKeyframes = platform === "youtube" && ytId

    if (youtubeVideoForKeyframes) {
      const cellKf = await fetchYoutubeStoryboardCellCandidates(ytId, 28)
      keyframesRaw = dedupeKeyframeItemsByCanonicalUrl([
        ...cellKf.map((k) => ({ index: k.index, imageUrl: k.imageUrl, label: k.label })),
        ...youtubeStaticKeyframeCandidates(ytId).slice(0, 3),
      ])
      keyframesSource = cellKf.length > 0 ? "youtube_storyboard_cells" : "youtube_frame_thumbnails"
    } else if (inputThumbnail) {
      keyframesRaw = [{ index: 1, imageUrl: inputThumbnail, label: "플랫폼 대표 썸네일(영상 미리보기)" }]
      keyframesSource = "platform_oembed_thumbnail_only"
    } else if (serpApiKey) {
      const qFb = [analysis.productName, ...analysis.targetKeywords.slice(0, 2)].filter(Boolean).join(" ").trim()
      const web = await serpGoogleImagesAsKeyframes(serpApiKey, qFb || analysis.productName, 14)
      keyframesRaw = web
      if (web.length > 0) keyframesSource = "serpapi_google_images_no_video_thumb"
    }

    if (keyframesRaw.length === 0 && inputThumbnail) {
      keyframesRaw = [{ index: 1, imageUrl: inputThumbnail, label: "대표 썸네일" }]
      keyframesSource = "single_thumb_only"
    }

    let keyframes = await dedupeKeyframesByPayload(keyframesRaw, requestOrigin)

    if (
      keyframes.length < 14 &&
      inputThumbnail &&
      (keyframesSource === "youtube_frame_thumbnails" || keyframesSource === "youtube_storyboard_cells") &&
      !keyframes.some((k) => canonicalKeyframeUrl(k.imageUrl) === canonicalKeyframeUrl(inputThumbnail))
    ) {
      keyframes = await dedupeKeyframesByPayload(
        [{ index: 0, imageUrl: inputThumbnail, label: "oEmbed 대표 썸네일" }, ...keyframes],
        requestOrigin
      )
    }

    const maxKf = 6
    const keyframePoolAfterInitialDedupe = keyframes.map((k) => ({ ...k }))
    let keyframesVisionCurated = false
    const visionCurateSources = new Set([
      "youtube_frame_thumbnails",
      "youtube_storyboard_cells",
      "youtube_storyboard_plus_static",
      "platform_oembed_thumbnail_only",
      "serpapi_google_images_no_video_thumb",
    ])
    if (keyframes.length >= 2 && visionCurateSources.has(keyframesSource)) {
      const picked = await selectProductKeyframesWithVision(
        openaiApiKey,
        analysis,
        keyframes,
        maxKf,
        requestOrigin
      )
      if (picked && picked.length > 0) {
        const narrowed =
          picked.length >= 2
            ? await collapseNearDuplicateKeyframes(openaiApiKey, picked, maxKf, requestOrigin)
            : picked
        keyframes = await dedupeKeyframesByPayload(narrowed.length > 0 ? narrowed : picked, requestOrigin)
        keyframesVisionCurated = true
      }
    }
    keyframes = await dedupeKeyframesByPayload(keyframes, requestOrigin)
    keyframes = fillKeyframesToCountFromPool(keyframes, keyframePoolAfterInitialDedupe, maxKf)
    keyframes = await dedupeKeyframesByPayload(keyframes, requestOrigin)
    if (keyframes.length < maxKf) {
      keyframes = fillKeyframesToCountFromPool(keyframes, keyframePoolAfterInitialDedupe, maxKf)
      keyframes = await dedupeKeyframesByPayload(keyframes, requestOrigin)
    }
    keyframes = keyframes.slice(0, maxKf)
    if (keyframesSource !== "single_thumb_only") {
      keyframes = labelYoutubeKeyframesForSearch(keyframes)
    } else {
      keyframes = keyframes.map((k, i) => ({ ...k, index: i + 1 }))
    }

    const yq =
      analysis.searchQueries.youtube?.[0] ||
      analysis.serpPriorityQueries.youtube[0] ||
      analysis.productName ||
      analysis.targetKeywords?.[0] ||
      title

    const results: VideoResult[] = []
    let serpEngineCallsUsed = 0
    let apifyHttpCallsUsed = 0
    let apifyRowsSnapshot: VideoResult[] = []

    const apifyToken = clientApifyToken || (process.env.APIFY_TOKEN || "").trim() || null

    const serpP =
      serpApiKey && yq
        ? collectYoutubeSerpCandidates(serpApiKey, analysis)
        : Promise.resolve({ rows: [] as VideoResult[], serpEngineCalls: 0 })
    const apifyP = apifyToken
      ? collectApifyVideoCandidatesBudgeted(apifyToken, analysis)
      : Promise.resolve({ rows: [], apifyHttpCalls: 0 })

    const [pack, ap] = await Promise.all([serpP, apifyP])
    apifyRowsSnapshot =
      apifyToken && ap.rows.length > 0 ? (dedupeVideoRows(ap.rows) as VideoResult[]) : []
    results.push(...pack.rows, ...ap.rows)
    serpEngineCallsUsed = pack.serpEngineCalls
    apifyHttpCallsUsed = ap.apifyHttpCalls

    if (!serpApiKey && youtubeDataApiKey && yq) {
      results.push(...(await youtubeShortSearch(youtubeDataApiKey, yq)))
    }

    if (serpApiKey && youtubeDataApiKey && yq && results.filter((r) => r.platform === "youtube").length === 0) {
      results.push(...(await youtubeShortSearch(youtubeDataApiKey, yq)))
    }

    const resultsDeduped = dedupeVideoRows(results)
    const platformFiltered = resultsDeduped.filter((r) => r.platform !== "web" && r.platform !== "facebook")

    let resultsRanked: VideoResult[]
    let llmSimilarityApplied = false

    if (skipVideoCandidateChecks) {
      const mvpLinkRows = platformFiltered.filter((r) => r.author === "검색 링크 (MVP)")
      const candidateRows = platformFiltered.filter((r) => r.author !== "검색 링크 (MVP)")
      const sorted = sortByShoppingRelevance(candidateRows, analysis).slice(0, 200)
      resultsRanked = dedupeVideoRows([...sorted, ...mvpLinkRows])
    } else {
      const keywordPass = filterVideosByProductRelevance(platformFiltered, analysis)
      const mvpLinkRows = keywordPass.filter((r) => r.author === "검색 링크 (MVP)")
      const candidateRows = keywordPass.filter((r) => r.author !== "검색 링크 (MVP)")
      const presortedForLlm = sortByShoppingRelevance(candidateRows, analysis).slice(0, 100)

      if (presortedForLlm.length > 0) {
        const llm = await applyLlmSimilarityRerankAndFilter({
          apiKey: openaiApiKey,
          analysis,
          base: { url, platform, title, transcript, ocrNotes },
          candidates: presortedForLlm,
        })
        if (llm.llmUsed && llm.rows.length > 0) {
          resultsRanked = dedupeVideoRows([...llm.rows, ...mvpLinkRows])
          llmSimilarityApplied = true
        } else {
          resultsRanked = keywordPass
        }
      } else {
        resultsRanked = keywordPass
      }
    }

    if (apifyRowsSnapshot.length > 0) {
      resultsRanked = mergeApifySnapshotTailIntoRanked(resultsRanked, apifyRowsSnapshot, analysis)
    }

    const pipelineBase: string[] = [
      "url_oembed",
      ...(transcript.length > 0 ? ["youtube_transcript_json3"] : []),
      ...(ocrNotes.length > 0 ? ["openai_vision_ocr"] : []),
      "openai_product_analysis",
      "keyframes",
      ...(keyframesSource === "youtube_storyboard_cells" ? ["youtube_storyboard_cell_crop"] : []),
      ...(keyframesSource === "youtube_storyboard_plus_static" ? ["youtube_storyboard_mosaic_fetch"] : []),
      ...(keyframesVisionCurated ? ["openai_vision_keyframe_curate"] : []),
      ...(serpApiKey
        ? [`serpapi_youtube_engine_calls_${serpEngineCallsUsed}_of_${SERP_YOUTUBE_ENGINE_CAP}`]
        : []),
      ...(apifyToken ? [`apify_sync_http_calls_${apifyHttpCallsUsed}`] : []),
      ...(!serpApiKey && youtubeDataApiKey ? ["youtube_data_api_shorts"] : []),
    ]
    const pipelineDone = [
      ...pipelineBase,
      "merge_dedupe_urls",
      "relevance_sort",
      ...(skipVideoCandidateChecks
        ? ["skip_product_relevance_and_llm_test"]
        : ["product_relevance_filter", ...(llmSimilarityApplied ? ["openai_candidate_similarity_rerank"] : [])]),
    ] as const

    const pipelinePlanned = [
      "yt_dlp_or_stream_mp4",
      "ffmpeg_product_keyframes_5_to_8",
      "per_frame_tesseract_or_cloud_ocr",
      "reverse_image_lens_yandex",
      "redis_bullmq_worker_split",
      "list_project_persist",
    ] as const

    const noticeSerp = serpApiKey
        ? `YouTube: SerpApi YouTube 엔진 **최대 ${SERP_YOUTUBE_ENGINE_CAP}회**(serpPriorityQueries 상위 2키워드). 이번 요청 **${serpEngineCallsUsed}**회. (ShotForm SerpApi 키 또는 SERPAPI_KEY)`
        : "SerpApi 키가 없어 YouTube 실검색 후보를 붙이지 못했습니다. SerpApi 키 또는 YOUTUBE_API_KEY(쇼츠 폴백)를 설정하세요."

    const noticeApify = apifyToken
        ? `TikTok·샤오홍슈·더우인: 소스 검색 API 호출 **${apifyHttpCallsUsed}**회. TikTok은 통합 **상위 2문구** + dataset 상한 확대. 샤오홍슈·더우인은 **1차 2문구**(serpPriority→searchQueries) 후, 후보 풀에 3~4번째가 있으면 **2차 2문구**를 추가 호출해 병합합니다. 더우인 검색어 풀에는 **샤오홍슈 간체 후보**를 덧붙여 실검 0건을 줄입니다. 샤오홍슈 socialdatax-xhs-data-api, 더우인 sian.agency+natanielsantos 병합.`
        : "소스 검색 토큰이 없어 TikTok·샤오홍슈·더우인 후보를 수집하지 않았습니다. ShotForm 설정에 소스 검색 토큰을 넣거나 서버 환경 변수를 설정하세요."

    const noticeLlm = skipVideoCandidateChecks
        ? "하단 영상: **테스트 모드** — 제품 관련도 필터·OpenAI 유사도 재평가를 건너뛰고 수집 결과를 정렬만 해서 보여줍니다(`PRODUCT_SEARCH_SKIP_VIDEO_CANDIDATE_CHECKS` 또는 요청 `skipVideoCandidateChecks`)."
        : llmSimilarityApplied
          ? "하단 영상: OpenAI로 후보를 명세 §11 유사도(finalScore) 재평가했고, §12 기준 50점 미만은 제외·상위 최대 120개만 노출했습니다."
          : "하단 영상: LLM 유사도 재평가가 적용되지 않았습니다(응답 파싱 실패 또는 후보 없음). 키워드 관련도 필터 결과를 사용합니다."

    let noticeKeyframes =
      keyframesSource === "youtube_storyboard_cells"
        ? "이미지로 영상 찾기: YouTube storyboard에서 장면별 컷(9:16)을 잘라 최대 6장을 고릅니다. OpenAI Vision으로 제품이 잘 보이는 서로 다른 장면만 남깁니다."
        : keyframesSource === "youtube_storyboard_plus_static"
        ? "상단 최대 6장: YouTube 플레이어의 storyboard(시간대별 모자이크 M0·M1…)를 우선 사용하고, 정적 썸네일로 보강했습니다. 벤치마킹 툴처럼 서로 다른 구간 이미지를 얻기 쉽습니다. storyboard가 없는 영상은 정적 URL만 사용합니다."
        : keyframesSource === "youtube_frame_thumbnails"
          ? "상단 최대 6장: 해당 YouTube 영상의 video id로만 제공되는 정적 썸네일·자동 프레임 URL을 모았습니다(웹에서 제품명으로 찾은 사진은 넣지 않음). 같은 바이트는 한 장만 남깁니다. 시간축 임의 구간 캡처(ffmpeg)는 planned입니다."
          : keyframesSource === "platform_oembed_thumbnail_only"
            ? "상단: 플랫폼 oEmbed가 주는 대표 썸네일만 사용했습니다(URL당 보통 1장, 영상 속 제품 클로즈업과 다를 수 있음). 다중 프레임은 ffmpeg 도입 후 가능합니다."
            : keyframesSource === "serpapi_google_images_no_video_thumb"
              ? "상단: 영상 썸네일을 확보하지 못해 SerpApi Google 이미지(제품명 검색)만 사용했습니다. 이 그림은 영상 속 장면이 아닐 수 있습니다."
              : keyframesSource === "single_thumb_only"
                ? "상단: 입력 썸네일만 사용할 수 있었습니다."
                : ""
    if (keyframesVisionCurated) {
      noticeKeyframes = noticeKeyframes
        ? `${noticeKeyframes} OpenAI Vision 2회(선별→동일 장면 제거)과 최종 바이트 dedupe로 같은 사진 반복을 줄였습니다.`
        : "상단: OpenAI Vision 2회와 바이트 dedupe로 역검색용 이미지를 정리했습니다."
    }

    return NextResponse.json({
      input: {
        url,
        platform,
        title: title || "(oEmbed 없음 — 제목은 AI 추정에만 의존)",
        thumbnail: inputThumbnail,
        author,
        youtubeVideoId: ytId,
      },
      analysis,
      results: resultsRanked,
      keyframes,
      keyframesSource,
      pipeline: { done: [...pipelineDone], planned: [...pipelinePlanned] },
      signals: {
        transcriptLength: transcript.length,
        ocrLength: ocrNotes.length,
        transcriptPreview: transcript.slice(0, 320),
        ocrPreview: ocrNotes.slice(0, 320),
        serpEngineCalls: serpEngineCallsUsed,
        serpEngineCallCap: SERP_YOUTUBE_ENGINE_CAP,
        apifyHttpCalls: apifyHttpCallsUsed,
      },
      flags: {
        llmSimilarityRerank: llmSimilarityApplied,
        keyframesVisionCurated,
        skipVideoCandidateChecks,
      },
      notice: [noticeSerp, noticeApify, noticeKeyframes, noticeLlm].filter(Boolean).join(" ") || undefined,
    })
  } catch (e) {
    console.error("[product-search]", e)
    const msg = e instanceof Error ? e.message : "알 수 없는 오류"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
