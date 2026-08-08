import { type NextRequest, NextResponse } from "next/server"

const ALLOWED_HOSTS = new Set([
  "img.youtube.com",
  "i.ytimg.com",
  "i9.ytimg.com",
  "yt3.ggpht.com",
  "lh3.googleusercontent.com",
  "serpapi.com",
])

function isAllowedImageHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true
  if (hostname.endsWith(".gstatic.com")) return true
  if (hostname.endsWith(".googleusercontent.com")) return true
  if (hostname.endsWith(".serpapi.com")) return true
  if (hostname.endsWith(".douyinpic.com")) return true
  if (hostname.endsWith(".xhscdn.com")) return true
  if (hostname.endsWith(".xhscdn.net")) return true
  if (hostname.includes("xiaohongshu.com")) return true
  if (hostname.includes("coupang") || hostname.includes("coupangcdn")) return true
  if (hostname.includes("pixabay") || hostname.includes("pexels")) return true
  if (hostname.includes("pinimg") || hostname.includes("pinterest")) return true
  if (hostname.endsWith(".amazonaws.com") || hostname.includes("cloudfront.net")) {
    return true
  }
  return false
}

function upstreamReferer(hostname: string): string | undefined {
  if (hostname.endsWith(".douyinpic.com") || hostname.includes("byteimg")) {
    return "https://www.douyin.com/"
  }
  if (
    hostname.endsWith(".xhscdn.com") ||
    hostname.includes("xiaohongshu.com") ||
    hostname.endsWith(".xhscdn.net")
  ) {
    return "https://www.xiaohongshu.com/"
  }
  if (hostname.includes("coupang") || hostname.includes("coupangcdn")) {
    return "https://www.coupang.com/"
  }
  if (hostname.includes("pixabay")) return "https://pixabay.com/"
  if (hostname.includes("pexels")) return "https://www.pexels.com/"
  return undefined
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 })
  }
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "잘못된 URL입니다." }, { status: 400 })
  }
  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "https URL만 허용합니다." }, { status: 400 })
  }
  if (!isAllowedImageHost(target.hostname)) {
    return NextResponse.json({ error: "허용되지 않은 이미지 호스트입니다." }, { status: 403 })
  }

  const ref = upstreamReferer(target.hostname)
  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...(ref ? { Referer: ref, Origin: "https://www.xiaohongshu.com" } : {}),
    },
    next: { revalidate: 3600 },
  })
  if (!upstream.ok) {
    return NextResponse.json({ error: `이미지를 가져오지 못했습니다 (${upstream.status})` }, { status: 502 })
  }
  const buf = await upstream.arrayBuffer()
  const type = upstream.headers.get("content-type") || "image/jpeg"
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  })
}
