/** 여행쇼핑숏폼 AI 호출 + 사진 순서·카메라 움직임 규칙 (브라우저 전용) */

import { shotformOpenAiKey } from "@/lib/shotform-factory-seo"
import { photoToSmallDataUrl } from "@/lib/travel-shorts/render"
import type {
  TravelAngle,
  TravelInfo,
  TravelMotion,
  TravelPhoto,
  TravelPhotoRole,
  TravelProject,
  TravelPublishMeta,
  TravelScriptVariant,
} from "@/lib/travel-shorts/types"

const ROLE_ORDER: TravelPhotoRole[] = ["hero", "room", "unique", "food", "around"]

const ROLE_MOTION: Record<TravelPhotoRole, TravelMotion> = {
  hero: "push-in",
  room: "pan-right",
  unique: "rise",
  food: "pull-out",
  around: "pan-left",
}
const MOTION_CYCLE: TravelMotion[] = ["push-in", "pan-left", "rise", "pan-right", "pull-out"]

/** 같은 움직임이 연달아 나오지 않게 역할별 기본값에서 하나씩 비켜 갑니다 */
export function motionsForPhotos(photos: Pick<TravelPhoto, "role">[]): TravelMotion[] {
  const out: TravelMotion[] = []
  photos.forEach((p, i) => {
    let m = ROLE_MOTION[p.role]
    if (i > 0 && out[i - 1] === m) m = MOTION_CYCLE[(MOTION_CYCLE.indexOf(m) + 1) % MOTION_CYCLE.length]!
    out.push(m)
  })
  return out
}

/**
 * 추천 순서: 가장 눈길 끄는 컷 → 객실 → 여기만의 공간 → 식사 → 주변 → 남은 하이라이트로 마무리.
 * 첫 3초와 마지막 장면(댓글 유도)에 가장 센 사진이 오도록.
 */
export function recommendPhotoOrder(photos: TravelPhoto[], hookById: Map<string, number>): TravelPhoto[] {
  const score = (p: TravelPhoto) => hookById.get(p.id) ?? 5
  const heroes = photos.filter((p) => p.role === "hero").sort((a, b) => score(b) - score(a))
  const opener = heroes[0] ?? [...photos].sort((a, b) => score(b) - score(a))[0]
  if (!opener) return photos
  const rest = photos.filter((p) => p !== opener)
  const closer = rest.filter((p) => p.role === "hero").sort((a, b) => score(b) - score(a))[0]
  const middle = rest
    .filter((p) => p !== closer)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || score(b) - score(a))
  return [opener, ...middle, ...(closer ? [closer] : [])]
}

export const OPENAI_KEY_MISSING = "OpenAI API 키가 없습니다. 숏폼 홈 → 설정에서 입력해 주세요."

async function postJson<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/shotform/travel-shorts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`)
  return data
}

async function postTravelApi<T>(body: Record<string, unknown>): Promise<T> {
  const openaiApiKey = shotformOpenAiKey()
  if (!openaiApiKey) throw new Error(OPENAI_KEY_MISSING)
  return postJson<T>({ ...body, openaiApiKey })
}

/** 쿠팡 트래블 링크 → 숙소 정보 + 사진 Blob (사진은 이미지 프록시로 받아 브라우저에 저장) */
export async function importCoupangTravel(
  url: string
): Promise<{ info: Partial<TravelInfo>; photos: TravelPhoto[] }> {
  const data = await postJson<{
    placeName: string
    region: string
    highlights: string
    photos: Array<{ url: string; role: TravelPhotoRole; note: string }>
  }>({ action: "import", url: url.trim() })

  const stamp = Date.now().toString(36)
  const downloaded = await Promise.all(
    data.photos.map(async (p, i): Promise<TravelPhoto | null> => {
      const res = await fetch(`/api/shotform/image-proxy?url=${encodeURIComponent(p.url)}`).catch(() => null)
      if (!res?.ok) return null
      return { id: `cp-${stamp}-${i}`, blob: await res.blob(), role: p.role, note: p.note || undefined }
    })
  )
  const photos = downloaded.filter((p): p is TravelPhoto => p !== null)
  if (!photos.length) throw new Error("숙소 사진을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요.")

  return {
    info: {
      placeName: data.placeName,
      region: data.region,
      highlights: data.highlights,
      bookingUrl: url.trim(),
      platform: "coupang-travel",
    },
    photos,
  }
}

/** 사진 역할·설명을 AI로 채우고 추천 순서로 재배열 */
export async function classifyTravelPhotos(photos: TravelPhoto[]): Promise<TravelPhoto[]> {
  const payload = await Promise.all(
    photos.map(async (p) => ({ id: p.id, dataUrl: await photoToSmallDataUrl(p.blob) }))
  )
  const data = await postTravelApi<{ photos: Array<{ id: string; role: TravelPhotoRole; note: string; hook: number }> }>(
    { action: "classify", photos: payload }
  )
  const byId = new Map(data.photos.map((p) => [p.id, p]))
  const updated = photos.map((p) => {
    const hit = byId.get(p.id)
    if (!hit) return p
    // 쿠팡에서 받은 객실명 같은 사실 정보는 남기고, AI가 본 장면 설명을 덧붙임
    const note = p.note && hit.note && !p.note.includes(hit.note) ? `${p.note} · ${hit.note}` : hit.note || p.note
    return { ...p, role: hit.role, note }
  })
  return recommendPhotoOrder(updated, new Map(data.photos.map((p) => [p.id, p.hook])))
}

export async function generateTravelScripts(
  project: TravelProject
): Promise<{ variants: TravelScriptVariant[]; publish: TravelPublishMeta }> {
  const data = await postTravelApi<{
    variants: Array<{ angle: TravelAngle; headline: [string, string]; lines: string[] }>
    publish: TravelPublishMeta
  }>({
    action: "script",
    info: project.info,
    photos: project.photos.map((p) => ({ id: p.id, role: p.role, note: p.note })),
  })
  const motions = motionsForPhotos(project.photos)
  const variants = data.variants.map((v) => ({
    angle: v.angle,
    headline: v.headline,
    scenes: project.photos.map((p, i) => ({ photoId: p.id, line: v.lines[i] ?? "", motion: motions[i]! })),
  }))
  return { variants, publish: data.publish }
}

/** 대본을 만든 뒤 사진 순서가 바뀌면 장면 순서도 사진을 따라가게 맞춥니다 */
export function alignScenesToPhotos(variant: TravelScriptVariant, photos: TravelPhoto[]): TravelScriptVariant {
  const byPhoto = new Map(variant.scenes.map((s) => [s.photoId, s]))
  const motions = motionsForPhotos(photos)
  return {
    ...variant,
    scenes: photos.map((p, i) => ({
      photoId: p.id,
      line: byPhoto.get(p.id)?.line ?? "",
      motion: motions[i]!,
    })),
  }
}

export const TRAVEL_AFFILIATE_DISCLOSURE =
  "이 게시물은 제휴 마케팅 활동의 일환으로, 구매·예약 시 일정액의 수수료를 제공받을 수 있습니다."
