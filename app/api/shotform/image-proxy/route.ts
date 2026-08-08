import { NextResponse, type NextRequest } from "next/server"
import { isIP } from "node:net"

export const runtime = "nodejs"

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local")) return true
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  return isIP(host) === 6 && (host === "::1" || host.startsWith("fc") || host.startsWith("fd"))
}

/** CDN별 Referer — 없으면 403/빈 응답이 나는 경우가 많음 */
function upstreamHeaders(hostname: string): Record<string, string> {
  const host = hostname.toLowerCase()
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  }

  if (
    host.includes("coupang") ||
    host.includes("coupangcdn") ||
    host.endsWith("coupangcdn.com")
  ) {
    headers.Referer = "https://www.coupang.com/"
    headers.Origin = "https://www.coupang.com"
  } else if (
    host.includes("douyin") ||
    host.includes("byteimg") ||
    host.includes("tiktokcdn") ||
    host.includes("ibytedtos")
  ) {
    headers.Referer = "https://www.douyin.com/"
  } else if (
    host.includes("xhscdn") ||
    host.includes("xiaohongshu") ||
    host.includes("xhslink")
  ) {
    headers.Referer = "https://www.xiaohongshu.com/"
    headers.Origin = "https://www.xiaohongshu.com"
  } else if (host.includes("pixabay") || host.includes("pexels")) {
    headers.Referer = host.includes("pexels")
      ? "https://www.pexels.com/"
      : "https://pixabay.com/"
  } else if (host.includes("pinimg") || host.includes("pinterest")) {
    headers.Referer = "https://www.pinterest.com/"
  } else if (host.includes("ytimg") || host.includes("ggpht") || host.includes("googleusercontent")) {
    headers.Referer = "https://www.youtube.com/"
  } else if (host.includes("amazonaws.com") || host.includes("cloudfront.net")) {
    headers.Referer = "https://www.google.com/"
  }

  return headers
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get("url")?.trim()
    if (!rawUrl) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 })
    }
    const url = new URL(rawUrl)
    if (url.protocol !== "https:" || isPrivateHost(url.hostname)) {
      return NextResponse.json(
        { error: "허용되지 않는 이미지 URL입니다." },
        { status: 400 }
      )
    }

    const response = await fetch(url.toString(), {
      headers: upstreamHeaders(url.hostname),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
      redirect: "follow",
    })
    if (!response.ok) {
      return NextResponse.json(
        { error: `이미지 원본 응답 오류 (${response.status})` },
        { status: 502 }
      )
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase()
    const path = url.pathname.toLowerCase()
    const looksLikeImageExt = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|$)/i.test(
      path
    )
    const okType =
      contentType.startsWith("image/") ||
      contentType.includes("octet-stream") ||
      contentType.includes("binary") ||
      !contentType ||
      looksLikeImageExt
    if (!okType) {
      return NextResponse.json(
        { error: `이미지 파일이 아닙니다. (${contentType || "unknown"})` },
        { status: 415 }
      )
    }
    const contentLength = Number(response.headers.get("content-length") || 0)
    if (contentLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지가 12MB를 초과합니다." }, { status: 413 })
    }
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "이미지가 12MB를 초과합니다." }, { status: 413 })
    }
    if (bytes.byteLength < 32) {
      return NextResponse.json({ error: "이미지 데이터가 비어 있습니다." }, { status: 502 })
    }
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 프록시 실패" },
      { status: 502 }
    )
  }
}
