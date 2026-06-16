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

  const hostname = target.hostname
  const referer = upstreamReferer(hostname)
  const baseHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Referer: referer,
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ko;q=0.7",
  }
  if (hostname.endsWith(".xhscdn.com") || hostname.endsWith(".xhscdn.net")) {
    baseHeaders.Origin = "https://www.xiaohongshu.com"
  }
  if (init?.range) baseHeaders.Range = init.range

  const timeoutMs = init?.range ? 45_000 : process.env.VERCEL ? 90_000 : 300_000
  const signal = init?.signal ?? AbortSignal.timeout(timeoutMs)

  const attempts: Record<string, string>[] = [baseHeaders]
  if (hostname.includes("douyin") || hostname.includes("amemv")) {
    attempts.push({
      ...baseHeaders,
      Referer: "https://www.douyin.com/",
      Origin: "https://www.douyin.com",
    })
  }

  let lastStatus = 0
  for (const headers of attempts) {
    const res = await fetch(target.toString(), { headers, cache: "no-store", signal })
    if (res.ok || res.status === 206) return res
    lastStatus = res.status
    if (res.status !== 403 && res.status !== 401) break
  }

  throw new Error(`영상 upstream fetch 실패 (${lastStatus || 0})`)
}
