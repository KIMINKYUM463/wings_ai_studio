/**
 * WINGS panel skin — all platforms (IG/TikTok/XHS/Douyin/YT/Threads)
 * Injects teal research theme into open shadow roots + swaps duck header for W.
 */
(() => {
  if (window.__WINGS_PANEL_SKIN_V2__) return;
  window.__WINGS_PANEL_SKIN_V2__ = true;

  const STYLE_ID = "wings-shadow-ui-style";
  let cachedCss = null;

  const TITLE_MAP = [
    [/전체 릴스 분석/g, "WINGS 릴스 리서치"],
    [/\bAll Reels\b/g, "WINGS Reels Research"],
    [/틱톡 검색 분석/g, "WINGS 틱톡 검색"],
    [/틱톡 계정 분석/g, "WINGS 틱톡 계정"],
    [/TikTok Search/g, "WINGS TikTok Search"],
    [/TikTok Account/g, "WINGS TikTok Account"],
    [/샤오홍슈 검색 분석/g, "WINGS 샤오홍슈 검색"],
    [/샤오홍슈 탐색 분석/g, "WINGS 샤오홍슈 탐색"],
    [/샤오홍슈 분석/g, "WINGS 샤오홍슈"],
    [/RedNote Search/g, "WINGS RedNote Search"],
    [/RedNote Explore/g, "WINGS RedNote Explore"],
    [/RedNote Analysis/g, "WINGS RedNote"],
    [/도우인 검색 분석/g, "WINGS 도우인 검색"],
    [/도우인 계정 분석/g, "WINGS 도우인 계정"],
    [/Douyin Search/g, "WINGS Douyin Search"],
    [/Douyin Account/g, "WINGS Douyin Account"],
    [/쿠팡 상품/g, "WINGS 소싱"],
  ];

  const TITLE_HINT =
    /릴스|틱톡|샤오홍|도우인|쿠팡|소싱|TikTok|RedNote|Douyin|YouTube|분석|Search|Account|Explore|Research|WINGS/i;

  async function loadCss() {
    if (cachedCss != null) return cachedCss;
    try {
      const url = chrome.runtime.getURL("content-scripts/wings-shadow-ui.css");
      cachedCss = await fetch(url).then((r) => r.text());
    } catch {
      cachedCss = "";
    }
    return cachedCss;
  }

  function remapTitleText(text) {
    let out = text;
    for (const [re, to] of TITLE_MAP) out = out.replace(re, to);
    return out;
  }

  function ensureHeaderMark(root) {
    if (!root) return;

    // Remap title labels
    root.querySelectorAll("span,div,h1,h2,button,p,strong").forEach((node) => {
      if (!node.childNodes || node.childNodes.length !== 1 || node.childNodes[0].nodeType !== 3) return;
      const v = node.textContent || "";
      if (!TITLE_HINT.test(v)) return;
      const n = remapTitleText(v);
      if (n !== v) node.textContent = n;
    });

    // Replace floating / header duck buttons inside the panel
    root
      .querySelectorAll(
        "[data-duck-mood],[data-duck],[class*='DuckBot'],[class*='duck-bot'],[class*='duck-load'],[class*='hd-duck'],img[src*='hypeduck'],img[src*='duck-load'],img[src*='expression']"
      )
      .forEach((el) => {
        if (el.dataset?.wingsSkinned === "1") return;
        const box = el.getBoundingClientRect?.();
        const size = Math.max(28, Math.min(44, Math.round(box?.width || el.clientWidth || 32)));
        const host = el.tagName === "IMG" ? document.createElement("span") : el;
        if (el.tagName === "IMG") {
          try {
            el.replaceWith(host);
          } catch {
            return;
          }
        }
        host.innerHTML = "";
        host.style.cssText = [
          "display:inline-flex!important",
          "align-items:center!important",
          "justify-content:center!important",
          `width:${size}px!important`,
          `height:${size}px!important`,
          "border-radius:50%!important",
          "background:#ffffff!important",
          "border:1px solid rgba(15,118,110,0.28)!important",
          "overflow:hidden!important",
          "color:#0f766e!important",
          `font:800 ${Math.max(12, Math.round(size * 0.55))}px/1 Pretendard,Apple SD Gothic Neo,system-ui,sans-serif!important`,
          "letter-spacing:-0.04em!important",
        ].join(";");
        const mark = document.createElement("span");
        mark.setAttribute("data-wings-btn", "1");
        mark.setAttribute("aria-label", "WINGS");
        mark.textContent = "W";
        host.appendChild(mark);
        host.dataset.wingsSkinned = "1";
      });

    if (root.querySelector("[data-wings-header-mark]")) return;

    const title = Array.from(root.querySelectorAll("span,div,h1,h2,button")).find((n) => {
      const t = (n.textContent || "").trim();
      return TITLE_HINT.test(t) && t.length < 40;
    });
    if (!title) return;

    const row = title.closest("div") || title.parentElement;
    if (!row) return;
    const mascot = row.querySelector(
      "svg, canvas, span[aria-hidden='true'], [data-duck-mood], [class*='DuckBot'], [class*='duck']"
    );
    if (!mascot || row.querySelector("[data-wings-header-mark]")) return;
    // 오리 SVG는 span 안에 있으므로 래퍼째 제거
    const duck = mascot.closest("span[aria-hidden='true']") || mascot;

    const w = duck.getBoundingClientRect?.().width || duck.clientWidth || 0;
    if (w && (w < 16 || w > 56)) return;

    const mark = document.createElement("span");
    mark.setAttribute("data-wings-header-mark", "1");
    mark.setAttribute("data-wings-btn", "1");
    mark.setAttribute("aria-label", "WINGS");
    mark.textContent = "W";
    mark.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#ffffff;color:#0f766e;font:800 18px/1 Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;letter-spacing:-0.04em;box-shadow:0 0 0 1px rgba(15,118,110,.22);";
    try {
      duck.replaceWith(mark);
    } catch {
      duck.style.display = "none";
      row.insertBefore(mark, duck);
    }
  }

  async function styleShadowHost(host) {
    const root = host.shadowRoot;
    if (!root) return;
    if (!root.getElementById(STYLE_ID)) {
      const css = await loadCss();
      if (css) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css;
        root.appendChild(style);
      }
    }
    ensureHeaderMark(root);

    root.querySelectorAll("[class*='rounded-']").forEach((el) => {
      const cls = el.className || "";
      if (/rounded-\[20px\]|rounded-3xl|rounded-2xl|rounded-xl/.test(cls)) {
        el.style.borderRadius = "8px";
        if (!el.style.borderColor) el.style.borderColor = "#cfdad6";
      }
      if (/rounded-full/.test(cls) && /px-|py-|badge|pill|chip/i.test(cls + (el.getAttribute("class") || ""))) {
        el.style.borderRadius = "6px";
      }
    });
  }

  let scanning = false;
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      const hosts = document.querySelectorAll("[data-wxt-shadow-root]");
      for (const host of hosts) await styleShadowHost(host);
    } finally {
      scanning = false;
    }
  }

  const obs = new MutationObserver(() => {
    scan();
  });

  function boot() {
    scan();
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(scan, 2000);
    window.addEventListener("wxt:locationchange", scan);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
