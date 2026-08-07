/**
 * ShotForm 로컬 동반 에이전트 — ffmpeg 로컬 렌더 + 쿠팡 상품평 Playwright 수집
 *
 * 사용: npm run shotform:local-agent
 * 기본: http://127.0.0.1:3847
 */
import http from "http"
import net from "net"
import fs from "fs"
import path from "path"
import { spawn, spawnSync } from "child_process"
import { fileURLToPath } from "url"
import os from "os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const PORT = Number(process.env.SHOTFORM_LOCAL_AGENT_PORT || 3847)
const HOST = process.env.SHOTFORM_LOCAL_AGENT_HOST || "127.0.0.1"

/** 쿠팡 프로필 동시 사용 방지 */
let coupangBusy = false
let coupangBusySince = 0

function defaultWorkDir() {
  const fromEnv = process.env.SHOTFORM_LOCAL_WORK_DIR?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return path.join(os.homedir(), "ShotForm", "auto-edit")
}

function normalizeWorkDir(input) {
  const trimmed = String(input || "").trim()
  if (!trimmed) throw new Error("workDir가 필요합니다.")
  const resolved = path.resolve(trimmed)
  if (resolved.split(path.sep).some((s) => s === "..")) {
    throw new Error("유효하지 않은 workDir")
  }
  return resolved
}

function sourcesDir(workRoot) {
  return path.join(workRoot, "sources")
}

function sourcePath(workRoot, videoId) {
  return path.join(sourcesDir(workRoot), `${videoId}.mp4`)
}

function jobDir(workRoot, jobId) {
  return path.join(workRoot, "jobs", jobId)
}

function outputPath(workRoot, jobId) {
  return path.join(jobDir(workRoot, jobId), "output.mp4")
}

function ffmpegBin() {
  try {
    return require("ffmpeg-static")
  } catch {
    return "ffmpeg"
  }
}

function ffprobeBin() {
  try {
    return require("ffprobe-static").path
  } catch {
    return "ffprobe"
  }
}

function probeHasVideoStream(filePath) {
  const r = spawnSync(
    ffprobeBin(),
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      filePath,
    ],
    { encoding: "utf8" }
  )
  return r.status === 0 && String(r.stdout || "").trim().toLowerCase().includes("video")
}

function hasFfmpeg() {
  const r = spawnSync(ffmpegBin(), ["-version"], { encoding: "utf8" })
  return r.status === 0
}

function hasPlaywright() {
  return fs.existsSync(path.join(ROOT, "node_modules", "playwright", "package.json"))
}

/** 프로젝트 고정 경로 — Windows 사용자(AppData)가 달라도 Chromium을 같은 폴더에서 씀 */
function playwrightBrowsersDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) {
    return path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH.trim())
  }
  return path.join(ROOT, ".playwright-browsers")
}

function hasPlaywrightChromium() {
  const base = playwrightBrowsersDir()
  if (!fs.existsSync(base)) return false
  try {
    const entries = fs.readdirSync(base)
    return entries.some((name) => {
      if (!name.startsWith("chromium-")) return false
      const chromeWin = path.join(base, name, "chrome-win", "chrome.exe")
      const chromeLinux = path.join(base, name, "chrome-linux", "chrome")
      const chromeMac = path.join(base, name, "chrome-mac", "Chromium.app")
      return fs.existsSync(chromeWin) || fs.existsSync(chromeLinux) || fs.existsSync(chromeMac)
    })
  } catch {
    return false
  }
}

function coupangEnv() {
  return {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersDir(),
  }
}

function coupangProfileDir() {
  if (process.env.SHOTFORM_COUPANG_PROFILE?.trim()) {
    return path.resolve(process.env.SHOTFORM_COUPANG_PROFILE.trim())
  }
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
    return path.join(base, "ShotForm", "coupang-review-profile")
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "ShotForm", "coupang-review-profile")
  }
  return path.join(os.homedir(), ".config", "ShotForm", "coupang-review-profile")
}

function runCoupangCli(cliArgs, timeoutMs) {
  const script = path.join(ROOT, "scripts", "shotform-coupang-reviews.mjs")
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...cliArgs], {
      cwd: ROOT,
      env: coupangEnv(),
      windowsHide: false,
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM")
      } catch {
        /* ignore */
      }
      resolve({
        status: "failed",
        message: `쿠팡 수집 타임아웃(${Math.round(timeoutMs / 1000)}초)`,
        stderr: stderr.slice(-800),
      })
    }, timeoutMs)

    child.stdout.on("data", (buf) => {
      stdout += buf.toString("utf8")
    })
    child.stderr.on("data", (buf) => {
      stderr += buf.toString("utf8")
    })
    child.on("error", (err) => {
      clearTimeout(timer)
      resolve({ status: "failed", message: err.message || "쿠팡 CLI 실행 실패" })
    })
    child.on("close", () => {
      clearTimeout(timer)
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      const last = lines[lines.length - 1]
      if (!last) {
        resolve({
          status: "failed",
          message: stderr.slice(-600) || "쿠팡 CLI 응답이 비었습니다.",
          exitHint: "playwright 설치: npm run shotform:install-coupang",
        })
        return
      }
      try {
        resolve(JSON.parse(last))
      } catch {
        resolve({
          status: "failed",
          message: "쿠팡 CLI JSON 파싱 실패",
          raw: last.slice(0, 500),
          stderr: stderr.slice(-400),
        })
      }
    })
  })
}

function openDefaultBrowser(url) {
  const target = url || "https://www.coupang.com/"
  if (process.platform === "win32") {
    // 평소 쓰는 기본 브라우저 (자동화 프로필/원격디버깅 없음)
    spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore" }).unref()
    return
  }
  if (process.platform === "darwin") {
    spawn("open", [target], { detached: true, stdio: "ignore" }).unref()
    return
  }
  spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref()
}

function coupangIngestPath() {
  const base =
    process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA || os.homedir(), "ShotForm")
      : path.join(os.homedir(), ".config", "ShotForm")
  return path.join(base, "coupang-ingest-latest.json")
}

async function handleCoupangSession(req, res) {
  let body = {}
  try {
    const raw = await readBody(req)
    if (raw.length) body = JSON.parse(raw.toString("utf8"))
  } catch {
    body = {}
  }
  const productUrl = typeof body.productUrl === "string" ? body.productUrl.trim() : ""
  const openUrl =
    productUrl && /coupang\.com/i.test(productUrl) ? productUrl : "https://www.coupang.com/"

  try {
    openDefaultBrowser(openUrl)
    json(res, req, 200, {
      status: "session_ready",
      message:
        "평소 쓰는 기본 브라우저로 열었습니다. Access Denied가 뜨면 일반 Chrome(자동화 창 아님)에서 같은 URL을 여세요. 상품평이 보이면 북마크릿/확장으로 전송 → Wings 숏폼에서 「전송된 리뷰 불러오기」.",
      mode: "default-browser",
      openedUrl: openUrl,
    })
  } catch (e) {
    json(res, req, 500, {
      status: "failed",
      message: e instanceof Error ? e.message : "브라우저를 열지 못했습니다.",
    })
  }
}

async function handleCoupangIngest(req, res) {
  let body
  try {
    body = JSON.parse((await readBody(req)).toString("utf8"))
  } catch {
    json(res, req, 400, { ok: false, error: "JSON body 필요" })
    return
  }
  const mergeReviewPhotos = Boolean(body.mergeReviewPhotos)
  let previous = {}
  if (mergeReviewPhotos) {
    try {
      const file = coupangIngestPath()
      if (fs.existsSync(file)) {
        previous = JSON.parse(fs.readFileSync(file, "utf8"))
      }
    } catch {
      previous = {}
    }
  }
  const reviewsByContent = new Map()
  for (const review of [
    ...(mergeReviewPhotos && Array.isArray(previous.reviews) ? previous.reviews : []),
    ...(Array.isArray(body.reviews) ? body.reviews : []),
  ]) {
    const key = String(review?.content || review?.text || review?.review || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160)
    if (!key) continue
    const existing = reviewsByContent.get(key)
    reviewsByContent.set(key, {
      ...(existing || {}),
      ...review,
      images: Array.from(
        new Set([
          ...(Array.isArray(existing?.images) ? existing.images : []),
          ...(Array.isArray(review?.images) ? review.images : []),
        ])
      ),
    })
  }
  const reviews = Array.from(reviewsByContent.values())
  const productName =
    (typeof body.productName === "string" ? body.productName : "") ||
    (typeof previous.productName === "string" ? previous.productName : "")
  if (!reviews.length && !productName.trim()) {
    json(res, req, 400, {
      ok: false,
      error:
        "수집 데이터가 비어 있습니다. 확장을 새로고침(chrome://extensions)하고 다시 수집하세요.",
    })
    return
  }
  const junkRe = /function\s*\(|localStorage|web-adapter|#region|getLocalStorage/i
  const headerRe =
    /^(?:[가-힣*]{2,8}\s+)?[가-힣A-Za-z0-9&·]{2,30}\s*\[[^\]]{1,40}\][\s\S]{5,200}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉))(?:\s*,\s*[가-힣A-Za-z0-9()[\]\s./\-]{0,80}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|\([^)]{0,40}\))){0,6}\s*/i
  const stripReviewPrefix = (raw) => {
    let s = String(raw || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!s) return ""
    let after = s.replace(headerRe, "").trim()
    if (after.length >= 8) s = after
    const pn = productName.trim()
    if (pn) {
      const core = pn.replace(/^\[[^\]]+\]\s*/, "").trim()
      for (const v of [pn, core].filter((x) => x.length >= 6)) {
        const idx = s.indexOf(v)
        if (idx >= 0 && idx < 120) {
          after = s
            .slice(idx + v.length)
            .replace(/^[,\s]+/, "")
            .replace(
              /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
              ""
            )
            .trim()
          if (after.length >= 8) {
            s = after
            break
          }
        }
      }
    }
    s = s
      .replace(
        /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
        ""
      )
      .trim()
    return s.slice(0, 1500)
  }

  const slimReviews = reviews
    .map((r, i) => {
      const content = stripReviewPrefix(r?.content || r?.text || r?.review || "")
      const page = Number(r?.page) > 0 ? Math.floor(Number(r.page)) : Math.floor(i / 5) + 1
      const indexOnPage =
        Number(r?.indexOnPage) > 0 ? Math.floor(Number(r.indexOnPage)) : (i % 5) + 1
      const images = (Array.isArray(r?.images) ? r.images : [])
        .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
        .slice(0, 6)
      return {
        content,
        page,
        indexOnPage,
        images: images.length ? images : undefined,
      }
    })
    .filter((r) => r.content.length >= 2 && !junkRe.test(r.content))

  const cleanStr = (v, max = 4500) => {
    const s = typeof v === "string" ? v.trim() : ""
    if (!s || junkRe.test(s)) return ""
    return s.slice(0, max)
  }
  const cleanUrls = (arr, max = 40) =>
    (Array.isArray(arr) ? arr : [])
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u) && !junkRe.test(u))
      .slice(0, max)

  const detailImages = cleanUrls(
    mergeReviewPhotos && !Array.isArray(body.detailImages)
      ? previous.detailImages
      : body.detailImages,
    60
  )
  // 갤러리 후보 전부 보관 → Wings AI가 제품이 잘 보이는 1·2번 선정
  const productImages = cleanUrls(
    Array.isArray(body.productImages) && body.productImages.length
      ? body.productImages
      : mergeReviewPhotos
        ? previous.productImages || previous.images
        : body.images,
    12
  )
  const productImage =
    cleanStr(body.productImage, 800) ||
    (mergeReviewPhotos ? cleanStr(previous.productImage, 800) : "") ||
    productImages[0] ||
    ""

  const reviewImages = cleanUrls(
    [
      ...(Array.isArray(body.reviewImages) ? body.reviewImages : []),
      ...(mergeReviewPhotos && Array.isArray(previous.reviewImages)
        ? previous.reviewImages
        : []),
      ...slimReviews.flatMap((r) => r.images || []),
    ],
    Number.MAX_SAFE_INTEGER
  )

  // 필수표기 텍스트는 저장하지 않음. 상세페이지 = detailImages / 제품사진 = productImages
  const payload = {
    ok: true,
    status: slimReviews.length ? "ready" : "no_reviews",
    productName: productName.trim(),
    price: cleanStr(
      body.price || body.productPrice || (mergeReviewPhotos ? previous.price : ""),
      80
    ),
    productPrice: cleanStr(
      body.price ||
        body.productPrice ||
        (mergeReviewPhotos ? previous.productPrice || previous.price : ""),
      80
    ),
    delivery: cleanStr(
      body.delivery ||
        body.productDelivery ||
        (mergeReviewPhotos ? previous.delivery : ""),
      80
    ),
    productDelivery: cleanStr(
      body.delivery ||
        body.productDelivery ||
        (mergeReviewPhotos ? previous.productDelivery || previous.delivery : ""),
      80
    ),
    images: productImages,
    productImages,
    detailImages,
    reviewImages,
    productImage,
    productUrl: cleanStr(
      body.productUrl || (mergeReviewPhotos ? previous.productUrl : ""),
      500
    ),
    reviews: slimReviews,
    reviewCount: slimReviews.length,
    detailImageCount: detailImages.length,
    source: body.source || "chrome-extension",
    at: body.at || new Date().toISOString(),
  }
  try {
    const file = coupangIngestPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8")
    json(res, req, 200, {
      ok: true,
      reviewCount: reviews.length,
      reviewImageCount: reviewImages.length,
      savedTo: file,
    })
  } catch (e) {
    json(res, req, 500, { ok: false, error: e instanceof Error ? e.message : "저장 실패" })
  }
}

function handleCoupangLatest(req, res) {
  try {
    const file = coupangIngestPath()
    if (!fs.existsSync(file)) {
      json(res, req, 200, {
        status: "no_reviews",
        message: "아직 전송된 리뷰가 없습니다. 쿠팡 상품평 페이지에서 북마크릿을 실행하세요.",
        reviews: [],
      })
      return
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"))
    json(res, req, 200, data)
  } catch (e) {
    json(res, req, 500, { status: "failed", message: e instanceof Error ? e.message : "읽기 실패" })
  }
}

function handleCoupangBookmarklet(req, res) {
  setCors(res, req)
  const srcPath = path.join(ROOT, "scripts", "coupang-review-bookmarklet-source.js")
  let src = ""
  try {
    src = fs.readFileSync(srcPath, "utf8")
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("bookmarklet source missing")
    return
  }
  // 한 줄 북마크릿
  const compact = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
  const href = `javascript:${encodeURIComponent(compact)}`
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify({ ok: true, href, label: "Wings 숏폼 상품평 전송" }))
}

async function handleCoupangReviews(req, res) {
  if (coupangBusy) {
    json(res, req, 409, {
      status: "profile_locked",
      message: "다른 쿠팡 작업이 진행 중입니다. 로그인 창이 열려 있으면 닫은 뒤 다시 시도하세요.",
      busyForMs: Date.now() - coupangBusySince,
    })
    return
  }
  if (!hasPlaywright() || !hasPlaywrightChromium()) {
    json(res, req, 200, {
      status: "dependency_missing",
      message:
        "Playwright Chromium이 없습니다. 프로젝트 폴더에서 npm run shotform:install-coupang 를 실행하세요.",
      browsersPath: playwrightBrowsersDir(),
    })
    return
  }

  let body
  try {
    body = JSON.parse((await readBody(req)).toString("utf8"))
  } catch {
    json(res, req, 400, { status: "failed", message: "JSON body 필요" })
    return
  }
  const productUrl = typeof body.productUrl === "string" ? body.productUrl.trim() : ""
  if (!productUrl || !/coupang\.com/i.test(productUrl)) {
    json(res, req, 400, { status: "failed", message: "쿠팡 상품 URL이 필요합니다." })
    return
  }
  const sort = body.sort === "latest" ? "latest" : "best"
  const maxPages = Math.min(5, Math.max(1, Number(body.maxPages) || 3))
  const headless = body.headless === true

  coupangBusy = true
  coupangBusySince = Date.now()
  try {
    const args = [
      "--mode",
      "collect",
      "--url",
      productUrl,
      "--sort",
      sort,
      "--max-pages",
      String(maxPages),
    ]
    if (headless) args.push("--headless", "true")
    const result = await runCoupangCli(args, COLLECT_TIMEOUT_MS)
    json(res, req, 200, result)
  } finally {
    coupangBusy = false
  }
}

const COLLECT_TIMEOUT_MS = 6 * 60 * 1000
const SUPERTONIC_BASE = (process.env.SUPERTONIC_BASE_URL || "http://127.0.0.1:7788").replace(
  /\/$/,
  ""
)
const ENSURE_SUPERTONIC_SCRIPT = path.join(ROOT, "scripts", "ensure-supertonic.mjs")
const SUPERTONIC_STATUS_PATH = path.join(ROOT, ".tmp", "supertonic-ensure-status.json")

async function probeSupertonicHealth() {
  try {
    const res = await fetch(`${SUPERTONIC_BASE}/v1/health`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { online: false, baseUrl: SUPERTONIC_BASE }
    return {
      online: true,
      baseUrl: SUPERTONIC_BASE,
      model: typeof data.model === "string" ? data.model : undefined,
      raw: data,
    }
  } catch {
    return { online: false, baseUrl: SUPERTONIC_BASE }
  }
}

function readSupertonicEnsureStatus() {
  try {
    return JSON.parse(fs.readFileSync(SUPERTONIC_STATUS_PATH, "utf8"))
  } catch {
    return null
  }
}

function spawnEnsureSupertonic() {
  if (!fs.existsSync(ENSURE_SUPERTONIC_SCRIPT)) {
    return { started: false, reason: `스크립트 없음: ${ENSURE_SUPERTONIC_SCRIPT}` }
  }
  const child = spawn(process.execPath, [ENSURE_SUPERTONIC_SCRIPT], {
    detached: true,
    stdio: "ignore",
    cwd: ROOT,
    windowsHide: true,
    env: { ...process.env },
  })
  child.unref()
  return { started: true }
}

async function probePythonAvailable() {
  const candidates = [
    { cmd: "py", args: ["-3", "--version"] },
    { cmd: "python", args: ["--version"] },
    { cmd: "python3", args: ["--version"] },
  ]
  for (const c of candidates) {
    try {
      const r = spawnSync(c.cmd, c.args, {
        encoding: "utf8",
        windowsHide: true,
        timeout: 8000,
      })
      if (r.status === 0) {
        const ver = String(r.stdout || r.stderr || "").trim()
        return { ok: true, command: c.cmd, version: ver }
      }
    } catch {
      /* next */
    }
  }
  return { ok: false }
}

async function handleSupertonicPrereq(req, res) {
  const python = await probePythonAvailable()
  const health = await probeSupertonicHealth()
  const status = readSupertonicEnsureStatus() || {}
  json(res, req, 200, {
    ok: true,
    agent: true,
    python: python.ok,
    pythonVersion: python.version || null,
    pythonCommand: python.command || null,
    supertonic: Boolean(health.online),
    supertonicBaseUrl: SUPERTONIC_BASE,
    ensurePhase: status.phase || null,
    ensureMessage: status.message || null,
    tip: python.ok
      ? "Python 있음 → 「설치·기동」으로 pip 설치 가능"
      : "Python 없음 → Google Drive 포터블 팩을 이 PC에 풀어 두거나 Python을 설치하세요",
  })
}

async function handleSupertonicEnsure(req, res) {
  const health = await probeSupertonicHealth()
  if (health.online) {
    json(res, req, 200, {
      success: true,
      ok: true,
      phase: "ready",
      online: true,
      installed: true,
      alreadyRunning: true,
      baseUrl: health.baseUrl,
      model: health.model,
      message: `이미 실행 중 · ${health.model || "supertonic-3"} · ${health.baseUrl}`,
    })
    return
  }
  const spawned = spawnEnsureSupertonic()
  if (!spawned.started) {
    json(res, req, 500, {
      success: false,
      ok: false,
      phase: "error",
      online: false,
      error: spawned.reason,
      message: spawned.reason,
    })
    return
  }
  json(res, req, 200, {
    success: true,
    ok: true,
    phase: "checking",
    online: false,
    busy: true,
    baseUrl: SUPERTONIC_BASE,
    message: "이 PC에서 Supertonic 3 설치·기동을 시작했습니다…",
  })
}

async function handleSupertonicStatus(req, res) {
  const health = await probeSupertonicHealth()
  const status = readSupertonicEnsureStatus() || {}
  if (health.online) {
    json(res, req, 200, {
      success: true,
      ok: true,
      phase: "ready",
      online: true,
      installed: true,
      baseUrl: health.baseUrl,
      model: health.model,
      message: `연결됨 · ${health.model || "supertonic-3"} · ${health.baseUrl}`,
      busy: false,
    })
    return
  }
  json(res, req, 200, {
    success: true,
    ok: false,
    phase: status.phase || "idle",
    online: false,
    busy: Boolean(status.phase && !["ready", "error", "idle"].includes(status.phase)),
    baseUrl: SUPERTONIC_BASE,
    message: status.message || "Supertonic이 아직 준비되지 않았습니다.",
    error: status.phase === "error" ? status.message : undefined,
  })
}

async function handleSupertonicTts(req, res) {
  const raw = await readBody(req)
  let body
  try {
    body = JSON.parse(raw.toString("utf8") || "{}")
  } catch {
    json(res, req, 400, { success: false, error: "JSON body 필요" })
    return
  }
  const text = String(body.text ?? "").trim()
  const voice = String(body.voiceId ?? body.voice ?? "F1").trim()
  const lang = String(body.lang ?? "ko").trim() || "ko"
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed)
      ? Math.min(2, Math.max(0.7, body.speed))
      : 1.05
  const steps =
    typeof body.steps === "number" && Number.isFinite(body.steps)
      ? Math.min(12, Math.max(5, Math.round(body.steps)))
      : 8
  if (!text) {
    json(res, req, 400, { success: false, error: "텍스트가 필요합니다." })
    return
  }

  let response
  try {
    response = await fetch(`${SUPERTONIC_BASE}/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/wav, application/json" },
      body: JSON.stringify({
        text,
        voice,
        lang,
        speed,
        total_steps: steps,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(180000),
    })
  } catch (e) {
    json(res, req, 503, {
      success: false,
      error: `로컬 Supertonic 연결 실패 (${SUPERTONIC_BASE}). POST /supertonic/ensure 로 설치·기동하세요. ${
        e instanceof Error ? e.message : ""
      }`,
      baseUrl: SUPERTONIC_BASE,
    })
    return
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    json(res, req, response.status, {
      success: false,
      error: `Supertonic TTS 실패 (${response.status}): ${errText.slice(0, 400)}`,
      baseUrl: SUPERTONIC_BASE,
    })
    return
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => ({}))
    const b64 = data.audioBase64 || data.audio
    if (data.audio_url) {
      json(res, req, 200, { success: true, audioUrl: data.audio_url })
      return
    }
    if (b64) {
      const audioUrl = String(b64).startsWith("data:")
        ? String(b64)
        : `data:audio/wav;base64,${b64}`
      json(res, req, 200, {
        success: true,
        audioUrl,
        audioBase64: String(b64).replace(/^data:[^;]+;base64,/, ""),
      })
      return
    }
    json(res, req, 502, { success: false, error: "Supertonic JSON 응답에 오디오가 없습니다." })
    return
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())
  if (!audioBuffer.length) {
    json(res, req, 502, { success: false, error: "오디오가 비어 있습니다." })
    return
  }
  const audioBase64 = audioBuffer.toString("base64")
  json(res, req, 200, {
    success: true,
    audioUrl: `data:audio/wav;base64,${audioBase64}`,
    audioBase64,
  })
}

async function handleSupertonicVoices(req, res) {
  const builtins = ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"].map((id) => ({
    voice_id: id,
    name: id,
    kind: "builtin",
  }))
  try {
    const upstream = await fetch(`${SUPERTONIC_BASE}/v1/styles`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) {
      json(res, req, 200, {
        success: true,
        online: false,
        baseUrl: SUPERTONIC_BASE,
        voices: builtins,
        note: "스타일 목록을 못 읽어 기본 보이스를 사용합니다.",
      })
      return
    }
    const raw = await upstream.json().catch(() => null)
    const voices = []
    const push = (id) => {
      const voiceId = String(id || "").trim()
      if (!voiceId || voices.some((v) => v.voice_id === voiceId)) return
      voices.push({ voice_id: voiceId, name: voiceId, kind: "style" })
    }
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string") push(item)
        else if (item && typeof item === "object") push(item.voice_id || item.id || item.name)
      }
    } else if (raw && typeof raw === "object") {
      const list = raw.styles || raw.voices || raw.data
      if (Array.isArray(list)) {
        for (const item of list) {
          if (typeof item === "string") push(item)
          else if (item && typeof item === "object") push(item.voice_id || item.id || item.name)
        }
      }
    }
    json(res, req, 200, {
      success: true,
      online: true,
      baseUrl: SUPERTONIC_BASE,
      voices: voices.length ? voices : builtins,
    })
  } catch {
    json(res, req, 200, {
      success: true,
      online: false,
      baseUrl: SUPERTONIC_BASE,
      voices: builtins,
      note: "Supertonic 미연결 — 기본 보이스만 표시",
    })
  }
}

function setCors(res, req) {
  const origin = req.headers.origin
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin)
  else res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Work-Dir, X-Video-Id")
  res.setHeader("Access-Control-Allow-Private-Network", "true")
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function json(res, req, status, data) {
  setCors(res, req)
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(data))
}

async function handleSourcesPut(req, res, videoId) {
  const workDir = normalizeWorkDir(req.headers["x-work-dir"])
  if (!videoId || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
    json(res, req, 400, { error: "유효하지 않은 videoId" })
    return
  }
  const buf = await readBody(req)
  if (buf.length < 50_000) {
    json(res, req, 400, { error: "MP4가 너무 작습니다." })
    return
  }
  const sig = buf.subarray(4, 8).toString("ascii")
  if (sig !== "ftyp") {
    json(res, req, 400, { error: "유효한 MP4가 아닙니다. CDN 만료·다운로드 실패일 수 있습니다." })
    return
  }
  const dest = sourcePath(workDir, videoId)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
  if (!probeHasVideoStream(dest)) {
    try {
      fs.unlinkSync(dest)
    } catch {
      /* ignore */
    }
    json(res, req, 400, {
      error: "영상 화면 스트림이 없습니다. 소스를 다시 추가하거나 URL을 갱신해 주세요.",
    })
    return
  }
  json(res, req, 200, { ok: true, path: dest, bytes: buf.length })
}

async function handleRender(req, res) {
  const raw = await readBody(req)
  let body
  try {
    body = JSON.parse(raw.toString("utf8"))
  } catch {
    json(res, req, 400, { error: "JSON body 필요" })
    return
  }
  const workDir = normalizeWorkDir(body.workDir)
  const jobId = String(body.jobId || "").trim()
  const editPlan = body.editPlan
  const segments = editPlan?.edit_plan || body.segments
  const targetDuration = editPlan?.target_duration ?? body.targetDuration
  if (!jobId || !Array.isArray(segments) || !segments.length) {
    json(res, req, 400, { error: "jobId, editPlan.edit_plan 필요" })
    return
  }

  const jDir = jobDir(workDir, jobId)
  fs.mkdirSync(jDir, { recursive: true })
  if (editPlan) {
    fs.writeFileSync(path.join(jDir, "edit-plan.json"), JSON.stringify(editPlan, null, 2))
  }

  const runner = path.join(ROOT, "scripts", "shotform-local-render-runner.cjs")
  const payload = JSON.stringify({
    workDir,
    jobId,
    segments,
    targetDuration,
    defaultVideoId: segments[0]?.video_id || "video_001",
  })
  const proc = spawnSync(process.execPath, [runner, payload], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (proc.status !== 0) {
    json(res, req, 500, {
      error: proc.stderr?.slice(-600) || proc.stdout?.slice(-600) || "ffmpeg 렌더 실패",
    })
    return
  }
  const out = outputPath(workDir, jobId)
  if (!fs.existsSync(out)) {
    json(res, req, 500, { error: "output.mp4가 생성되지 않았습니다." })
    return
  }
  json(res, req, 200, {
    ok: true,
    outputPath: out,
    bytes: fs.statSync(out).size,
  })
}

function handleSourceMeta(req, res, videoId, workDirRaw) {
  try {
    const workDir = normalizeWorkDir(workDirRaw)
    if (!videoId || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
      json(res, req, 400, { error: "유효하지 않은 videoId" })
      return
    }
    const src = sourcePath(workDir, videoId)
    if (!fs.existsSync(src)) {
      json(res, req, 200, { exists: false, hasVideo: false })
      return
    }
    const stat = fs.statSync(src)
    const sig = fs.readFileSync(src, { start: 4, end: 8 }).toString("ascii")
    const hasVideo = stat.size >= 50_000 && sig === "ftyp" && probeHasVideoStream(src)
    json(res, req, 200, { exists: true, hasVideo, bytes: stat.size })
  } catch (e) {
    json(res, req, 400, { error: e instanceof Error ? e.message : "오류" })
  }
}

function handleSourceGet(req, res, videoId, workDirRaw) {
  try {
    const workDir = normalizeWorkDir(workDirRaw)
    if (!videoId || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
      json(res, req, 400, { error: "유효하지 않은 videoId" })
      return
    }
    const src = sourcePath(workDir, videoId)
    if (!fs.existsSync(src)) {
      json(res, req, 404, { error: "source 없음" })
      return
    }
    const stat = fs.statSync(src)
    if (stat.size < 50_000) {
      json(res, req, 404, { error: "source 파일이 너무 작습니다" })
      return
    }
    setCors(res, req)
    if (req.method === "HEAD") {
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Cache-Control": "no-store",
      })
      res.end()
      return
    }
    const buf = fs.readFileSync(src)
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    })
    res.end(buf)
  } catch (e) {
    json(res, req, 400, { error: e instanceof Error ? e.message : "오류" })
  }
}

function handleOutput(req, res, jobId, workDirRaw) {
  try {
    const workDir = normalizeWorkDir(workDirRaw)
    const out = outputPath(workDir, jobId)
    if (!fs.existsSync(out)) {
      json(res, req, 404, { error: "output 없음" })
      return
    }
    const buf = fs.readFileSync(out)
    setCors(res, req)
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    })
    res.end(buf)
  } catch (e) {
    json(res, req, 400, { error: e instanceof Error ? e.message : "오류" })
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
  const pathname = url.pathname

  if (req.method === "OPTIONS") {
    setCors(res, req)
    res.writeHead(204)
    res.end()
    return
  }

  try {
    if (req.method === "GET" && pathname === "/health") {
      const st = await probeSupertonicHealth()
      json(res, req, 200, {
        ok: true,
        ffmpeg: hasFfmpeg(),
        playwright: hasPlaywright(),
        playwrightChromium: hasPlaywrightChromium(),
        playwrightBrowsersPath: playwrightBrowsersDir(),
        coupangBusy,
        coupangProfileDir: coupangProfileDir(),
        defaultWorkDir: defaultWorkDir(),
        port: PORT,
        supertonic: Boolean(st.online),
        supertonicBaseUrl: SUPERTONIC_BASE,
      })
      return
    }

    if (req.method === "GET" && pathname === "/supertonic/prereq") {
      await handleSupertonicPrereq(req, res)
      return
    }

    if (req.method === "POST" && pathname === "/supertonic/ensure") {
      await handleSupertonicEnsure(req, res)
      return
    }

    if (req.method === "GET" && pathname === "/supertonic/status") {
      await handleSupertonicStatus(req, res)
      return
    }

    if (req.method === "POST" && pathname === "/supertonic/tts") {
      await handleSupertonicTts(req, res)
      return
    }

    if (req.method === "GET" && pathname === "/supertonic/voices") {
      await handleSupertonicVoices(req, res)
      return
    }

    if (req.method === "POST" && pathname === "/coupang/session") {
      await handleCoupangSession(req, res)
      return
    }

    if (req.method === "POST" && pathname === "/coupang/reviews") {
      await handleCoupangReviews(req, res)
      return
    }

    if (req.method === "POST" && pathname === "/coupang/ingest") {
      await handleCoupangIngest(req, res)
      return
    }

    if (req.method === "GET" && pathname === "/coupang/latest") {
      handleCoupangLatest(req, res)
      return
    }

    if (req.method === "GET" && pathname === "/coupang/bookmarklet") {
      handleCoupangBookmarklet(req, res)
      return
    }

    const sourceMatch = pathname.match(/^\/sources\/([^/]+)(?:\/meta)?$/)
    if (sourceMatch) {
      const videoId = decodeURIComponent(sourceMatch[1])
      if (pathname.endsWith("/meta") && req.method === "GET") {
        handleSourceMeta(req, res, videoId, url.searchParams.get("workDir"))
        return
      }
      if (req.method === "POST") {
        await handleSourcesPut(req, res, videoId)
        return
      }
      if (req.method === "GET" || req.method === "HEAD") {
        handleSourceGet(req, res, videoId, url.searchParams.get("workDir"))
        return
      }
    }

    if (req.method === "POST" && pathname === "/render") {
      await handleRender(req, res)
      return
    }

    const outMatch = pathname.match(/^\/jobs\/([^/]+)\/output$/)
    if (req.method === "GET" && outMatch) {
      handleOutput(req, res, decodeURIComponent(outMatch[1]), url.searchParams.get("workDir"))
      return
    }

    json(res, req, 404, { error: "not found" })
  } catch (e) {
    json(res, req, 500, { error: e instanceof Error ? e.message : "오류" })
  }
})

function isPortTaken(port, host) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (err) => resolve(err?.code === "EADDRINUSE"))
      .once("listening", () => tester.close(() => resolve(false)))
      .listen(port, host)
  })
}

const taken = await isPortTaken(PORT, HOST)
if (taken) {
  console.log(`[shotform-local-agent] 이미 실행 중 — http://${HOST}:${PORT}`)
  process.exit(0)
}

server.listen(PORT, HOST, () => {
  console.log(`[shotform-local-agent] http://${HOST}:${PORT}`)
  console.log(`[shotform-local-agent] 기본 작업 폴더: ${defaultWorkDir()}`)
  console.log(`[shotform-local-agent] ffmpeg: ${hasFfmpeg() ? "OK" : "없음 — npm install 확인"}`)
  console.log(
    `[shotform-local-agent] playwright: ${hasPlaywright() ? "OK" : "없음"} / chromium: ${
      hasPlaywrightChromium() ? "OK" : "없음 — npm run shotform:install-coupang"
    }`
  )
  console.log(`[shotform-local-agent] browsers: ${playwrightBrowsersDir()}`)
  console.log(`[shotform-local-agent] 쿠팡 프로필: ${coupangProfileDir()}`)
})
