/**
 * 타입캐스트 보이스 API(v2)는 캐릭터 사진을 주지 않는다.
 * 공개 카탈로그(/api/actor/noauth)의 img_url을 voice_id·이름으로 이어 붙인다.
 * voice_id는 `tc_` + actor_id 인 경우가 많다.
 */

const CATALOG_URL = "https://typecast.ai/api/actor/noauth"
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000
const FAILURE_TTL_MS = 60 * 1000

export type TypecastPortraitIndex = {
  byId: Map<string, string>
  byName: Map<string, string>
}

const EMPTY_INDEX: TypecastPortraitIndex = {
  byId: new Map(),
  byName: new Map(),
}

let cached: { until: number; index: TypecastPortraitIndex } | null = null
let inflight: Promise<TypecastPortraitIndex> | null = null

function nameKeys(name: string): string[] {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ")
  if (!key) return []
  const compact = key.replace(/\s+/g, "")
  return compact === key ? [key] : [key, compact]
}

function rememberName(bucket: Map<string, Set<string>>, name: unknown, url: string) {
  if (typeof name !== "string") return
  for (const key of nameKeys(name)) {
    const urls = bucket.get(key) ?? new Set<string>()
    urls.add(url)
    bucket.set(key, urls)
  }
}

export async function loadTypecastPortraitIndex(): Promise<TypecastPortraitIndex> {
  if (cached && Date.now() < cached.until) return cached.index
  if (!inflight) {
    inflight = fetchIndex().finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function fetchIndex(): Promise<TypecastPortraitIndex> {
  try {
    const response = await fetch(CATALOG_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`catalog ${response.status}`)
    const data = (await response.json()) as { result?: unknown }
    const rows = Array.isArray(data.result) ? data.result : []
    const byId = new Map<string, string>()
    const nameBucket = new Map<string, Set<string>>()

    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const actor = row as {
        actor_id?: unknown
        img_url?: unknown
        name?: { ko?: unknown; en?: unknown }
      }
      const actorId = String(actor.actor_id ?? "").trim()
      const imgUrl = String(actor.img_url ?? "").trim()
      if (!actorId || !imgUrl) continue
      byId.set(actorId, imgUrl)
      byId.set(`tc_${actorId}`, imgUrl)
      rememberName(nameBucket, actor.name?.ko, imgUrl)
      rememberName(nameBucket, actor.name?.en, imgUrl)
    }

    const byName = new Map<string, string>()
    for (const [key, urls] of nameBucket) {
      if (urls.size === 1) byName.set(key, [...urls][0]!)
    }

    const index = byId.size > 0 ? { byId, byName } : EMPTY_INDEX
    cached = {
      until: Date.now() + (byId.size > 0 ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
      index,
    }
    return index
  } catch {
    cached = { until: Date.now() + FAILURE_TTL_MS, index: EMPTY_INDEX }
    return EMPTY_INDEX
  }
}

export function typecastPortraitUrl(
  index: TypecastPortraitIndex,
  voice: { voice_id: string; name: string; name_en?: string }
): string | undefined {
  const voiceId = voice.voice_id.trim()
  const bare = voiceId.replace(/^tc_/, "")
  const byId = index.byId.get(voiceId) || index.byId.get(bare)
  if (byId) return byId
  for (const name of [voice.name_en, voice.name]) {
    if (!name) continue
    for (const key of nameKeys(name)) {
      const url = index.byName.get(key)
      if (url) return url
    }
  }
  return undefined
}
