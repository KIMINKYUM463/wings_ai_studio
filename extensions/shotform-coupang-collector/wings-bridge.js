/**
 * Wings 숏폼 페이지 ↔ 확장 브리지
 * 「에이전트 연결」클릭 → .cmd 자동 실행 → 연결 감시 시작
 */
;(function () {
  function fetchTextSync(url) {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", url, false)
      xhr.send(null)
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText
    } catch {
      /* sync xhr blocked / network */
    }
    return ""
  }

  function absolutize(url) {
    try {
      return new URL(url || "/api/shotform/local-agent/download?file=cmd", window.location.origin)
        .href
    } catch {
      return `${window.location.origin}/api/shotform/local-agent/download?file=cmd`
    }
  }

  function launchAgent(cmdUrl) {
    const url = absolutize(cmdUrl)
    const content = fetchTextSync(url)
    try {
      if (content && /shotform-local-agent|ShotForm Local Agent/i.test(content)) {
        chrome.runtime.sendMessage({
          type: "SHOTFORM_OPEN_AGENT_DATA",
          content,
          filename: "ShotForm/start-shotform-agent.cmd",
        })
      } else {
        chrome.runtime.sendMessage({
          type: "SHOTFORM_DOWNLOAD_OPEN_AGENT",
          cmdUrl: url,
        })
      }
      chrome.runtime.sendMessage({ type: "SHOTFORM_WATCH_AGENT", maxMs: 120000 })
    } catch {
      /* extension context invalidated */
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target?.closest?.("[data-shotform-launch-agent]")
      if (!el) return
      const cmdUrl =
        el.getAttribute("data-shotform-cmd-url") ||
        `${window.location.origin}/api/shotform/local-agent/download?file=cmd`
      launchAgent(cmdUrl)
    },
    true
  )

  window.addEventListener("message", (e) => {
    if (e.source !== window) return
    if (e.data?.type === "SHOTFORM_LAUNCH_AGENT") {
      const cmdUrl =
        typeof e.data.cmdUrl === "string" && e.data.cmdUrl
          ? e.data.cmdUrl
          : `${window.location.origin}/api/shotform/local-agent/download?file=cmd`
      launchAgent(cmdUrl)
      return
    }
    if (e.data?.type === "SHOTFORM_AGENT_CONNECTED") {
      try {
        chrome.runtime.sendMessage({
          type: "SHOTFORM_AGENT_CONNECTED",
          base: e.data.base || "http://127.0.0.1:3847",
        })
      } catch {
        /* ignore */
      }
    }
  })
})()
