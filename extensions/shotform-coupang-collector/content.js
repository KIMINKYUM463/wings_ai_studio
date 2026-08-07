/**
 * content script — 백그라운드/팝업 요청에 응답
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "SHOTFORM_COLLECT") return

  ;(async () => {
    try {
      if (typeof window.__shotformCollectCoupang !== "function") {
        sendResponse({ ok: false, error: "수집 스크립트가 로드되지 않았습니다. 페이지를 새로고침하세요." })
        return
      }
      const data = await window.__shotformCollectCoupang({
        maxReviews: msg.maxReviews || 20,
        reviewPhotosOnly: Boolean(msg.reviewPhotosOnly),
      })
      sendResponse({ ok: true, data })
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })()

  return true // async
})
