/** 신규 롱폼 v2 — 브라우저 로컬 프로젝트 저장소 */

import {
  V2_SCRIPT_TARGET_CHARS_DEFAULT,
} from "@/lib/longform-v2/script-utils"
import {
  deleteProjectMedia,
  isHeavyMediaUrl,
  loadProjectMediaMap,
  putAllSceneMedia,
} from "@/lib/longform-v2/project-media-idb"

export type StepId = "script" | "voice-image" | "overview"
export type ScriptSubStep = "input" | "plan" | "script"
export type MethodId = "benchmark" | "upload"

export type SceneAsset = {
  index: number
  text: string
  prompt?: string
  imageUrl?: string
  audioUrl?: string
  /** 이미지+TTS 합성 MP4 (data URL 또는 http) */
  videoUrl?: string
  busy?: string | null
  error?: string | null
}

export type LongformV2Project = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  step: StepId
  method: MethodId
  scriptSub: ScriptSubStep
  benchmarkText: string
  topicDirection: string
  targetChars: number
  analysis: Record<string, unknown> | null
  planMarkdown: string
  scriptText: string
  styleHint: string
  /** 이미지 스타일 카드 id */
  imageStyleId: string
  imageStyleLabel: string
  imageModel: string
  productionTab: "style" | "scenes"
  /** WingsStudio / 쇼핑숏폼 호환: elevenlabs | supertone(클라우드) | supertonic(로컬 3) */
  ttsEngine: "elevenlabs" | "supertone" | "supertonic"
  voiceId: string
  ttsLanguage: string
  ttsSpeed: number
  scenes: SceneAsset[]
  hasScript: boolean
  hasTTS: boolean
  hasImages: boolean
}

const LIST_KEY = "wings_longform_v2_projects"
const PROJECT_PREFIX = "wings_longform_v2_project:"

const DEFAULT_STYLE = "cinematic documentary, realistic lighting, 16:9"

function nowIso() {
  return new Date().toISOString()
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `lfv2_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyProject(title?: string): LongformV2Project {
  const t = nowIso()
  const name = (title || "").trim() || `새 프로젝트`
  return {
    id: uid(),
    title: name,
    createdAt: t,
    updatedAt: t,
    step: "overview",
    method: "benchmark",
    scriptSub: "input",
    benchmarkText: "",
    topicDirection: "",
    targetChars: V2_SCRIPT_TARGET_CHARS_DEFAULT,
    analysis: null,
    planMarkdown: "",
    scriptText: "",
    styleHint: DEFAULT_STYLE,
    imageStyleId: "realistic",
    imageStyleLabel: "리얼리스틱 실사",
    imageModel: "nano2",
    productionTab: "style",
    ttsEngine: "supertonic",
    voiceId: "F1",
    ttsLanguage: "한국어",
    ttsSpeed: 1.05,
    scenes: [],
    hasScript: false,
    hasTTS: false,
    hasImages: false,
  }
}

export type ProjectListItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  hasScript: boolean
  hasTTS: boolean
  hasImages: boolean
}

function readList(): ProjectListItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeList(items: ProjectListItem[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(items))
}

function toListItem(p: LongformV2Project): ProjectListItem {
  return {
    id: p.id,
    title: p.title,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    hasScript: !!p.scriptText?.trim() || p.hasScript,
    hasTTS: p.scenes?.some((s) => !!s.audioUrl) || p.hasTTS,
    hasImages: p.scenes?.some((s) => !!s.imageUrl) || p.hasImages,
  }
}

/** localStorage용 — data:/blob: 미디어 제거 (용량 초과 방지) */
export function compactProjectForStorage(project: LongformV2Project): LongformV2Project {
  return {
    ...project,
    scenes: (project.scenes || []).map((s) => {
      const imageUrl =
        s.imageUrl && !isHeavyMediaUrl(s.imageUrl) && !s.imageUrl.startsWith("blob:")
          ? s.imageUrl
          : undefined
      const audioUrl =
        s.audioUrl && !isHeavyMediaUrl(s.audioUrl) && !s.audioUrl.startsWith("blob:")
          ? s.audioUrl
          : undefined
      const videoUrl =
        s.videoUrl && !isHeavyMediaUrl(s.videoUrl) && !s.videoUrl.startsWith("blob:")
          ? s.videoUrl
          : undefined
      return {
        index: s.index,
        text: s.text,
        prompt: s.prompt,
        imageUrl,
        audioUrl,
        videoUrl,
        busy: null,
        error: s.error || null,
      }
    }),
    hasScript: !!project.scriptText?.trim(),
    hasTTS: project.scenes?.some((s) => !!s.audioUrl) || false,
    hasImages: project.scenes?.some((s) => !!s.imageUrl) || false,
  }
}

function normalizeLoadedProject(p: LongformV2Project): LongformV2Project {
  if (!p.ttsEngine) p.ttsEngine = "supertonic"
  if (!p.ttsLanguage) p.ttsLanguage = "한국어"
  if (typeof p.ttsSpeed !== "number" || !Number.isFinite(p.ttsSpeed)) p.ttsSpeed = 1.05
  else p.ttsSpeed = Math.min(1.25, Math.max(0.75, p.ttsSpeed))
  if (!p.imageStyleId) p.imageStyleId = "realistic"
  if (!p.imageStyleLabel) p.imageStyleLabel = "리얼리스틱 실사"
  if (
    !p.imageModel ||
    p.imageModel === "nanobanana-2" ||
    p.imageModel === "flux-schnell" ||
    p.imageModel === "sdxl"
  ) {
    if (!p.imageModel || p.imageModel === "nanobanana-2") p.imageModel = "nano2"
    else if (p.imageModel === "flux-schnell") p.imageModel = "black-forest-labs/flux-schnell"
    else if (p.imageModel === "sdxl") p.imageModel = "prunaai/z-image-turbo"
  }
  if (!p.productionTab) p.productionTab = "style"
  if (!p.styleHint) p.styleHint = DEFAULT_STYLE
  if (p.imageStyleId === "cinematic-realism") {
    p.imageStyleId = "realistic"
    p.imageStyleLabel = "리얼리스틱 실사"
  }
  if (
    !p.voiceId ||
    p.voiceId === "여성1" ||
    p.voiceId.startsWith("남성") ||
    p.voiceId.startsWith("여성")
  ) {
    p.voiceId = p.ttsEngine === "elevenlabs" ? "jB1Cifc2UQbq1gR3wnb0" : "F1"
  }
  if (!Array.isArray(p.scenes)) p.scenes = []
  return p
}

function writeProjectLocal(compacted: LongformV2Project) {
  const key = PROJECT_PREFIX + compacted.id
  const payload = JSON.stringify(compacted)
  try {
    localStorage.setItem(key, payload)
    return
  } catch (e) {
    const isQuota =
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    if (!isQuota) throw e
  }

  // 다른 프로젝트에 남아 있는 data URL도 걷어내 공간 확보
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PROJECT_PREFIX) || k === key) continue
      try {
        const raw = localStorage.getItem(k)
        if (!raw || raw.length < 200_000) continue
        if (!raw.includes("data:")) continue
        const other = JSON.parse(raw) as LongformV2Project
        if (!other?.id) continue
        localStorage.setItem(k, JSON.stringify(compactProjectForStorage(other)))
      } catch {
        /* skip broken */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(key, payload)
    return
  } catch {
    /* fall through */
  }

  // 최후 수단: 분석 JSON·긴 프롬프트 제거 후 재시도
  const leaner: LongformV2Project = {
    ...compacted,
    analysis: null,
      scenes: compacted.scenes.map((s) => ({
        ...s,
        prompt: s.prompt && s.prompt.length > 400 ? s.prompt.slice(0, 400) + "…" : s.prompt,
        imageUrl: undefined,
        audioUrl: undefined,
        videoUrl: undefined,
      })),
  }
  localStorage.setItem(key, JSON.stringify(leaner))
}

export function listProjects(): ProjectListItem[] {
  return readList().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

/** 동기 로드 (미디어 미포함 — 목록/빠른 읽기용) */
export function loadProject(id: string): LongformV2Project | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id)
    if (!raw) return null
    const p = JSON.parse(raw) as LongformV2Project
    if (!p?.id) return null
    return normalizeLoadedProject(p)
  } catch {
    return null
  }
}

/** IndexedDB 미디어까지 합쳐 로드 */
export async function loadProjectAsync(id: string): Promise<LongformV2Project | null> {
  const base = loadProject(id)
  if (!base) return null
  const media = await loadProjectMediaMap(id)
  if (media.size === 0) return base
  const scenes = base.scenes.map((s) => {
    const image = media.get(`${s.index}:image`)
    const audio = media.get(`${s.index}:audio`)
    const video = media.get(`${s.index}:video`)
    return {
      ...s,
      imageUrl: image || s.imageUrl,
      audioUrl: audio || s.audioUrl,
      videoUrl: video || s.videoUrl,
    }
  })
  return {
    ...base,
    scenes,
    hasTTS: scenes.some((s) => !!s.audioUrl) || base.hasTTS,
    hasImages: scenes.some((s) => !!s.imageUrl) || base.hasImages,
  }
}

export function saveProject(project: LongformV2Project): LongformV2Project {
  const next: LongformV2Project = {
    ...project,
    updatedAt: nowIso(),
    hasScript: !!project.scriptText?.trim(),
    hasTTS: project.scenes?.some((s) => !!s.audioUrl) || false,
    hasImages: project.scenes?.some((s) => !!s.imageUrl) || false,
  }

  const compacted = compactProjectForStorage(next)
  writeProjectLocal(compacted)

  const list = readList().filter((x) => x.id !== next.id)
  list.unshift(toListItem(next))
  try {
    writeList(list)
  } catch {
    /* 목록은 작아서 거의 실패하지 않음 */
  }

  // data URL 미디어는 IndexedDB에 비동기 저장 (화면 상태는 next 유지)
  void putAllSceneMedia(next.id, next.scenes || []).catch(() => {
    /* ignore */
  })

  return next
}

export function createProject(title?: string): LongformV2Project {
  const p = createEmptyProject(title)
  return saveProject(p)
}

export function deleteProject(id: string) {
  localStorage.removeItem(PROJECT_PREFIX + id)
  writeList(readList().filter((x) => x.id !== id))
  void deleteProjectMedia(id)
}

export function renameProject(id: string, title: string): LongformV2Project | null {
  const p = loadProject(id)
  if (!p) return null
  return saveProject({ ...p, title: title.trim() || p.title })
}

/** 예전 단일 키 데이터가 있으면 한 번 마이그레이션 */
export function migrateLegacySingleProject(): void {
  if (typeof window === "undefined") return
  try {
    const legacy = localStorage.getItem("wings_longform_v2_project")
    if (!legacy) return
    if (readList().length > 0) {
      localStorage.removeItem("wings_longform_v2_project")
      return
    }
    const old = JSON.parse(legacy) as Partial<LongformV2Project>
    const p = createEmptyProject(old.title || "마이그레이션 프로젝트")
    const merged = saveProject({
      ...p,
      ...old,
      id: p.id,
      createdAt: p.createdAt,
      updatedAt: nowIso(),
      step: old.scriptText ? "script" : "overview",
    } as LongformV2Project)
    void merged
    localStorage.removeItem("wings_longform_v2_project")
  } catch {
    /* ignore */
  }
}

/**
 * 이미 QuotaExceeded로 깨진 프로젝트: LS에 남은 data URL을 걷어내고 IDB로 옮김
 */
export async function migrateProjectMediaOutOfLocalStorage(id: string): Promise<LongformV2Project | null> {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id)
    if (!raw) return null
    const p = normalizeLoadedProject(JSON.parse(raw) as LongformV2Project)
    const hasHeavy = p.scenes?.some(
      (s) => isHeavyMediaUrl(s.imageUrl) || isHeavyMediaUrl(s.audioUrl)
    )
    if (hasHeavy) {
      await putAllSceneMedia(p.id, p.scenes)
      writeProjectLocal(compactProjectForStorage(p))
    }
    return loadProjectAsync(id)
  } catch {
    return loadProjectAsync(id)
  }
}
