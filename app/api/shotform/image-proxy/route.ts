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

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get("url")?.trim()
    if (!rawUrl) return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 })
    const url = new URL(rawUrl)
    if (url.protocol !== "https:" || isPrivateHost(url.hostname)) {
      return NextResponse.json({ error: "허용되지 않는 이미지 URL입니다." }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 ShotForm-Image-Proxy/1.0",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    })
    if (!response.ok) {
      return NextResponse.json({ error: `이미지 원본 응답 오류 (${response.status})` }, { status: 502 })
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
