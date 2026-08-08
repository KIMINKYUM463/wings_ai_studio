const $ = (id) => document.getElementById(id)
const logEl = $("log")
const agentStatus = $("agentStatus")

function log(msg) {
  logEl.textContent = msg
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function isCoupangProductTab(tab) {
  const url = tab?.url || ""
  return /https?:\/\/(www\.)?coupang\.com\//i.test(url)
}

async function ensureContentScripts(tabId) {
  // content script가 없는 탭(이미 열린 페이지) 대비 주입
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["collect.js", "content.js"],
    })
  } catch {
    /* already injected or restricted */
  }
}

async function collectFromTab(tab, maxReviews, reviewPhotosOnly = false) {
  await ensureContentScripts(tab.id)
  const res = await chrome.tabs.sendMessage(tab.id, {
    type: "SHOTFORM_COLLECT",
    maxReviews,
    reviewPhotosOnly,
  })
  if (!res?.ok) throw new Error(res?.error || "수집 실패")
  return res.data
}

async function loadAgentUrl() {
  const stored = await chrome.storage.sync.get(["agentUrl"])
  $("agentUrl").value = stored.agentUrl || "http://127.0.0.1:3847"
}

async function saveAgentUrl() {
  const url = ($("agentUrl").value || "http://127.0.0.1:3847").replace(/\/$/, "")
  await chrome.runtime.sendMessage({ type: "SHOTFORM_SET_AGENT", agentUrl: url })
  return url
}

function applyProbeUi(res, opts = {}) {
  if (res?.ok) {
    agentStatus.textContent = "연결됨"
    agentStatus.className = "pill ok"
    if (!opts.silent) log(`에이전트 OK: ${res.base || "http://127.0.0.1:3847"}`)
  } else {
    agentStatus.textContent = "끊김"
    agentStatus.className = "pill bad"
    if (!opts.silent) {
      log(
        `에이전트 대기 중 (${res?.base || "http://127.0.0.1:3847"})\n` +
          `Wings 「에이전트 연결」또는 아래 「에이전트 자동 실행」을 누르면 창이 뜹니다.\n` +
          `${res?.error || ""}`
      )
    }
  }
}

async function probe(opts = {}) {
  await saveAgentUrl()
  if (!opts.silent) {
    agentStatus.textContent = "확인 중…"
    agentStatus.className = "pill"
  }
  const res = await chrome.runtime.sendMessage({ type: "SHOTFORM_PROBE_AGENT" })
  applyProbeUi(res, opts)
  return res
}

async function startAgentFromPopup() {
  const wingsOrigin = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs?.[0]?.url || ""
      try {
        resolve(new URL(url).origin)
      } catch {
        resolve("")
      }
    })
  })
  // Wings 탭이 아니면 기본 배포/로컬 추정 불가 → 사용자에게 Wings에서 누르라고 안내
  const cmdUrl = wingsOrigin.includes("localhost") || wingsOrigin.includes("vercel.app")
    ? `${wingsOrigin}/api/shotform/local-agent/download?file=cmd`
    : ""
  if (!cmdUrl) {
    log(
      "Wings 숏폼 탭(배포 사이트 또는 localhost)을 연 뒤\n「에이전트 자동 실행」을 다시 누르거나,\nWings의 「에이전트 연결」을 사용하세요."
    )
    return
  }
  $("btnStartAgent").disabled = true
  log("실행 파일을 받아 자동으로 여는 중…\n연결 확인도 자동으로 반복합니다.")
  try {
    const res = await chrome.runtime.sendMessage({
      type: "SHOTFORM_DOWNLOAD_OPEN_AGENT",
      cmdUrl,
    })
    if (!res?.ok) throw new Error(res?.error || "실행 실패")
    chrome.runtime.sendMessage({ type: "SHOTFORM_WATCH_AGENT", maxMs: 120000 })
    log(
      res.opened
        ? "에이전트 창을 열었습니다. 연결될 때까지 자동 확인 중…"
        : "다운로드됨. Chrome 알림 「지금 실행」을 누르거나 잠시 기다려 주세요."
    )
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      const health = await probe({ silent: true })
      if (health?.ok) {
        log(`연결됨: ${health.base}\n이제 상품 페이지에서 수집하세요.`)
        return
      }
    }
    log("아직 연결되지 않았습니다. Node.js 설치 여부와 검은 창을 확인하세요.")
  } catch (e) {
    log(e instanceof Error ? e.message : String(e))
  } finally {
    $("btnStartAgent").disabled = false
  }
}

function summarizeCollect(slim, data) {
  const detailImages = Array.isArray(slim.detailImages) ? slim.detailImages : []
  const base =
    `수집 완료: 리뷰 ${slim.reviewCount}개 · 리뷰사진 ${slim.reviewImages.length}장 · 상품상세 ${detailImages.length}장` +
    ` · 갤러리후보 ${data.productImageCount || data.productImages?.length || 0}장\n상품: ${slim.productName || "-"}`
  if (!detailImages.length) {
    return (
      `${base}\n\n⚠️ 상품상세 이미지 0장\n` +
      `「상품상세」탭 → 「상세정보 더보기」로 상세컷이 보이게 스크롤한 뒤 다시 수집하세요.`
    )
  }
  return base
}

async function copySlimJson(slim) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(slim, null, 2))
    return true
  } catch {
    return false
  }
}

async function collectAndSend() {
  const tab = await getActiveTab()
  if (!isCoupangProductTab(tab)) {
    log("쿠팡 상품 페이지 탭에서 실행하세요.\n예: https://www.coupang.com/vp/products/...")
    return
  }
  if (/Access Denied|edgesuite/i.test(tab.title || "")) {
    log(
      "지금 탭이 Access Denied(차단) 화면입니다.\n탭을 닫고 10~30분 뒤 쿠팡을 다시 연 다음,\n상품 페이지가 정상일 때만 수집하세요."
    )
    return
  }

  const maxReviews = Number($("maxReviews").value) || 20
  $("btnCollect").disabled = true
  log("상품·상세 이미지·리뷰·리뷰 사진을 한번에 수집 중…\n리뷰 페이지를 이동하므로 잠시 기다려주세요.")

  try {
    await saveAgentUrl()
    const data = await collectFromTab(tab, maxReviews)
    const n = data.reviews?.length || 0

    if (!n && !data.productName) {
      throw new Error(
        "상품/리뷰를 전혀 읽지 못했습니다.\n쿠팡 상품 상세(vp/products/...) 페이지인지 확인하세요."
      )
    }

    const detailImages = Array.isArray(data.detailImages) ? data.detailImages : []
    const reviews = (data.reviews || [])
      .map((review) => ({
        content: String(review.content || "").trim(),
        page: review.page,
        indexOnPage: review.indexOnPage,
        images: Array.isArray(review.images) ? review.images.filter(Boolean) : [],
      }))
      .filter((review) => review.content.length >= 2)
    const slim = {
      productName: data.productName || "",
      price: data.price || data.productPrice || "",
      productPrice: data.price || data.productPrice || "",
      delivery: data.delivery || data.productDelivery || "",
      productDelivery: data.delivery || data.productDelivery || "",
      images: Array.isArray(data.images) ? data.images : [],
      detailImages,
      productImage: data.productImage || detailImages[0] || "",
      productUrl: data.productUrl || "",
      reviews,
      reviewImages: Array.from(
        new Set([
          ...(Array.isArray(data.reviewImages) ? data.reviewImages : []),
          ...reviews.flatMap((review) => review.images),
        ])
      ),
      reviewCount: 0,
      source: "chrome-extension",
      at: new Date().toISOString(),
    }
    slim.reviewCount = slim.reviews.length

    // 에이전트는 선택 사항. 끊겨 있어도 페이지 수집 + JSON 복사로 완료 처리
    const probe = await chrome.runtime.sendMessage({ type: "SHOTFORM_PROBE_AGENT" })
    if (probe?.ok) {
      agentStatus.textContent = "연결됨"
      agentStatus.className = "pill ok"
      const ingest = await chrome.runtime.sendMessage({
        type: "SHOTFORM_INGEST",
        payload: slim,
      })
      if (ingest?.ok) {
        log(
          `${summarizeCollect(slim, data)}\n\n에이전트 전송 완료 → Wings 숏폼 「전송된 리뷰 불러오기」`
        )
        return
      }
    } else {
      agentStatus.textContent = "끊김"
      agentStatus.className = "pill bad"
    }

    const copied = await copySlimJson(slim)
    log(
      `${summarizeCollect(slim, data)}\n\n` +
        (copied
          ? "에이전트 없이 완료 · JSON이 클립보드에 복사됐습니다.\n" +
            "배포/다른 PC에서는 이게 정상입니다.\n\n" +
            "Wings 숏폼 → 「JSON 붙여넣기」칸에 Ctrl+V → 「JSON 적용」"
          : "에이전트 없이 수집은 됐지만 클립보드 복사에 실패했습니다.\n" +
            "「JSON 클립보드 복사」 버튼을 한 번 더 눌러 주세요.")
    )
  } catch (e) {
    log(e instanceof Error ? e.message : String(e))
  } finally {
    $("btnCollect").disabled = false
  }
}

async function copyJsonOnly() {
  const tab = await getActiveTab()
  if (!isCoupangProductTab(tab)) {
    log("쿠팡 상품 페이지 탭에서 실행하세요.")
    return
  }
  $("btnCopy").disabled = true
  try {
    const maxReviews = Number($("maxReviews").value) || 20
    const data = await collectFromTab(tab, maxReviews)
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    log(
      `JSON ${data.reviews?.length || 0}개 리뷰를 클립보드에 복사했습니다.\n\nWings 숏폼 → 쿠팡 수집기 → 「JSON 붙여넣기」칸에 붙여넣고 「JSON 적용」`
    )
  } catch (e) {
    log(e instanceof Error ? e.message : String(e))
  } finally {
    $("btnCopy").disabled = false
  }
}

$("btnProbe").addEventListener("click", () => void probe())
$("btnStartAgent").addEventListener("click", () => void startAgentFromPopup())
$("btnCollect").addEventListener("click", () => void collectAndSend())
$("btnCopy").addEventListener("click", () => void copyJsonOnly())

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.agentOnline) return
  if (changes.agentOnline.newValue) {
    agentStatus.textContent = "연결됨"
    agentStatus.className = "pill ok"
    log(`에이전트 연결됨 (자동 확인)\n${changes.agentBase?.newValue || "http://127.0.0.1:3847"}`)
  }
})

void loadAgentUrl().then(async () => {
  const stored = await chrome.storage.local.get(["agentOnline", "agentBase"])
  if (stored.agentOnline) {
    applyProbeUi({ ok: true, base: stored.agentBase }, { silent: true })
  }
  await probe({ silent: Boolean(stored.agentOnline) })
  // 팝업이 열려 있는 동안 자동 연결 확인
  window.setInterval(() => void probe({ silent: true }), 2000)
})
