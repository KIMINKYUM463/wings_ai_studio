function $(id) {
  return document.getElementById(id);
}

function setFlag(el, ok, labelOk, labelOff) {
  el.textContent = ok ? labelOk : labelOff;
  el.className = ok ? "on" : "off";
}

async function ensureOverlayPrefsOn() {
  const GLOBAL_KEY = "wingsOverlayGlobalEnabled";
  const PREF_KEY = "wingsOverlayPreferences";
  const LEGACY_GLOBAL = "hypeduckOverlayGlobalEnabled";
  const LEGACY_PREF = "hypeduckOverlayPreferences";
  const bag = await chrome.storage.local.get([GLOBAL_KEY, PREF_KEY, LEGACY_GLOBAL, LEGACY_PREF]);
  const prefs =
    (bag[PREF_KEY] && typeof bag[PREF_KEY] === "object" && bag[PREF_KEY]) ||
    (bag[LEGACY_PREF] && typeof bag[LEGACY_PREF] === "object" && bag[LEGACY_PREF]) ||
    {};
  const next = { ...prefs };
  for (const plat of ["youtube", "instagram", "threads", "tiktok", "rednote", "douyin"]) {
    const cur = next[plat] && typeof next[plat] === "object" ? { ...next[plat] } : {};
    cur.enabled = true;
    if (!cur.corner) cur.corner = plat === "youtube" || plat === "instagram" ? "top-left" : "top-right";
    if (cur.collapsed == null) cur.collapsed = false;
    next[plat] = cur;
  }
  await chrome.storage.local.set({
    [GLOBAL_KEY]: true,
    [PREF_KEY]: next,
    [LEGACY_GLOBAL]: true,
    [LEGACY_PREF]: next,
  });
}

async function pingActiveTab() {
  const tabEl = $("tab");
  const actions = $("tabActions");
  const hint = $("tabHint");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      tabEl.textContent = "탭 없음";
      tabEl.className = "warn";
      return;
    }
    const isYt = /https:\/\/(www\.|m\.)?youtube\.com\//i.test(tab.url);
    if (!isYt) {
      tabEl.textContent = "YouTube 아님";
      tabEl.className = "warn";
      actions.hidden = false;
      hint.textContent =
        "오버레이는 YouTube(Shorts 포함)에서 표시됩니다. 아래 버튼으로 Shorts를 연 뒤, 확장 권한을 youtube.com 허용으로 두세요.";
      return;
    }
    let res = null;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { type: "WINGS_PING" });
    } catch {
      res = null;
    }
    if (res?.ok) {
      tabEl.textContent = res.hasYtOverlayHost ? "오버레이 로드됨" : "스크립트만 로드됨";
      tabEl.className = res.hasYtOverlayHost ? "on" : "warn";
      actions.hidden = false;
      hint.textContent = res.hasYtOverlayHost
        ? "오버레이 호스트가 감지됐습니다. 안 보이면 화면 좌상단(또는 설정한 모서리)을 확인하세요."
        : "확장은 로드됐지만 YouTube 오버레이 카드가 아직 없습니다. 탭을 새로고침 해보세요.";
    } else {
      tabEl.textContent = "미주입";
      tabEl.className = "off";
      actions.hidden = false;
      hint.textContent =
        "이 탭에 WINGS 스크립트가 없습니다. chrome://extensions → WINGS Research → ‘사이트 액세스’를 youtube.com(또는 모든 사이트)으로 허용한 뒤 탭을 새로고침하세요. (화면에 보이는 iq 아이콘은 다른 확장입니다.)";
    }
  } catch (e) {
    tabEl.textContent = "오류";
    tabEl.className = "off";
    actions.hidden = false;
    hint.textContent = String(e?.message || e);
  }
}

async function refresh() {
  await ensureOverlayPrefsOn();
  const bag = await chrome.storage.local.get(["wings_settings", "wings_saved_results", "wings_mode"]);
  const s = bag.wings_settings || {};
  const saved = Array.isArray(bag.wings_saved_results) ? bag.wings_saved_results : [];
  let count = 0;
  for (const e of saved) {
    if (Array.isArray(e?.reels)) count += e.reels.length;
    else count += 1;
  }
  $("mode").textContent = String(bag.wings_mode || "local").toUpperCase();
  setFlag($("ai"), Boolean(String(s.openaiApiKey || "").trim()), "설정됨", "미설정");
  setFlag(
    $("coupang"),
    Boolean(String(s.coupangAccessKey || "").trim() && String(s.coupangSecretKey || "").trim()),
    "설정됨",
    "미설정"
  );
  $("saved").textContent = `${count}건`;
  await pingActiveTab();
}

$("btnSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("btnOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("btnLegacy").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options-legacy.html") });
});
$("btnReloadTab").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.tabs.reload(tab.id);
  window.close();
});
$("btnOpenYt").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.youtube.com/shorts/" });
});

document.querySelectorAll("[data-url]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = btn.getAttribute("data-url");
    if (url) chrome.tabs.create({ url });
  });
});

$("btnExport").addEventListener("click", async () => {
  const bag = await chrome.storage.local.get([
    "wings_saved_results",
    "wings_decisions",
    "wings_analysis_jobs",
  ]);
  const blob = new Blob([JSON.stringify(bag, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wings-research-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

refresh();
