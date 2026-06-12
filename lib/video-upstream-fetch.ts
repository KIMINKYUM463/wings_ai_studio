/** xhscdn·douyin 등 CDN 영상 upstream fetch (proxy-video와 동일 로직) */

const ALLOWED_HOST_SUFFIXES = [
  ".douyinvod.com",
  ".ixigua.com",
  ".snssdk.com",
  ".bytecdn.cn",
  ".zjcdn.com",
  ".douyinstatic.com",
  ".amemv.com",
  ".xhscdn.com",
  ".xhscdn.net",
]

export function isAllowedVideoHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((s) => hostname.endsWith(s))
}

export function upstreamReferer(hostname: string): string {
  if (hostname.endsWith(".xhscdn.com") || hostname.endsWith(".xhscdn.net")) {
    return "https://www.xiaohongshu.com/"
  }
  if (hostname.includes("douyin") || hostname.includes("ixigua") || hostname.includes("amemv")) {
    return "https://www.douyin.com/"
  }
  return "https://www.douyin.com/"
}

/** `/api/proxy-video?url=` 또는 직접 CDN URL → upstream https URL */
export function unwrapProxyVideoUrl(url: string): string {
  const u = url.trim()
  if (u.startsWith("/api/proxy-video?")) {
    const q = new URL(u, "http://local").searchParams.get("url")
    if (q) return q
  }
  return u
}

export async function fetchUpstreamVideo(
  url: string,
  init?: { range?: string; signal?: AbortSignal }
): Promise<Response> {
  const raw = unwrapProxyVideoUrl(url)
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    throw new Error("잘못된 영상 URL입니다.")
  }
  if (target.protocol !== "https:") {
    throw new Error("https URL만 허용합니다.")
  }
  if (!isAllowedVideoHost(target.hostname)) {
    throw new Error(`허용되지 않은 영상 호스트: ${target.hostname}`)
  }

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Referer: upstreamReferer(target.hostname),
    Accept: "*/*",
  }
  if (init?.range) headers.Range = init.range

  const timeoutMs = init?.range ? 45_000 : process.env.VERCEL ? 90_000 : 300_000
  const res = await fetch(target.toString(), {
    headers,
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok && res.status !== 206) {
    throw new Error(`영상 upstream fetch 실패 (${res.status})`)
  }
  return res
}
