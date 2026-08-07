/**
 * 쿠팡 제품 URL → og 메타·대표 이미지 추출 (MVP 영상 키워드 분석용)
 */

const COUPANG_URL_RE =
  /https?:\/\/(?:www\.)?(?:link\.)?coupang\.com\/[^\s"'<>\\]+/gi

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function pickMetaContent(html: string, property: string): string {
  const re1 = new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)["']`, "i")
  const re2 = new RegExp(`content=["']([^"']+)["'][^>]*property=["']${property}["']`, "i")
  return decodeHtmlEntities(html.match(re1)?.[1] || html.match(re2)?.[1] || "")
}

function pickImageUrlsFromHtml(html: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const u = decodeHtmlEntities(raw.trim())
    if (!u.startsWith("http") || seen.has(u)) return
    if (!/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u) && !u.includes("coupangcdn.com") && !u.includes("image.coupang")) {
      return
    }
    seen.add(u)
    out.push(u)
  }

  push(pickMetaContent(html, "og:image"))
  push(pickMetaContent(html, "og:image:url"))
  push(pickMetaContent(html, "twitter:image"))

  const imgRe = /https?:\/\/[^\s"'<>\\]+(?:coupangcdn\.com|image\.coupang)[^\s"'<>\\]*/gi
  for (const m of html.match(imgRe) || []) {
    push(m.replace(/\\u002F/g, "/"))
    if (out.length >= 4) break
  }

  return out.slice(0, 4)
}

export function isCoupangProductUrl(rawUrl: string): boolean {
  const u = rawUrl.trim().toLowerCase()
  return u.includes("coupang.com") || u.includes("link.coupang.com")
}

/** 텍스트(영상 설명·자막 등)에서 쿠팡 URL 추출 */
export function extractCoupangUrlsFromText(text: string): string[] {
  if (!text.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of text.match(COUPANG_URL_RE) || []) {
    const cleaned = m.replace(/[)\\],.;]+$/, "").trim()
    const key = cleaned.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(cleaned)
    }
  }
  return out
}

export type CoupangProductMeta = {
  url: string
  title: string
  description: string
  imageUrls: string[]
}

/** 쿠팡·쿠팡 파트너스 링크 → 제품 페이지 메타 (리다이렉트 follow) */
export async function fetchCoupangProductMeta(rawUrl: string): Promise<CoupangProductMeta | null> {
  const url = rawUrl.trim()
  if (!isCoupangProductUrl(url)) return null

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(16_000),
      redirect: "follow",
    })
    if (!res.ok) return null

    const finalUrl = res.url || url
    const html = (await res.text()).slice(0, 200_000)
    const title =
      pickMetaContent(html, "og:title") ||
      decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    const description = pickMetaContent(html, "og:description")
    const imageUrls = pickImageUrlsFromHtml(html)

    if (!title && imageUrls.length === 0) return null

    return {
      url: finalUrl,
      title,
      description,
      imageUrls,
    }
  } catch {
    return null
  }
}

/** Vision API용 — 서버에서 이미지 다운로드 후 data URL (쿠팡 CDN 차단 대비) */
export async function fetchImageAsVisionDataUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl.startsWith("http")) return null
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.coupang.com/",
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim()
    // 일부 CDN은 content-type을 octet-stream으로 줌
    const looksImage =
      ct.startsWith("image/") ||
      ct.includes("octet-stream") ||
      /\.(avif|bmp|gif|jpe?g|png|webp)(\?|$)/i.test(imageUrl)
    if (!looksImage) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 400) return null
    // Vision/OpenAI 요청 크기 제한 대비 — 너무 큰 상세컷은 스킵
    if (buf.byteLength > 6 * 1024 * 1024) return null
    const b64 = Buffer.from(buf).toString("base64")
    const mime = ct.startsWith("image/") ? ct : "image/jpeg"
    return `data:${mime};base64,${b64}`
  } catch {
    return null
  }
}

/** YouTube watch 페이지 HTML에서 설명란 텍스트·쿠팡 링크 추출 (API 키 없이) */
export async function fetchYoutubeDescriptionForCoupang(videoId: string): Promise<{
  description: string
  coupangUrls: string[]
}> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(14_000),
    })
    if (!res.ok) return { description: "", coupangUrls: [] }
    const html = await res.text()

    let description = ""
    const shortDesc =
      html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/)?.[1] ||
      html.match(/"description":{"simpleText":"((?:\\.|[^"\\])*)"/)?.[1]
    if (shortDesc) {
      description = shortDesc
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    }

    const coupangUrls = extractCoupangUrlsFromText(description + "\n" + html.slice(0, 80_000))
    return { description: description.slice(0, 4000), coupangUrls }
  } catch {
    return { description: "", coupangUrls: [] }
  }
}
