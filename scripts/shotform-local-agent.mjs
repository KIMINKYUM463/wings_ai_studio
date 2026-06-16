/**
 * ShotForm 로컬 동반 에이전트 — 배포 사이트(HTTPS)에서도 PC 폴더로 ffmpeg 렌더
 *
 * 사용: npm run shotform:local-agent
 * 기본: http://127.0.0.1:3847
 */
import http from "http"
import net from "net"
import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import { fileURLToPath } from "url"
import os from "os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const PORT = Number(process.env.SHOTFORM_LOCAL_AGENT_PORT || 3847)
const HOST = process.env.SHOTFORM_LOCAL_AGENT_HOST || "127.0.0.1"

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
      json(res, req, 200, {
        ok: true,
        ffmpeg: hasFfmpeg(),
        defaultWorkDir: defaultWorkDir(),
        port: PORT,
      })
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
})
