/**
 * WINGS YouTube AI analyze — button handler + result drawer + fold toggle
 */
(() => {
  if (window.__WINGS_YT_AI_V2__) return
  window.__WINGS_YT_AI_V2__ = true

  const PANEL_ID = "wings-ai-result-panel"
  const FOLD_KEY = "wings_yt_panel_folded"

  function esc(t) {
    return String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
  }

  function getVideoIdFromLocation() {
    const href = location.href || ""
    return (
      href.match(/[?&]v=([^&]+)/)?.[1] ||
      href.match(/\/shorts\/([^/?]+)/)?.[1] ||
      ""
    )
  }

  function isFolded() {
    try {
      return sessionStorage.getItem(FOLD_KEY) === "1"
    } catch {
      return false
    }
  }

  function setFolded(next) {
    try {
      sessionStorage.setItem(FOLD_KEY, next ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  function overlayHosts() {
    return Array.from(
      document.querySelectorAll('[data-hd-yt-card="shorts"], [data-hd-yt-card="watch"]')
    )
  }

  function getPlayerRect(kind) {
    if (kind === "shorts") {
      const reel = document.querySelector(
        "ytd-reel-video-renderer[is-active], ytd-shorts [is-active], ytd-reel-video-renderer"
      )
      const player =
        reel?.querySelector("#shorts-player video, #shorts-player, video") ?? reel
      return player?.getBoundingClientRect?.() ?? null
    }
    const watch =
      document.querySelector("#movie_player") ||
      document.querySelector("ytd-player") ||
      document.querySelector("#player")
    return watch?.getBoundingClientRect?.() ?? null
  }

  function syncFoldSide(host) {
    if (!host) return
    // Prefer dock side already set by youtube.js positioning
    if (host.dataset.foldSide === "left" || host.dataset.foldSide === "right") return
    const kind = host.getAttribute("data-hd-yt-card") || "shorts"
    const player = getPlayerRect(kind)
    const rect = host.getBoundingClientRect()
    if (player && player.width > 20) {
      const hostMid = rect.left + rect.width / 2
      const playerMid = player.left + player.width / 2
      host.dataset.foldSide = hostMid < playerMid ? "left" : "right"
      return
    }
    const mid = window.innerWidth / 2
    host.dataset.foldSide = rect.left + rect.width / 2 < mid ? "left" : "right"
  }

  /** When folded, snap tab flush to the Shorts player edge (not viewport left). */
  function snapHostToPlayer(host, folded) {
    if (!host || !folded) return
    if (host.getAttribute("data-hd-yt-card") !== "shorts") return
    const player = getPlayerRect("shorts")
    if (!player || player.width < 40) return

    const side = host.dataset.foldSide === "right" ? "right" : "left"
    const gap = 8
    const width = 44
    host.style.width = `${width}px`
    if (side === "left") {
      host.style.left = `${Math.round(Math.max(4, player.left - width - gap))}px`
    } else {
      host.style.left = `${Math.round(player.right + gap)}px`
    }
  }

  function ensureFoldTab(host) {
    if (!host || host.querySelector(":scope > .wings-ai-fold-tab")) return
    const tab = document.createElement("button")
    tab.type = "button"
    tab.className = "wings-ai-fold-tab"
    tab.setAttribute("data-wings-fold-toggle", "1")
    tab.setAttribute("aria-label", "패널 접기/펼치기")
    tab.innerHTML = `<span class="wings-ai-fold-tab-label">WINGS</span><span class="wings-ai-fold-tab-chevron" aria-hidden="true"></span>`
    host.appendChild(tab)
  }

  function applyFoldState() {
    const folded = isFolded()
    for (const host of overlayHosts()) {
      ensureFoldTab(host)
      syncFoldSide(host)
      host.classList.toggle("wings-ai-folded", folded)
      snapHostToPlayer(host, folded)
      const tab = host.querySelector(":scope > .wings-ai-fold-tab")
      if (tab) {
        tab.title = folded ? "패널 펼치기" : "패널 접기"
        tab.setAttribute("aria-expanded", folded ? "false" : "true")
      }
      // keep panel tools clickable only when expanded
      host.style.pointerEvents = "none"
      const panel = host.querySelector(".wings-ai-panel")
      if (panel) panel.style.pointerEvents = folded ? "none" : "none"
      if (tab) tab.style.pointerEvents = "auto"
      host.querySelectorAll(".wings-ai-tools, .wings-ai-analyze-btn, .wings-ai-dl-btn, [data-wings-fold-toggle]").forEach((el) => {
        el.style.pointerEvents = folded && !el.classList.contains("wings-ai-fold-tab") && !el.hasAttribute("data-wings-fold-toggle")
          ? "none"
          : "auto"
      })
    }
  }

  function toggleFold() {
    setFolded(!isFolded())
    applyFoldState()
    // youtube.js may re-apply left shortly after; snap again next frames
    requestAnimationFrame(() => applyFoldState())
    setTimeout(applyFoldState, 50)
    setTimeout(applyFoldState, 320)
  }

  function collectTranscriptHint() {
    const chunks = []
    document.querySelectorAll("yt-formatted-string, .ytp-caption-segment, #description, #title h1").forEach((el) => {
      const t = (el.textContent || "").trim()
      if (t && t.length < 400) chunks.push(t)
    })
    const title =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string, h1.title, #title h1")?.textContent?.trim() ||
      document.title.replace(/ - YouTube$/, "").trim()
    const desc =
      document.querySelector("#description-inline-expander, #description, ytd-expander #content")?.textContent?.trim() ||
      ""
    return {
      title,
      description: desc.slice(0, 2500),
      transcript: chunks.slice(0, 40).join("\n").slice(0, 8000),
    }
  }

  function listBlock(title, items) {
    if (!items?.length) return ""
    return `<section class="wings-ai-result-sec"><h3>${esc(title)}</h3><ul>${items
      .map((x) => `<li>${esc(x)}</li>`)
      .join("")}</ul></section>`
  }

  function structureBlock(rows) {
    if (!Array.isArray(rows) || !rows.length) return ""
    return `<section class="wings-ai-result-sec"><h3>대본 구조</h3><div class="wings-ai-beats">${rows
      .map((r) => {
        const beat = esc(r?.beat || "비트")
        const sec = esc(r?.seconds || "")
        const line = esc(r?.line || "")
        const purpose = esc(r?.purpose || "")
        return `<article class="wings-ai-beat"><header><b>${beat}</b>${sec ? `<span>${sec}</span>` : ""}</header><p>${line}</p>${
          purpose ? `<small>${purpose}</small>` : ""
        }</article>`
      })
      .join("")}</div></section>`
  }

  function renderResult(analysis, meta) {
    let host = document.getElementById(PANEL_ID)
    if (!host) {
      host = document.createElement("div")
      host.id = PANEL_ID
      document.documentElement.appendChild(host)
    }
    const score =
      analysis?.score == null ? "" : `<span class="wings-ai-score">Score ${esc(analysis.score)}</span>`
    host.innerHTML = `
      <div class="wings-ai-result-card">
        <div class="wings-ai-result-top">
          <div>
            <div class="wings-ai-result-badge"><i></i>WINGS AI 분석</div>
            <h2>${esc(meta?.title || "영상 분석 결과")}</h2>
          </div>
          <button type="button" class="wings-ai-result-close" aria-label="닫기">×</button>
        </div>
        <div class="wings-ai-result-body">
          <div class="wings-ai-result-summary">
            ${score}
            <p>${esc(analysis?.summary || "요약 없음")}</p>
          </div>
          <div class="wings-ai-result-grid">
            <section class="wings-ai-result-sec"><h3>훅</h3><p>${esc(analysis?.hook || "-")}</p></section>
            <section class="wings-ai-result-sec"><h3>타깃</h3><p>${esc(analysis?.audience || "-")}</p></section>
            <section class="wings-ai-result-sec"><h3>톤</h3><p>${esc(analysis?.emotion || "-")}</p></section>
            <section class="wings-ai-result-sec"><h3>CTA</h3><p>${esc(analysis?.cta || "-")}</p></section>
          </div>
          ${structureBlock(analysis?.scriptStructure)}
          ${listBlock("전체 대본 아웃라인", analysis?.fullScriptOutline)}
          ${listBlock("핵심 문장", analysis?.keyLines)}
          ${listBlock("잘된 점", analysis?.whyItWorks)}
          ${listBlock("개선점", analysis?.improvements)}
          ${listBlock("리믹스 아이디어", analysis?.remixIdeas)}
        </div>
      </div>`
    host.querySelector(".wings-ai-result-close")?.addEventListener("click", () => host.remove())
    host.addEventListener("click", (e) => {
      if (e.target === host) host.remove()
    })
  }

  function setButtonBusy(btn, busy, label) {
    if (!btn) return
    btn.disabled = Boolean(busy)
    btn.textContent = label
    btn.classList.toggle("is-busy", Boolean(busy))
  }

  async function runAnalyze(btn) {
    const videoId = btn.getAttribute("data-video-id") || getVideoIdFromLocation()
    const page = collectTranscriptHint()
    const payload = {
      type: "WINGS_YT_AI_ANALYZE",
      videoId,
      title: btn.getAttribute("data-title") || page.title,
      channelName: btn.getAttribute("data-channel") || "",
      description: page.description,
      transcript: page.transcript,
      metrics: {
        views: btn.getAttribute("data-views") || "",
        subscribers: btn.getAttribute("data-subs") || "",
        likes: btn.getAttribute("data-likes") || "",
        vph: btn.getAttribute("data-vph") || "",
        reach: btn.getAttribute("data-reach") || "",
        engagement: btn.getAttribute("data-eng") || "",
        grade: btn.getAttribute("data-grade") || "",
      },
    }
    setButtonBusy(btn, true, "분석 중…")
    try {
      const res = await chrome.runtime.sendMessage(payload)
      if (!res?.success) throw new Error(res?.error || "AI 분석 실패")
      renderResult(res.analysis, { title: payload.title })
      setButtonBusy(btn, false, "AI 분석")
    } catch (err) {
      setButtonBusy(btn, false, "AI 분석")
      renderResult(
        {
          summary: err instanceof Error ? err.message : String(err),
          hook: "",
          audience: "",
          emotion: "",
          cta: "",
          scriptStructure: [],
          fullScriptOutline: [],
          keyLines: [],
          whyItWorks: [],
          improvements: ["설정에서 Gemini API 키를 확인해 주세요."],
          remixIdeas: [],
          score: null,
        },
        { title: "분석 실패" }
      )
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      const foldBtn = e.target?.closest?.("[data-wings-fold-toggle]")
      if (foldBtn) {
        e.preventDefault()
        e.stopPropagation()
        toggleFold()
        return
      }
      const btn = e.target?.closest?.("[data-wings-ai-analyze]")
      if (!btn) return
      e.preventDefault()
      e.stopPropagation()
      void runAnalyze(btn)
    },
    true
  )

  // Keep fold tab attached even when youtube.js re-renders panel HTML
  const obs = new MutationObserver(() => applyFoldState())
  obs.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("resize", () => applyFoldState())
  setInterval(applyFoldState, 1200)
  applyFoldState()
})()
