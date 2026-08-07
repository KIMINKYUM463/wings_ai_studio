/**
 * MV3 service worker — localhost 에이전트 전송 (CORS/Private Network 회피)
 */

const DEFAULT_AGENT = "http://127.0.0.1:3847"

async function getAgentBase() {
  const stored = await chrome.storage.sync.get(["agentUrl"])
  const url = (stored.agentUrl || DEFAULT_AGENT).replace(/\/$/, "")
  return url
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return

  if (msg.type === "SHOTFORM_INGEST") {
    ;(async () => {
      try {
        const result = await ingestToAgent(msg.payload)
        sendResponse({ ok: true, result })
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    })()
    return true
  }

  if (msg.type === "SHOTFORM_PROBE_AGENT") {
    ;(async () => {
      sendResponse(await probeAgent())
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
})
