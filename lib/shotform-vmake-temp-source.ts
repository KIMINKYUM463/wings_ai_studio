import fs from "fs/promises"
import { randomUUID } from "crypto"

type Entry = {
  filePath: string
  expiresAt: number
}

const registry = new Map<string, Entry>()

function registryKey(jobId: string, videoId: string, token: string): string {
  return `${jobId}:${videoId}:${token}`
}

/** Vmake 등 외부 API가 fetch할 수 있는 공개 베이스 URL (localhost 제외) */
export function shotformPublicBaseUrl(): string | null {
  const raw = (
    process.env.SHOTFORM_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  )
    .trim()
    .replace(/\/$/, "")

  if (!raw) return null
  if (/localhost|127\.0\.0\.1/i.test(raw)) return null
  return raw
}

export function isDouyinCdnOrPlatform(videoUrl: string, platform?: string): boolean {
  if (platform === "douyin") return true
  try {
    const host = new URL(videoUrl).hostname.toLowerCase()
    return (
      host.includes("douyin") ||
      host.includes("amemv") ||
      host.includes("douyinvod") ||
      host.includes("snssdk") ||
      host.includes("ixigua") ||
      host.includes("bytecdn")
    )
  } catch {
    return false
  }
}

export function registerVmakeTempSource(input: {
  jobId: string
  videoId: string
  filePath: string
  ttlMs?: number
}): { url: string; token: string } | null {
  const base = shotformPublicBaseUrl()
  if (!base) return null

  const token = randomUUID()
  const key = registryKey(input.jobId, input.videoId, token)
  registry.set(key, {
    filePath: input.filePath,
    expiresAt: Date.now() + (input.ttlMs ?? 45 * 60 * 1000),
  })
  prune()

  const q = new URLSearchParams({
    jobId: input.jobId,
    videoId: input.videoId,
    token,
  })
  return { token, url: `${base}/api/shotform/auto-edit/vmake-source?${q.toString()}` }
}

export async function readVmakeTempSource(
  jobId: string,
  videoId: string,
  token: string
): Promise<Buffer | null> {
  const key = registryKey(jobId, videoId, token)
  const entry = registry.get(key)
  if (!entry || Date.now() > entry.expiresAt) {
    registry.delete(key)
    return null
  }
  try {
    const buf = await fs.readFile(entry.filePath)
    if (buf.length < 20_000) return null
    return buf
  } catch {
    return null
  }
}

function prune(): void {
  const now = Date.now()
  for (const [k, v] of registry) {
    if (now > v.expiresAt) registry.delete(k)
  }
}
