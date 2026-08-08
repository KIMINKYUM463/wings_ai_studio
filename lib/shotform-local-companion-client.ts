/** 배포 사이트 → PC 로컬 동반 에이전트 (http://127.0.0.1:3847) */

import type { AutoEditPick, EditPlan } from "@/lib/shotform-auto-edit-types"
import type {
  CoupangCollectResult,
  CoupangReviewSort,
} from "@/lib/shotform-coupang-reviews"

export const DEFAULT_LOCAL_COMPANION_URL = "http://127.0.0.1:3847"
export const LOCAL_COMPANION_URL_STORAGE_KEY = "shotform_local_companion_url"

export type LocalCompanionHealth = {
  ok: boolean
  ffmpeg?: boolean
  playwright?: boolean
  playwrightChromium?: boolean
  playwrightBrowsersPath?: string
  coupangBusy?: boolean
  coupangProfileDir?: string
  defaultWorkDir?: string
  error?: string
}

export function resolveLocalCompanionUrl(): string {
  if (typeof window === "undefined") return DEFAULT_LOCAL_COMPANION_URL
  return (
    localStorage.getItem(LOCAL_COMPANION_URL_STORAGE_KEY)?.trim() || DEFAULT_LOCAL_COMPANION_URL
  ).replace(/\/$/, "")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function probeLocalCompanion(
  baseUrl = resolveLocalCompanionUrl()
): Promise<LocalCompanionHealth> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      cache: "no-store",
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      ffmpeg?: boolean
      playwright?: boolean
      playwrightChromium?: boolean
      playwrightBrowsersPath?: string
      coupangBusy?: boolean
      coupangProfileDir?: string
      defaultWorkDir?: string
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: json.error || `에이전트 응답 ${res.status}` }
    }
    return {
      ok: Boolean(json.ok),
      ffmpeg: json.ffmpeg,
      playwright: json.playwright,
      playwrightChromium: json.playwrightChromium,
      playwrightBrowsersPath: json.playwrightBrowsersPath,
      coupangBusy: json.coupangBusy,
      coupangProfileDir: json.coupangProfileDir,
      defaultWorkDir: json.defaultWorkDir,
    }
  } catch {
    return {
      ok: false,
      error: "로컬 에이전트에 연결하지 못했습니다.",
    }
  }
}

function companionReady(
  health: LocalCompanionHealth,
  requireFfmpeg: boolean
): boolean {
  if (!health.ok) return false
  if (requireFfmpeg && !health.ffmpeg) return false
  return true
}

/**
 * 깨진 shotform-agent:// (bare `node`) 는 쓰지 않는다.
 * 항상 최신 start-shotform-agent.cmd 를 받아 실행한다.
 */
export function downloadLocalAgentStarter(): void {
  if (typeof window === "undefined") return
  const a = document.createElement("a")
  a.href = `/api/shotform/local-agent/download?file=cmd&t=${Date.now()}`
  a.download = "start-shotform-agent.cmd"
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function openShotformAgentProtocol() {
  // 구버전 프로토콜이 `node` PATH 오류를 내므로 기본적으로 호출하지 않음.
  // 수리된 뒤에만 localStorage 플래그로 허용.
  if (typeof window === "undefined") return
  if (localStorage.getItem("shotform_agent_protocol_ok") !== "1") return
  try {
    const a = document.createElement("a")
    a.href = "shotform-agent://start"
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    /* ignore */
  }
}

/**
 * 에이전트 창 실행 — 수집기 없이도 동작.
 *
 * 브라우저는 보안상 .cmd 를 자동 실행할 수 없음 → 안내 팝업 1곳에서만
 * 다운로드 + 「더블클릭」안내. (예전처럼 부모창+팝업 이중 다운로드하지 않음)
 */
export function launchLocalAgentWindow(opts?: {
  /** true면 팝업 없이 .cmd 만 받음 (UI에 안내 문구가 있을 때) */
  downloadOnly?: boolean
}): void {
  if (typeof window === "undefined") return

  const cmdUrl = `${window.location.origin}/api/shotform/local-agent/download?file=cmd&t=${Date.now()}`

  // 수집기 확장이 있으면 .cmd 자동 실행 시도 (있으면 좋음)
  try {
    window.postMessage({ type: "SHOTFORM_LAUNCH_AGENT", cmdUrl }, window.location.origin)
  } catch {
    /* ignore */
  }

  if (opts?.downloadOnly) {
    downloadLocalAgentStarter()
    openShotformAgentProtocol()
    return
  }

  // 안내 팝업 1회 — 여기서만 다운로드 (open 라우트 스크립트)
  try {
    const popup = window.open(
      `/api/shotform/local-agent/open?t=${Date.now()}`,
      "shotform_local_agent",
      "popup=yes,width=560,height=420"
    )
    if (!popup) {
      // 팝업 차단 시에만 부모에서 다운로드
      downloadLocalAgentStarter()
    }
  } catch {
    downloadLocalAgentStarter()
  }

  openShotformAgentProtocol()
}

/** @deprecated use launchLocalAgentWindow — kept for older call sites */
export function requestExtensionLaunchAgent(): void {
  launchLocalAgentWindow()
}

/**
 * 「에이전트 실행」— 수집기 없이 cmd/에이전트 창을 연다.
 * 이미 3847이 살아 있으면 .cmd 를 다시 받지 않는다. (forceLaunch 로만 강제)
 */
export async function connectLocalAgent(opts?: {
  companionUrl?: string
  onProgress?: (message: string) => void
  requireFfmpeg?: boolean
  /** true면 이미 실행 중이어도 .cmd 다운로드·실행 시도 */
  forceLaunch?: boolean
}): Promise<LocalCompanionHealth> {
  const baseUrl = opts?.companionUrl || resolveLocalCompanionUrl()
  const onProgress = opts?.onProgress
  const requireFfmpeg = opts?.requireFfmpeg === true
  const forceLaunch = opts?.forceLaunch === true

  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

  if (!forceLaunch) {
    const existing = await probeLocalCompanion(baseUrl)
    if (companionReady(existing, requireFfmpeg)) {
      onProgress?.(
        "에이전트가 이미 실행 중입니다. (http://127.0.0.1:3847)\n검은 창은 끄지 마세요."
      )
      return existing
    }
  }

  onProgress?.("에이전트가 꺼져 있어 실행 파일을 받는 중… (한 번만)")
  launchLocalAgentWindow()

  if (isLocalHost) {
    try {
      await fetch("/api/shotform/local-agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTerminal: true }),
      })
    } catch {
      /* fall through */
    }
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    const health = await probeLocalCompanion(baseUrl)
    if (companionReady(health, requireFfmpeg)) {
      try {
        localStorage.setItem("shotform_agent_protocol_ok", "1")
      } catch {
        /* ignore */
      }
      onProgress?.(
        "에이전트가 실행 중입니다. (http://127.0.0.1:3847)\n검은 창은 끄지 마세요."
      )
      return health
    }
  }

  onProgress?.(
    "다운로드 폴더의 start-shotform-agent.cmd 를 더블클릭하세요.\n" +
      "창에 Found: ...\\nodejs\\node.exe 와 Starting agent 가 보이면 성공입니다.\n" +
      "(System32 에서 'node' 오류만 보이면 그건 예전 창이니 닫으세요)"
  )
  return {
    ok: false,
    ffmpeg: false,
    error:
      "start-shotform-agent.cmd 를 더블클릭하세요. (Found: node.exe 가 보여야 정상)",
  }
}

/** 에이전트 자동 기동 — install API · localhost start · shotform-agent:// · 재시도 */
export async function ensureLocalCompanionRunning(opts?: {
  companionUrl?: string
  onProgress?: (message: string) => void
  /** ffmpeg 필요 여부 (쿠팡 수집은 false) */
  requireFfmpeg?: boolean
}): Promise<LocalCompanionHealth> {
  const baseUrl = opts?.companionUrl || resolveLocalCompanionUrl()
  const onProgress = opts?.onProgress
  const requireFfmpeg = opts?.requireFfmpeg !== false

  let health = await probeLocalCompanion(baseUrl)
  if (companionReady(health, requireFfmpeg)) return health

  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")

  if (isLocalHost) {
    onProgress?.("로컬 에이전트 시작 중… (npm run shotform:local-agent)")
    try {
      await fetch("/api/shotform/local-agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTerminal: false }),
      })
      for (let i = 0; i < 8; i++) {
        await sleep(500)
        health = await probeLocalCompanion(baseUrl)
        if (companionReady(health, requireFfmpeg)) return health
      }
    } catch {
      /* fall through */
    }
  }

  if (typeof window !== "undefined") {
    onProgress?.("로컬 에이전트 실행 요청 중…")
    openShotformAgentProtocol()
    for (let i = 0; i < 8; i++) {
      await sleep(400)
      health = await probeLocalCompanion(baseUrl)
      if (companionReady(health, requireFfmpeg)) return health
    }
  }

  return {
    ok: false,
    ffmpeg: false,
    error:
      health.error ||
      "로컬 에이전트를 시작하지 못했습니다. 수집기에서 「에이전트 연결」을 누르거나, 터미널에서 npm run shotform:local-agent 를 실행해 주세요.",
  }
}

export async function probeCompanionSourceExists(args: {
  companionUrl?: string
  localWorkDir: string
  videoId: string
}): Promise<boolean> {
  const meta = await probeCompanionSourceMeta(args)
  return meta.exists
}

/** 로컬 sources/{videoId}.mp4 존재·영상 스트림 여부 */
export async function probeCompanionSourceMeta(args: {
  companionUrl?: string
  localWorkDir: string
  videoId: string
}): Promise<{ exists: boolean; hasVideo: boolean; bytes?: number }> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const base = companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir.trim() })
  try {
    const res = await fetch(
      `${base}/sources/${encodeURIComponent(args.videoId)}/meta?${q.toString()}`,
      { cache: "no-store" }
    )
    const json = (await res.json().catch(() => ({}))) as {
      exists?: boolean
      hasVideo?: boolean
      bytes?: number
    }
    if (!res.ok) return { exists: false, hasVideo: false }
    return {
      exists: Boolean(json.exists),
      hasVideo: Boolean(json.hasVideo),
      bytes: json.bytes,
    }
  } catch {
    return { exists: false, hasVideo: false }
  }
}

export async function fetchCompanionSourceMp4(args: {
  companionUrl?: string
  localWorkDir: string
  videoId: string
}): Promise<Blob> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const base = companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir.trim() })
  const res = await fetch(
    `${base}/sources/${encodeURIComponent(args.videoId)}?${q.toString()}`,
    { cache: "no-store" }
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || `로컬 소스 불러오기 실패 (${res.status})`)
  }
  const blob = await res.blob()
  if (blob.size < 50_000) {
    throw new Error("로컬 소스 MP4가 너무 작습니다.")
  }
  return blob
}

export async function uploadAutoEditSourcesToCompanion(
  companionUrl: string,
  localWorkDir: string,
  picks: AutoEditPick[],
  onProgress?: (message: string) => void,
  prefetchedBlobs?: Record<string, Blob>
): Promise<void> {
  const { fetchMvpPickVideoBlob } = await import("@/lib/shotform-mvp-pick-video-download")
  const base = companionUrl.replace(/\/$/, "")
  const total = picks.length

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!
    const label = pick.title || pick.video_id
    onProgress?.(`로컬 에이전트 저장 ${i + 1}/${total}… (${label})`)

    const meta = await probeCompanionSourceMeta({
      companionUrl,
      localWorkDir,
      videoId: pick.video_id,
    })
    if (meta.exists && meta.hasVideo) {
      onProgress?.(`로컬 폴더에 유효한 영상 있음 — ${label} 건너뜀`)
      continue
    }
    if (meta.exists && !meta.hasVideo) {
      onProgress?.(`손상된 소스 감지 — ${label} 다시 저장 중…`)
    }

    let blob = prefetchedBlobs?.[pick.video_id]
    if (!blob?.size) {
      onProgress?.(`영상 ${i + 1}/${total} 다운로드 중… (${label})`)
      const fetched = await fetchMvpPickVideoBlob(pick, (hint) => onProgress?.(hint), {
        localWorkDir,
        companionUrl,
      })
      blob = fetched.blob
    }

    const res = await fetch(`${base}/sources/${encodeURIComponent(pick.video_id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        "X-Work-Dir": localWorkDir,
      },
      body: blob,
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      throw new Error(json.error || `로컬 에이전트 소스 저장 실패 (${res.status})`)
    }
  }
}

export async function renderEditPlanOnCompanion(args: {
  companionUrl: string
  localWorkDir: string
  jobId: string
  editPlan: EditPlan
}): Promise<{ outputPath: string }> {
  const base = args.companionUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workDir: args.localWorkDir,
      jobId: args.jobId,
      editPlan: args.editPlan,
    }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    outputPath?: string
    error?: string
  }
  if (!res.ok || !json.ok || !json.outputPath) {
    throw new Error(json.error || `로컬 에이전트 렌더 실패 (${res.status})`)
  }
  return { outputPath: json.outputPath }
}

export async function fetchCompanionOutputMp4(args: {
  companionUrl: string
  localWorkDir: string
  jobId: string
}): Promise<Blob> {
  const base = args.companionUrl.replace(/\/$/, "")
  const q = new URLSearchParams({ workDir: args.localWorkDir })
  const res = await fetch(
    `${base}/jobs/${encodeURIComponent(args.jobId)}/output?${q.toString()}`,
    { cache: "no-store" }
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(json.error || `로컬 MP4 불러오기 실패 (${res.status})`)
  }
  const blob = await res.blob()
  if (blob.size < 50_000) {
    throw new Error("로컬 MP4가 너무 작습니다.")
  }
  return blob
}

/** 로컬 output.mp4 조회 — 없으면 editPlan으로 렌더 후 반환 */
export async function resolveLocalCompanionMp4(args: {
  localWorkDir: string
  jobId: string
  editPlan?: EditPlan
  localRenderPending?: boolean
  companionUrl?: string
  onProgress?: (message: string) => void
}): Promise<{ blob: Blob; localOutputPath?: string }> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const workDir = args.localWorkDir.trim()
  if (!workDir) throw new Error("로컬 작업 폴더 경로가 필요합니다.")

  const health = await ensureLocalCompanionRunning({
    companionUrl,
    onProgress: args.onProgress,
  })
  if (!health.ok || !health.ffmpeg) {
    throw new Error(health.error || "로컬 에이전트에 연결하지 못했습니다.")
  }

  let localOutputPath: string | undefined

  try {
    const blob = await fetchCompanionOutputMp4({
      companionUrl,
      localWorkDir: workDir,
      jobId: args.jobId,
    })
    return { blob }
  } catch {
    /* output 없음 — 아래에서 렌더 */
  }

  if (!args.editPlan?.edit_plan?.length) {
    throw new Error("짜집기 타임라인(editPlan)이 없어 로컬 MP4를 만들 수 없습니다.")
  }

  args.onProgress?.("로컬 에이전트에서 ffmpeg 렌더 중…")
  const rendered = await renderEditPlanOnCompanion({
    companionUrl,
    localWorkDir: workDir,
    jobId: args.jobId,
    editPlan: args.editPlan,
  })
  localOutputPath = rendered.outputPath

  const blob = await fetchCompanionOutputMp4({
    companionUrl,
    localWorkDir: workDir,
    jobId: args.jobId,
  })
  return { blob, localOutputPath }
}

/** 평소 쓰는 기본 브라우저로 쿠팡 열기 (자동화 프로필 아님) */
export async function openCoupangSessionOnCompanion(args?: {
  companionUrl?: string
  productUrl?: string
  onProgress?: (message: string) => void
}): Promise<CoupangCollectResult> {
  const companionUrl = args?.companionUrl || resolveLocalCompanionUrl()
  const health = await ensureLocalCompanionRunning({
    companionUrl,
    onProgress: args?.onProgress,
    requireFfmpeg: false,
  })
  if (!health.ok) {
    return {
      status: "failed",
      message: health.error || "로컬 에이전트에 연결하지 못했습니다.",
    }
  }

  args?.onProgress?.("기본 브라우저로 쿠팡 여는 중…")
  const base = companionUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/coupang/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productUrl: args?.productUrl || undefined }),
  })
  const json = (await res.json().catch(() => ({}))) as CoupangCollectResult
  if (!res.ok && !json.status) {
    return {
      status: "failed",
      message: (json as { message?: string }).message || `세션 요청 실패 (${res.status})`,
    }
  }
  return json
}

export async function fetchCoupangBookmarkletHref(
  companionUrl = resolveLocalCompanionUrl()
): Promise<string | null> {
  try {
    const base = companionUrl.replace(/\/$/, "")
    const res = await fetch(`${base}/coupang/bookmarklet`, { cache: "no-store" })
    const json = (await res.json().catch(() => ({}))) as { href?: string }
    return json.href || null
  } catch {
    return null
  }
}

/** 북마크릿이 에이전트에 보낸 최신 리뷰 */
export async function fetchCoupangIngestedOnCompanion(args?: {
  companionUrl?: string
  onProgress?: (message: string) => void
}): Promise<CoupangCollectResult> {
  const companionUrl = args?.companionUrl || resolveLocalCompanionUrl()
  const health = await ensureLocalCompanionRunning({
    companionUrl,
    onProgress: args?.onProgress,
    requireFfmpeg: false,
  })
  if (!health.ok) {
    return {
      status: "failed",
      message: health.error || "로컬 에이전트에 연결하지 못했습니다.",
    }
  }
  args?.onProgress?.("전송된 리뷰 확인 중…")
  const base = companionUrl.replace(/\/$/, "")
  const res = await fetch(`${base}/coupang/latest`, { cache: "no-store" })
  const json = (await res.json().catch(() => ({}))) as CoupangCollectResult
  return json
}

/** 쿠팡 상품평 수집 (로컬 Playwright) */
export async function fetchCoupangReviewsOnCompanion(args: {
  productUrl: string
  sort?: CoupangReviewSort
  maxPages?: number
  headless?: boolean
  companionUrl?: string
  onProgress?: (message: string) => void
}): Promise<CoupangCollectResult> {
  const companionUrl = args.companionUrl || resolveLocalCompanionUrl()
  const health = await ensureLocalCompanionRunning({
    companionUrl,
    onProgress: args.onProgress,
    requireFfmpeg: false,
  })
  if (!health.ok) {
    return {
      status: "failed",
      message: health.error || "로컬 에이전트에 연결하지 못했습니다.",
    }
  }
  if (!health.playwright || health.playwrightChromium === false) {
    return {
      status: "dependency_missing",
      message:
        "Playwright Chromium이 없습니다. 프로젝트 폴더에서 npm run shotform:install-coupang 후 로컬 에이전트를 재시작하세요.",
    }
  }

  args.onProgress?.("쿠팡 상품평 수집 중… (Chrome이 열릴 수 있습니다)")
  const base = companionUrl.replace(/\/$/, "")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6 * 60 * 1000)
  try {
    const res = await fetch(`${base}/coupang/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        productUrl: args.productUrl,
        sort: args.sort || "best",
        maxPages: args.maxPages ?? 3,
        headless: args.headless === true,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as CoupangCollectResult
    if (!res.ok && !json.status) {
      return {
        status: res.status === 409 ? "profile_locked" : "failed",
        message: (json as { message?: string }).message || `수집 요청 실패 (${res.status})`,
      }
    }
    return json
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { status: "failed", message: "상품평 수집이 시간 초과되었습니다." }
    }
    return {
      status: "failed",
      message: e instanceof Error ? e.message : "상품평 수집 요청 실패",
    }
  } finally {
    clearTimeout(timer)
  }
}
