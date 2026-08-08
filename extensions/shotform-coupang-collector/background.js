/**
 * MV3 service worker — 에이전트 .cmd 자동 실행 + 연결 상태 감시
 */

const DEFAULT_AGENT = "http://127.0.0.1:3847"
let pendingOpenDownloadId = null
let watchTimer = null
let watchUntil = 0

async function getAgentBase() {
  const stored = await chrome.storage.sync.get(["agentUrl"])
  return (stored.agentUrl || DEFAULT_AGENT).replace(/\/$/, "")
}

async function ingestToAgent(payload) {
  const base = await getAgentBase()
  const res = await fetch(`${base}/coupang/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || json.message || `에이전트 응답 ${res.status}`)
  }
  return json
}

async function probeAgent() {
  const base = await getAgentBase()
  try {
    const res = await fetch(`${base}/health`, { method: "GET", cache: "no-store" })
    const json = await res.json().catch(() => ({}))
    return { ok: Boolean(res.ok && json.ok), base, detail: json }
  } catch (e) {
    return { ok: false, base, error: e instanceof Error ? e.message : String(e) }
  }
}

async function setAgentOnlineState(online, base) {
  await chrome.storage.local.set({
    agentOnline: Boolean(online),
    agentBase: base || DEFAULT_AGENT,
    agentCheckedAt: Date.now(),
  })
  try {
    if (online) {
      await chrome.action.setBadgeText({ text: "ON" })
      await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" })
      await chrome.action.setTitle({ title: "Wings 수집기 · 에이전트 연결됨" })
    } else {
      await chrome.action.setBadgeText({ text: "" })
      await chrome.action.setTitle({ title: "Wings 숏폼 쿠팡 수집기" })
    }
  } catch {
    /* ignore */
  }
}

function stopWatch() {
  if (watchTimer) {
    clearInterval(watchTimer)
    watchTimer = null
  }
  watchUntil = 0
}

/** 에이전트가 뜰 때까지 자동 연결 확인 */
function watchAgentUntilOnline(maxMs = 120000) {
  stopWatch()
  watchUntil = Date.now() + maxMs
  const tick = async () => {
    if (Date.now() > watchUntil) {
      stopWatch()
      return
    }
    const res = await probeAgent()
    if (res.ok) {
      await setAgentOnlineState(true, res.base)
      stopWatch()
      try {
        chrome.notifications.create(`shotform-online-${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "ShotForm 에이전트 연결됨",
          message: `${res.base} · 이제 수집·전송할 수 있습니다.`,
          priority: 1,
        })
      } catch {
        /* ignore */
      }
      return
    }
    await setAgentOnlineState(false, res.base)
  }
  void tick()
  watchTimer = setInterval(() => void tick(), 1500)
}

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function waitDownloadComplete(downloadId, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.downloads.onChanged.removeListener(onChanged)
      reject(new Error("다운로드 시간 초과"))
    }, timeoutMs)

    function onChanged(delta) {
      if (delta.id !== downloadId) return
      if (delta.state?.current === "complete") {
        clearTimeout(timer)
        chrome.downloads.onChanged.removeListener(onChanged)
        resolve()
      }
      if (delta.state?.current === "interrupted") {
        clearTimeout(timer)
        chrome.downloads.onChanged.removeListener(onChanged)
        reject(new Error("다운로드가 중단되었습니다."))
      }
    }

    chrome.downloads.onChanged.addListener(onChanged)
    chrome.downloads.search({ id: downloadId }, (items) => {
      const item = items?.[0]
      if (item?.state === "complete") {
        clearTimeout(timer)
        chrome.downloads.onChanged.removeListener(onChanged)
        resolve()
      }
    })
  })
}

function openDownload(downloadId) {
  return new Promise((resolve) => {
    try {
      chrome.downloads.open(downloadId, () => {
        const err = chrome.runtime.lastError?.message || ""
        resolve(err ? { ok: false, error: err } : { ok: true })
      })
    } catch (e) {
      resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

async function notifyOpenFallback(downloadId) {
  pendingOpenDownloadId = downloadId
  try {
    await chrome.notifications.create(`shotform-agent-${downloadId}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "ShotForm 로컬 에이전트",
      message: "실행 창이 안 뜨면 여기를 누르세요.",
      buttons: [{ title: "지금 실행" }],
      requireInteraction: true,
      priority: 2,
    })
  } catch {
    /* ignore */
  }
}

function downloadUrl(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        conflictAction: "overwrite",
        saveAs: false,
      },
      (id) => {
        if (chrome.runtime.lastError || id == null) {
          reject(new Error(chrome.runtime.lastError?.message || "다운로드 실패"))
          return
        }
        resolve(id)
      }
    )
  })
}

async function finishOpen(downloadId) {
  // data URL은 바로 complete인 경우가 많음 → 즉시 open 시도
  let opened = await openDownload(downloadId)
  if (!opened.ok) {
    try {
      await waitDownloadComplete(downloadId)
    } catch {
      /* continue */
    }
    opened = await openDownload(downloadId)
  }
  if (!opened.ok) {
    await new Promise((r) => setTimeout(r, 200))
    opened = await openDownload(downloadId)
  }
  if (!opened.ok) {
    await notifyOpenFallback(downloadId)
  }
  watchAgentUntilOnline(120000)
  try {
    await chrome.action.openPopup()
  } catch {
    /* popup may already be open / no gesture */
  }
  return {
    ok: true,
    opened: Boolean(opened.ok),
    downloadId,
    error: opened.ok ? undefined : opened.error,
  }
}

async function openAgentFromContent(content, filename) {
  const dataUrl = `data:application/x-bat;base64,${toBase64Utf8(content)}`
  const downloadId = await downloadUrl(
    dataUrl,
    filename || "ShotForm/start-shotform-agent.cmd"
  )
  return finishOpen(downloadId)
}

async function downloadAndOpenAgent(cmdUrl) {
  if (!cmdUrl || !/^https?:\/\//i.test(cmdUrl)) {
    throw new Error("유효한 실행 파일 URL이 아닙니다.")
  }
  const downloadId = await downloadUrl(cmdUrl, "ShotForm/start-shotform-agent.cmd")
  return finishOpen(downloadId)
}

chrome.notifications?.onButtonClicked?.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith("shotform-agent-")) return
  if (buttonIndex !== 0) return
  if (pendingOpenDownloadId != null) {
    void openDownload(pendingOpenDownloadId).then(() => watchAgentUntilOnline(120000))
  }
  chrome.notifications.clear(notificationId)
})

chrome.notifications?.onClicked?.addListener((notificationId) => {
  if (!notificationId.startsWith("shotform-agent-")) return
  if (pendingOpenDownloadId != null) {
    void openDownload(pendingOpenDownloadId).then(() => watchAgentUntilOnline(120000))
  }
  chrome.notifications.clear(notificationId)
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return

  if (msg.type === "SHOTFORM_INGEST") {
    ;(async () => {
      try {
        sendResponse({ ok: true, result: await ingestToAgent(msg.payload) })
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  if (msg.type === "SHOTFORM_PROBE_AGENT") {
    ;(async () => {
      const res = await probeAgent()
      await setAgentOnlineState(res.ok, res.base)
      sendResponse(res)
    })()
    return true
  }

  if (msg.type === "SHOTFORM_SET_AGENT") {
    ;(async () => {
      const url = String(msg.agentUrl || DEFAULT_AGENT).replace(/\/$/, "")
      await chrome.storage.sync.set({ agentUrl: url })
      sendResponse({ ok: true, agentUrl: url })
    })()
    return true
  }

  if (msg.type === "SHOTFORM_OPEN_AGENT_DATA") {
    ;(async () => {
      try {
        sendResponse(await openAgentFromContent(String(msg.content || ""), msg.filename))
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  if (msg.type === "SHOTFORM_DOWNLOAD_OPEN_AGENT") {
    ;(async () => {
      try {
        sendResponse(await downloadAndOpenAgent(msg.cmdUrl))
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  if (msg.type === "SHOTFORM_WATCH_AGENT") {
    watchAgentUntilOnline(Number(msg.maxMs) || 120000)
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === "SHOTFORM_AGENT_CONNECTED") {
    ;(async () => {
      await setAgentOnlineState(true, msg.base || DEFAULT_AGENT)
      stopWatch()
      sendResponse({ ok: true })
    })()
    return true
  }
})

// 확장 시작 시 한 번 상태 확인
void probeAgent().then((res) => setAgentOnlineState(res.ok, res.base))
