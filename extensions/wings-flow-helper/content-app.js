// 윙즈 앱 페이지 ↔ 확장 다리 (window.postMessage)
// app→ext: {source:'wings-app', type:'ping'|'flow-job', job}
// ext→app: {source:'wings-flow-helper', type:'hello'|'job-accepted'|'job-error'|'video-result', ...}
;(function () {
  const OUT = "wings-flow-helper"
  const post = (data, transfer) => window.postMessage({ source: OUT, ...data }, window.location.origin, transfer || [])

  post({ type: "hello", version: chrome.runtime.getManifest().version })

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    const data = event.data
    if (!data || data.source !== "wings-app") return
    if (data.type === "ping") {
      post({ type: "hello", version: chrome.runtime.getManifest().version })
      return
    }
    if (data.type === "flow-job") {
      chrome.runtime.sendMessage({ type: "flow-job", job: data.job }, (res) => {
        const err = chrome.runtime.lastError?.message || (res && !res.ok ? res.error : "")
        if (err) post({ type: "job-error", jobId: data.job?.jobId, error: err })
        else post({ type: "job-accepted", jobId: data.job?.jobId, sceneIndex: data.job?.sceneIndex })
      })
    }
  })

  // 영상은 base64 조각으로 들어온다 → 모아서 ArrayBuffer 로 앱에 넘긴다(transfer)
  const pending = new Map()
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "video-chunk") return
    let entry = pending.get(msg.jobId)
    if (!entry || msg.index === 0) {
      entry = { parts: [], total: msg.total }
      pending.set(msg.jobId, entry)
    }
    entry.parts[msg.index] = msg.b64
    if (msg.index === msg.total - 1) {
      pending.delete(msg.jobId)
      const bin = atob(entry.parts.join(""))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      post(
        { type: "video-result", jobId: msg.jobId, sceneIndex: msg.sceneIndex, mime: msg.mime || "video/mp4", videoBuffer: bytes.buffer },
        [bytes.buffer]
      )
    }
    sendResponse({ ok: true })
  })
})()
