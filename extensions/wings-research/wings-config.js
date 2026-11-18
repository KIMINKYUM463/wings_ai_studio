/**
 * WINGS Research — settings keys & defaults (service worker + options page).
 * chrome.storage.local key: wings_settings
 */
const WINGS_SETTINGS_KEY = "wings_settings";
const WINGS_SAVED_RESULTS_KEY = "wings_saved_results";
const WINGS_DECISIONS_KEY = "wings_decisions";
const WINGS_PERSONAS_KEY = "wings_personas";
const WINGS_ANALYSIS_JOBS_KEY = "wings_analysis_jobs";

const WINGS_DEFAULT_SETTINGS = {
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

async function wingsGetSettings() {
  const bag = await chrome.storage.local.get(WINGS_SETTINGS_KEY);
  return { ...WINGS_DEFAULT_SETTINGS, ...(bag[WINGS_SETTINGS_KEY] || {}) };
}

async function wingsSetSettings(partial) {
  const cur = await wingsGetSettings();
  const next = { ...cur, ...partial };
  await chrome.storage.local.set({ [WINGS_SETTINGS_KEY]: next });
  return next;
}

function wingsRequireOpenAI(settings) {
  const key = String(settings.openaiApiKey || "").trim();
  if (!key) {
    const err = new Error("OpenAI API 키가 없습니다. 확장 프로그램 설정에서 입력해 주세요.");
    err.code = "missing_openai_key";
    throw err;
  }
  return key;
}

function wingsRequireGemini(settings) {
  const key = String(settings.geminiApiKey || "").trim();
  if (!key) {
    const err = new Error("Gemini API 키가 없습니다. 확장 프로그램 설정에서 입력해 주세요.");
    err.code = "missing_gemini_key";
    throw err;
  }
  return key;
}

function wingsRequireCoupang(settings) {
  const accessKey = String(settings.coupangAccessKey || "").trim();
  const secretKey = String(settings.coupangSecretKey || "").trim();
  if (!accessKey || !secretKey) {
    const err = new Error("쿠팡 파트너스 Access/Secret 키가 없습니다. 설정에서 입력해 주세요.");
    err.code = "missing_coupang_keys";
    throw err;
  }
  return {
    accessKey,
    secretKey,
    subId: String(settings.coupangSubId || "").trim(),
  };
}

/** Default local personas when empty */
const WINGS_DEFAULT_PERSONAS = [
  { id: "seller-friendly", name: "친근한 판매자", tone: "따뜻하고 신뢰감 있게", lang: "ko" },
  { id: "trend-curator", name: "트렌드 큐레이터", tone: "짧고 훅 강하게", lang: "ko" },
  { id: "expert-review", name: "전문가 리뷰", tone: "팩트 중심, 과장 최소화", lang: "ko" },
];
