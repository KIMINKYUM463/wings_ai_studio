/**
 * ShotForm — 쿠팡 상품평 Playwright 수집 CLI
 *
 * 사용:
 *   node scripts/shotform-coupang-reviews.mjs --mode session --url "https://www.coupang.com/..."
 *   node scripts/shotform-coupang-reviews.mjs --mode collect --url "..." --sort best --max-pages 3
 *
 * stdout: JSON 한 줄
 */
import fs from "fs"
import net from "net"
import os from "os"
import path from "path"
import { spawn } from "child_process"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")

// 프로젝트 고정 브라우저 경로 (에이전트가 env로 넘기지 않은 CLI 직접 실행 대비)
if (!process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(ROOT, ".playwright-browsers")
}

const URL_LOAD_MS = 45_000
const FIRST_RENDER_MS = 2500
const PAGE_SWITCH_MS = 900
const SNAPSHOT_RETRIES = 8
const SNAPSHOT_RETRY_MS = 500
const MAX_REVIEWS = 80
const SESSION_MAX_MS = 15 * 60 * 1000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs(argv) {
  const out = {
    mode: "collect",
    url: "",
    sort: "best",
    maxPages: 3,
    headless: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === "--mode" && next) {
      out.mode = String(next)
      i++
    } else if (a === "--url" && next) {
      out.url = String(next).trim()
      i++
    } else if (a === "--sort" && next) {
      out.sort = String(next).trim() === "latest" ? "latest" : "best"
      i++
    } else if (a === "--max-pages" && next) {
      out.maxPages = Math.min(5, Math.max(1, Number(next) || 3))
      i++
    } else if (a === "--headless") {
      if (next === "false" || next === "0") {
        out.headless = false
        i++
      } else if (next === "true" || next === "1") {
        out.headless = true
        i++
      } else {
        out.headless = true
      }
    } else if (a === "--headed") {
      out.headless = false
    }
  }
  return out
}

function profileBaseDir() {
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

/** channel별 프로필 분리 (bundled Chromium 프로필과 시스템 Chrome 혼용 방지) */
function profileDir(channel) {
  const base = profileBaseDir()
  if (!channel || channel === "chromium") return path.join(base, "chromium")
  return path.join(base, channel)
}

function browserCandidates() {
  const list = []
  if (process.platform === "win32") {
    list.push(
      { channel: "chrome", exe: path.join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe") },
      { channel: "chrome", exe: path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe") },
      { channel: "chrome", exe: path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe") },
      { channel: "msedge", exe: path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe") },
      { channel: "msedge", exe: path.join(process.env["PROGRAMFILES"] || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe") }
    )
  } else if (process.platform === "darwin") {
    list.push(
      { channel: "chrome", exe: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      { channel: "msedge", exe: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" }
    )
  } else {
    list.push(
      { channel: "chrome", exe: "/usr/bin/google-chrome" },
      { channel: "chrome", exe: "/usr/bin/google-chrome-stable" },
      { channel: "chrome", exe: "/usr/bin/chromium-browser" }
    )
  }
  return list
}

function resolveSystemBrowser() {
  const forced = (process.env.SHOTFORM_COUPANG_BROWSER || "").trim().toLowerCase()
  for (const c of browserCandidates()) {
    if (forced && c.channel !== forced) continue
    if (c.exe && fs.existsSync(c.exe)) return c
  }
  return null
}

function cdpMetaPath(userDataDir) {
  return path.join(userDataDir, "shotform-cdp.json")
}

function readCdpMeta(userDataDir) {
  try {
    const raw = fs.readFileSync(cdpMetaPath(userDataDir), "utf8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCdpMeta(userDataDir, meta) {
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(cdpMetaPath(userDataDir), JSON.stringify(meta, null, 2), "utf8")
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address()
      const port = typeof addr === "object" && addr ? addr.port : 0
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
    s.on("error", reject)
  })
}

async function probeCdp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function waitForCdp(port, timeoutMs = 25_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = await probeCdp(port)
    if (v) return v
    await sleep(250)
  }
  const err = new Error("cdp_timeout")
  err.code = "cdp_timeout"
  throw err
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n")
}

function isCoupangUrl(url) {
  try {
    const u = new URL(url)
    return u.hostname.includes("coupang.com")
  } catch {
    return false
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright")
  } catch {
    return null
  }
}

/**
 * 세션용: 원격디버깅 없는 일반 Chrome (Akamai 통과율↑)
 * 수집용: 동일 프로필 + remote-debugging (이미 연 창에 붙거나, 홈만 연 뒤 수동 이동 대기)
 */
function spawnChromeProcess({ exe, userDataDir, port, startUrl }) {
  const args = [
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=TranslateUI",
    "--lang=ko-KR",
  ]
  if (port) {
    args.push(`--remote-debugging-port=${port}`, "--remote-allow-origins=*")
  }
  // 상품 URL을 자동으로 넣지 않음 — Access Denied 유발
  args.push(startUrl || "https://www.coupang.com/")
  const child = spawn(exe, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  })
  child.unref()
  return child
}

async function connectCdp(playwright, port) {
  const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
    timeout: 20_000,
  })
  const context = browser.contexts()[0] || (await browser.newContext())
  return { browser, context }
}

/** 수집: 기존 세션 CDP에만 붙거나, 없으면 홈만 연 debug Chrome */
async function openViaSystemChrome(playwright, { reuseOnly = false } = {}) {
  const browserInfo = resolveSystemBrowser()
  if (!browserInfo) {
    const err = new Error("no_system_browser")
    err.code = "no_system_browser"
    throw err
  }
  const channel = browserInfo.channel
  const userDataDir = profileDir(channel)
  fs.mkdirSync(userDataDir, { recursive: true })

  const prev = readCdpMeta(userDataDir)
  if (prev?.port) {
    const alive = await probeCdp(prev.port)
    if (alive) {
      const { browser, context } = await connectCdp(playwright, prev.port)
      return {
        browser,
        context,
        userDataDir,
        channel,
        port: prev.port,
        reused: true,
        ownedProcess: false,
      }
    }
  }

  if (reuseOnly) {
    const err = new Error("session_required")
    err.code = "session_required"
    throw err
  }

  const port = await getFreePort()
  spawnChromeProcess({
    exe: browserInfo.exe,
    userDataDir,
    port,
    startUrl: "https://www.coupang.com/",
  })
  try {
    await waitForCdp(port)
  } catch (e) {
    const err = new Error("profile_locked_or_cdp")
    err.code = "profile_locked"
    err.detail = e instanceof Error ? e.message : String(e)
    throw err
  }
  writeCdpMeta(userDataDir, { port, channel, mode: "debug", pidHint: Date.now() })
  const { browser, context } = await connectCdp(playwright, port)
  return {
    browser,
    context,
    userDataDir,
    channel,
    port,
    reused: false,
    ownedProcess: true,
  }
}

async function pageHasReviewSignals(page) {
  if (await detectBlocked(page)) return false
  return page.evaluate(() => {
    const t = document.body?.innerText || ""
    if (/Access Denied|You don't have permission|errors\.edgesuite/i.test(t)) return false
    if (/도움이\s*돼요/.test(t)) return true
    if (/개\s*상품평/.test(t) && /베스트순|최신순/.test(t)) return true
    if (document.querySelector("#sdpReview, [class*='sdp-review']")) return true
    return false
  }).catch(() => false)
}

/** page.goto로 상품 URL을 열지 않음 — 사용자가 연 탭/수동 이동을 기다림 */
async function waitForReviewablePage(context, productUrl, timeoutMs = 180_000) {
  const productId = extractProductId(productUrl)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const pages = context.pages()
    for (const page of pages) {
      const url = page.url() || ""
      if (/errors\.edgesuite|Access Denied/i.test(url)) continue
      const idOk = !productId || url.includes(`/products/${productId}`)
      if (await pageHasReviewSignals(page)) {
        if (idOk || /\/vp\/products\//.test(url)) return page
      }
    }
    // 상품 페이지인데 리뷰 섹션만 아직인 경우도 후보
    for (const page of pages) {
      const url = page.url() || ""
      if (productId && url.includes(`/products/${productId}`) && !(await detectBlocked(page))) {
        await clickReviewTab(page).catch(() => null)
        if (await pageHasReviewSignals(page)) return page
      }
    }
    await sleep(2000)
  }
  return null
}

async function closeBrowserSoft(browser, { killChrome }) {
  try {
    await browser?.close()
  } catch {
    /* ignore */
  }
  // Chrome은 프로필 쿠키 유지를 위해 기본은 죽이지 않음.
  // (수집 후에도 사용자가 수동으로 닫으면 됨)
  void killChrome
}

async function detectBlocked(page) {
  const url = page.url() || ""
  if (/errors\.edgesuite\.net|accessdenied|Access Denied/i.test(url)) return true
  const title = await page.title().catch(() => "")
  if (/access denied/i.test(title)) return true
  const text = await page.evaluate(() => (document.body?.innerText || "").slice(0, 5000)).catch(() => "")
  if (
    /비정상적인\s*접근|Access Denied|You don't have permission|errors\.edgesuite|보안\s*확인|captcha|로봇이\s*아닙니다|잠시\s*후\s*다시|자동화된\s*쿼리/i.test(
      text
    )
  ) {
    return true
  }
  return false
}

function extractProductId(productUrl) {
  const m = String(productUrl || "").match(/\/products\/(\d+)/)
  return m?.[1] || ""
}

/** 이미 상품 페이지면 새로고침하지 않음 (리뷰가 보인 상태 유지) */
async function ensureProductPage(page, productUrl) {
  const id = extractProductId(productUrl)
  const cur = page.url() || ""
  if (id && cur.includes(`/products/${id}`) && !(await detectBlocked(page))) {
    await sleep(400)
    return "reused"
  }

  await page.goto("https://www.coupang.com/", {
    waitUntil: "domcontentloaded",
    timeout: URL_LOAD_MS,
  }).catch(() => null)
  await sleep(1200 + Math.floor(Math.random() * 800))
  await page.evaluate(() => window.scrollBy(0, 180 + Math.floor(Math.random() * 300))).catch(() => null)
  await sleep(500)

  await page.goto(productUrl, {
    waitUntil: "domcontentloaded",
    timeout: URL_LOAD_MS,
  })
  await sleep(FIRST_RENDER_MS + Math.floor(Math.random() * 800))
  return "navigated"
}

async function clickReviewTab(page) {
  await page.evaluate(() => {
    const score = (el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim()
      if (!t || t.length > 40) return -1
      if (/^\d+$/.test(t)) return -1
      if (t.includes("상품평")) return 10
      if (t.includes("상품 리뷰")) return 9
      if (/^리뷰/.test(t)) return 6
      return -1
    }
    let best = null
    let bestScore = 0
    for (const el of document.querySelectorAll("a, button, [role='tab'], li, span")) {
      const s = score(el)
      if (s > bestScore) {
        bestScore = s
        best = el
      }
    }
    best?.click()
    return Boolean(best)
  })
  await sleep(1000)

  // 리뷰 섹션으로 스크롤 + lazy load 유도
  await page.evaluate(async () => {
    const roots = [
      "#sdpReview",
      "[id*='sdpReview']",
      "[class*='sdp-review']",
      "[class*='ProductReview']",
      "[data-component='ProductReview']",
    ]
    let el = null
    for (const sel of roots) {
      el = document.querySelector(sel)
      if (el) break
    }
    if (el) el.scrollIntoView({ behavior: "instant", block: "center" })
    else window.scrollTo(0, Math.max(600, document.body.scrollHeight * 0.55))
    await new Promise((r) => setTimeout(r, 400))
    window.scrollBy(0, 350)
  })
  await sleep(1200)
}

async function clickSort(page, sort) {
  const label = sort === "latest" ? "최신순" : "베스트순"
  await page.evaluate((want) => {
    const roots = [
      document.querySelector("#sdpReview"),
      document.querySelector("[class*='sdp-review']"),
      document,
    ].filter(Boolean)
    for (const root of roots) {
      const nodes = Array.from(root.querySelectorAll("button, a, span, li, label"))
      for (const el of nodes) {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim()
        if (t === want || t.includes(want)) {
          el.click()
          return true
        }
      }
    }
    return false
  }, label)
  await sleep(PAGE_SWITCH_MS + 400)
}

async function clickPageNumber(page, n) {
  const result = await page.evaluate((pageNum) => {
    const root =
      document.querySelector("#sdpReview") ||
      document.querySelector("[class*='sdp-review']") ||
      document
    const want = String(pageNum)
    const nodes = Array.from(root.querySelectorAll("button, a, span, li, div"))
    for (const el of nodes) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim()
      if (t !== want) continue
      const disabled =
        el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled") ||
        /disabled|is-disabled/i.test(el.className || "")
      if (disabled) return "disabled"
      el.click()
      return "clicked"
    }
    return "missing"
  }, n)
  if (result === "clicked") await sleep(PAGE_SWITCH_MS + 300)
  return result
}

/** 브라우저 세션 쿠키로 next-api 리뷰 JSON 수집 (DOM보다 안정적) */
async function fetchReviewsViaApi(page, productUrl, sort, maxPages) {
  const productId = extractProductId(productUrl)
  if (!productId) return { reviews: [], productName: "", source: "api", ok: false }

  return page.evaluate(
    async ({ productId, sort, maxPages }) => {
      const decode = (s) =>
        String(s || "")
          .replace(/\s+/g, " ")
          .trim()

      const productName = (() => {
        const h1 = document.querySelector("h1")
        if (h1?.textContent) return decode(h1.textContent)
        const og = document.querySelector('meta[property="og:title"]')
        return decode(og?.getAttribute("content") || document.title || "").replace(/\s*\|.*$/, "")
      })()

      const sortCandidates =
        sort === "latest"
          ? ["DATE_DESC", "ORDER_SCORE_ASC", "HELPFUL_DESC"]
          : ["ORDER_SCORE_DESC", "ORDER_SCORE_ASC", "HELPFUL_DESC", "DATE_DESC"]

      const flatten = (node, out = []) => {
        if (!node) return out
        if (Array.isArray(node)) {
          for (const x of node) flatten(x, out)
          return out
        }
        if (typeof node !== "object") return out
        const content =
          node.content ||
          node.reviewContent ||
          node.reviewText ||
          node.review ||
          node.comment ||
          node.text ||
          node.title ||
          node.headline
        if (typeof content === "string" && content.trim().length >= 5) {
          out.push(node)
          return out
        }
        for (const k of Object.keys(node)) {
          if (
            /review|rData|datalist|list|items|contents/i.test(k) &&
            (Array.isArray(node[k]) || typeof node[k] === "object")
          ) {
            flatten(node[k], out)
          }
        }
        return out
      }

      const normalize = (r) => {
        const content = decode(
          r.content || r.reviewContent || r.reviewText || r.review || r.comment || r.text || r.title || r.headline || ""
        )
        if (content.length < 5) return null
        const author = decode(
          r.memberDisplayName || r.displayName || r.userName || r.writerName || r.author || r.name || ""
        )
        let rating =
          r.rating ?? r.ratingAverage ?? r.starRating ?? r.ratingStar ?? r.reviewRating ?? undefined
        if (typeof rating === "string") rating = Number(rating)
        if (typeof rating !== "number" || Number.isNaN(rating)) rating = undefined
        const date = decode(
          r.date || r.reviewAt || r.createdAt || r.regDate || r.writeDate || r.updatedAt || ""
        )
        const imageCandidates = []
        const pushImg = (u) => {
          if (typeof u !== "string") return
          const src = u.trim()
          if (!/^https?:\/\//i.test(src)) return
          imageCandidates.push(src.split("?")[0] || src)
        }
        for (const key of ["images", "imageList", "reviewImages", "attachImages", "attachments", "photos"]) {
          const val = r[key]
          if (Array.isArray(val)) {
            for (const item of val) {
              if (typeof item === "string") pushImg(item)
              else if (item && typeof item === "object") {
                pushImg(item.url || item.src || item.originUrl || item.imageUrl || item.originalUrl)
              }
            }
          }
        }
        const images = Array.from(new Set(imageCandidates)).slice(0, 6)
        return {
          author: author || undefined,
          rating,
          content,
          date: date || undefined,
          images: images.length ? images : undefined,
        }
      }

      const all = []
      let usedSort = sortCandidates[0]
      for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
        let pageItems = []
        for (const sortBy of sortCandidates) {
          const urls = [
            `https://www.coupang.com/next-api/review?productId=${productId}&page=${pageNo}&size=20&sortBy=${sortBy}&ratingSummary=true&ratings=&market=`,
            `https://www.coupang.com/next-api/review?productId=${productId}&page=${pageNo}&size=30&sortBy=${sortBy}`,
          ]
          for (const url of urls) {
            try {
              const res = await fetch(url, {
                credentials: "include",
                headers: {
                  Accept: "application/json, text/plain, */*",
                  "X-Requested-With": "XMLHttpRequest",
                },
              })
              if (!res.ok) continue
              const data = await res.json()
              const raw = flatten(data)
              const mapped = raw.map(normalize).filter(Boolean)
              if (mapped.length) {
                pageItems = mapped
                usedSort = sortBy
                break
              }
            } catch {
              /* try next */
            }
          }
          if (pageItems.length) break
        }
        if (!pageItems.length) break
        all.push(...pageItems)
      }

      return {
        productName,
        reviews: all,
        source: "api",
        ok: all.length > 0,
        sortBy: usedSort,
        reviewCountText: all.length ? `${all.length}개 수집` : "",
        noReviews: false,
      }
    },
    { productId, sort, maxPages }
  )
}

async function snapshotReviews(page) {
  return page.evaluate(() => {
    const decode = (s) =>
      String(s || "")
        .replace(/\s+/g, " ")
        .trim()

    const productName = (() => {
      const h1 = document.querySelector("h1")
      if (h1?.textContent) return decode(h1.textContent)
      const og = document.querySelector('meta[property="og:title"]')
      return decode(og?.getAttribute("content") || document.title || "").replace(/\s*\|.*$/, "")
    })()

    const roots = [
      document.querySelector("#sdpReview"),
      document.querySelector("[id*='sdpReview']"),
      document.querySelector("[class*='sdp-review']"),
      document.querySelector("[class*='ProductReview']"),
      document.body,
    ].filter(Boolean)

    let reviewCountText = ""
    for (const root of roots) {
      const t = root.innerText || ""
      const countMatch = t.match(/([\d,]+)\s*개\s*상품평/) || t.match(/상품평\s*\(?([\d,]+)\)?/)
      if (countMatch) {
        reviewCountText = countMatch[0]
        break
      }
    }

    // empty 판정은 리뷰 루트 안에서만 (본문 다른 문구 오탐 방지)
    const reviewRoot =
      document.querySelector("#sdpReview") || document.querySelector("[class*='sdp-review']")
    const rootText = reviewRoot?.innerText || ""
    if (
      reviewRoot &&
      /등록된\s*상품평이\s*없습니다|아직\s*작성된\s*상품평이\s*없습니다/.test(rootText) &&
      !/도움이\s*돼요/.test(rootText)
    ) {
      return { productName, reviewCountText, reviews: [], noReviews: true, source: "dom" }
    }

    const nodeSet = new Set()
    const selectors = [
      ".sdp-review__article__list__review",
      ".sdp-review__article__list article",
      ".sdp-review__article__list > li",
      ".sdp-review__article__list__review__content",
      ".js_reviewArticleReviewList > li",
      "[data-review-id]",
      "article",
      "[class*='ReviewArticle']",
      "[class*='review-article']",
    ]
    for (const root of roots) {
      for (const sel of selectors) {
        root.querySelectorAll(sel).forEach((n) => {
          // content 노드면 카드 루트로 올림
          let card = n
          if (/content/i.test(n.className || "") || sel.includes("content")) {
            card =
              n.closest("article, li, [class*='review__article'], [class*='ReviewArticle']") ||
              n.parentElement ||
              n
          }
          nodeSet.add(card)
        })
      }
    }

    // 화면에 보이는 "도움이 돼요" 버튼 기준으로 카드 추정 (최신 UI)
    for (const el of document.querySelectorAll("button, a, span, div")) {
      const t = decode(el.textContent)
      if (t !== "도움이 돼요" && !/^도움이\s*돼요/.test(t)) continue
      let cur = el
      for (let i = 0; i < 8 && cur; i++) {
        const txt = decode(cur.textContent)
        if (txt.length > 60 && /20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/.test(txt)) {
          nodeSet.add(cur)
          break
        }
        cur = cur.parentElement
      }
    }

    const reviews = []
    for (const node of nodeSet) {
      if (!node || node === document.body) continue
      const text = decode(node.textContent)
      if (text.length < 20) continue
      if (!/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}|도움이\s*돼요|판매자:/.test(text) && text.length < 40) continue

      let content = ""
      const contentEl =
        node.querySelector(
          ".sdp-review__article__list__review__content, [class*='review__content'], [class*='ReviewContent'], [class*='content__text']"
        ) || null
      if (contentEl) content = decode(contentEl.textContent)

      // 제목(볼드) + 본문
      const titleEl =
        node.querySelector(
          ".sdp-review__article__list__headline, [class*='headline'], [class*='title']"
        ) || null
      const title = titleEl ? decode(titleEl.textContent) : ""
      if (!content) {
        // 노이즈 제거 후 본문 추정
        content = text
          .replace(/도움이\s*돼요/g, " ")
          .replace(/신고하기/g, " ")
          .replace(/판매자:\s*[^\n]+/g, " ")
          .replace(/베스트순|최신순|모든 별점|검색어를 입력하세요/g, " ")
          .replace(/신선도|맛 만족도|아주 신선해요|맛있어요/g, " ")
          .replace(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }
      if (title && content && !content.includes(title)) content = `${title} ${content}`.trim()
      else if (title && !content) content = title
      if (content.length < 8) continue

      let author = ""
      const authorEl = node.querySelector(
        ".sdp-review__article__list__info__user__name, [class*='user__name'], [class*='UserName'], [class*='info__user']"
      )
      if (authorEl) author = decode(authorEl.textContent).slice(0, 40)
      if (!author) {
        const am = text.match(/^([가-힣A-Za-z*]{1,20})/)
        if (am) author = am[1]
      }

      let date = ""
      const dm = text.match(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/)
      if (dm) date = dm[0].replace(/\s+/g, "")

      let rating
      const rated = node.querySelector(
        "[aria-label*='별'], [aria-label*='점'], [aria-label*='rating'], [aria-label*='star']"
      )
      const aria = rated?.getAttribute("aria-label") || ""
      const ratingMatch = aria.match(/(\d+(?:\.\d+)?)/)
      if (ratingMatch) rating = Number(ratingMatch[1])
      if (rating == null) {
        const stars = node.querySelectorAll(
          "[class*='star--on'], [class*='star-on'], [class*='filled'], [class*='twinkle']"
        )
        if (stars.length > 0 && stars.length <= 5) rating = stars.length
      }

      const images = []
      const imgNodes = node.querySelectorAll(
        "img[src], img[data-src], img[data-lazy-src], img[data-original]"
      )
      for (const img of imgNodes) {
        const raw =
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("src") ||
          ""
        const src = String(raw).trim()
        if (!/^https?:\/\//i.test(src)) continue
        if (/sprite|icon|logo|blank|1x1|avatar|profile/i.test(src)) continue
        images.push(src.split("?")[0] || src)
      }

      reviews.push({
        author: author || undefined,
        rating,
        content: content.slice(0, 2000),
        date: date || undefined,
        images: images.length ? Array.from(new Set(images)).slice(0, 6) : undefined,
      })
    }

    return {
      productName,
      reviewCountText,
      reviews,
      noReviews: false,
      source: "dom",
      debugCardCount: nodeSet.size,
    }
  })
}

async function snapshotWithRetry(page) {
  let last = { productName: "", reviewCountText: "", reviews: [], noReviews: false }
  for (let i = 0; i < SNAPSHOT_RETRIES + 4; i++) {
    // lazy load 유도
    await page.evaluate(() => window.scrollBy(0, 220)).catch(() => null)
    last = await snapshotReviews(page)
    if (last.noReviews || last.reviews.length > 0) return last
    await sleep(SNAPSHOT_RETRY_MS + 200)
  }
  return last
}

function dedupeReviews(list) {
  const seen = new Set()
  const out = []
  for (const r of list) {
    const key = `${(r.content || "").slice(0, 120)}|${r.date || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
    if (out.length >= MAX_REVIEWS) break
  }
  return out
}

async function runSession(args) {
  // Playwright로 URL을 열지 않음. 상품 URL 자동 이동 금지(Access Denied 유발).
  void args
  try {
    const browserInfo = resolveSystemBrowser()
    if (!browserInfo) {
      emit({
        status: "dependency_missing",
        message: "PC에 Chrome 또는 Edge가 필요합니다. Google Chrome을 설치한 뒤 다시 시도하세요.",
      })
      return 2
    }
    const userDataDir = profileDir(browserInfo.channel)
    fs.mkdirSync(userDataDir, { recursive: true })

    const prev = readCdpMeta(userDataDir)
    if (prev?.port && (await probeCdp(prev.port))) {
      emit({
        status: "session_ready",
        message:
          "이미 쿠팡용 Chrome이 열려 있습니다. 주소창에 상품 URL을 직접 붙여넣고, 상품평이 보이면 창을 닫지 말고 「상품평 가져오기」를 누르세요. (자동 이동하지 않습니다)",
        channel: browserInfo.channel,
        profileDir: userDataDir,
        cdpPort: prev.port,
      })
      return 0
    }

    // CDP는 켜 두되, 시작 URL은 홈만. Playwright goto 없음.
    const port = await getFreePort()
    spawnChromeProcess({
      exe: browserInfo.exe,
      userDataDir,
      port,
      startUrl: "https://www.coupang.com/",
    })
    try {
      await waitForCdp(port)
      writeCdpMeta(userDataDir, { port, channel: browserInfo.channel, mode: "session", pidHint: Date.now() })
    } catch (e) {
      emit({
        status: "profile_locked",
        message:
          "Chrome을 열지 못했습니다. 이전에 연 ShotForm 쿠팡 Chrome 창을 모두 닫고 다시 시도하세요.",
        detail: e instanceof Error ? e.message : String(e),
      })
      return 3
    }

    emit({
      status: "session_ready",
      message:
        "멈춘 게 아닙니다. 쿠팡 홈만 연 상태입니다. Chrome 주소창에 상품 URL을 붙여넣으세요(Ctrl+V). 상품평이 보이면 창을 닫지 말고 「상품평 가져오기」를 누르세요.",
      channel: browserInfo.channel,
      profileDir: userDataDir,
      cdpPort: port,
    })
    return 0
  } catch (e) {
    emit({ status: "failed", message: e instanceof Error ? e.message : String(e) })
    return 1
  }
}

async function runCollect(args) {
  if (!args.url || !isCoupangUrl(args.url)) {
    emit({ status: "failed", message: "유효한 쿠팡 상품 URL이 필요합니다." })
    return 1
  }

  const pw = await loadPlaywright()
  if (!pw) {
    emit({ status: "dependency_missing", message: "playwright 패키지가 없습니다. npm run shotform:install-coupang" })
    return 2
  }

  let browser
  let context
  let channel = "chrome"
  try {
    // 세션 Chrome이 열려 있으면 재사용, 없으면 새로 spawn
    ;({ browser, context, channel } = await openViaSystemChrome(pw, {
      startUrl: "https://www.coupang.com/",
      reuseOnly: false,
    }))
  } catch (e) {
    if (e?.code === "no_system_browser") {
      emit({
        status: "dependency_missing",
        message: "PC에 Chrome 또는 Edge가 필요합니다. Google Chrome 설치 후 「쿠팡 세션(로그인)」부터 진행하세요.",
      })
      return 2
    }
    if (e?.code === "profile_locked") {
      emit({
        status: "profile_locked",
        message: "쿠팡 Chrome 프로필이 잠겼습니다. 열린 쿠팡 Chrome 창을 닫거나, 「쿠팡 세션」으로 연 창을 유지한 채 다시 시도하세요.",
        detail: e.detail || (e instanceof Error ? e.message : String(e)),
      })
      return 3
    }
    emit({ status: "failed", message: e instanceof Error ? e.message : String(e) })
    return 1
  }

  try {
    // 절대 product URL로 page.goto 하지 않음 — 사용자가 연 탭에서만 읽음
    let page = await waitForReviewablePage(context, args.url, 8_000)
    if (!page) {
      // 짧은 대기: 사용자가 세션 창에서 상품평을 열고 버튼을 누른 경우
      page = await waitForReviewablePage(context, args.url, 150_000)
    }
    if (!page) {
      await closeBrowserSoft(browser, { killChrome: false })
      emit({
        status: "blocked",
        message:
          "상품평이 보이는 페이지를 찾지 못했습니다. Chrome 주소창에 상품 URL을 직접 붙여넣어 상품평이 보이게 한 뒤(Access Denied면 수동 통과), 창을 유지한 채 「상품평 가져오기」를 다시 누르세요. 도구는 상품 URL로 자동 이동하지 않습니다.",
        productUrl: args.url,
        channel,
      })
      return 4
    }

    await clickReviewTab(page)
    await clickSort(page, args.sort)

    // 1순위: next-api JSON (DOM 클래스 변경에 덜 민감)
    const apiSnap = await fetchReviewsViaApi(page, args.url, args.sort, args.maxPages)
    let all = Array.isArray(apiSnap?.reviews) ? [...apiSnap.reviews] : []
    let productName = apiSnap?.productName || ""
    let reviewCountText = apiSnap?.reviewCountText || ""
    let source = apiSnap?.ok ? "api" : "dom"
    let noReviews = false

    // 2순위: DOM 파싱 (도움이 돼요 / sdp-review 카드)
    if (all.length === 0) {
      for (let p = 1; p <= args.maxPages; p++) {
        if (p > 1) {
          const nav = await clickPageNumber(page, p)
          if (nav === "disabled" || nav === "missing") break
        }
        const snap = await snapshotWithRetry(page)
        if (snap.productName) productName = snap.productName
        if (snap.reviewCountText) reviewCountText = snap.reviewCountText
        if (snap.noReviews && p === 1 && !(snap.reviews || []).length) {
          noReviews = true
          break
        }
        all.push(...(snap.reviews || []))
      }
    }

    const reviews = dedupeReviews(all)
    const reviewImages = []
    const seenImg = new Set()
    for (const r of reviews) {
      for (const u of r.images || []) {
        if (typeof u !== "string" || !/^https?:\/\//i.test(u)) continue
        if (seenImg.has(u)) continue
        seenImg.add(u)
        reviewImages.push(u)
      }
    }
    await closeBrowserSoft(browser, { killChrome: false })

    if (noReviews || reviews.length === 0) {
      emit({
        status: "no_reviews",
        productName: productName || undefined,
        reviewCountText: reviewCountText || undefined,
        reviewCount: 0,
        reviews: [],
        reviewImages: [],
        productUrl: args.url,
        sort: args.sort,
        channel,
        source,
        message:
          "화면에는 상품평이 있어도 수집이 비었습니다. 상품평 영역이 보이는 Chrome 창을 유지한 채 다시 시도해 주세요.",
      })
      return 0
    }

    emit({
      status: "ready",
      productName: productName || undefined,
      reviewCountText: reviewCountText || undefined,
      reviewCount: reviews.length,
      reviews,
      reviewImages,
      productUrl: args.url,
      sort: args.sort,
      maxPages: args.maxPages,
      channel,
      source,
    })
    return 0
  } catch (e) {
    await closeBrowserSoft(browser, { killChrome: false })
    const msg = e instanceof Error ? e.message : String(e)
    if (/Timeout|timeout/i.test(msg)) {
      emit({ status: "blocked", message: "페이지 로드 타임아웃 — 차단·네트워크 문제를 확인하세요.", detail: msg })
      return 4
    }
    emit({ status: "failed", message: msg })
    return 1
  }
}

const args = parseArgs(process.argv)
const code = args.mode === "session" ? await runSession(args) : await runCollect(args)
process.exit(code)
