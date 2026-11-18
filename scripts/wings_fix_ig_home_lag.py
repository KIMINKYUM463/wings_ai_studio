# -*- coding: utf-8 -*-
"""Reduce IG home lag: gate interceptor deep-work, lighten skin, skip coupang/hd on IG home."""
from pathlib import Path
import re

ROOT = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")

# --- 1) interceptor.js: add Pi + skip expensive parse off-profile ---
inter = ROOT / "content-scripts" / "interceptor.js"
t = inter.read_text(encoding="utf-8")

old_b = 'function B(e){const n=e.match(/^\\/([^/]+)\\/reels\\/?$/);if(!n)return null;const c=n[1];return K.has(c.toLowerCase())?null:c}'
if old_b not in t:
    raise SystemExit("interceptor B() not found")
new_b = (
    old_b
    + 'function Pi(e){const n=(e||"").match(/^\\/([A-Za-z0-9._]+)\\/?(?:$|(?:reels?|tagged)\\/?$)/);if(!n)return null;const c=n[1];return K.has(c.toLowerCase())?null:c}'
    + 'function shouldCapture(){return !!(Pi(location.pathname)||B(location.pathname))}'
)
t = t.replace(old_b, new_b, 1)

# Gate fetch body parse
old_fetch = '(h.includes("/graphql")||h.includes("/api/v1/"))&&f.clone().text().then(w=>{try{const g=JSON.parse(w);'
new_fetch = '(h.includes("/graphql")||h.includes("/api/v1/"))&&shouldCapture()&&f.clone().text().then(w=>{try{const g=JSON.parse(w);'
if old_fetch not in t:
    raise SystemExit("fetch gate target not found")
t = t.replace(old_fetch, new_fetch, 1)

# Gate XHR
old_xhr = '(f.includes("/graphql")||f.includes("/api/v1/"))&&(d._hdBody=typeof r[0]=="string"?r[0]:"",d.addEventListener("load",function(){try{const h=d.responseText,_=JSON.parse(h);'
new_xhr = '(f.includes("/graphql")||f.includes("/api/v1/"))&&shouldCapture()&&(d._hdBody=typeof r[0]=="string"?r[0]:"",d.addEventListener("load",function(){try{const h=d.responseText,_=JSON.parse(h);'
if old_xhr not in t:
    raise SystemExit("xhr gate target not found")
t = t.replace(old_xhr, new_xhr, 1)

# Gate SSR scan
old_ssr = 'function I(){const r=document.querySelectorAll(\'script[type="application/json"]\'),d=[];'
new_ssr = 'function I(){if(!shouldCapture())return;const r=document.querySelectorAll(\'script[type="application/json"]\'),d=[];'
if old_ssr not in t:
    raise SystemExit("SSR I() not found")
t = t.replace(old_ssr, new_ssr, 1)

inter.write_text(t, encoding="utf-8")
print("interceptor OK")

# --- 2) coupang-image-badge: skip IG ---
badge = ROOT / "content-scripts" / "coupang-image-badge.js"
bt = badge.read_text(encoding="utf-8")
old_main = 'async main(u){let c=null;c=await ih(u,{name:"wings-coupang-badge"'
new_main = 'async main(u){if(/(^|\\.)instagram\\.com$/i.test(location.hostname))return;let c=null;c=await ih(u,{name:"wings-coupang-badge"'
if old_main not in bt:
    raise SystemExit("coupang main not found")
badge.write_text(bt.replace(old_main, new_main, 1), encoding="utf-8")
print("coupang OK")

# --- 3) content.js: don't start hd() dialog observer on IG home ---
content = ROOT / "content-scripts" / "content.js"
ct = content.read_text(encoding="utf-8")
old_hd = '),hd();{console.info("[WINGS] Instagram scanner/sidebar is disabled until release readiness");return}}'
new_hd = ');{console.info("[WINGS] Instagram scanner/sidebar is disabled until release readiness");return}}'
if old_hd not in ct:
    # try alternate quote
    if '),hd();{' in ct:
        ct = ct.replace('),hd();{', ');{', 1)
        content.write_text(ct, encoding="utf-8")
        print("content hd removed (alt)")
    else:
        raise SystemExit("content hd() call not found")
else:
    content.write_text(ct.replace(old_hd, new_hd, 1), encoding="utf-8")
    print("content OK")

# --- 4) wings-skin.js: light mode on IG non-profile ---
skin_path = ROOT / "content-scripts" / "wings-skin.js"
skin_path.write_text(
    r'''/**
 * WINGS Research — light overlay skin
 * On Instagram home/explore/etc: idle (no DOM walk).
 * On profile pages / other overlay sites: remap ducks + brand.
 */
(() => {
  if (window.__WINGS_SKIN_V4__) return;
  window.__WINGS_SKIN_V4__ = true;

  const RESERVED = new Set([
    "reels","reel","explore","direct","accounts","p","stories","about","developer",
    "legal","privacy","terms","web","session","emails","challenge","oauth","ajax",
    "api","graphql","your_activity","inbox","notifications","nametag"
  ]);

  function isIg() {
    return /(^|\.)instagram\.com$/i.test(location.hostname);
  }

  function isIgProfile() {
    const m = (location.pathname || "").match(/^\/([A-Za-z0-9._]+)\/?(?:$|(?:reels?|tagged)\/?$)/);
    if (!m) return false;
    return !RESERVED.has(m[1].toLowerCase());
  }

  /** On IG, only skin when profile analysis UI can appear. */
  function shouldRun() {
    if (!isIg()) return true;
    return isIgProfile();
  }

  const COLOR_MAP = [
    [/#6d4aff/gi, "#2f7fc7"],
    [/#7c3aed/gi, "#2f7fc7"],
    [/#8b5cf6/gi, "#3d9cf0"],
    [/#a78bfa/gi, "#6eb6e8"],
    [/#ffd479/gi, "#8ec8f0"],
    [/rgb\(\s*109\s*,\s*74\s*,\s*255\s*\)/gi, "rgb(47, 127, 199)"],
  ];

  const TEXT_MAP = [
    [/하입덕\s*오리/g, "WINGS"],
    [/하입덕/g, "WINGS"],
    [/HypeDuck/g, "WINGS"],
    [/Hypeduck/g, "WINGS"],
    [/hypeduck/gi, "wings"],
  ];

  const W_MARK =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1a3a5c"/><text x="16" y="22" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="14" font-weight="700" fill="#8ec8f0">W</text></svg>'
    );

  function remapColors(s) {
    if (!s) return s;
    let out = s;
    for (const [re, to] of COLOR_MAP) out = out.replace(re, to);
    return out;
  }

  function remapText(s) {
    if (!s) return s;
    let out = s;
    for (const [re, to] of TEXT_MAP) out = out.replace(re, to);
    return out;
  }

  function isDuckAsset(src) {
    return /hypeduck|duck-load|expression\/|DuckBot|\/duck/i.test(src || "");
  }

  function replaceDuckNode(el) {
    if (!el || el.nodeType !== 1 || el.dataset?.wingsSkinned === "1") return;
    const tag = el.tagName;

    if (tag === "IMG" && isDuckAsset(el.getAttribute("src") || "")) {
      el.src = W_MARK;
      el.alt = "WINGS";
      el.dataset.wingsSkinned = "1";
      return;
    }

    const isMood =
      el.hasAttribute?.("data-duck-mood") ||
      el.hasAttribute?.("data-duck") ||
      el.hasAttribute?.("data-wings-slot") ||
      /DuckBot|duck-bot|duck-load|hd-duck/i.test(el.className || "");

    if (isMood) {
      if (el.hasAttribute?.("data-wings-mark") && el.querySelector("span,img")) {
        el.dataset.wingsSkinned = "1";
        return;
      }
      el.innerHTML = "";
      el.style.cssText =
        "display:inline-flex!important;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:#1a3a5c;overflow:hidden;";
      const img = document.createElement("img");
      img.src = W_MARK;
      img.alt = "WINGS";
      img.width = 28;
      img.height = 28;
      img.style.display = "block";
      el.appendChild(img);
      el.dataset.wingsSkinned = "1";
      return;
    }

    if (el.style?.cssText) {
      const next = remapColors(el.style.cssText);
      if (next !== el.style.cssText) el.style.cssText = next;
    }

    for (const attr of ["title", "aria-label", "alt", "placeholder"]) {
      const v = el.getAttribute?.(attr);
      if (!v) continue;
      const n = remapText(v);
      if (n !== v) el.setAttribute(attr, n);
    }
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      const v = node.nodeValue;
      if (v && /하입덕|HypeDuck|Hypeduck|hypeduck/i.test(v)) node.nodeValue = remapText(v);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
    replaceDuckNode(node);
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) walk(kids[i]);
  }

  function blockOldBrandNav() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target?.closest?.("a[href]");
        if (!a) return;
        const href = a.href || "";
        if (/hypeduck\.ai|youtube\.com\/pricing/i.test(href)) {
          e.preventDefault();
          e.stopPropagation();
          try {
            chrome.runtime?.openOptionsPage?.();
          } catch {
            /* ignore */
          }
        }
      },
      true
    );
  }

  let obs = null;
  let active = false;

  function stopSkin() {
    active = false;
    if (obs) {
      obs.disconnect();
      obs = null;
    }
  }

  function startSkin() {
    if (active) return;
    active = true;
    walk(document.documentElement);
    obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") walk(m.target);
        if (m.type === "attributes") replaceDuckNode(m.target);
        for (const n of m.addedNodes || []) walk(n);
      }
    });
    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "src", "title", "aria-label", "alt", "class", "data-duck-mood", "data-duck"],
    });
  }

  function sync() {
    if (shouldRun()) startSkin();
    else stopSkin();
  }

  function boot() {
    blockOldBrandNav();
    sync();
    window.addEventListener("wxt:locationchange", sync);
    // IG SPA fallback
    let last = location.pathname;
    setInterval(() => {
      if (location.pathname !== last) {
        last = location.pathname;
        sync();
      }
    }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
''',
    encoding="utf-8",
)
print("wings-skin OK")

# --- 5) narrow wings-skin matches in manifest (drop http/https *!*) ---
man = ROOT / "manifest.json"
mt = man.read_text(encoding="utf-8")
# Only replace the wings-skin block's wild matches carefully via unique context
old_skin_matches = '''    {
      "js": [
        "content-scripts/wings-skin.js"
      ],
      "css": [
        "content-scripts/wings-skin.css"
      ],
      "matches": [
        "https://*.instagram.com/*",
        "https://www.threads.com/*",
        "https://www.youtube.com/*",
        "https://*.tiktok.com/*",
        "https://www.tiktok.com/*",
        "https://*.douyin.com/*",
        "https://www.douyin.com/*",
        "https://*.rednote.com/*",
        "https://*.xiaohongshu.com/*",
        "https://www.coupang.com/*",
        "http://*/*",
        "https://*/*"
      ],
      "run_at": "document_idle"
    }'''
new_skin_matches = '''    {
      "js": [
        "content-scripts/wings-skin.js"
      ],
      "css": [
        "content-scripts/wings-skin.css"
      ],
      "matches": [
        "https://*.instagram.com/*",
        "https://www.threads.com/*",
        "https://www.youtube.com/*",
        "https://youtube.com/*",
        "https://m.youtube.com/*",
        "https://*.tiktok.com/*",
        "https://www.tiktok.com/*",
        "https://*.douyin.com/*",
        "https://www.douyin.com/*",
        "https://*.rednote.com/*",
        "https://*.xiaohongshu.com/*",
        "https://www.coupang.com/*"
      ],
      "run_at": "document_idle"
    }'''
if old_skin_matches not in mt:
    raise SystemExit("manifest wings-skin block not found")
mt = mt.replace(old_skin_matches, new_skin_matches, 1)
mt = mt.replace('"version": "0.3.65.9"', '"version": "0.3.65.10"')
mt = mt.replace('"version": "0.3.65.8"', '"version": "0.3.65.10"')
man.write_text(mt, encoding="utf-8")

bg = ROOT / "background.js"
bgt = bg.read_text(encoding="utf-8")
bgt = bgt.replace('wings_version: "0.3.65.9"', 'wings_version: "0.3.65.10"')
bgt = bgt.replace('wings_version: "0.3.65.8"', 'wings_version: "0.3.65.10"')
bg.write_text(bgt, encoding="utf-8")
print("manifest/version OK 0.3.65.10")

# verify
it = inter.read_text(encoding="utf-8")
assert "function shouldCapture()" in it
assert "shouldCapture()&&f.clone().text()" in it
assert "shouldCapture()&&(d._hdBody" in it
assert "if(!shouldCapture())return;const r=document.querySelectorAll" in it
print("verify OK")
