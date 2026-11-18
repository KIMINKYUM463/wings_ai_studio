/**
 * WINGS Research — light overlay skin
 * Replaces leftover HypeDuck mascots with the white WINGS mark on all pages.
 * Full text remap stays profile-oriented on Instagram for performance.
 */
(() => {
  if (window.__WINGS_SKIN_V7__) return
  window.__WINGS_SKIN_V7__ = true

  const RESERVED = new Set([
    "reels",
    "reel",
    "explore",
    "direct",
    "accounts",
    "p",
    "stories",
    "about",
    "developer",
    "legal",
    "privacy",
    "terms",
    "web",
    "session",
    "emails",
    "challenge",
    "oauth",
    "ajax",
    "api",
    "graphql",
    "your_activity",
    "inbox",
    "notifications",
    "nametag",
  ])

  function isIg() {
    return /(^|\.)instagram\.com$/i.test(location.hostname)
  }

  function isIgProfile() {
    const m = (location.pathname || "").match(/^\/([A-Za-z0-9._]+)\/?(?:$|(?:reels?|tagged)\/?$)/)
    if (!m) return false
    return !RESERVED.has(m[1].toLowerCase())
  }

  /** Heavy text/color remap only on IG profiles; duck-button swap runs everywhere. */
  function shouldFullRemap() {
    if (!isIg()) return true
    return isIgProfile()
  }

  const COLOR_MAP = [
    [/#6d4aff/gi, "#0f766e"],
    [/#7c3aed/gi, "#0f766e"],
    [/#8b5cf6/gi, "#14b8a6"],
    [/#a78bfa/gi, "#5eead4"],
    [/#ffd479/gi, "#99f6e4"],
    [/rgb\(\s*109\s*,\s*74\s*,\s*255\s*\)/gi, "rgb(15, 118, 110)"],
  ]

  const TEXT_MAP = [
    [/하입덕\s*오리/g, "WINGS"],
    [/하입덕/g, "WINGS"],
    [/HypeDuck/g, "WINGS"],
    [/Hypeduck/g, "WINGS"],
    [/hypeduck/gi, "wings"],
  ]

  let W_MARK = ""
  try {
    W_MARK = chrome.runtime.getURL("icons/wings-btn-32.png")
  } catch {
    W_MARK = ""
  }

  function remapColors(s) {
    if (!s) return s
    let out = s
    for (const [re, to] of COLOR_MAP) out = out.replace(re, to)
    return out
  }

  function remapText(s) {
    if (!s) return s
    let out = s
    for (const [re, to] of TEXT_MAP) out = out.replace(re, to)
    return out
  }

  function isDuckAsset(src) {
    return /hypeduck|duck-load|expression\/|DuckBot|\/duck|assets\/expressions/i.test(src || "")
  }

  function isDuckSvg(el) {
    if (!el || el.tagName !== "SVG") return false
    if (el.dataset?.wingsSkinned === "1") return false
    const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("role") || ""}`
    if (/오리|duck|DuckBot|HypeDuck/i.test(label)) return true
    // procedural HypeDuck mascot uses a wide square viewBox with mask body
    const vb = el.getAttribute("viewBox") || ""
    return /^-?\d+\s+-?\d+\s+316\s+316$/.test(vb.trim()) || el.querySelector("mask[id*='duck']") != null
  }

  function applyWingsMark(el, size = 32) {
    if (!el || el.nodeType !== 1) return
    if (el.dataset?.wingsSkinned === "1" && el.querySelector?.("[data-wings-btn]")) return

    el.innerHTML = ""
    el.style.cssText = [
      "display:inline-flex!important",
      "align-items:center!important",
      "justify-content:center!important",
      `width:${size}px!important`,
      `height:${size}px!important`,
      "border-radius:50%!important",
      "background:#ffffff!important",
      "border:1px solid rgba(15,118,110,0.28)!important",
      "box-shadow:0 6px 16px rgba(15,28,26,0.18)!important",
      "overflow:hidden!important",
      "padding:0!important",
      "color:#0f766e!important",
      `font:800 ${Math.max(12, Math.round(size * 0.55))}px/1 Pretendard,Apple SD Gothic Neo,system-ui,sans-serif!important`,
      "letter-spacing:-0.04em!important",
    ].join(";")

    const mark = document.createElement("span")
    mark.setAttribute("data-wings-btn", "1")
    mark.setAttribute("aria-label", "WINGS")
    mark.textContent = "W"
    mark.style.cssText = "display:block;line-height:1;"
    el.appendChild(mark)
    el.dataset.wingsSkinned = "1"
    el.setAttribute("data-wings-mark", "1")
  }

  function replaceDuckNode(el, fullRemap) {
    if (!el || el.nodeType !== 1 || el.dataset?.wingsSkinned === "1") return
    const tag = el.tagName

    if (tag === "IMG" && isDuckAsset(el.getAttribute("src") || "")) {
      const size = Math.max(24, Math.min(44, Math.round(el.width || el.clientWidth || 32)))
      const host = document.createElement("span")
      el.replaceWith(host)
      applyWingsMark(host, size)
      return
    }

    if (isDuckSvg(el)) {
      const host = el.closest("span,button,div") || el.parentElement || el
      const box = host.getBoundingClientRect?.()
      const size = Math.max(24, Math.min(48, Math.round(box?.width || el.clientWidth || 32)))
      if (host !== el && host.childElementCount <= 2) {
        applyWingsMark(host, size)
      } else {
        // replace svg in place via wrapper
        const wrap = document.createElement("span")
        el.replaceWith(wrap)
        applyWingsMark(wrap, size)
      }
      return
    }

    const isMood =
      el.hasAttribute?.("data-duck-mood") ||
      el.hasAttribute?.("data-duck") ||
      el.hasAttribute?.("data-wings-slot") ||
      el.hasAttribute?.("data-wings-no-duck") ||
      el.hasAttribute?.("data-wings-no-duck-span") ||
      /DuckBot|duck-bot|duck-load|hd-duck/i.test(el.className || "")

    if (isMood) {
      if (el.hasAttribute?.("data-wings-mark") && el.querySelector("[data-wings-btn]")) {
        el.dataset.wingsSkinned = "1"
        return
      }
      const box = el.getBoundingClientRect?.()
      const size = Math.max(28, Math.min(44, Math.round(box?.width || el.clientWidth || 32)))
      applyWingsMark(el, size)
      return
    }

    if (!fullRemap) return

    if (el.style?.cssText) {
      const next = remapColors(el.style.cssText)
      if (next !== el.style.cssText) el.style.cssText = next
    }

    for (const attr of ["title", "aria-label", "alt", "placeholder"]) {
      const v = el.getAttribute?.(attr)
      if (!v) continue
      const n = remapText(v)
      if (n !== v) el.setAttribute(attr, n)
    }
  }

  function walk(node, fullRemap) {
    if (!node) return
    if (node.nodeType === 3) {
      if (!fullRemap) return
      const v = node.nodeValue
      if (v && /하입덕|HypeDuck|Hypeduck|hypeduck/i.test(v)) node.nodeValue = remapText(v)
      return
    }
    if (node.nodeType !== 1) return
    const tag = node.tagName
    if (tag === "SCRIPT" || tag === "STYLE") return
    replaceDuckNode(node, fullRemap)
    if (node.shadowRoot) walk(node.shadowRoot, fullRemap)
    const kids = node.childNodes
    for (let i = 0; i < kids.length; i++) walk(kids[i], fullRemap)
  }

  function scanDuckButtons(root = document.documentElement) {
    const fullRemap = shouldFullRemap()
    const nodes = root.querySelectorAll?.(
      "[data-duck-mood],[data-duck],[data-wings-slot],[data-wings-no-duck],[data-wings-no-duck-span],[class*='DuckBot'],[class*='duck-bot'],[class*='duck-load'],[class*='hd-duck'],img[src*='hypeduck'],img[src*='duck-load'],img[src*='expression'],svg[aria-label*='오리'],svg[aria-label*='duck' i],svg[aria-label*='Duck']"
    )
    if (nodes) {
      for (const el of nodes) replaceDuckNode(el, fullRemap)
    }
    // open shadow hosts
    root.querySelectorAll?.("[data-wxt-shadow-root]").forEach((host) => {
      if (host.shadowRoot) walk(host.shadowRoot, fullRemap)
    })
  }

  function blockOldBrandNav() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target?.closest?.("a[href]")
        if (!a) return
        const href = a.href || ""
        if (/hypeduck\.ai|youtube\.com\/pricing/i.test(href)) {
          e.preventDefault()
          e.stopPropagation()
          try {
            chrome.runtime?.openOptionsPage?.()
          } catch {
            /* ignore */
          }
        }
      },
      true
    )
  }

  let obs = null

  function startSkin() {
    if (obs) return
    const fullRemap = shouldFullRemap()
    walk(document.documentElement, fullRemap)
    scanDuckButtons()
    obs = new MutationObserver((muts) => {
      const remap = shouldFullRemap()
      for (const m of muts) {
        if (remap && m.type === "characterData") walk(m.target, true)
        if (m.type === "attributes") replaceDuckNode(m.target, remap)
        for (const n of m.addedNodes || []) walk(n, remap)
      }
      scanDuckButtons()
    })
    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "src", "title", "aria-label", "alt", "class", "data-duck-mood", "data-duck"],
    })
  }

  function boot() {
    blockOldBrandNav()
    startSkin()
    window.addEventListener("wxt:locationchange", () => scanDuckButtons())
    let last = location.pathname
    setInterval(() => {
      if (location.pathname !== last) {
        last = location.pathname
        scanDuckButtons()
      }
      scanDuckButtons()
    }, 1200)
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true })
  else boot()
})()
