# -*- coding: utf-8 -*-
"""Gate IG feed analysis to profile pages only."""
from pathlib import Path

ROOT = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
feed = ROOT / "content-scripts" / "feed.js"
t = feed.read_text(encoding="utf-8")

# 1) Add profile path helper after Wi
old_wi = 'function Wi(e){const t=e.match(/^\\/([^/]+)\\/reels\\/?$/);if(!t)return null;const n=t[1];return Vi.has(n.toLowerCase())?null:n}function Xi(e){return Wi(e)!==null}'
new_wi = (
    'function Wi(e){const t=e.match(/^\\/([^/]+)\\/reels\\/?$/);if(!t)return null;const n=t[1];return Vi.has(n.toLowerCase())?null:n}'
    'function Pi(e){const t=(e||"").match(/^\\/([A-Za-z0-9._]+)\\/?(?:$|(?:reels?|tagged)\\/?$)/);if(!t)return null;const n=t[1];return Vi.has(n.toLowerCase())?null:n}'
    'function Xi(e){return Wi(e)!==null||Pi(e)!==null}'
)
if old_wi not in t:
    raise SystemExit("Wi block not found")
t = t.replace(old_wi, new_wi, 1)

# 2) Flip mt() gate: profile only
old_mt = "function mt(){k||(z&&(za()||Xo()||$n())?Ba():Wo())}"
new_mt = "function mt(){k||(z&&Pi(location.pathname)?Ba():Wo())}"
if old_mt not in t:
    raise SystemExit("mt() not found")
t = t.replace(old_mt, new_mt, 1)

# 3) Ua() profile scan (grid links + articles)
old_ua = 'function Ua(){if(Xo()){(document.querySelector("main")||document.body).querySelectorAll("a[href]").forEach(u=>La(u));return}if($n()){Na();return}document.querySelectorAll("article").forEach(ge)}'
new_ua = 'function Ua(){if(!Pi(location.pathname))return;const a=document.querySelector("main")||document.body;a.querySelectorAll("a[href]").forEach(u=>La(u)),a.querySelectorAll("article").forEach(ge)}'
if old_ua not in t:
    raise SystemExit("Ua() not found")
t = t.replace(old_ua, new_ua, 1)

feed.write_text(t, encoding="utf-8")
print("feed.js patched OK")

# 4) rescue only on profile
rescue = ROOT / "content-scripts" / "wings-ig-rescue.js"
rescue.write_text(
    """/**
 * WINGS IG rescue — only on profile pages; nudge stuck \"Analyzing\" chips.
 */
(() => {
  if (window.__WINGS_IG_RESCUE__) return;
  window.__WINGS_IG_RESCUE__ = true;

  const RESERVED = new Set([
    "reels","reel","explore","direct","accounts","p","stories","about","developer",
    "legal","privacy","terms","web","session","emails","challenge","oauth","ajax",
    "api","graphql","your_activity","inbox","notifications","nametag"
  ]);

  function isProfilePath(pathname) {
    const m = (pathname || "").match(/^\\/([A-Za-z0-9._]+)\\/?(?:$|(?:reels?|tagged)\\/?$)/);
    if (!m) return false;
    return !RESERVED.has(m[1].toLowerCase());
  }

  const started = new WeakMap();

  function scan() {
    if (!isProfilePath(location.pathname)) return;
    const chips = document.querySelectorAll(".hd-feed-chip");
    chips.forEach((chip) => {
      const text = (chip.textContent || "").replace(/\\s+/g, " ");
      const analyzing = /분석 중|Analyzing/i.test(text);
      if (!analyzing) {
        started.delete(chip);
        return;
      }
      const t0 = started.get(chip) || Date.now();
      if (!started.has(chip)) started.set(chip, t0);
      if (Date.now() - t0 < 8000) return;
      try {
        chip.removeAttribute("data-hd-feed");
        chip.style.opacity = "0.99";
        window.dispatchEvent(new Event("scroll"));
        chip.setAttribute("data-wings-rescue", String(Date.now()));
      } catch {
        /* ignore */
      }
    });
  }

  setInterval(scan, 2000);
  window.addEventListener("wxt:locationchange", scan);
})();
""",
    encoding="utf-8",
)
print("wings-ig-rescue.js patched OK")

# bump version
man = ROOT / "manifest.json"
mt = man.read_text(encoding="utf-8")
mt2 = mt.replace('"version": "0.3.65.8"', '"version": "0.3.65.9"')
if mt2 == mt:
    mt2 = mt.replace('"version": "0.3.65.7"', '"version": "0.3.65.9"')
man.write_text(mt2, encoding="utf-8")
bg = ROOT / "background.js"
bt = bg.read_text(encoding="utf-8")
bt = bt.replace('wings_version: "0.3.65.8"', 'wings_version: "0.3.65.9"')
bt = bt.replace('wings_version: "0.3.65.7"', 'wings_version: "0.3.65.9"')
bg.write_text(bt, encoding="utf-8")
print("version -> 0.3.65.9")

# verify
t = feed.read_text(encoding="utf-8")
assert "function Pi(e)" in t
assert "z&&Pi(location.pathname)?Ba():Wo()" in t
assert "if(!Pi(location.pathname))return" in t
assert "za()||Xo()||$n()" not in t[t.find("function mt()") : t.find("function mt()") + 80]
print("verify OK")
