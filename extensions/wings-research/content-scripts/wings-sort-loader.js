/**
 * Deferred sort loader — only pull the heavy sort.js bundle on profile Reels tabs.
 */
(() => {
  if (window.__WINGS_SORT_LOADER__) return;
  window.__WINGS_SORT_LOADER__ = true;

  const RESERVED = new Set([
    "reels","reel","explore","direct","accounts","p","stories","about","developer",
    "legal","privacy","terms","web","session","emails","challenge","oauth","ajax",
    "api","graphql","your_activity","inbox","notifications","nametag"
  ]);

  function wantsSort(pathname) {
    const m = (pathname || "").match(/^\/([A-Za-z0-9._]+)\/reels\/?$/);
    if (!m) return false;
    return !RESERVED.has(m[1].toLowerCase());
  }

  let loading = false;
  let loaded = false;

  async function ensure() {
    if (loaded || loading) return;
    if (!wantsSort(location.pathname)) return;
    loading = true;
    try {
      await chrome.runtime.sendMessage({ type: "WINGS_INJECT_IG_SORT" });
      loaded = true;
    } catch {
      /* ignore */
    } finally {
      loading = false;
    }
  }

  ensure();
  window.addEventListener("wxt:locationchange", ensure);
  let last = location.pathname;
  setInterval(() => {
    if (location.pathname !== last) {
      last = location.pathname;
      ensure();
    }
  }, 1000);
})();
