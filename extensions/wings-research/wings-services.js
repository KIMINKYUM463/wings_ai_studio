/**
 * WINGS Research — local service implementations (OpenAI + Coupang Partners).
 * Loaded in service worker via importScripts before background.core.js.
 */
/* global wingsGetSettings, wingsRequireOpenAI, wingsRequireCoupang,
   WINGS_SAVED_RESULTS_KEY, WINGS_DECISIONS_KEY, WINGS_PERSONAS_KEY,
   WINGS_ANALYSIS_JOBS_KEY, WINGS_DEFAULT_PERSONAS, wingsSetSettings */

async function wingsHmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function wingsCoupangSignedDate(now = new Date()) {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .slice(2);
}

async function wingsCoupangRequest({ method, path, query = "", body = null, accessKey, secretKey }) {
  const datetime = wingsCoupangSignedDate();
  const message = `${datetime}${method}${path}${query}`;
  const signature = await wingsHmacSha256Hex(secretKey, message);
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  const url = `https://api-gateway.coupang.com${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error(`쿠팡 API 실패 (${res.status}): ${text.slice(0, 240)}`);
    err.code = `http_${res.status}`;
    throw err;
  }
  return json;
}

async function wingsOpenAIChat({ system, user, temperature = 0.7 }) {
  const settings = await wingsGetSettings();
  const apiKey = wingsRequireOpenAI(settings);
  const base = String(settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = String(settings.openaiModel || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = "openai_error";
    throw err;
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }
  return text.trim();
}

async function wingsGeminiChat({ system, user, temperature = 0.3 }) {
  const settings = await wingsGetSettings();
  const apiKey = wingsRequireGemini(settings);
  const model = String(settings.geminiModel || "gemini-2.5-flash").trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = [system ? `시스템:\n${system}` : "", user ? `요청:\n${user}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = "gemini_error";
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
  if (!String(text).trim()) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }
  return String(text).trim();
}

function wingsParseJsonLoose(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

const WingsServices = {
  async status() {
    const s = await wingsGetSettings();
    return {
      ok: true,
      mode: "wings_local",
      hasOpenAI: Boolean(String(s.openaiApiKey || "").trim()),
      hasGemini: Boolean(String(s.geminiApiKey || "").trim()),
      hasCoupang: Boolean(String(s.coupangAccessKey || "").trim() && String(s.coupangSecretKey || "").trim()),
      hasReplicate: Boolean(String(s.replicateApiToken || "").trim()),
      model: s.openaiModel || "gpt-4o-mini",
      geminiModel: s.geminiModel || "gemini-2.5-flash",
    };
  },

  async threadsGenerate(msg) {
    const style = String(msg?.stylePreset || msg?.style || "default");
    const mode = msg?.rewriteMode === "faithful" ? "faithful" : "creative";
    const instruction = String(msg?.instruction || "").trim();
    const source =
      String(msg?.sourceText || msg?.caption || msg?.text || msg?.draftText || "").trim() ||
      (instruction ? "" : "원문 없음 — 짧은 쇼핑/콘텐츠 홍보 글 작성");
    const productHint = msg?.productId != null ? `상품ID: ${msg.productId}` : "";
    const text = await wingsOpenAIChat({
      system:
        "당신은 한국어 SNS(Threads) 카피라이터입니다. 해시태그는 0~3개, 과장·허위 광고 금지. 결과만 출력하세요.",
      user: [
        `스타일 프리셋: ${style}`,
        `모드: ${mode === "faithful" ? "원문 의미 유지 재작성" : "창의적 재작성"}`,
        productHint,
        instruction ? `추가 지시: ${instruction}` : "",
        `원문/소재:\n${source || "(없음)"}`,
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: mode === "faithful" ? 0.4 : 0.85,
    });
    return { ok: true, text, mode: "wings_local" };
  },

  async threadsPresets() {
    return {
      presets: [
        { id: "hook", label: "훅 강하게" },
        { id: "soft-sell", label: "소프트 세일" },
        { id: "review", label: "사용 후기" },
        { id: "listicle", label: "리스트형" },
        { id: "local", label: "WINGS Local" },
      ],
      mode: "wings_local",
    };
  },

  async threadsModels() {
    const s = await wingsGetSettings();
    return {
      ok: true,
      models: [
        { id: s.openaiModel || "gpt-4o-mini", label: s.openaiModel || "gpt-4o-mini" },
        { id: "gpt-4o", label: "gpt-4o" },
        { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      ],
      mode: "wings_local",
    };
  },

  async startAnalysis(msg) {
    const reelCode = String(msg?.reelCode || "").trim();
    const reelUrl = String(msg?.reelUrl || "").trim();
    const caption = String(msg?.caption || msg?.title || "").trim();
    const jobId = `wings-analysis-${Date.now()}`;
    let analysis = null;
    let error = null;
    try {
      const raw = await wingsOpenAIChat({
        system:
          "콘텐츠 리서치 분석가. JSON만 출력: {summary,hooks:string[],audience,cta,risks:string[],score:1-100}",
        user: `code=${reelCode}\nurl=${reelUrl}\ncaption=${caption || "(없음)"}\n이 숏폼/릴스 성과·후킹·개선점을 분석하세요.`,
        temperature: 0.3,
      });
      try {
        analysis = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      } catch {
        analysis = { summary: raw, hooks: [], audience: "", cta: "", risks: [], score: null };
      }
    } catch (e) {
      error = String(e?.message || e);
    }
    const job = {
      id: jobId,
      status: error ? "failed" : "done",
      reelCode,
      reelUrl,
      analysis,
      error,
      createdAt: Date.now(),
      mode: "wings_local",
    };
    const bag = await chrome.storage.local.get(WINGS_ANALYSIS_JOBS_KEY);
    const prev = Array.isArray(bag[WINGS_ANALYSIS_JOBS_KEY]) ? bag[WINGS_ANALYSIS_JOBS_KEY] : [];
    prev.unshift(job);
    if (prev.length > 100) prev.length = 100;
    await chrome.storage.local.set({ [WINGS_ANALYSIS_JOBS_KEY]: prev });
    if (error) return { success: false, error, jobId, mode: "wings_local" };
    return { success: true, jobId, status: "done", analysis, mode: "wings_local" };
  },

  async enrichReel(msg) {
    const code = String(msg?.code || "").trim();
    try {
      const raw = await wingsOpenAIChat({
        system:
          "숏폼 메타데이터 enrich. JSON만: {title,tags:string[],category,scriptOutline:string[],sellingPoints:string[]}",
        user: `릴스/숏폼 코드: ${code}\n공개 정보만으로 추정 enrich 하세요. 모르는 값은 빈 값.`,
        temperature: 0.4,
      });
      let data;
      try {
        data = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      } catch {
        data = { title: raw, tags: [], category: "", scriptOutline: [], sellingPoints: [] };
      }
      return { success: true, data: { code, enriched: true, ...data, mode: "wings_local" } };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
  },

  async analyzeYoutubeVideo(msg) {
    const videoId = String(msg?.videoId || "").trim();
    const title = String(msg?.title || "").trim();
    const channelName = String(msg?.channelName || "").trim();
    const description = String(msg?.description || "").trim();
    const transcript = String(msg?.transcript || "").trim();
    const metrics = msg?.metrics && typeof msg.metrics === "object" ? msg.metrics : {};
    if (!videoId && !title && !transcript) {
      return { success: false, error: "분석할 영상 정보가 없습니다.", code: "missing_video" };
    }
    try {
      const raw = await wingsGeminiChat({
        system: `당신은 유튜브 숏폼/영상 리서치 분석가입니다.
반드시 JSON 객체만 반환하세요.
제공된 제목·채널·지표·자막/대본을 근거로 분석하세요.
모르는 값은 빈 문자열/빈 배열로 두세요. 없는 수치를 지어내지 마세요.

응답 형식:
{
  "summary": "영상 한줄 요약",
  "hook": "초반 3초 훅 분석",
  "audience": "추정 타깃 시청자",
  "emotion": "감정/톤",
  "scriptStructure": [
    {"beat":"훅","seconds":"0-3","line":"추정 대사/화면","purpose":"목적"}
  ],
  "fullScriptOutline": ["장면1 ...","장면2 ..."],
  "keyLines": ["핵심 문장1","핵심 문장2"],
  "cta": "CTA/전환 유도",
  "whyItWorks": ["잘된 점1","잘된 점2"],
  "improvements": ["개선점1","개선점2"],
  "remixIdeas": ["재창작 아이디어1","재창작 아이디어2"],
  "score": 0
}`,
        user: JSON.stringify(
          {
            videoId,
            title,
            channelName,
            description: description.slice(0, 2500),
            transcript: transcript.slice(0, 12000),
            metrics,
            url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
          },
          null,
          2
        ),
        temperature: 0.35,
      });
      const parsed = wingsParseJsonLoose(raw) || {
        summary: raw,
        scriptStructure: [],
        fullScriptOutline: [],
        keyLines: [],
        whyItWorks: [],
        improvements: [],
        remixIdeas: [],
        score: null,
      };
      const analysis = {
        summary: String(parsed.summary || "").trim(),
        hook: String(parsed.hook || "").trim(),
        audience: String(parsed.audience || "").trim(),
        emotion: String(parsed.emotion || "").trim(),
        scriptStructure: Array.isArray(parsed.scriptStructure) ? parsed.scriptStructure : [],
        fullScriptOutline: Array.isArray(parsed.fullScriptOutline)
          ? parsed.fullScriptOutline.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        keyLines: Array.isArray(parsed.keyLines)
          ? parsed.keyLines.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        cta: String(parsed.cta || "").trim(),
        whyItWorks: Array.isArray(parsed.whyItWorks)
          ? parsed.whyItWorks.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        remixIdeas: Array.isArray(parsed.remixIdeas)
          ? parsed.remixIdeas.map((x) => String(x || "").trim()).filter(Boolean)
          : [],
        score:
          parsed.score == null || parsed.score === ""
            ? null
            : Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      };
      return {
        success: true,
        analysis,
        model: (await wingsGetSettings()).geminiModel || "gemini-2.5-flash",
        mode: "wings_local_gemini",
      };
    } catch (e) {
      return {
        success: false,
        error: String(e?.message || e),
        code: e?.code || "analyze_failed",
      };
    }
  },

  async convertCoupangLink(msg) {
    const url = String(msg?.url || "").trim();
    if (!/^https:\/\//i.test(url)) return { success: false, code: "invalid_url" };
    try {
      const settings = await wingsGetSettings();
      const creds = wingsRequireCoupang(settings);
      const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
      const body = { coupangUrls: [url] };
      if (creds.subId) body.subId = creds.subId;
      const json = await wingsCoupangRequest({
        method: "POST",
        path,
        query: "",
        body,
        accessKey: creds.accessKey,
        secretKey: creds.secretKey,
      });
      const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
      const deeplink =
        (row && (row.shortenUrl || row.landingUrl || row.originalUrl || row.url)) ||
        (typeof row === "string" ? row : null);
      if (!deeplink) {
        return { success: false, code: "empty_deeplink", raw: json };
      }
      return { success: true, url: deeplink, deeplink, data: json, mode: "wings_local" };
    } catch (e) {
      return { success: false, code: e?.code || "network_error", error: String(e?.message || e) };
    }
  },

  async coupangCapability() {
    const s = await wingsGetSettings();
    const enabled = Boolean(String(s.coupangAccessKey || "").trim() && String(s.coupangSecretKey || "").trim());
    return enabled
      ? { enabled: true, mode: "wings_local" }
      : { enabled: false, code: "not_configured", mode: "wings_local" };
  },

  async saveCoupangCredentials(msg) {
    const accessKey = String(msg?.accessKey || "").trim();
    const secretKey = String(msg?.secretKey || "").trim();
    if (!accessKey || !secretKey) return { success: false, code: "invalid_credentials" };
    await wingsSetSettings({ coupangAccessKey: accessKey, coupangSecretKey: secretKey });
    return { success: true, mode: "wings_local" };
  },

  async getResults() {
    const bag = await chrome.storage.local.get(WINGS_SAVED_RESULTS_KEY);
    const entries = Array.isArray(bag[WINGS_SAVED_RESULTS_KEY]) ? bag[WINGS_SAVED_RESULTS_KEY] : [];
    const reels = [];
    for (const entry of entries) {
      if (Array.isArray(entry?.reels)) reels.push(...entry.reels);
    }
    return { success: true, reels, entries, total: reels.length, mode: "wings_local" };
  },

  async saveDecisions(msg) {
    const decisions = Array.isArray(msg?.decisions) ? msg.decisions : [];
    const account = msg?.account || null;
    const stats = msg?.stats || {};
    if (!account) return { success: false, error: "no account" };
    const bag = await chrome.storage.local.get(WINGS_DECISIONS_KEY);
    const prev = Array.isArray(bag[WINGS_DECISIONS_KEY]) ? bag[WINGS_DECISIONS_KEY] : [];
    prev.unshift({ savedAt: Date.now(), account, stats, decisions });
    if (prev.length > 200) prev.length = 200;
    await chrome.storage.local.set({ [WINGS_DECISIONS_KEY]: prev });
    return { success: true, saved: decisions.length, mode: "wings_local" };
  },

  async loadPersonas() {
    const bag = await chrome.storage.local.get(WINGS_PERSONAS_KEY);
    let personas = bag[WINGS_PERSONAS_KEY];
    if (!Array.isArray(personas) || personas.length === 0) {
      personas = WINGS_DEFAULT_PERSONAS;
      await chrome.storage.local.set({ [WINGS_PERSONAS_KEY]: personas });
    }
    return { success: true, personas, mode: "wings_local" };
  },

  async parseCaptionLink(msg) {
    const caption = String(msg?.caption || "");
    const urls = [...caption.matchAll(/https?:\/\/[^\s)>\]]+/gi)].map((m) => m[0]);
    if (urls.length) {
      return { success: true, url: urls[0], urls, via: "regex", mode: "wings_local" };
    }
    // optional AI assist when no URL visible
    try {
      const raw = await wingsOpenAIChat({
        system: "캡션에서 쇼핑몰/쿠팡/링크트리 URL만 추출. JSON만: {url:string|null,urls:string[]}",
        user: caption.slice(0, 4000) || "(빈 캡션)",
        temperature: 0,
      });
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
      return { success: Boolean(parsed?.url), ...parsed, via: "openai", mode: "wings_local" };
    } catch (e) {
      return { success: false, error: String(e?.message || e), mode: "wings_local" };
    }
  },
};

self.WingsServices = WingsServices;
