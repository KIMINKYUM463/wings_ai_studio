const FIELDS = [
  "openaiApiKey",
  "openaiBaseUrl",
  "openaiModel",
  "geminiApiKey",
  "geminiModel",
  "replicateApiToken",
  "coupangAccessKey",
  "coupangSecretKey",
  "coupangSubId",
  "wingsApiBase",
];

const DEFAULTS = {
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiModel: "gpt-4o-mini",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  replicateApiToken: "",
  coupangAccessKey: "",
  coupangSecretKey: "",
  coupangSubId: "",
  wingsApiBase: "",
};

function $(id) {
  return document.getElementById(id);
}

function readForm() {
  const out = {};
  for (const key of FIELDS) out[key] = String($(key)?.value || "").trim();
  return out;
}

function fillForm(data) {
  const merged = { ...DEFAULTS, ...data };
  for (const key of FIELDS) {
    if ($(key)) $(key).value = merged[key] || "";
  }
}

function setMsg(text, isErr) {
  const el = $("msg");
  el.hidden = !text;
  el.textContent = text || "";
  el.classList.toggle("err", Boolean(isErr));
}

async function refreshStatus() {
  const pill = $("statusPill");
  try {
    const bag = await chrome.storage.local.get("wings_settings");
    const s = { ...DEFAULTS, ...(bag.wings_settings || {}) };
    const hasAI = Boolean(s.openaiApiKey || s.geminiApiKey);
    const hasC = Boolean(s.coupangAccessKey && s.coupangSecretKey);
    if (hasAI && hasC) {
      pill.textContent = "AI·쿠팡 준비됨";
      pill.className = "pill ok";
    } else if (hasAI || hasC) {
      pill.textContent = s.geminiApiKey ? "Gemini 준비됨" : hasAI ? "AI만 설정됨" : "쿠팡만 설정됨";
      pill.className = "pill warn";
    } else {
      pill.textContent = "키 미설정";
      pill.className = "pill warn";
    }
  } catch {
    pill.textContent = "상태 오류";
    pill.className = "pill";
  }
}

async function load() {
  const bag = await chrome.storage.local.get("wings_settings");
  fillForm(bag.wings_settings || {});
  await refreshStatus();
}

$("btnSave").addEventListener("click", async () => {
  try {
    const next = readForm();
    await chrome.storage.local.set({ wings_settings: next });
    setMsg("저장되었습니다.", false);
    await refreshStatus();
  } catch (e) {
    setMsg(String(e?.message || e), true);
  }
});

$("btnLegacy").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options-legacy.html") });
});

$("btnExport").addEventListener("click", async () => {
  const bag = await chrome.storage.local.get(["wings_saved_results", "wings_decisions", "wings_analysis_jobs"]);
  const blob = new Blob([JSON.stringify(bag, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wings-research-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setMsg("내보내기 완료", false);
});

load();
