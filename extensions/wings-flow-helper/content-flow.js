// 윙즈 Flow 도우미 — Google Flow 페이지 콘텐츠 스크립트
// Flow 화면 구조는 공개 규격이 없어 자주 바뀐다 → 모든 탐색은 추측(heuristic)이며 실패하면 수동 안내로 넘긴다.
// 보안 확인(reCAPTCHA 등)은 절대 건드리지 않는다: 보이면 멈추고 사용자에게 맡긴다.
;(function () {
  if (window.__wingsFlowHelper) return
  window.__wingsFlowHelper = true

  const CHUNK = 3 * 256 * 1024 // 3의 배수여야 base64 조각을 이어 붙여도 깨지지 않는다
  const log = (text) => chrome.runtime.sendMessage({ type: "log", text }).catch(() => {})

  const PROMPT_RE = /prompt|프롬프트|describe|설명|무엇을|what do you want|create a video|동영상/i
  const GENERATE_RE = /^(generate|create|만들기|생성|send|보내기|submit)$|generate|만들기|생성하기/i
  const ADD_IMAGE_RE = /add image|upload|image to video|frames? to video|starting frame|first frame|이미지 추가|업로드|이미지로|프레임|첫 프레임/i
  const CHALLENGE_TEXT_RE = /unusual traffic|verify (that )?you('| a)re (a )?human|i'?m not a robot|로봇이 아닙니다|비정상적인 트래픽|본인 확인/i

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"
  }
  const labelOf = (el) =>
    [el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.getAttribute("title"), el.getAttribute("data-placeholder"), el.textContent]
      .filter(Boolean)
      .join(" ")
      .trim()
      .slice(0, 200)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function challengeVisible() {
    const frames = document.querySelectorAll('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA" i], iframe[src*="challenge"]')
    if ([...frames].some(isVisible)) return true
    return CHALLENGE_TEXT_RE.test((document.body?.innerText || "").slice(0, 20000))
  }
  function stopIfChallenge() {
    if (!challengeVisible()) return false
    log("Flow에서 확인을 직접 완료해 주세요. (도우미는 잠시 멈춥니다)")
    return true
  }

  async function jobImageFile(job) {
    const src = job.imageDataUrl || job.imageUrl
    if (!src) throw new Error("이미지가 없어요.")
    const blob = await (await fetch(src)).blob()
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg")
    return new File([blob], `wings_scene_${job.sceneIndex + 1}.${ext}`, { type: blob.type || "image/png" })
  }

  const imageInputs = () =>
    [...document.querySelectorAll('input[type="file"]')].filter((i) => {
      const a = (i.getAttribute("accept") || "").toLowerCase()
      return !a || a.includes("image") || /\.(png|jpe?g|webp)/.test(a)
    })

  function setInputFile(input, file) {
    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function dropFile(target, file) {
    const dt = new DataTransfer()
    dt.items.add(file)
    for (const type of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
    }
  }

  function findButtons(re) {
    return [...document.querySelectorAll('button, [role="button"]')].filter(
      (b) => isVisible(b) && !b.disabled && b.getAttribute("aria-disabled") !== "true" && re.test(labelOf(b))
    )
  }

  async function attachImage(job) {
    const file = await jobImageFile(job)
    let inputs = imageInputs()
    if (!inputs.length) {
      const opener = findButtons(ADD_IMAGE_RE)[0]
      if (opener) {
        log(`이미지 버튼 클릭: "${labelOf(opener).slice(0, 30)}"`)
        opener.click()
        await sleep(800)
        inputs = imageInputs()
      }
    }
    if (inputs.length) {
      setInputFile(inputs[inputs.length - 1], file)
      log("이미지 첨부 시도 (파일 입력)")
      return true
    }
    const zone = [...document.querySelectorAll('[class*="drop" i], [aria-label*="drop" i], [aria-label*="upload" i], [aria-label*="업로드"]')].find(isVisible)
    if (zone) {
      dropFile(zone, file)
      log("이미지 첨부 시도 (끌어놓기)")
      return true
    }
    log("이미지 넣을 곳을 못 찾았어요. 패널의 이미지를 Flow로 직접 끌어다 놓아 주세요.")
    return false
  }

  function findPromptBox() {
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]')].filter(isVisible)
    return all.find((el) => PROMPT_RE.test(labelOf(el))) || all.filter((el) => el.tagName === "TEXTAREA").sort((a, b) => b.clientWidth - a.clientWidth)[0] || all[0] || null
  }

  function fillPrompt(text) {
    const box = findPromptBox()
    if (!box) {
      log("프롬프트 입력칸을 못 찾았어요. 패널에서 '복사' 후 붙여 넣어 주세요.")
      return false
    }
    box.focus()
    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      // React 등 프레임워크가 값 변경을 인식하도록 기본 setter 로 넣는다
      const proto = box.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, "value").set.call(box, text)
      box.dispatchEvent(new Event("input", { bubbles: true }))
      box.dispatchEvent(new Event("change", { bubbles: true }))
    } else {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(box)
      sel.removeAllRanges()
      sel.addRange(range)
      if (!document.execCommand("insertText", false, text)) {
        box.textContent = text
        box.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }))
      }
    }
    log("프롬프트를 넣었어요.")
    return true
  }

  function clickGenerate() {
    if (stopIfChallenge()) return false
    const box = findPromptBox()
    const candidates = findButtons(GENERATE_RE)
    // 프롬프트칸과 가장 가까운 버튼을 고른다
    const near = (b) => {
      if (!box) return 0
      const a = box.getBoundingClientRect(), c = b.getBoundingClientRect()
      return Math.hypot(a.right - c.left, a.bottom - c.top)
    }
    const btn = candidates.sort((x, y) => near(x) - near(y))[0]
    if (!btn) {
      log("만들기 버튼을 못 찾았어요. Flow에서 직접 눌러 주세요.")
      return false
    }
    log(`만들기 버튼 클릭: "${labelOf(btn).slice(0, 30) || "(아이콘)"}"`)
    btn.click()
    return true
  }

  // ---- 결과 영상 감시 ----
  let baseline = new WeakSet()
  const sent = new WeakSet()
  let watchingJobId = ""
  let autoTimer = 0

  const videoSrc = (v) => v.currentSrc || v.src || v.querySelector("source")?.src || ""

  function markBaseline() {
    baseline = new WeakSet(document.querySelectorAll("video"))
  }

  async function sendVideo(video, btn) {
    if (stopIfChallenge()) return
    const { activeJob } = await chrome.storage.local.get("activeJob")
    if (!activeJob) return log("윙즈 앱에서 먼저 'Flow 확장으로 보내기'를 눌러 주세요.")
    const src = videoSrc(video)
    if (!src) return log("영상 주소가 아직 없어요. 재생이 준비된 뒤 다시 눌러 주세요.")
    if (btn) btn.textContent = "보내는 중…"
    try {
      let res = await fetch(src).catch(() => null)
      if (!res || !res.ok) res = await fetch(src, { credentials: "include" })
      if (!res.ok) throw new Error(`영상 받기 실패 (${res.status})`)
      const blob = await res.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const total = Math.max(1, Math.ceil(bytes.length / CHUNK))
      log(`장면 ${activeJob.sceneIndex + 1}로 영상 보내는 중 (${(bytes.length / 1048576).toFixed(1)}MB)`)
      for (let i = 0; i < total; i++) {
        const part = bytes.subarray(i * CHUNK, (i + 1) * CHUNK)
        let bin = ""
        for (let j = 0; j < part.length; j += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(j, j + 0x8000))
        const r = await chrome.runtime.sendMessage({ type: "video-chunk", jobId: activeJob.jobId, index: i, total, mime: blob.type || "video/mp4", b64: btoa(bin) })
        if (r && r.ok === false) throw new Error(r.error)
      }
      sent.add(video)
      if (btn) btn.textContent = "보냄 ✓"
    } catch (err) {
      if (btn) btn.textContent = "윙즈로 보내기"
      log(`보내기 실패: ${err?.message || err}. 영상을 내려받아 앱에서 '영상 올리기'로 올려 주세요.`)
    }
  }

  function decorate(video) {
    if (video.dataset.wingsDecorated) return
    const host = video.parentElement
    if (!host) return
    video.dataset.wingsDecorated = "1"
    if (getComputedStyle(host).position === "static") host.style.position = "relative"
    const btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = "윙즈로 보내기"
    btn.style.cssText =
      "position:absolute;top:8px;left:8px;z-index:2147483000;padding:6px 10px;border:0;border-radius:999px;" +
      "background:#2f3beb;color:#fff;font:600 12px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(14,16,22,.25);cursor:pointer"
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      void sendVideo(video, btn)
    }, true)
    host.appendChild(btn)
  }

  async function maybeAutoSend() {
    if (!watchingJobId) return
    const { autoSend, activeJob } = await chrome.storage.local.get(["autoSend", "activeJob"])
    if (!autoSend || !activeJob || activeJob.jobId !== watchingJobId) return
    if (stopIfChallenge()) return
    const fresh = [...document.querySelectorAll("video")].filter((v) => !baseline.has(v) && !sent.has(v) && videoSrc(v))
    if (fresh.length === 1) {
      watchingJobId = "" // 작업당 한 번만 자동 전송
      log("새 결과 1개 → 자동으로 윙즈에 보냅니다.")
      const btn = fresh[0].parentElement?.querySelector("button")
      await sendVideo(fresh[0], btn && btn.textContent.includes("윙즈") ? btn : null)
    } else if (fresh.length > 1) {
      log("결과가 여러 개예요. 원하는 영상의 '윙즈로 보내기'를 눌러 주세요.")
      watchingJobId = ""
    }
  }

  const scan = () => {
    document.querySelectorAll("video").forEach(decorate)
    clearTimeout(autoTimer)
    autoTimer = setTimeout(() => void maybeAutoSend(), 4000) // 결과가 다 붙을 때까지 잠깐 기다린다
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] })
  scan()

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const run = async () => {
      if (msg?.type === "insert") {
        if (stopIfChallenge()) return { ok: false, paused: true }
        markBaseline()
        watchingJobId = msg.job.jobId
        const img = await attachImage(msg.job).catch((e) => (log(`이미지 첨부 실패: ${e.message}`), false))
        await sleep(400)
        const prompt = msg.job.prompt ? fillPrompt(msg.job.prompt) : false
        log("Flow 설정에서 세로(9:16)인지 확인한 뒤 '생성 시작'을 눌러 주세요.")
        return { ok: true, img, prompt }
      }
      if (msg?.type === "generate") {
        markBaseline()
        watchingJobId = msg.jobId || watchingJobId
        return { ok: clickGenerate() }
      }
      return undefined
    }
    if (msg?.type !== "insert" && msg?.type !== "generate") return
    run().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }))
    return true
  })
})()
