// 윙즈 Flow 도우미 — 서비스 워커
// 앱 탭 ↔ Flow 탭 사이 중계만 한다. 작업은 한 번에 하나(activeJob), 모두 사용자 클릭으로 시작된다.

const FLOW_URL = "https://labs.google/fx/tools/flow"
const FLOW_MATCH = "https://labs.google/fx/*"
const MAX_LOGS = 60

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

async function log(text) {
  const line = `${new Date().toLocaleTimeString("ko-KR", { hour12: false })}  ${text}`
  const { logs = [] } = await chrome.storage.session.get("logs")
  logs.push(line)
  await chrome.storage.session.set({ logs: logs.slice(-MAX_LOGS) })
}

async function findFlowTab() {
  const tabs = await chrome.tabs.query({ url: FLOW_MATCH })
  return tabs.find((t) => t.url && t.url.includes("/tools/flow")) || null
}

async function openOrFocusFlow() {
  let tab = await findFlowTab()
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true })
    await chrome.windows.update(tab.windowId, { focused: true })
  } else {
    tab = await chrome.tabs.create({ url: FLOW_URL, active: true })
  }
  // 사용자 제스처가 없으면 실패할 수 있다 → 그땐 아이콘으로 열도록 안내
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId })
  } catch {
    await log("확장 아이콘을 눌러 'Flow 도우미' 패널을 열어 주세요.")
  }
  return tab
}

async function handleJob(job, sender) {
  if (!job || typeof job.jobId !== "string" || typeof job.sceneIndex !== "number") {
    throw new Error("작업 정보가 올바르지 않아요.")
  }
  const activeJob = {
    jobId: job.jobId,
    sceneIndex: job.sceneIndex,
    imageDataUrl: typeof job.imageDataUrl === "string" ? job.imageDataUrl : "",
    imageUrl: typeof job.imageUrl === "string" ? job.imageUrl : "",
    prompt: typeof job.prompt === "string" ? job.prompt : "",
    aspect: job.aspect || "9:16",
    appTabId: sender.tab?.id ?? null,
    createdAt: Date.now(),
  }
  await chrome.storage.local.set({ activeJob })
  await log(`장면 ${activeJob.sceneIndex + 1} 작업을 받았어요.`)
  await openOrFocusFlow()
  return { ok: true }
}

// Flow 탭에서 온 영상 조각을 앱 탭으로 그대로 넘긴다
async function relayToApp(msg) {
  const { activeJob } = await chrome.storage.local.get("activeJob")
  if (!activeJob || activeJob.appTabId == null) throw new Error("윙즈 앱 탭을 찾지 못했어요. 앱에서 다시 보내 주세요.")
  if (msg.jobId !== activeJob.jobId) throw new Error("현재 작업과 다른 결과예요.")
  return chrome.tabs.sendMessage(activeJob.appTabId, { ...msg, sceneIndex: activeJob.sceneIndex })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const run = async () => {
    switch (msg?.type) {
      case "flow-job":
        return handleJob(msg.job, sender)
      case "log":
        await log(String(msg.text || ""))
        return { ok: true }
      case "open-flow":
        await openOrFocusFlow()
        return { ok: true }
      case "video-chunk": {
        const res = await relayToApp(msg)
        if (msg.index === msg.total - 1) await log("윙즈로 영상을 보냈어요.")
        return res || { ok: true }
      }
      default:
        return undefined
    }
  }
  run()
    .then((res) => sendResponse(res ?? { ok: true }))
    .catch((err) => {
      void log(`오류: ${err?.message || err}`)
      sendResponse({ ok: false, error: String(err?.message || err) })
    })
  return true
})
