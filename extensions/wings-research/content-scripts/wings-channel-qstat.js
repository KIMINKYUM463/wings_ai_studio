/**
 * Premium channel stats — charts + always-visible AI insights.
 * Freeze-safe: store-first, no MutationObserver, no full-page HTML.
 */
(() => {
  if (window.__WINGS_CHANNEL_QSTAT_V9__) return;
  window.__WINGS_CHANNEL_QSTAT_V9__ = true;

  const HOST_ID = "wings-channel-qstat";
  const MAX = 40;
  const CHART_N = 18;

  const ko = () => {
    try {
      return (chrome.i18n?.getUILanguage?.() || navigator.language || "").startsWith("ko");
    } catch {
      return (navigator.language || "").startsWith("ko");
    }
  };
  const t = (a, b) => (ko() ? a : b);
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");

  let lastSig = "";
  let lastPath = "";
  let aiTimer = null;

  function isChannel() {
    return /\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/.test(location.pathname);
  }

  function parseCount(raw) {
    if (raw == null) return null;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const s = String(raw).trim().replace(/,/g, "").replace(/\s+/g, "");
    if (!s) return null;
    const mKo = s.match(/^([\d.]+)(억|만|천)/);
    if (mKo) {
      const n = parseFloat(mKo[1]);
      if (!Number.isFinite(n)) return null;
      return mKo[2] === "억" ? n * 1e8 : mKo[2] === "만" ? n * 1e4 : n * 1e3;
    }
    const mEn = s.match(/^([\d.]+)([KMB])/i);
    if (mEn) {
      const n = parseFloat(mEn[1]);
      if (!Number.isFinite(n)) return null;
      const u = mEn[2].toUpperCase();
      return u === "K" ? n * 1e3 : u === "M" ? n * 1e6 : n * 1e9;
    }
    const n = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function fmt(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    if (ko()) {
      if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}억`;
      if (n >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}만`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}천`;
      return String(Math.round(n));
    }
    if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    return String(Math.round(n));
  }

  function median(arr) {
    const a = arr.filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function store() {
    try {
      return window.__hdYoutube || null;
    } catch {
      return null;
    }
  }

  function readFromStore() {
    const st = store();
    const views = [];
    let subs = null;
    if (!st) return { views, subs };
    const videos = st.videos;
    if (videos && typeof videos.values === "function") {
      for (const vid of videos.values()) {
        if (views.length >= MAX) break;
        const v = Number(vid?.viewCount);
        if (Number.isFinite(v) && v > 0) views.push(v);
        if (subs == null) {
          const s = Number(vid?.subscriberCount);
          if (Number.isFinite(s) && s > 0) subs = s;
        }
      }
    }
    const channels = st.channels;
    if (subs == null && channels && typeof channels.values === "function") {
      for (const ch of channels.values()) {
        const s = Number(ch?.subscriberCount);
        if (Number.isFinite(s) && s > 0) {
          subs = s;
          break;
        }
      }
    }
    return { views, subs };
  }

  function readTitle() {
    return (
      (
        document.querySelector(
          "#page-header h1, yt-dynamic-text-view-model h1, ytd-channel-name #text"
        )?.textContent || ""
      )
        .replace(/\s*-\s*YouTube\s*$/i, "")
        .trim() || t("채널", "Channel")
    );
  }

  function readSubsDom() {
    const header = document.querySelector(
      "#page-header, yt-page-header-renderer, ytd-page-header-renderer, ytd-c4-tabbed-header-renderer"
    );
    const text = (header?.textContent || "").slice(0, 800);
    let m =
      text.match(/([\d.,]+)\s*(억|만|천)?\s*구독자/) ||
      text.match(/([\d.,]+[KMB]?)\s*subscribers/i);
    if (!m) {
      const meta = document.querySelector("ytd-rich-item-renderer, yt-lockup-view-model")
        ?.textContent;
      const slice = (meta || "").slice(0, 400);
      m =
        slice.match(/([\d.,]+)\s*(억|만|천)\s*Subscribers/i) ||
        slice.match(/([\d.,]+)\s*(억|만|천)\s*구독자/);
    }
    if (!m) return null;
    const unit = m[2] || "";
    return parseCount(unit ? `${m[1]}${unit}` : m[1]);
  }

  function readViewsDom() {
    const out = [];
    const seen = new Set();
    const items = document.querySelectorAll(
      "ytd-rich-item-renderer, yt-lockup-view-model, ytd-grid-video-renderer"
    );
    for (const el of items) {
      if (out.length >= MAX) break;
      const label =
        el.querySelector("a#thumbnail, a#video-title-link, a[href*='/shorts/'], a[href*='watch']")
          ?.getAttribute("aria-label") || "";
      const meta = (el.textContent || "").slice(0, 300);
      const blob = `${label} ${meta}`;
      const m =
        blob.match(/([\d.,]+)\s*(억|만|천)?\s*회\b/) ||
        blob.match(/([\d.,]+[KMB]?)\s*views?\b/i);
      if (!m) continue;
      const unit = m[2] || "";
      const v = parseCount(unit ? `${m[1]}${unit}` : m[1]);
      if (v == null || v <= 0) continue;
      const href =
        el.querySelector("a[href*='/shorts/'], a[href*='watch']")?.getAttribute("href") ||
        String(out.length);
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(v);
    }
    return out;
  }

  function place(host) {
    const grid = document.querySelector("ytd-rich-grid-renderer");
    if (grid?.parentElement) {
      if (host.parentElement !== grid.parentElement || host.nextSibling !== grid) {
        grid.parentElement.insertBefore(host, grid);
      }
      return true;
    }
    const primary = document.querySelector("#primary");
    if (primary) {
      if (host.parentElement !== primary) primary.prepend(host);
      return true;
    }
    return false;
  }

  function ensure() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.className = "wings-channel-qstat";
      host.dataset.open = "1";
    }
    if (!place(host)) return null;
    return host;
  }

  function barChartSvg(views, med) {
    // Central-value relative bars (px height) so variation is always visible.
    const CAP = 8;
    const PLOT_H = 148;
    let sample = [...views].filter((v) => v > 0).sort((a, b) => a - b);
    if (sample.length > 24) {
      const picked = [];
      for (let i = 0; i < 24; i++) {
        picked.push(sample[Math.round((i / 23) * (sample.length - 1))]);
      }
      sample = picked;
    }
    if (!sample.length || !med || med <= 0) {
      return `<div class="wings-cq-chart-empty">${t("그래프 데이터 준비 중…", "Preparing chart…")}</div>`;
    }

    const multiples = sample.map((v) => v / med);
    const topMult = Math.max(...multiples);
    const topViews = Math.max(...sample);
    // Soft curve: sqrt so mid values still read as height changes
    const display = multiples.map((m) => Math.sqrt(Math.min(CAP, Math.max(0.12, m))));
    const maxDisp = Math.sqrt(CAP);

    const cols = sample
      .map((v, i) => {
        const m = multiples[i];
        const hPx = Math.max(10, Math.round((display[i] / maxDisp) * PLOT_H));
        const hot = m >= 3;
        const mid = m >= 1;
        const cls = hot ? "is-hot" : mid ? "is-mid" : "is-low";
        const lab = m >= 10 ? `${m.toFixed(0)}×` : `${m.toFixed(1)}×`;
        return `<div class="wings-cq-col ${cls}" style="--i:${i}" title="${fmt(v)} · ${m.toFixed(1)}×">
          <div class="wings-cq-col-bar">
            <span class="wings-cq-fill" data-h="${hPx}" data-i="${i}"></span>
          </div>
          <span class="wings-cq-col-lab">${lab}</span>
        </div>`;
      })
      .join("");

    const medPx = Math.max(10, Math.round((Math.sqrt(1) / maxDisp) * PLOT_H));

    return `<div class="wings-cq-risechart" role="img" aria-label="${t("조회수 분포", "Views distribution")}">
      <div class="wings-cq-hook">
        <div class="wings-cq-hook-k">${t("최고 히트", "Top hit")}</div>
        <div class="wings-cq-hook-v">${topMult >= 10 ? topMult.toFixed(0) : topMult.toFixed(1)}×</div>
        <div class="wings-cq-hook-s">${t("중앙값 대비", "vs median")} · ${fmt(topViews)}</div>
      </div>
      <div class="wings-cq-riseplot">
        <div class="wings-cq-ylabels">
          <span>${CAP}×+</span>
          <span>4×</span>
          <span>2×</span>
          <span>1×</span>
          <span>0</span>
        </div>
        <div class="wings-cq-riseframe">
          <div class="wings-cq-medline" style="bottom:${medPx + 22}px">
            <span>${t("중앙값", "Median")} 1×</span>
          </div>
          <div class="wings-cq-cols">${cols}</div>
        </div>
      </div>
      <div class="wings-cq-xaxis">
        <span>${t("낮은 조회", "Lower views")}</span>
        <span>${t("높은 조회", "Higher views")}</span>
      </div>
    </div>`;
  }

  function animateCountUps(root) {
    const nodes = root.querySelectorAll("[data-count]");
    nodes.forEach((el) => {
      const target = Number(el.getAttribute("data-count"));
      if (!Number.isFinite(target)) return;
      const isRatio = el.getAttribute("data-kind") === "ratio";
      const start = performance.now();
      const dur = 900;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const cur = target * eased;
        if (isRatio) el.textContent = `${cur.toFixed(2)}×`;
        else el.textContent = fmt(cur);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = isRatio ? `${target.toFixed(2)}×` : fmt(target);
      };
      requestAnimationFrame(tick);
    });
  }

  function animateBars(root) {
    const bars = root.querySelectorAll(".wings-cq-fill");
    bars.forEach((el) => {
      const hPx = Math.max(8, Number(el.getAttribute("data-h")) || 12);
      const delay = (Number(el.getAttribute("data-i")) || 0) * 45 + 80;
      el.style.setProperty("height", "0px", "important");
      el.style.setProperty("transition", "height 0.85s cubic-bezier(.16,1,.3,1)", "important");
      setTimeout(() => {
        el.style.setProperty("height", `${hPx}px`, "important");
      }, delay);
    });
  }

  function ringGauge(ratioNum) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const pct = ratioNum != null ? Math.max(0.04, Math.min(1, ratioNum / 6)) : 0.05;
    const offset = (c * (1 - pct)).toFixed(1);
    const label = ratioNum != null ? `${ratioNum.toFixed(2)}×` : "—";
    return `<div class="wings-cq-ring" aria-label="${t("조회/구독", "Views/sub")}">
      <svg viewBox="0 0 88 88" width="88" height="88">
        <circle class="wings-cq-ring-track" cx="44" cy="44" r="${r}" />
        <circle class="wings-cq-ring-val" cx="44" cy="44" r="${r}"
          stroke-dasharray="${c.toFixed(1)} ${c.toFixed(1)}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 44 44)" />
      </svg>
      <div class="wings-cq-ring-center">
        <strong>${label}</strong>
        <span>${t("도달", "Reach")}</span>
      </div>
    </div>`;
  }

  function meter(pct, label) {
    const p = Math.max(0, Math.min(100, pct || 0));
    return `<div class="wings-cq-meter" title="${label}">
      <div class="wings-cq-meter-row">
        <div class="wings-cq-meter-label">${esc(label)}</div>
        <div class="wings-cq-meter-pct">${p.toFixed(0)}%</div>
      </div>
      <div class="wings-cq-meter-track"><span style="--w:${p.toFixed(0)}%"></span></div>
    </div>`;
  }

  function buildInsights(views, med, subs) {
    const tips = [];
    const ratio = med && subs ? med / subs : null;
    const sorted = [...views].filter((v) => v > 0).sort((a, b) => a - b);
    const top = sorted[sorted.length - 1] || 0;
    const low = sorted[0] || 0;
    const spread = med ? top / Math.max(med, 1) : 0;

    if (ratio != null) {
      if (ratio >= 5) {
        tips.push({
          tag: t("도달", "Reach"),
          text: t(
            "조회/구독이 매우 높아요. 구독자 밖 알고리즘 도달이 강한 채널입니다.",
            "Views/sub is very high — strong algorithmic reach beyond subscribers."
          ),
        });
      } else if (ratio >= 2) {
        tips.push({
          tag: t("안정", "Steady"),
          text: t(
            "조회/구독이 안정적이에요. 숏폼 리듬을 유지하면 성장 여지가 큽니다.",
            "Solid views/sub — keep Shorts cadence for growth room."
          ),
        });
      } else {
        tips.push({
          tag: t("개선", "Improve"),
          text: t(
            "조회가 구독 대비 낮은 편이에요. 초반 3초 훅·자막 강조를 우선하세요.",
            "Views lag subscribers — prioritize the first 3s hook and captions."
          ),
        });
      }
    } else {
      tips.push({
        tag: t("수집", "Collect"),
        text: t(
          "구독·조회 샘플이 더 쌓이면 도달력 판단이 정확해집니다.",
          "More sub/view samples will sharpen the reach read."
        ),
      });
    }

    if (spread >= 4) {
      tips.push({
        tag: t("히트", "Hits"),
        text: t(
          "히트 편차가 커요. 상위 영상 포맷(훅·주제)을 복제하는 전략이 유효합니다.",
          "Wide hit spread — clone hooks/topics from top performers."
        ),
      });
    } else if (views.length >= 8) {
      tips.push({
        tag: t("균일", "Even"),
        text: t(
          "조회 분포가 비교적 고른 편이에요. 시리즈형 포맷이 잘 맞는 채널입니다.",
          "Fairly even views — series-style formats fit this channel."
        ),
      });
    }

    if (med != null && top > 0) {
      tips.push({
        tag: t("범위", "Range"),
        text: t(
          `샘플 최고 ${fmt(top)} · 중앙 ${fmt(med)} · 최저 ${fmt(low)}. 상위 패턴을 다음 업로드에 재사용하세요.`,
          `Peak ${fmt(top)} · median ${fmt(med)} · floor ${fmt(low)}. Reuse what top clips share.`
        ),
      });
    }

    if (!tips.length) {
      tips.push({
        tag: t("대기", "Wait"),
        text: t(
          "영상 데이터가 들어오는 대로 채널 요약을 작성합니다.",
          "Channel summary appears as video data arrives."
        ),
      });
    }
    return tips.slice(0, 3);
  }

  function startScan(host) {
    const ai = host.querySelector(".wings-cq-ai");
    if (!ai) return;
    const status = ai.querySelector(".wings-cq-ai-status");
    const stepsEl = ai.querySelectorAll(".wings-cq-step");
    if (host.dataset.aiDone === location.pathname) {
      ai.classList.remove("is-scanning");
      ai.classList.add("is-ready");
      if (status) status.textContent = t("채널 분석 완료", "Channel analysis ready");
      stepsEl.forEach((el) => el.classList.add("is-on"));
      return;
    }
    ai.classList.add("is-scanning");
    ai.classList.remove("is-ready");
    stepsEl.forEach((el) => el.classList.remove("is-on"));
    const steps = [
      t("조회 분포 스캔 중…", "Scanning view distribution…"),
      t("도달·구독 비율 계산 중…", "Computing reach vs subs…"),
      t("인사이트 정리 중…", "Drafting insights…"),
      t("채널 분석 완료", "Channel analysis ready"),
    ];
    let i = 0;
    if (status) status.textContent = steps[0];
    stepsEl[0]?.classList.add("is-on");
    clearTimeout(aiTimer);
    const tickStep = () => {
      i += 1;
      if (i < steps.length) {
        if (status) status.textContent = steps[i];
        stepsEl[i]?.classList.add("is-on");
        aiTimer = setTimeout(tickStep, 480);
      } else {
        ai.classList.remove("is-scanning");
        ai.classList.add("is-ready");
        host.dataset.aiDone = location.pathname;
      }
    };
    aiTimer = setTimeout(tickStep, 480);
  }

  function paint(host, title, views, med, subs) {
    const open = host.dataset.open !== "0";
    const ratioNum = med && subs ? med / subs : null;
    const ratio = ratioNum != null ? `${ratioNum.toFixed(2)}×` : "—";
    const insights = buildInsights(views, med, subs);
    const reachPct = ratioNum != null ? Math.min(100, (ratioNum / 6) * 100) : 12;
    const volumePct = views.length ? Math.min(100, (views.length / 40) * 100) : 8;
    const hitPct = (() => {
      if (!med || !views.length) return 10;
      const top = Math.max(...views);
      return Math.min(100, (top / Math.max(med, 1) / 8) * 100);
    })();
    const done = host.dataset.aiDone === location.pathname;

    host.innerHTML = `
      <div class="wings-cq-shell">
        <div class="wings-cq-glow" aria-hidden="true"></div>
        <button type="button" class="wings-cq-toggle" aria-expanded="${open}">
          <span class="wings-cq-brand" aria-hidden="true">W</span>
          <span class="wings-cq-head">
            <span class="wings-cq-kicker">WINGS · AI CHANNEL</span>
            <span class="wings-cq-title">${t("빠른 채널 통계", "Quick channel stats")} · ${esc(title)}</span>
          </span>
          <span class="wings-cq-count">${views.length ? views.length + t("개", "") : "…"}</span>
          <span class="wings-cq-chevron">${open ? "▴" : "▾"}</span>
        </button>
        <div class="wings-cq-body" ${open ? "" : "hidden"}>
          <div class="wings-cq-hero">
            <div class="wings-cq-hero-main">
              <div class="wings-cq-stat">
                <div class="wings-cq-label">${t("평균 조회", "Avg views")}</div>
                <div class="wings-cq-value" data-count="${med || 0}">0</div>
              </div>
              <div class="wings-cq-stat">
                <div class="wings-cq-label">${t("구독자", "Subs")}</div>
                <div class="wings-cq-value" data-count="${subs || 0}">0</div>
              </div>
              <div class="wings-cq-stat wings-cq-stat--accent">
                <div class="wings-cq-label">${t("조회/구독", "Views/sub")}</div>
                <div class="wings-cq-value" data-count="${ratioNum || 0}" data-kind="ratio">0.00×</div>
              </div>
              <div class="wings-cq-stat">
                <div class="wings-cq-label">${t("샘플", "Sample")}</div>
                <div class="wings-cq-value" data-count="${views.length || 0}">0</div>
              </div>
            </div>
            <div class="wings-cq-hero-side">
              ${ringGauge(ratioNum)}
              <div class="wings-cq-meters">
                ${meter(reachPct, t("도달력", "Reach"))}
                ${meter(hitPct, t("히트 편차", "Hit spread"))}
                ${meter(volumePct, t("샘플 밀도", "Sample density"))}
              </div>
            </div>
          </div>

          <div class="wings-cq-panel">
            <div class="wings-cq-panel-h">
              <span>${t("조회수 분포", "Views distribution")}</span>
              <span class="wings-cq-panel-sub">${t("중앙값 대비 배수 · 막대가 올라갑니다", "Multiples vs median · bars rise")}</span>
            </div>
            <div class="wings-cq-chart">${barChartSvg(views, med)}</div>
          </div>

          <div class="wings-cq-ai">
            <div class="wings-cq-ai-top">
              <span class="wings-cq-ai-orb" aria-hidden="true"></span>
              <div class="wings-cq-ai-copy">
                <div class="wings-cq-ai-label">${t("AI 채널 분석", "AI channel analysis")}</div>
                <div class="wings-cq-ai-status">${
                  done ? t("채널 분석 완료", "Channel analysis ready") : t("분석 준비…", "Preparing analysis…")
                }</div>
              </div>
              <div class="wings-cq-steps" aria-hidden="true">
                <i class="wings-cq-step${done ? " is-on" : ""}"></i>
                <i class="wings-cq-step${done ? " is-on" : ""}"></i>
                <i class="wings-cq-step${done ? " is-on" : ""}"></i>
                <i class="wings-cq-step${done ? " is-on" : ""}"></i>
              </div>
            </div>
            <div class="wings-cq-scan" aria-hidden="true"></div>
            <ul class="wings-cq-ai-list">
              ${insights
                .map(
                  (item, i) => `<li style="--i:${i}">
                  <span class="wings-cq-ai-tag">${esc(item.tag)}</span>
                  <span class="wings-cq-ai-text">${esc(item.text)}</span>
                </li>`
                )
                .join("")}
            </ul>
          </div>

          <p class="wings-cq-note">${t(
            "이 탭에 보이는 영상 기준 요약 · 규칙 기반 인사이트",
            "Summary from videos on this tab · rule-based insights"
          )}</p>
        </div>
      </div>`;

    host.querySelector(".wings-cq-toggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      host.dataset.open = host.dataset.open === "0" ? "1" : "0";
      lastSig = "";
      tick();
    });

    if (open && views.length) startScan(host);
    if (open) {
      animateCountUps(host);
      animateBars(host);
    }
  }

  function tick() {
    if (!isChannel()) {
      clearTimeout(aiTimer);
      document.getElementById(HOST_ID)?.remove();
      lastSig = "";
      lastPath = location.pathname;
      return;
    }
    if (lastPath !== location.pathname) {
      lastPath = location.pathname;
      lastSig = "";
      clearTimeout(aiTimer);
      const existing = document.getElementById(HOST_ID);
      if (existing) existing.dataset.aiDone = "";
    }
    const host = ensure();
    if (!host) return;

    const title = readTitle();
    const fromStore = readFromStore();
    let views = fromStore.views;
    let subs = fromStore.subs;
    if (!views.length) views = readViewsDom();
    if (subs == null) subs = readSubsDom();

    const med = median(views);
    const sig = [title, subs, views.length, Math.round(med || 0), host.dataset.open].join("|");
    if (sig === lastSig) return;
    lastSig = sig;
    paint(host, title, views, med, subs);
  }

  setTimeout(tick, 1500);
  setInterval(tick, 5000);
  window.addEventListener("yt-navigate-finish", () => {
    lastSig = "";
    setTimeout(tick, 600);
  });
})();
