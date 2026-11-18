const $ = (id) => document.getElementById(id)
let job = null

async function log(text) {
  await chrome.runtime.sendMessage({ type: "log", text })
}

function renderLogs(logs = []) {
  $("log").replaceChildren(
    ...logs.slice().reverse().map((t) => {
      const li = document.createElement("li")
      li.textContent = t
      return li
    })
  )
}

function renderJob(j) {
  job = j || null
  $("empty").hidden = !!job
  $("job").hidden = !job
  if (!job) return
  const src = job.imageDataUrl || job.imageUrl
  $("jobTitle").textContent = `장면 ${job.sceneIndex + 1}`
  $("jobImage").src = src || ""
  $("downloadImage").href = src || "#"
  $("downloadImage").download = `wings_scene_${job.sceneIndex + 1}.png`
  $("jobPrompt").value = job.prompt || ""
}

async function flowTab() {
  const tabs = await chrome.tabs.query({ url: "https://labs.google/fx/*" })
  const flow = tabs.filter((t) => t.url && t.url.includes("/tools/flow"))
  return flow.find((t) => t.active) || flow[0] || null
}

async function sendToFlow(message, button) {
  const tab = await flowTab()
  if (!tab) {
    await log("Flow 탭이 없어요. 'Flow 열기'를 눌러 주세요.")
    return
  }
  button.disabled = true
  try {
    await chrome.tabs.update(tab.id, { active: true })
    const res = await chrome.tabs.sendMessage(tab.id, message)
    if (res && res.ok === false && res.error) await log(`오류: ${res.error}`)
  } catch {
    await log("Flow 페이지와 연결되지 않았어요. Flow 탭을 새로고침한 뒤 다시 눌러 주세요.")
  } finally {
    button.disabled = false
  }
}

$("insert").addEventListener("click", () => job && sendToFlow({ type: "insert", job }, $("insert")))
$("generate").addEventListener("click", () => job && sendToFlow({ type: "generate", jobId: job.jobId }, $("generate")))
$("openFlow").addEventListener("click", () => chrome.runtime.sendMessage({ type: "open-flow" }))
$("copyPrompt").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("jobPrompt").value)
  $("copyPrompt").textContent = "복사됨"
  setTimeout(() => ($("copyPrompt").textContent = "프롬프트 복사"), 1500)
})
$("autoSend").addEventListener("change", (e) => chrome.storage.local.set({ autoSend: e.target.checked }))
$("clearLog").addEventListener("click", () => chrome.storage.session.set({ logs: [] }))

chrome.storage.local.get(["activeJob", "autoSend"]).then(({ activeJob, autoSend }) => {
  renderJob(activeJob)
  $("autoSend").checked = !!autoSend
})
chrome.storage.session.get("logs").then(({ logs }) => renderLogs(logs))
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.activeJob) renderJob(changes.activeJob.newValue)
  if (area === "session" && changes.logs) renderLogs(changes.logs.newValue)
})
