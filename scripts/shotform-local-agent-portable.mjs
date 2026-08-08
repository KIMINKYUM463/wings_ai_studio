/**
 * ShotForm 포터블 로컬 에이전트 (배포·다른 PC용)
 * Node.js만 있으면 동작 — 프로젝트 클론/npm install 불필요
 *
 * 기능:
 *  /health
 *  /coupang/ingest · /coupang/latest
 *  /supertonic/prereq · /supertonic/ensure · /supertonic/status · /supertonic/tts
 */
import http from "http"
import net from "net"
import fs from "fs"
import path from "path"
import os from "os"
import { spawn, spawnSync } from "child_process"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SHOTFORM_LOCAL_AGENT_PORT || 3847)
const HOST = process.env.SHOTFORM_LOCAL_AGENT_HOST || "127.0.0.1"
const SUPERTONIC_BASE = (process.env.SUPERTONIC_BASE_URL || "http://127.0.0.1:7788").replace(
  /\/$/,
  ""
)

function shotformDir() {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), "ShotForm")
  }
  return path.join(os.homedir(), ".config", "ShotForm")
}

function coupangIngestPath() {
  return path.join(shotformDir(), "coupang-ingest-latest.json")
}

/** ensure-supertonic.mjs 의 ROOT = scripts 의 부모 → ShotForm 홈과 맞춤 */
function ensureScriptPath() {
  return path.join(shotformDir(), "scripts", "ensure-supertonic.mjs")
}

function ensureStatusPath() {
  return path.join(shotformDir(), ".tmp", "supertonic-ensure-status.json")
}

function setCors(res, req) {
  const origin = req.headers.origin || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader("Access-Control-Allow-Private-Network", "true")
  res.setHeader("Vary", "Origin")
}

function json(res, req, status, body) {
  setCors(res, req)
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (c) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function cleanUrls(arr, max = 80) {
  return (Array.isArray(arr) ? arr : [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, max)
}

async function handleCoupangIngest(req, res) {
  let body
  try {
    body = JSON.parse((await readBody(req)).toString("utf8"))
  } catch {
    json(res, req, 400, { ok: false, error: "JSON body 필요" })
    return
  }

  const reviews = (Array.isArray(body.reviews) ? body.reviews : [])
    .map((r, i) => ({
      content: String(r?.content || r?.text || r?.review || "")
        .replace(/\s+/g, " ")
        .trim(),
      page: Number(r?.page) > 0 ? Math.floor(Number(r.page)) : Math.floor(i / 5) + 1,
      indexOnPage:
        Number(r?.indexOnPage) > 0 ? Math.floor(Number(r.indexOnPage)) : (i % 5) + 1,
      images: cleanUrls(r?.images, 6),
    }))
    .filter((r) => r.content.length >= 2)

  const productName = String(body.productName || "").trim()
  if (!reviews.length && !productName) {
    json(res, req, 400, {
      ok: false,
      error: "수집 데이터가 비어 있습니다. 확장에서 다시 수집하세요.",
    })
    return
  }

  const productImages = cleanUrls(
    Array.isArray(body.productImages) && body.productImages.length
      ? body.productImages
      : body.images,
    12
  )
  const detailImages = cleanUrls(body.detailImages, 60)
  const reviewImages = cleanUrls(
    [
      ...(Array.isArray(body.reviewImages) ? body.reviewImages : []),
      ...reviews.flatMap((r) => r.images || []),
    ],
    200
  )

  const payload = {
    ok: true,
    status: reviews.length ? "ready" : "no_reviews",
    productName,
    price: String(body.price || body.productPrice || "").trim(),
    productPrice: String(body.price || body.productPrice || "").trim(),
    delivery: String(body.delivery || body.productDelivery || "").trim(),
    productDelivery: String(body.delivery || body.productDelivery || "").trim(),
    images: productImages,
    productImages,
    detailImages,
    reviewImages,
    productImage: String(body.productImage || "").trim() || productImages[0] || "",
    productUrl: String(body.productUrl || "").trim(),
    reviews,
    reviewCount: reviews.length,
    detailImageCount: detailImages.length,
    source: body.source || "chrome-extension",
    portable: true,
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
        message: "아직 전송된 리뷰가 없습니다. 확장에서 수집·전송하세요.",
        reviews: [],
      })
      return
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"))
    json(res, req, 200, data)
  } catch (e) {
    json(res, req, 500, {
      status: "failed",
      message: e instanceof Error ? e.message : "읽기 실패",
    })
  }
}

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
    return JSON.parse(fs.readFileSync(ensureStatusPath(), "utf8"))
  } catch {
    return null
  }
}

function probePythonAvailable() {
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

function resolveEnsureDownloadUrl(hintOrigin) {
  if (process.env.SHOTFORM_ENSURE_URL) return process.env.SHOTFORM_ENSURE_URL
  const origin = String(
    process.env.SHOTFORM_ORIGIN || hintOrigin || ""
  ).replace(/\/$/, "")
  if (!origin) return ""
  return `${origin}/api/shotform/local-agent/download?file=ensure-supertonic`
}

async function ensureEnsureScript(hintOrigin) {
  const dest = ensureScriptPath()
  const url = resolveEnsureDownloadUrl(hintOrigin)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 200) {
    // 원본 URL이 있으면 최신으로 갱신 시도 (실패해도 기존 파일 사용)
    if (!url) return { ok: true, path: dest, refreshed: false }
  }
  if (!url) {
    return {
      ok: false,
      reason:
        "설치 스크립트 URL을 모릅니다. 사이트에서 start-shotform-agent.cmd 를 다시 받아 실행하세요.",
    }
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) {
      if (fs.existsSync(dest)) return { ok: true, path: dest, refreshed: false }
      return { ok: false, reason: `ensure 스크립트 다운로드 실패 (${res.status})` }
    }
    const text = await res.text()
    if (!text.includes("ensure-supertonic") && !text.includes("supertonic")) {
      if (fs.existsSync(dest)) return { ok: true, path: dest, refreshed: false }
      return { ok: false, reason: "다운로드한 파일이 ensure 스크립트가 아닙니다." }
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, text, "utf8")
    return { ok: true, path: dest, refreshed: true }
  } catch (e) {
    if (fs.existsSync(dest)) return { ok: true, path: dest, refreshed: false }
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "ensure 스크립트 다운로드 실패",
    }
  }
}

function spawnEnsureSupertonic(scriptPath) {
  const root = shotformDir()
  fs.mkdirSync(path.join(root, ".tmp"), { recursive: true })
  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: "ignore",
    cwd: root,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1" },
  })
  child.unref()
  return { started: true, pid: child.pid }
}

async function handleSupertonicPrereq(req, res) {
  const python = probePythonAvailable()
  const health = await probeSupertonicHealth()
  const status = readSupertonicEnsureStatus() || {}
  json(res, req, 200, {
    ok: true,
    agent: true,
    portable: true,
    python: python.ok,
    pythonVersion: python.version || null,
    pythonCommand: python.command || null,
    supertonic: Boolean(health.online),
    supertonicBaseUrl: SUPERTONIC_BASE,
    ensurePhase: status.phase || null,
    ensureMessage: status.message || null,
    tip: python.ok
      ? "Python 있음 → 「Supertonic 자동 실행」으로 pip 설치·기동 가능"
      : "Python 없음 → https://www.python.org/downloads/ 에서 Python 3 설치 (Add to PATH 체크)",
  })
}

async function handleSupertonicEnsure(req, res) {
  let hintOrigin = ""
  try {
    const raw = await readBody(req)
    if (raw.length) {
      const body = JSON.parse(raw.toString("utf8") || "{}")
      hintOrigin = String(body.origin || "").trim()
    }
  } catch {
    /* empty body ok */
  }
  if (!hintOrigin && req.headers.origin) {
    hintOrigin = String(req.headers.origin)
  }

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

  const python = probePythonAvailable()
  if (!python.ok) {
    json(res, req, 200, {
      success: false,
      ok: false,
      phase: "error",
      online: false,
      error: "python_missing",
      message:
        "이 PC에 Python이 없습니다. python.org 에서 Python 3를 설치하고(Add to PATH 체크) PC를 재시작한 뒤, 에이전트 창을 닫고 start-shotform-agent.cmd 를 다시 실행한 다음 「Supertonic 자동 실행」을 누르세요.",
    })
    return
  }

  const script = await ensureEnsureScript(hintOrigin)
  if (!script.ok) {
    json(res, req, 500, {
      success: false,
      ok: false,
      phase: "error",
      online: false,
      error: script.reason,
      message: script.reason,
    })
    return
  }

  const spawned = spawnEnsureSupertonic(script.path)
  json(res, req, 200, {
    success: true,
    ok: true,
    phase: "checking",
    online: false,
    busy: true,
    baseUrl: SUPERTONIC_BASE,
    python: python.version,
    message: `Python 확인됨 (${python.version}). 이 PC에서 Supertonic 3 설치·기동을 시작했습니다… (최초 1회 pip·모델 수 분)`,
    ensurePid: spawned.pid,
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

async function handleSupertonicVoices(req, res) {
  const builtins = ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"].map(
    (id) => ({
      voice_id: id,
      name: id,
      kind: "builtin",
    })
  )
  const health = await probeSupertonicHealth()
  json(res, req, 200, {
    success: true,
    online: Boolean(health.online),
    baseUrl: SUPERTONIC_BASE,
    voices: builtins,
    note: health.online
      ? undefined
      : "서버 오프라인 — 기본 보이스 목록만 표시. 「Supertonic 자동 실행」으로 기동하세요.",
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
  if (!text) {
    json(res, req, 400, { success: false, error: "text 필요" })
    return
  }
  try {
    const upstream = await fetch(`${SUPERTONIC_BASE}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: text,
        voice,
        language: lang,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(120000),
    })
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "")
      json(res, req, 502, {
        success: false,
        error: `Supertonic TTS 실패 (${upstream.status}) ${errText.slice(0, 200)}`,
      })
      return
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    setCors(res, req)
    res.writeHead(200, {
      "Content-Type": upstream.headers.get("content-type") || "audio/wav",
      "Cache-Control": "no-store",
      "Content-Length": String(buf.length),
    })
    res.end(buf)
  } catch (e) {
    json(res, req, 502, {
      success: false,
      error: e instanceof Error ? e.message : "TTS 프록시 실패",
    })
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
      const python = probePythonAvailable()
      const st = await probeSupertonicHealth()
      json(res, req, 200, {
        ok: true,
        ffmpeg: false,
        playwright: false,
        portable: true,
        supertonic: true,
        python: python.ok,
        pythonVersion: python.version || null,
        supertonicOnline: Boolean(st.online),
        agentDir: __dirname,
        defaultWorkDir: path.join(shotformDir(), "auto-edit"),
        port: PORT,
      })
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

    json(res, req, 404, { error: "not found (portable agent)" })
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
  console.log(`[shotform-portable-agent] 이미 실행 중 — http://${HOST}:${PORT}`)
  console.log(
    `[shotform-portable-agent] 예전 에이전트일 수 있습니다. Supertonic이 안 되면 이 창을 닫고 start-shotform-agent.cmd 를 다시 실행하세요.`
  )
  process.exit(0)
}

server.listen(PORT, HOST, () => {
  const python = probePythonAvailable()
  console.log(`[shotform-portable-agent] http://${HOST}:${PORT}`)
  console.log(`[shotform-portable-agent] 저장: ${coupangIngestPath()}`)
  console.log(
    `[shotform-portable-agent] Python: ${
      python.ok ? python.version : "없음 — Supertonic 자동 설치 전에 Python 3 필요"
    }`
  )
  console.log(
    `[shotform-portable-agent] 이 창은 닫지 마세요. Wings에서 「Supertonic 자동 실행」을 누르세요.`
  )
})
