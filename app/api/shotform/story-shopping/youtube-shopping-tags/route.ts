import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type ShoppingTagProduct = {
  title: string
  price: string
  imageUrl: string
  url: string
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

function extractJsonObject(source: string, marker: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null
  const start = source.indexOf("{", markerIndex + marker.length)
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === "{") depth += 1
    else if (character === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, index + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function readText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  if (typeof record.simpleText === "string") return record.simpleText.trim()
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) =>
        run && typeof run === "object" ? String((run as Record<string, unknown>).text || "") : ""
      )
      .join("")
      .trim()
  }
  return ""
}

function findImageUrl(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  if (Array.isArray(record.thumbnails)) {
    const thumbnails = record.thumbnails as Array<Record<string, unknown>>
    return String(thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || "")
  }
  for (const key of ["thumbnail", "image", "productImage", "primaryImage"]) {
    const found = findImageUrl(record[key])
    if (found) return found
  }
  return ""
}

function findUrl(value: unknown): string {
  const urls: string[] = []
  const visit = (current: unknown, depth: number) => {
    if (!current || typeof current !== "object" || depth > 12) return
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1))
      return
    }
    const record = current as Record<string, unknown>
    const directValues = [
      record.url,
      (record.webCommandMetadata as Record<string, unknown> | undefined)?.url,
      (record.urlEndpoint as Record<string, unknown> | undefined)?.url,
    ]
    directValues.forEach((candidate) => {
      if (typeof candidate !== "string" || !candidate.trim()) return
      urls.push(
        candidate.startsWith("/") ? `https://www.youtube.com${candidate}` : candidate
      )
    })
    for (const key of [
      "navigationEndpoint",
      "commandMetadata",
      "endpoint",
      "onTap",
      "onClickCommand",
      "commandExecutorCommand",
      "commands",
      "urlEndpoint",
      "serviceEndpoint",
      "button",
    ]) {
      visit(record[key], depth + 1)
    }
  }
  visit(value, 0)
  const score = (url: string) => {
    if (/link\.coupang\.com|coupang\.com/i.test(url)) return 100
    if (/ftc\.go\.kr|accounts\.google\.com|youtube\.com\/youtubei/i.test(url)) return -100
    if (/^https?:\/\//i.test(url)) return 10
    return 0
  }
  return urls.sort((a, b) => score(b) - score(a))[0] || ""
}

function normalizeProduct(value: unknown): ShoppingTagProduct | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const title = [
    record.productName,
    record.title,
    record.name,
    record.headline,
    record.primaryText,
  ]
    .map(readText)
    .find((text) => text.length >= 2)
  if (!title || /^(쇼핑|shopping|제품|상품)$/i.test(title)) return null

  const price =
    [
      record.price,
      record.currentPrice,
      record.priceText,
      record.secondaryText,
      record.accessibilityText,
    ]
      .map(readText)
      .find((text) => /[₩$€£¥]|\d[\d,.]*\s*원/.test(text)) || ""
  const imageUrl = findImageUrl(record)
  const url = findUrl(record)
  if (!price && !imageUrl && !url) return null
  return { title, price, imageUrl, url }
}

function collectProducts(root: unknown) {
  const products: ShoppingTagProduct[] = []
  let visited = 0
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || visited > 80_000) return
    visited += 1
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    for (const [key, child] of Object.entries(record)) {
      if (
        /(shopping.*product|product.*renderer|product.*item|merchandise.*renderer)/i.test(key)
      ) {
        const product = normalizeProduct(child)
        if (product) products.push(product)
      }
      visit(child)
    }
  }
  visit(root)

  const merged = new Map<string, ShoppingTagProduct>()
  products.forEach((product) => {
    const key = product.imageUrl
      ? `image:${product.imageUrl}`
      : product.title.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ")
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, product)
      return
    }
    merged.set(key, {
      title: existing.title,
      price: existing.price || product.price,
      imageUrl: existing.imageUrl || product.imageUrl,
      url: existing.url || product.url,
    })
  })
  return Array.from(merged.values())
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")?.trim() || ""
  if (!/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return NextResponse.json({ error: "올바른 영상 ID가 필요합니다." }, { status: 400 })
  }

  try {
    const watchResponse = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=ko&gl=KR`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
        },
        cache: "no-store",
      }
    )
    if (!watchResponse.ok) throw new Error(`YouTube 페이지 응답 ${watchResponse.status}`)
    const html = await watchResponse.text()
    const directCoupangUrls = Array.from(
      new Set(
        (html.match(/https:\/\/link\.coupang\.com\/[^"]+/g) || []).map((url) =>
          url.replace(/\\u0026/g, "&").replace(/\\\//g, "/")
        )
      )
    )
    const sources: unknown[] = [
      extractJsonObject(html, "var ytInitialData ="),
      extractJsonObject(html, "ytInitialData ="),
      extractJsonObject(html, "var ytInitialPlayerResponse ="),
    ].filter(Boolean)

    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] || ""
    const clientVersion =
      html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || "2.20260701.00.00"
    if (apiKey) {
      try {
        const nextResponse = await fetch(
          `https://www.youtube.com/youtubei/v1/next?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": USER_AGENT,
              "X-YouTube-Client-Name": "1",
              "X-YouTube-Client-Version": clientVersion,
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: "WEB",
                  clientVersion,
                  hl: "ko",
                  gl: "KR",
                },
              },
              videoId,
            }),
          }
        )
        if (nextResponse.ok) sources.push(await nextResponse.json())
      } catch {
        // 내부 응답이 실패해도 공개 watch 페이지 분석 결과를 사용합니다.
      }
    }

    const products = collectProducts(sources)
      .slice(0, 20)
      .map((product, index) => ({
        ...product,
        url: /coupang\.com/i.test(product.url)
          ? product.url
          : directCoupangUrls[index] || product.url,
      }))
    return NextResponse.json({
      success: true,
      videoId,
      products,
      detected: products.length > 0,
      source: "youtube_public_shopping_renderer",
    })
  } catch (error) {
    return NextResponse.json({
      success: true,
      videoId,
      products: [],
      detected: false,
      source: "youtube_public_shopping_renderer",
      warning: error instanceof Error ? error.message : "쇼핑 태그를 확인하지 못했습니다.",
    })
  }
}
