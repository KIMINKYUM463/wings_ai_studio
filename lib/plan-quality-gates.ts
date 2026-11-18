/**
 * 계획 품질 게이트에서 공통으로 쓰는 순수 판정 함수.
 * 네트워크, DB, 브라우저 API에 의존하지 않아 Node 테스트에서 그대로 실행할 수 있다.
 */

export type GateDecision = { allowed: boolean; reason: string }

export function decideOwnershipAccess(
  authenticatedUserId: string | null | undefined,
  resourceOwnerId: string | null | undefined
): GateDecision {
  const actor = authenticatedUserId?.trim()
  const owner = resourceOwnerId?.trim()
  if (!actor) return { allowed: false, reason: "authentication-required" }
  if (!owner) return { allowed: false, reason: "owner-missing" }
  if (actor !== owner) return { allowed: false, reason: "owner-mismatch" }
  return { allowed: true, reason: "owner-match" }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    a! >= 224
  )
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab]/.test(host) ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.")
  )
}

export function decideSsrfUrl(rawUrl: string): GateDecision {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { allowed: false, reason: "invalid-url" }
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { allowed: false, reason: "unsupported-protocol" }
  }
  if (url.username || url.password) return { allowed: false, reason: "credentials-forbidden" }

  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    return { allowed: false, reason: "private-host" }
  }
  return { allowed: true, reason: "public-host-requires-dns-pin" }
}

const EXPIRING_MEDIA_HOSTS = new Set(["replicate.delivery"])
const EXPIRY_QUERY_KEYS = ["expires", "expiry", "x-amz-expires", "x-goog-expires", "token"]

export type PersistenceDecision = {
  mustPersist: boolean
  reason: "empty" | "ephemeral-scheme" | "expiring-host" | "signed-url" | "durable-url"
}

export function decideMediaPersistence(rawUrl: string): PersistenceDecision {
  const value = rawUrl.trim()
  if (!value) return { mustPersist: false, reason: "empty" }
  if (value.startsWith("blob:") || value.startsWith("data:")) {
    return { mustPersist: true, reason: "ephemeral-scheme" }
  }
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if ([...EXPIRING_MEDIA_HOSTS].some((item) => host === item || host.endsWith(`.${item}`))) {
      return { mustPersist: true, reason: "expiring-host" }
    }
    const queryKeys = new Set([...url.searchParams.keys()].map((key) => key.toLowerCase()))
    if (EXPIRY_QUERY_KEYS.some((key) => queryKeys.has(key))) {
      return { mustPersist: true, reason: "signed-url" }
    }
  } catch {
    return { mustPersist: true, reason: "ephemeral-scheme" }
  }
  return { mustPersist: false, reason: "durable-url" }
}

const VOLATILE_QUERY_KEYS = new Set([
  "expires",
  "expiry",
  "signature",
  "sig",
  "token",
  "x-amz-credential",
  "x-amz-date",
  "x-amz-expires",
  "x-amz-signature",
  "x-goog-credential",
  "x-goog-date",
  "x-goog-expires",
  "x-goog-signature",
])

export function canonicalProxyOrigin(rawUrl: string, appOrigin = "http://local"): string {
  let candidate = rawUrl.trim()
  const proxy = new URL(candidate, appOrigin)
  if (proxy.pathname === "/api/proxy-video") {
    candidate = proxy.searchParams.get("url")?.trim() || candidate
  }

  const url = new URL(candidate, appOrigin)
  url.hash = ""
  url.hostname = url.hostname.toLowerCase()
  for (const key of [...url.searchParams.keys()]) {
    if (VOLATILE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return url.toString()
}

function fnv1a64(value: string): string {
  let hash = BigInt("0xcbf29ce484222325")
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0)!)
    hash = BigInt.asUintN(64, hash * BigInt("0x100000001b3"))
  }
  return hash.toString(16).padStart(16, "0")
}

export function proxyOriginFingerprint(rawUrl: string, appOrigin?: string): string {
  return `fnv1a64:${fnv1a64(canonicalProxyOrigin(rawUrl, appOrigin))}`
}

function expiryTimeMs(url: URL): number | null {
  const absolute = url.searchParams.get("expires") || url.searchParams.get("expiry")
  if (absolute && /^\d+$/.test(absolute)) {
    const value = Number(absolute)
    return value < 10_000_000_000 ? value * 1_000 : value
  }
  const issued = url.searchParams.get("x-amz-date") || url.searchParams.get("x-goog-date")
  const ttl = url.searchParams.get("x-amz-expires") || url.searchParams.get("x-goog-expires")
  if (issued && ttl && /^\d+$/.test(ttl)) {
    const match = issued.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
    if (match) {
      const [, year, month, day, hour, minute, second] = match
      return Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +second!) + Number(ttl) * 1_000
    }
  }
  return null
}

export function shouldRefreshMediaUrl(
  rawUrl: string,
  options: { nowMs?: number; responseStatus?: number; refreshMarginMs?: number } = {}
): boolean {
  if (options.responseStatus === 401 || options.responseStatus === 403 || options.responseStatus === 410) {
    return true
  }
  try {
    const expiry = expiryTimeMs(new URL(rawUrl))
    return expiry !== null && expiry <= (options.nowMs ?? Date.now()) + (options.refreshMarginMs ?? 60_000)
  } catch {
    return false
  }
}

export function decideRightsBlock(input: {
  mediaUrl?: string
  rightsConfirmed?: boolean
  license?: string
}): GateDecision {
  if (!input.mediaUrl?.trim()) return { allowed: true, reason: "no-media" }
  if (input.license === "permission-required") {
    return { allowed: false, reason: "permission-required" }
  }
  if (input.rightsConfirmed !== true) return { allowed: false, reason: "rights-unconfirmed" }
  return { allowed: true, reason: "rights-confirmed" }
}

export type TtsHashInput = {
  script: string
  voiceId: string
  speed?: number
  pitch?: number
  model?: string
}

export function scriptTtsHash(input: TtsHashInput): string {
  const normalized = {
    script: input.script.normalize("NFC").replace(/\s+/g, " ").trim(),
    voiceId: input.voiceId.trim(),
    speed: input.speed ?? 1,
    pitch: input.pitch ?? 0,
    model: input.model?.trim() || "default",
  }
  return `tts-v1:${fnv1a64(JSON.stringify(normalized))}`
}

export type MosaicExportInput = {
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  startSec: number
  endSec: number
  blockSize?: number
}

export type MosaicExportRegion = {
  x: number
  y: number
  width: number
  height: number
  startSec: number
  endSec: number
  blockSize: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function mosaicExportRegion(
  input: MosaicExportInput,
  video: { width: number; height: number; durationSec: number }
): MosaicExportRegion | null {
  if (
    video.width <= 0 ||
    video.height <= 0 ||
    video.durationSec <= 0 ||
    input.widthPct <= 0 ||
    input.heightPct <= 0
  ) {
    return null
  }
  const width = clamp(Math.round((input.widthPct / 100) * video.width), 2, video.width)
  const height = clamp(Math.round((input.heightPct / 100) * video.height), 2, video.height)
  const centerX = (clamp(input.xPct, 0, 100) / 100) * video.width
  const centerY = (clamp(input.yPct, 0, 100) / 100) * video.height
  const startSec = clamp(input.startSec, 0, video.durationSec)
  const endSec = clamp(input.endSec, startSec, video.durationSec)
  if (endSec <= startSec) return null
  return {
    x: clamp(Math.round(centerX - width / 2), 0, video.width - width),
    y: clamp(Math.round(centerY - height / 2), 0, video.height - height),
    width,
    height,
    startSec,
    endSec,
    blockSize: clamp(Math.round(input.blockSize ?? 5), 2, 64),
  }
}

export type EvalFixture = {
  id: string
  durationSec: 30 | 60 | 120
  thresholds: {
    minQualityScore: number
    maxCostUsd: number
    maxLatencyMs: number
  }
  observed: {
    qualityScore: number
    costUsd: number
    latencyMs: number
  }
}

export type EvalResult = {
  fixtureId: string
  passed: boolean
  checks: {
    quality: boolean
    cost: boolean
    latency: boolean
  }
}

export function evaluateFixture(fixture: EvalFixture): EvalResult {
  const checks = {
    quality: fixture.observed.qualityScore >= fixture.thresholds.minQualityScore,
    cost: fixture.observed.costUsd <= fixture.thresholds.maxCostUsd,
    latency: fixture.observed.latencyMs <= fixture.thresholds.maxLatencyMs,
  }
  return {
    fixtureId: fixture.id,
    passed: Object.values(checks).every(Boolean),
    checks,
  }
}
