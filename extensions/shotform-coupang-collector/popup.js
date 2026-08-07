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

async function probe() {
  await saveAgentUrl()
  agentStatus.textContent = "확인 중…"
  agentStatus.className = "pill"
  const res = await chrome.runtime.sendMessage({ type: "SHOTFORM_PROBE_AGENT" })
  if (res?.ok) {
    agentStatus.textContent = "연결됨"
    agentStatus.className = "pill ok"
    log(`에이전트 OK: ${res.base}`)
  } else {
    agentStatus.textContent = "끊김"
    agentStatus.className = "pill bad"
    log(
      `에이전트 연결 실패 (${res?.base || ""})\n프로젝트에서 npm run shotform:local-agent 실행 후 다시 확인하세요.\n${res?.error || ""}`
    )
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

    const ingest = await chrome.runtime.sendMessage({
      type: "SHOTFORM_INGEST",
      payload: slim,
    })
    if (!ingest?.ok) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(slim, null, 2))
      } catch {
        /* ignore */
      }
      throw new Error(
        `${ingest?.error || "전송 실패"}\n\n로컬 에이전트를 재시작(npm run shotform:local-agent)한 뒤 다시 시도하세요.\nJSON은 클립보드에 복사됐습니다.`
      )
    }

    if (!detailImages.length) {
      log(
        `전송 완료: 리뷰 ${slim.reviewCount}개 · 리뷰사진 ${slim.reviewImages.length}장\n⚠️ 상품상세 이미지 0장\n\n상단 대표 사진(갤러리)은 가져오지 않습니다.\n「상품상세」탭 → 「상세정보 더보기」로\n상세컷이 보이게 스크롤한 뒤 다시 수집하세요.\n\n상품: ${slim.productName || "-"}`
      )
    } else {
      log(
        `전송 완료: 리뷰 ${slim.reviewCount}개 · 리뷰사진 ${slim.reviewImages.length}장 · 갤러리후보 ${data.productImageCount || data.productImages?.length || 0}장 · 상품상세 ${detailImages.length}장\n상품: ${slim.productName || "-"}\n\nWings 숏폼 → 「전송된 리뷰 불러오기」\n(제품 1·2번은 AI가 선정)`
      )
    }
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
$("btnCollect").addEventListener("click", () => void collectAndSend())
$("btnCopy").addEventListener("click", () => void copyJsonOnly())

void loadAgentUrl().then(() => probe())
