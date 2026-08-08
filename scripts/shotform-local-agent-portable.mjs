/**
 * ShotForm 포터블 로컬 에이전트 (배포·다른 PC용)
 * Node.js만 있으면 동작 — 프로젝트 클론/npm install 불필요
 *
 * 기능: /health · /coupang/ingest · /coupang/latest
 */
import http from "http"
import net from "net"
import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.SHOTFORM_LOCAL_AGENT_PORT || 3847)
const HOST = process.env.SHOTFORM_LOCAL_AGENT_HOST || "127.0.0.1"

function shotformDir() {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), "ShotForm")
  }
  return path.join(os.homedir(), ".config", "ShotForm")
}

function coupangIngestPath() {
  return path.join(shotformDir(), "coupang-ingest-latest.json")
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
        ffmpeg: false,
        playwright: false,
        portable: true,
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
  process.exit(0)
}

server.listen(PORT, HOST, () => {
  console.log(`[shotform-portable-agent] http://${HOST}:${PORT}`)
  console.log(`[shotform-portable-agent] 저장: ${coupangIngestPath()}`)
  console.log(
    `[shotform-portable-agent] 이 창은 닫지 마세요. Wings 숏폼에서 「에이전트 연결」을 다시 누르세요.`
  )
})
