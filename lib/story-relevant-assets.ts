import { createHash } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import sharp from "sharp"

export type RelevantAssetSource =
  | "douyin"
  | "xiaohongshu"
  | "google"
  | "google_videos"
  | "unknown"

export type AssetFailureCode =
  | "ABORTED"
  | "BUDGET_ACTOR_LIMIT"
  | "BUDGET_COST_LIMIT"
  | "BUDGET_TIME_LIMIT"
  | "EMPTY_QUERY"
  | "GENERIC_QUERY"
  | "TITLE_MISMATCH"
  | "THUMBNAIL_UNAVAILABLE"
  | "THUMBNAIL_WATERMARK"
  | "THUMBNAIL_DISTORTED"
  | "PRODUCT_IDENTITY_MISMATCH"
  | "DOWNLOAD_UNAVAILABLE"
  | "DOWNLOAD_NOT_MEDIA"
  | "DUPLICATE_ORIGINAL"
  | "DUPLICATE_VISUAL"
  | "SOURCE_FAILED"

export type AssetSourceMetric = {
  source: RelevantAssetSource
  requested: number
  received: number
  validated: number
  accepted: number
  latencyMs: number
  estimatedCostUsd: number
  cacheHit: boolean
  failureCodes: Partial<Record<AssetFailureCode, number>>
}

export type AssetRunLimits = {
  maxActors: number
  maxDurationMs: number
  maxEstimatedCostUsd: number
  maxCandidates: number
}

export type AssetCandidateInput = {
  id: string
  source: RelevantAssetSource
  title: string
  metadata?: string
  thumbnailUrl?: string
  mediaUrl?: string
  originalUrl: string
  mediaType: "image" | "video"
  durationSec?: number | null
  attribution?: string
}

export type AssetCandidateValidation = {
  accepted: boolean
  failureCodes: AssetFailureCode[]
  relevanceScore: number
  originalFingerprint: string
  perceptualHash?: string
  productIdentityScore?: number
  imageSignals?: {
    width: number
    height: number
    watermarkSuspected: boolean
    distorted: boolean
  }
  download?: {
    ok: boolean
    contentType: string
    contentLength: number | null
  }
}

export type ValidatedAssetCandidate = AssetCandidateInput & {
  validation: AssetCandidateValidation
}

type CacheEntry<T> = { expiresAt: number; value: T }
const candidateCache = new Map<string, CacheEntry<AssetCandidateInput[]>>()
const CACHE_TTL_MS = 10 * 60_000
const CACHE_MAX_ENTRIES = 120

const GENERIC_WORDS = new Set([
  "actor", "person", "people", "someone", "video", "shorts", "review",
  "사람", "인물", "누군가", "영상", "쇼츠", "리뷰", "브이로그", "일상",
  "감동", "행복", "고민", "좋음", "추천",
])
const ACTION_HINT =
  /(?:하|되|가|오|먹|마시|붓|따르|잡|누르|열|닫|씻|닦|자르|넣|빼|걷|뛰|앉|서|설치|조립|세척|보관|사용|시연|清洗|使用|打开|关闭|安装|倒|切|吃|喝)/
const PLACE_HINT =
  /(?:집|방|주방|거실|욕실|도로|거리|회사|학교|가게|마트|캠핑|공원|바다|산|车内|厨房|客厅|浴室|办公室|商店|露营|街道)/
const WATERMARK_TEXT =
  /(?:watermark|stock|shutterstock|alamy|getty|depositphotos|dreamstime|istock|样片|素材网|小红书号|抖音号)/i

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError")
}

function isPrivateAssetAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "")
  if (
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true
  }
  const parts = normalized.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] >= 224
  )
}

async function assertSafeAssetUrl(raw: string): Promise<URL> {
  const target = new URL(raw)
  if (target.protocol !== "https:" || target.username || target.password) {
    throw new Error("unsafe asset URL")
  }
  const hostname = target.hostname.toLowerCase()
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("unsafe asset host")
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAssetAddress(address))) {
    throw new Error("unsafe asset address")
  }
  return target
}

async function fetchSafeAsset(
  rawUrl: string,
  init: RequestInit,
  maxRedirects = 2
): Promise<Response> {
  let target = await assertSafeAssetUrl(rawUrl)
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(target, { ...init, redirect: "manual" })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get("location")
    void response.body?.cancel().catch(() => undefined)
    if (!location || redirectCount === maxRedirects) throw new Error("unsafe redirect")
    target = await assertSafeAssetUrl(new URL(location, target).toString())
  }
  throw new Error("too many redirects")
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function terms(value: string): string[] {
  return [...new Set(
    normalizeText(value)
      .split(" ")
      .filter((word) => word.length >= 2 && !GENERIC_WORDS.has(word))
  )]
}

export function buildConcreteVisualQuery(
  query: string,
  context = ""
): { query: string; concreteTerms: string[]; valid: boolean } {
  const combined = `${query} ${context}`.slice(0, 600)
  const concreteTerms = terms(combined).slice(0, 10)
  const hasConcreteStructure =
    concreteTerms.length >= 2 &&
    (ACTION_HINT.test(combined) || PLACE_HINT.test(combined) || concreteTerms.length >= 3)
  return {
    query: concreteTerms.slice(0, 6).join(" "),
    concreteTerms,
    valid: hasConcreteStructure,
  }
}

function canonicalOriginalUrl(raw: string): string {
  const url = new URL(raw)
  if (/\/api\/proxy-(?:video|image)/i.test(url.pathname)) {
    throw new Error("프록시 URL은 원본 fingerprint로 사용할 수 없습니다.")
  }
  url.hash = ""
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid|gclid|spm|share_|timestamp|token|sign|expires)/i.test(key)) {
      url.searchParams.delete(key)
    }
  }
  if (/xiaohongshu\.com|douyin\.com/i.test(url.hostname)) url.search = ""
  return url.toString().replace(/\/$/, "")
}

export function fingerprintOriginalUrl(raw: string): string {
  const canonical = canonicalOriginalUrl(raw)
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24)
}

function hammingDistance(a: string, b: string): number {
  if (!a || a.length !== b.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let index = 0; index < a.length; index += 1) {
    const xor = parseInt(a[index]!, 16) ^ parseInt(b[index]!, 16)
    distance += xor.toString(2).replace(/0/g, "").length
  }
  return distance
}

export function arePerceptuallySimilar(a?: string, b?: string, maxDistance = 6): boolean {
  return Boolean(a && b && hammingDistance(a, b) <= maxDistance)
}

async function fetchBuffer(
  url: string,
  signal: AbortSignal | undefined,
  maxBytes: number
): Promise<{ buffer: Buffer; contentType: string }> {
  throwIfAborted(signal)
  const response = await fetchSafeAsset(url, {
    headers: { "User-Agent": "Mozilla/5.0 WingsAssetValidator/1.0" },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const declared = Number(response.headers.get("content-length") || 0)
  if (declared > maxBytes) throw new Error("asset too large")
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > maxBytes) throw new Error("asset too large")
  return { buffer: bytes, contentType: response.headers.get("content-type") || "" }
}

export async function computePerceptualHash(
  imageUrl: string,
  signal?: AbortSignal
): Promise<{
  hash: string
  width: number
  height: number
  distorted: boolean
  watermarkSuspected: boolean
}> {
  const { buffer, contentType } = await fetchBuffer(imageUrl, signal, 10 * 1024 * 1024)
  if (!/^image\//i.test(contentType)) throw new Error("not image")
  const image = sharp(buffer, { failOn: "warning" })
  const metadata = await image.metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0
  if (width < 120 || height < 120) throw new Error("image too small")
  const raw = await image
    .clone()
    .rotate()
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer()
  let bits = ""
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = raw[y * 9 + x]!
      const right = raw[y * 9 + x + 1]!
      bits += left > right ? "1" : "0"
    }
  }
  const hash = bits.match(/.{4}/g)!.map((nibble) => parseInt(nibble, 2).toString(16)).join("")
  const edgePixels = await image
    .clone()
    .rotate()
    .resize(64, 64, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer()
  let cornerEdges = 0
  let cornerSamples = 0
  let centerEdges = 0
  let centerSamples = 0
  for (let y = 1; y < 63; y += 1) {
    for (let x = 1; x < 63; x += 1) {
      const gradient =
        Math.abs(edgePixels[y * 64 + x + 1]! - edgePixels[y * 64 + x - 1]!) +
        Math.abs(edgePixels[(y + 1) * 64 + x]! - edgePixels[(y - 1) * 64 + x]!)
      const inCorner = (x < 18 || x > 45) && (y < 18 || y > 45)
      const inCenter = x >= 20 && x <= 43 && y >= 20 && y <= 43
      if (inCorner) {
        cornerSamples += 1
        if (gradient > 90) cornerEdges += 1
      } else if (inCenter) {
        centerSamples += 1
        if (gradient > 90) centerEdges += 1
      }
    }
  }
  const cornerDensity = cornerEdges / Math.max(1, cornerSamples)
  const centerDensity = centerEdges / Math.max(1, centerSamples)
  // 네 모서리의 작은 고대비 문자/로고는 중앙보다 경계 밀도가 비정상적으로 높다.
  const watermarkSuspected =
    cornerDensity >= 0.19 && cornerDensity >= centerDensity * 1.65
  const ratio = width / height
  return {
    hash,
    width,
    height,
    distorted: ratio < 0.25 || ratio > 4 || width * height < 40_000,
    watermarkSuspected,
  }
}

async function probeDownload(
  candidate: AssetCandidateInput,
  signal?: AbortSignal
): Promise<{ ok: boolean; contentType: string; contentLength: number | null }> {
  const target = candidate.mediaUrl || (candidate.mediaType === "image" ? candidate.thumbnailUrl : "")
  if (!target || !/^https:\/\//i.test(target)) {
    return { ok: false, contentType: "", contentLength: null }
  }
  try {
    throwIfAborted(signal)
    const response = await fetchSafeAsset(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 WingsAssetValidator/1.0",
        Range: "bytes=0-2047",
      },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7_000)]) : AbortSignal.timeout(7_000),
      cache: "no-store",
    })
    const contentType = response.headers.get("content-type") || ""
    const contentLengthRaw = response.headers.get("content-length")
    const contentLength = contentLengthRaw ? Number(contentLengthRaw) : null
    void response.body?.cancel().catch(() => undefined)
    const expected = candidate.mediaType === "video" ? /^video\//i : /^image\//i
    return {
      ok: (response.ok || response.status === 206) && expected.test(contentType),
      contentType,
      contentLength: Number.isFinite(contentLength) ? contentLength : null,
    }
  } catch {
    return { ok: false, contentType: "", contentLength: null }
  }
}

function relevanceScore(candidate: AssetCandidateInput, visualQuery: string): number {
  const wanted = terms(visualQuery)
  const haystack = normalizeText(
    `${candidate.title} ${candidate.metadata || ""} ${candidate.attribution || ""}`
  )
  if (!wanted.length || !haystack) return 0
  const matched = wanted.filter((term) => haystack.includes(term)).length
  const coverage = matched / wanted.length
  const titleBonus = wanted.some((term) => normalizeText(candidate.title).includes(term)) ? 12 : 0
  return Math.min(100, Math.round(coverage * 88 + titleBonus))
}

export function scoreAssetTextRelevance(
  title: string,
  visualQuery: string,
  metadata = ""
): number {
  return relevanceScore(
    {
      id: "score-only",
      source: "unknown",
      title,
      metadata,
      originalUrl: "https://invalid.example/score-only",
      mediaType: "image",
    },
    visualQuery
  )
}

export async function validateAssetCandidates(options: {
  candidates: AssetCandidateInput[]
  visualQuery: string
  productReferenceImageUrl?: string
  signal?: AbortSignal
  maxCandidates?: number
  /** 도우인·샤오홍슈는 이미 검색어로 찾은 영상이다. 한국어 제목 겹침으로 버리지 않는다. */
  skipTitleMatch?: boolean
  /** 상세페이지 썸네일과 해시가 다르다는 이유로 실사용 영상을 버리지 않는다. */
  skipProductIdentity?: boolean
  /** CDN이 Range 요청을 막으면 재생 주소는 나중에 따로 받는다. */
  skipDownloadProbe?: boolean
}): Promise<ValidatedAssetCandidate[]> {
  const max = Math.max(1, Math.min(16, options.maxCandidates ?? 8))
  const reference = options.productReferenceImageUrl
    ? await computePerceptualHash(options.productReferenceImageUrl, options.signal).catch(() => null)
    : null
  const seenOriginals = new Set<string>()
  const seenHashes: string[] = []
  const validated: ValidatedAssetCandidate[] = []

  for (const candidate of options.candidates.slice(0, max)) {
    throwIfAborted(options.signal)
    const failureCodes: AssetFailureCode[] = []
    let originalFingerprint = ""
    try {
      originalFingerprint = fingerprintOriginalUrl(candidate.originalUrl)
      if (seenOriginals.has(originalFingerprint)) failureCodes.push("DUPLICATE_ORIGINAL")
    } catch {
      failureCodes.push("DUPLICATE_ORIGINAL")
    }

    const score = relevanceScore(candidate, options.visualQuery)
    if (!options.skipTitleMatch && score < 58) failureCodes.push("TITLE_MISMATCH")

    const thumbnailText = `${candidate.title} ${candidate.metadata || ""}`
    const watermarkText = WATERMARK_TEXT.test(thumbnailText)
    let visual: Awaited<ReturnType<typeof computePerceptualHash>> | null = null
    if (!candidate.thumbnailUrl) {
      failureCodes.push("THUMBNAIL_UNAVAILABLE")
    } else {
      visual = await computePerceptualHash(candidate.thumbnailUrl, options.signal).catch(() => null)
      if (!visual) failureCodes.push("THUMBNAIL_UNAVAILABLE")
    }
    if (watermarkText || visual?.watermarkSuspected) {
      failureCodes.push("THUMBNAIL_WATERMARK")
    }
    if (visual?.distorted) failureCodes.push("THUMBNAIL_DISTORTED")
    if (visual && seenHashes.some((hash) => hammingDistance(hash, visual!.hash) <= 6)) {
      failureCodes.push("DUPLICATE_VISUAL")
    }

    let productIdentityScore: number | undefined
    if (!options.skipProductIdentity && reference && visual) {
      const distance = hammingDistance(reference.hash, visual.hash)
      productIdentityScore = Math.max(0, Math.round(100 - (distance / 64) * 100))
      if (productIdentityScore < 45) failureCodes.push("PRODUCT_IDENTITY_MISMATCH")
    }

    const download = options.skipDownloadProbe
      ? { ok: true, contentType: "", contentLength: null }
      : await probeDownload(candidate, options.signal)
    if (!options.skipDownloadProbe && !download.ok) {
      failureCodes.push(
        download.contentType ? "DOWNLOAD_NOT_MEDIA" : "DOWNLOAD_UNAVAILABLE"
      )
    }
    const accepted = failureCodes.length === 0
    if (accepted) {
      if (originalFingerprint) seenOriginals.add(originalFingerprint)
      if (visual) seenHashes.push(visual.hash)
    }
    validated.push({
      ...candidate,
      validation: {
        accepted,
        failureCodes,
        relevanceScore: score,
        originalFingerprint,
        perceptualHash: visual?.hash,
        productIdentityScore,
        imageSignals: visual
          ? {
              width: visual.width,
              height: visual.height,
              watermarkSuspected: watermarkText || visual.watermarkSuspected,
              distorted: visual.distorted,
            }
          : undefined,
        download,
      },
    })
  }
  return validated
}

export function cacheKeyForCandidates(source: RelevantAssetSource, query: string): string {
  return `${source}:${normalizeText(query)}`
}

export function getCachedCandidates(key: string): AssetCandidateInput[] | null {
  const entry = candidateCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    candidateCache.delete(key)
    return null
  }
  return entry.value.map((item) => ({ ...item }))
}

export function setCachedCandidates(key: string, value: AssetCandidateInput[]): void {
  if (candidateCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = candidateCache.keys().next().value as string | undefined
    if (oldest) candidateCache.delete(oldest)
  }
  candidateCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: value.map((item) => ({ ...item })),
  })
}

export class AssetRunBudget {
  private readonly startedAt = Date.now()
  private actors = 0
  private estimatedCostUsd = 0

  constructor(
    readonly limits: AssetRunLimits,
    private readonly signal?: AbortSignal
  ) {}

  reserveActor(estimatedCostUsd: number): AssetFailureCode | null {
    if (this.signal?.aborted) return "ABORTED"
    if (Date.now() - this.startedAt >= this.limits.maxDurationMs) {
      return "BUDGET_TIME_LIMIT"
    }
    if (this.actors + 1 > this.limits.maxActors) return "BUDGET_ACTOR_LIMIT"
    if (this.estimatedCostUsd + estimatedCostUsd > this.limits.maxEstimatedCostUsd) {
      return "BUDGET_COST_LIMIT"
    }
    this.actors += 1
    this.estimatedCostUsd += estimatedCostUsd
    return null
  }

  snapshot(): {
    actorRuns: number
    elapsedMs: number
    estimatedCostUsd: number
    limits: AssetRunLimits
  } {
    return {
      actorRuns: this.actors,
      elapsedMs: Date.now() - this.startedAt,
      estimatedCostUsd: Number(this.estimatedCostUsd.toFixed(4)),
      limits: this.limits,
    }
  }
}

export function countFailureCodes(
  rows: ValidatedAssetCandidate[]
): Partial<Record<AssetFailureCode, number>> {
  const counts: Partial<Record<AssetFailureCode, number>> = {}
  for (const row of rows) {
    for (const code of row.validation.failureCodes) counts[code] = (counts[code] || 0) + 1
  }
  return counts
}
