/**
 * Wings 「에이전트 연결」클릭 → OS별 스타터 실행 창만 연다
 */
;(function () {
  function detectOs() {
    var ua = navigator.userAgent || ""
    var platform = navigator.platform || ""
    if (/Mac|Macintosh/i.test(platform) || (/Mac OS X/i.test(ua) && !/Windows NT/i.test(ua))) {
      return "mac"
    }
    return "win"
  }

  function starterMeta() {
    var os = detectOs()
    return os === "mac"
      ? {
          os: "mac",
          file: "command",
          filename: "ShotForm/start-shotform-agent.command",
        }
      : {
          os: "win",
          file: "cmd",
          filename: "ShotForm/start-shotform-agent.cmd",
        }
  }

  function fetchTextSync(url) {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open("GET", url, false)
      xhr.send(null)
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText
    } catch {
      /* ignore */
    }
    return ""
  }

  function defaultDownloadPath() {
    var meta = starterMeta()
    return (
      "/api/shotform/local-agent/download?file=" +
      meta.file +
      "&os=" +
      meta.os
    )
  }

  function absolutize(url) {
    try {
      return new URL(url || defaultDownloadPath(), window.location.origin).href
    } catch {
      return `${window.location.origin}${defaultDownloadPath()}`
    }
  }

  function launchAgent(cmdUrl, filenameHint) {
    const meta = starterMeta()
    const url = absolutize(cmdUrl)
    const filename = filenameHint || meta.filename
    const content = fetchTextSync(url)
    try {
      if (content && /shotform-local-agent|ShotForm Local Agent/i.test(content)) {
        chrome.runtime.sendMessage({
          type: "SHOTFORM_OPEN_AGENT_DATA",
          content,
          filename,
        })
      } else {
        chrome.runtime.sendMessage({
          type: "SHOTFORM_DOWNLOAD_OPEN_AGENT",
          cmdUrl: url,
          filename,
        })
      }
    } catch {
      /* extension context invalidated */
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target?.closest?.("[data-shotform-launch-agent]")
      if (!el) return
      const meta = starterMeta()
      const cmdUrl =
        el.getAttribute("data-shotform-cmd-url") ||
        `${window.location.origin}${defaultDownloadPath()}`
      const filename =
        el.getAttribute("data-shotform-filename") || meta.filename
      launchAgent(cmdUrl, filename)
    },
    true
  )

  window.addEventListener("message", (e) => {
    if (e.source !== window) return
    if (e.data?.type !== "SHOTFORM_LAUNCH_AGENT") return
    const meta = starterMeta()
    const cmdUrl =
      typeof e.data.cmdUrl === "string" && e.data.cmdUrl
        ? e.data.cmdUrl
        : `${window.location.origin}${defaultDownloadPath()}`
    const filename =
      typeof e.data.filename === "string" && e.data.filename
        ? e.data.filename
        : meta.filename
    launchAgent(cmdUrl, filename)
  })
})()
