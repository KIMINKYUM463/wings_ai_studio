export const SHOTFORM_MIX_SOURCES_KEY = "shotform_mix_sources"

/** 제품 URL 검색(영상·URL 검색)에서 마지막으로 분석한 입력 URL */
export const SHOTFORM_PRODUCT_INPUT_URL_KEY = "shotform_product_input_url"

/** AI 쇼핑 숏폼 믹스 분석 완료 후 요약 (다음 단계 UI용) */
export const SHOTFORM_MIX_PIPELINE_RESULT_KEY = "shotform_mix_pipeline_result"

/** sessionStorage 복원 후 클라이언트 컴포넌트가 다시 읽을 때 사용 */
export const SHOTFORM_SESSION_RESTORED_EVENT = "shotform:session-restored"

/** 제품 검색 → 믹스 단계로 넘길 때 sessionStorage에 넣는 최대 개수 */
export const MIX_SOURCE_MAX = 3

/** AI 쇼핑 숏폼에서 믹스 모드로 넣을 수 있는 URL 상한 */
export const MIX_FACTORY_URL_MAX = 5
export const MIX_FACTORY_URL_MIN = 2

export type MixSourceItem = {
  url: string
  title: string
  platform: string
  thumbnail: string
  videoUrl: string
  author?: string
}

export function normalizeMixSourceUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}${u.search}`.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

export function readMixSourcesFromSession(): MixSourceItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = sessionStorage.getItem(SHOTFORM_MIX_SOURCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is MixSourceItem => {
      if (!x || typeof x !== "object") return false
      const o = x as Record<string, unknown>
      return (
        typeof o.url === "string" &&
        typeof o.title === "string" &&
        typeof o.platform === "string" &&
        typeof o.thumbnail === "string" &&
        typeof o.videoUrl === "string"
      )
    }) as MixSourceItem[]
  } catch {
    return []
  }
}

export function writeMixSourcesToSession(items: MixSourceItem[]) {
  sessionStorage.setItem(SHOTFORM_MIX_SOURCES_KEY, JSON.stringify(items))
}

export function readProductInputUrlFromSession(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SHOTFORM_PRODUCT_INPUT_URL_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function writeProductInputUrlToSession(url: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SHOTFORM_PRODUCT_INPUT_URL_KEY, url.trim())
}

export function clearProductInputUrlFromSession() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(SHOTFORM_PRODUCT_INPUT_URL_KEY)
}

export type MixPipelineResult = {
  urls: string[]
  titles: string[]
  targetSeconds: number
  finishedAt: string
}

export function writeMixPipelineResult(result: MixPipelineResult) {
  sessionStorage.setItem(SHOTFORM_MIX_PIPELINE_RESULT_KEY, JSON.stringify(result))
}

export function readMixPipelineResult(): MixPipelineResult | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SHOTFORM_MIX_PIPELINE_RESULT_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!Array.isArray(o.urls) || !Array.isArray(o.titles)) return null
    return {
      urls: o.urls.filter((u): u is string => typeof u === "string"),
      titles: o.titles.filter((t): t is string => typeof t === "string"),
      targetSeconds: typeof o.targetSeconds === "number" ? o.targetSeconds : 30,
      finishedAt: typeof o.finishedAt === "string" ? o.finishedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function isMixSourceItem(x: unknown): x is MixSourceItem {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.url === "string" &&
    typeof o.title === "string" &&
    typeof o.platform === "string" &&
    typeof o.thumbnail === "string" &&
    typeof o.videoUrl === "string" &&
    (o.author === undefined || typeof o.author === "string")
  )
}

export type ShotFormProjectFileV1 = {
  format: "wings-shotform-project"
  version: number
  createdAt?: string
  app?: string
  mixSources: MixSourceItem[]
  mixPipelineResult: MixPipelineResult | null
}

export function parseAndApplyShotFormProject(
  raw: unknown
): { ok: true; message: string } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: false, error: "브라우저에서만 불러올 수 있습니다." }
  if (!raw || typeof raw !== "object") return { ok: false, error: "JSON 객체가 아닙니다." }
  const o = raw as Record<string, unknown>
  if (o.format !== "wings-shotform-project") {
    return { ok: false, error: "Wings ShotForm 프로젝트 파일(.json)이 아닙니다." }
  }
  const version = typeof o.version === "number" ? o.version : 1
  if (version !== 1) return { ok: false, error: `지원하지 않는 프로젝트 버전입니다. (v${version})` }

  if (!Array.isArray(o.mixSources)) return { ok: false, error: "mixSources 배열이 없습니다." }
  const sources = o.mixSources.filter(isMixSourceItem)
  if (sources.length !== o.mixSources.length) {
    return { ok: false, error: "mixSources 항목 형식이 올바르지 않습니다." }
  }

  const capped = sources.slice(0, MIX_FACTORY_URL_MAX)
  let capNote = ""
  if (sources.length > MIX_FACTORY_URL_MAX) {
    capNote = ` URL은 최대 ${MIX_FACTORY_URL_MAX}개까지라 앞 ${MIX_FACTORY_URL_MAX}개만 적용했습니다.`
  }

  if (o.mixPipelineResult === null || o.mixPipelineResult === undefined) {
    sessionStorage.removeItem(SHOTFORM_MIX_PIPELINE_RESULT_KEY)
  } else if (typeof o.mixPipelineResult === "object") {
    const pr = o.mixPipelineResult as Record<string, unknown>
    if (!Array.isArray(pr.urls) || !Array.isArray(pr.titles)) {
      return { ok: false, error: "mixPipelineResult 형식이 올바르지 않습니다." }
    }
    writeMixPipelineResult({
      urls: pr.urls.filter((u): u is string => typeof u === "string"),
      titles: pr.titles.filter((t): t is string => typeof t === "string"),
      targetSeconds: typeof pr.targetSeconds === "number" ? pr.targetSeconds : 30,
      finishedAt: typeof pr.finishedAt === "string" ? pr.finishedAt : new Date().toISOString(),
    })
  } else {
    return { ok: false, error: "mixPipelineResult는 객체이거나 null이어야 합니다." }
  }

  writeMixSourcesToSession(capped)
  window.dispatchEvent(new Event(SHOTFORM_SESSION_RESTORED_EVENT))
  return { ok: true, message: `프로젝트를 불러왔습니다. (믹스 소스 ${capped.length}개)${capNote}` }
}
