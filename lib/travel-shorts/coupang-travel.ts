/** 쿠팡 트래블 숙소 페이지 → 숙소 정보·사진 (서버 전용) */

import type { TravelPhotoRole } from "@/lib/travel-shorts/types"

// 쿠팡 트래블 숙소 링크는 trip.coupang.com 과 travel.coupang.com 두 주소로 다 나온다
const ALLOWED_HOSTS = ["coupang.com", "link.coupang.com", "trip.coupang.com", "travel.coupang.com", "www.coupang.com"]
const MAX_PHOTOS = 8

export type CoupangTravelImport = {
  finalUrl: string
  placeName: string
  region: string
  highlights: string
  photos: Array<{ url: string; role: TravelPhotoRole; note: string }>
}

function hostAllowed(raw: string): boolean {
  try {
    const { protocol, hostname } = new URL(raw)
    return protocol === "https:" && ALLOWED_HOSTS.includes(hostname.toLowerCase())
  } catch {
    return false
  }
}

const PROVINCE_SHORT: Array<[RegExp, string]> = [
  [/^서울/, "서울"],
  [/^부산/, "부산"],
  [/^대구/, "대구"],
  [/^인천/, "인천"],
  [/^광주/, "광주"],
  [/^대전/, "대전"],
  [/^울산/, "울산"],
  [/^세종/, "세종"],
  [/^제주/, "제주"],
  [/^경기/, "경기"],
  [/^강원/, "강원"],
  [/^충청북|^충북/, "충북"],
  [/^충청남|^충남/, "충남"],
  [/^전라북|^전북/, "전북"],
  [/^전라남|^전남/, "전남"],
  [/^경상북|^경북/, "경북"],
  [/^경상남|^경남/, "경남"],
]

/** "전라북도 부안군 변산면 ..." → "전북 부안" */
export function regionFromAddress(address: string): string {
  const [first = "", second = ""] = address.trim().split(/\s+/)
  const province = PROVINCE_SHORT.find(([re]) => re.test(first))?.[1]
  if (!province) return [first, second].filter(Boolean).join(" ")
  const city = second.replace(/(특별자치시|특별자치도|시|군|구)$/, "")
  const isMetro = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"].includes(province)
  return isMetro || !city ? province : `${province} ${city}`
}

/** "소노벨 변산 (구 대명리조트 변산/...)" → "소노벨 변산" */
function shortPlaceName(name: string): string {
  return name.replace(/\s*[([（][^)\]）]*[)\]）]\s*/g, " ").replace(/^\[[^\]]+\]\s*/, "").trim() || name.trim()
}

function roleForGroup(type: string, name: string): TravelPhotoRole {
  const key = `${type} ${name}`.toLowerCase()
  if (/view|전경|외관|외부|뷰|오션|야경/.test(key)) return "hero"
  if (/room|객실|침실|욕실/.test(key)) return "room"
  if (/dining|restaurant|food|식당|레스토랑|조식|다이닝|카페/.test(key)) return "food"
  if (/around|주변|관광|landmark/.test(key)) return "around"
  return "unique"
}

/** 썸네일·크롭 경로를 잘리지 않은 큰 이미지로 */
function fullImageUrl(path: string): string {
  const idx = path.indexOf("/image/travelSeller/")
  if (idx >= 0) return `https://thumbnail.coupangcdn.com/thumbnails/remote/1200x1200ex${path.slice(idx)}`
  return path.startsWith("//") ? `https:${path}` : path
}

type RawImage = { originImagePath?: string; description?: string }
type RawGroup = { type?: string; name?: string; images?: RawImage[] }

/** 객실 사진이 대부분인 숙소가 많아, 비슷한 컷이 이어지지 않게 역할별 상한을 둠 */
const ROLE_CAP: Partial<Record<TravelPhotoRole, number>> = { room: 3, food: 2 }
const MIN_PHOTOS = 5

function pickPhotos(groups: RawGroup[]): CoupangTravelImport["photos"] {
  const capped = pickPhotosWithCap(groups, ROLE_CAP)
  return capped.length >= MIN_PHOTOS ? capped : pickPhotosWithCap(groups, {})
}

/** 전경 → 부대시설 → 객실 순으로 그룹을 돌아가며, 같은 설명(같은 객실 타입)은 한 장씩만 */
function pickPhotosWithCap(
  groups: RawGroup[],
  cap: Partial<Record<TravelPhotoRole, number>>
): CoupangTravelImport["photos"] {
  const specific = groups.filter((g) => g.type !== "all" && g.images?.length)
  const pools = (specific.length ? specific : groups).map((g) => ({
    role: g.type === "all" ? ("unique" as TravelPhotoRole) : roleForGroup(g.type ?? "", g.name ?? ""),
    images: [...(g.images ?? [])],
  }))
  const order: TravelPhotoRole[] = ["hero", "unique", "room", "food", "around"]
  pools.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))

  const picked: CoupangTravelImport["photos"] = []
  const seenPath = new Set<string>()
  const seenNote = new Set<string>()
  let progressed = true
  while (picked.length < MAX_PHOTOS && progressed) {
    progressed = false
    for (const pool of pools) {
      const limit = cap[pool.role]
      if (limit !== undefined && picked.filter((p) => p.role === pool.role).length >= limit) continue
      while (pool.images.length) {
        const img = pool.images.shift()!
        const path = img.originImagePath ?? ""
        const note = (img.description ?? "").trim()
        if (!path || seenPath.has(path)) continue
        if (note && seenNote.has(note) && pool.images.length) continue
        seenPath.add(path)
        if (note) seenNote.add(note)
        picked.push({ url: fullImageUrl(path), role: pool.role, note: note.slice(0, 40) })
        progressed = true
        break
      }
      if (picked.length >= MAX_PHOTOS) break
    }
  }
  return picked
}

type RawProduct = {
  productName?: string
  location?: { address?: string }
  imageGroups?: RawGroup[]
  facilities?: Array<{ title?: string; facilities?: Array<{ description?: string }> }>
  introductions?: Array<{ themes?: string[]; description?: string }>
  productReview?: { ratingAverage?: number; ratingCount?: number }
  bestReview?: { reviewContent?: { title?: string } }
}

function buildHighlights(product: RawProduct): string {
  const lines: string[] = []
  const facilityGroup =
    product.facilities?.find((f) => f.title?.includes("인기")) ??
    product.facilities?.find((f) => f.title === "편의시설")
  const facilityNames = (facilityGroup?.facilities ?? [])
    .map((f) => f.description ?? "")
    .filter((d) => d && !/주차|엘리베이터|WIFI|인터넷/i.test(d))
  if (facilityNames.length) lines.push(`편의시설: ${facilityNames.slice(0, 6).join(", ")}`)

  const themes = product.introductions?.[0]?.themes ?? []
  if (themes.length) lines.push(`어울리는 여행: ${themes.slice(0, 5).join(", ")}`)

  const review = product.productReview
  if (review?.ratingAverage && review?.ratingCount) {
    lines.push(`쿠팡 평점 ${Number(review.ratingAverage).toFixed(1)} (후기 ${review.ratingCount}개)`)
  }
  const bestTitle = product.bestReview?.reviewContent?.title
  if (bestTitle) lines.push(`실제 후기 한마디: "${bestTitle.slice(0, 40)}"`)

  const intro = (product.introductions?.[0]?.description ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (intro) lines.push(`소개: ${intro.slice(0, 160)}`)
  return lines.join("\n")
}

export async function fetchCoupangTravelProduct(rawUrl: string): Promise<CoupangTravelImport> {
  const url = rawUrl.trim()
  if (!hostAllowed(url)) throw new Error("쿠팡 링크(https://...coupang.com)를 넣어 주세요.")

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(16_000),
  })
  const finalUrl = res.url || url
  if (!hostAllowed(finalUrl)) throw new Error("쿠팡 페이지로 연결되지 않는 링크입니다.")
  if (!res.ok) {
    throw new Error(
      `쿠팡 페이지를 열지 못했습니다. (${res.status}) 쿠팡 트래블 숙소·티켓 상세 링크(trip.coupang.com/tp/products/...)인지 확인해 주세요.`
    )
  }

  const html = await res.text()
  const json = html.match(/<script[^>]*id="travel-detail-product-data"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!json) {
    throw new Error("쿠팡 트래블 숙소 페이지가 아니에요. 쿠팡 트래블에서 숙소 상세 링크를 복사해 주세요.")
  }
  const data = JSON.parse(json) as { product?: RawProduct; productBasis?: { productName?: string } }
  const product = data.product ?? {}
  const fullName = String(product.productName ?? data.productBasis?.productName ?? "")
  const photos = pickPhotos(product.imageGroups ?? [])
  if (!fullName && !photos.length) throw new Error("숙소 정보를 찾지 못했습니다.")

  return {
    finalUrl,
    placeName: shortPlaceName(fullName),
    region: regionFromAddress(String(product.location?.address ?? "")),
    highlights: buildHighlights(product),
    photos,
  }
}
