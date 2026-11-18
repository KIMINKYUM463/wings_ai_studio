/* WINGS Research Local */

importScripts("wings-config.js", "wings-services.js", "background.core.js");

try {
  importScripts("wings-secrets.local.js");
} catch {
  /* optional */
}

function wingsSeedLocalSecrets() {
  const seed =
    typeof self !== "undefined" && self.__WINGS_SEED_SECRETS__ && typeof self.__WINGS_SEED_SECRETS__ === "object"
      ? self.__WINGS_SEED_SECRETS__
      : null;
  if (!seed) return;
  chrome.storage.local.get("wings_settings", (bag) => {
    const cur = bag?.wings_settings && typeof bag.wings_settings === "object" ? bag.wings_settings : {};
    const next = { ...cur };
    let changed = false;
    for (const [k, v] of Object.entries(seed)) {
      if (!String(next[k] || "").trim() && String(v || "").trim()) {
        next[k] = String(v).trim();
        changed = true;
      }
    }
    if (changed) chrome.storage.local.set({ wings_settings: next });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "WINGS_YT_AI_ANALYZE") {
    Promise.resolve()
      .then(() => WingsServices.analyzeYoutubeVideo(msg))
      .then((res) => sendResponse(res))
      .catch((err) =>
        sendResponse({ success: false, error: String(err?.message || err), code: "analyze_failed" })
      );
    return true;
  }

  if (msg?.type !== "WINGS_INJECT_IG_SORT") return;
  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse({ ok: false, error: "no-tab" });
    return;
  }
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ["content-scripts/sort.js"],
    })
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  const overlayPrefs = {
    youtube: { corner: "top-left", density: "normal", collapsed: false, enabled: true },
    threads: { corner: "top-right", density: "normal", collapsed: false, enabled: true },
    instagram: { corner: "top-left", density: "normal", collapsed: false, enabled: true },
    tiktok: { corner: "top-right", density: "normal", collapsed: false, enabled: true },
    rednote: { corner: "top-right", density: "normal", collapsed: false, enabled: true },
    douyin: { corner: "top-right", density: "normal", collapsed: false, enabled: true },
  };
  chrome.storage.local.set({
    wings_mode: "local",
    wings_version: "0.3.65.52",
    wings_unlock: "all",
    wingsOverlayGlobalEnabled: true,
    wingsOverlayPreferences: overlayPrefs,
    hypeduckOverlayGlobalEnabled: true,
    hypeduckOverlayPreferences: overlayPrefs,
  });
  wingsSeedLocalSecrets();
});

chrome.runtime.onStartup.addListener(() => {
  wingsSeedLocalSecrets();
});

wingsSeedLocalSecrets();
