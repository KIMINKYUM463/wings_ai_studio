/**
 * Lightweight presence + overlay preference bootstrap for WINGS Research.
 */
(() => {
  if (window.__WINGS_PRESENCE__) return;
  window.__WINGS_PRESENCE__ = true;

  const GLOBAL_KEY = "wingsOverlayGlobalEnabled";
  const PREF_KEY = "wingsOverlayPreferences";
  const LEGACY_GLOBAL = "hypeduckOverlayGlobalEnabled";
  const LEGACY_PREF = "hypeduckOverlayPreferences";

  // Ensure overlays stay enabled (new + legacy keys).
  try {
    chrome.storage?.local?.get([GLOBAL_KEY, PREF_KEY, LEGACY_GLOBAL, LEGACY_PREF], (bag) => {
      const patch = {
        [GLOBAL_KEY]: true,
        [LEGACY_GLOBAL]: true,
      };
      const prefs =
        (bag[PREF_KEY] && typeof bag[PREF_KEY] === "object" && bag[PREF_KEY]) ||
        (bag[LEGACY_PREF] && typeof bag[LEGACY_PREF] === "object" && bag[LEGACY_PREF]) ||
        {};
      const next = { ...prefs };
      for (const plat of ["youtube", "instagram", "threads", "tiktok", "rednote", "douyin"]) {
        const cur = next[plat] && typeof next[plat] === "object" ? { ...next[plat] } : {};
        cur.enabled = true;
        if (!cur.corner) cur.corner = "top-left";
        if (cur.collapsed == null) cur.collapsed = false;
        next[plat] = cur;
      }
      patch[PREF_KEY] = next;
      patch[LEGACY_PREF] = next;
      chrome.storage.local.set(patch);
    });
  } catch {
    /* ignore */
  }

  chrome.runtime?.onMessage?.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "WINGS_PING") {
      sendResponse({
        ok: true,
        brand: "WINGS",
        href: location.href,
        hasYtOverlayHost: Boolean(document.querySelector("wings-yt-overlay, [data-hd-yt-card], [data-hd-yt]")),
        hasWingsBadge: Boolean(document.getElementById("wings-research-badge")),
      });
      return true;
    }
    return false;
  });

  // Visible status chip so user can confirm injection
  const ensureChip = () => {
    if (document.getElementById("wings-research-badge")) return;
    const b = document.createElement("div");
    b.id = "wings-research-badge";
    b.textContent = "WINGS";
    b.title = "WINGS Research 확장 프로그램이 이 페이지에 로드됨";
    document.documentElement.appendChild(b);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureChip, { once: true });
  } else {
    ensureChip();
  }
})();
