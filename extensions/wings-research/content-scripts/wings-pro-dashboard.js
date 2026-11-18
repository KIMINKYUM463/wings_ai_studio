/**
 * WINGS Pro Research Dashboard
 * Replaces the legacy consumer "sort" panel with a denser research console + Chart.js.
 */
(() => {
  if (window.__WINGS_PRO_DASH__) return;
  window.__WINGS_PRO_DASH__ = true;

  const GRADES = ["전체", "폭발", "강력", "우수", "보통", "약함"];
  const GRADE_COLOR = {
    폭발: "#2dd4bf",
    강력: "#38bdf8",
    우수: "#a3e635",
    보통: "#94a3b8",
    약함: "#64748b",
  };

  let reels = [];
  let filter = "전체";
  let sortKey = "playCount";
  let sortDir = "desc";
  let chartViews = null;
  let chartGrade = null;
  let root = null;

  function logoUrl() {
    try {
      return chrome.runtime.getURL("icons/wings-btn-32.png");
    } catch {
      return "";
    }
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /** Prefer the strongest positive count — `??` treats 0 as valid and skips fallbacks. */
  function pickCount(...vals) {
    let best = 0;
    for (const v of vals) {
      const n = num(v);
      if (n > best) best = n;
    }
    return best;
  }

  function fmt(n) {
    n = num(n);
    if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}억`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}만`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}천`;
    return String(Math.round(n));
  }

  function engPct(r) {
    const v = num(r.engagementRate);
    if (!v) {
      const views = num(r.playCount);
      if (!views) return 0;
      return ((num(r.likeCount) + num(r.commentCount)) / views) * 100;
    }
    return v <= 1 ? v * 100 : v;
  }

  function median(arr) {
    const a = arr.filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function multiple(r, med) {
    if (r.multiple != null) return num(r.multiple);
    const views = num(r.playCount);
    return med > 0 ? views / med : 0;
  }

  function assignGrades(list) {
    const med = median(list.map((r) => r.playCount));
    return list.map((r) => {
      const m = med > 0 ? r.playCount / med : 0;
      let grade = r.grade;
      if (!grade || !GRADE_COLOR[grade]) {
        if (m >= 30) grade = "폭발";
        else if (m >= 10) grade = "강력";
        else if (m >= 3) grade = "우수";
        else if (m >= 1) grade = "보통";
        else grade = "약함";
      }
      return { ...r, grade, multiple: m, engagementRate: engPct(r) / 100 };
    });
  }

  function pickTakenAt(r) {
    const candidates = [
      r.takenAt,
      r.taken_at,
      r.taken_at_timestamp,
      r.timestamp,
      r.postedAt,
      r.posted_at,
      r.created_at,
      r.device_timestamp,
      r?.caption?.created_at,
      r?.media?.taken_at,
      r?.raw?.taken_at,
      r?.raw?.taken_at_timestamp,
      r?.raw?.device_timestamp,
    ];
    for (const c of candidates) {
      const n = num(c);
      if (n > 0) return n;
    }
    return 0;
  }

  /** Instagram 그리드에 보이는 조회수(1.2만, 12K 등)를 code → 숫자로 읽음 */
  function parseKoCount(raw) {
    if (raw == null) return 0;
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : 0;
    let s = String(raw).trim().replace(/,/g, "").replace(/\s+/g, "");
    if (!s) return 0;
    const m = s.match(/^([\d.]+)\s*([만천억KkMmBb]|회|views?|plays?)?/i);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const u = (m[2] || "").toLowerCase();
    if (u === "억") n *= 1e8;
    else if (u === "만") n *= 1e4;
    else if (u === "천" || u === "k") n *= 1e3;
    else if (u === "m") n *= 1e6;
    else if (u === "b") n *= 1e9;
    return Math.round(n);
  }

  function scrapeDomViews() {
    const out = new Map();
    try {
      const links = document.querySelectorAll('a[href*="/reel/"]');
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
        if (!m) continue;
        const code = m[1];
        if (out.has(code) && out.get(code) > 0) continue;
        let best = 0;
        const aria = a.getAttribute("aria-label") || "";
        const ariaHit = aria.match(/([\d.,]+)\s*(만|천|억|[KkMmBb])?\s*(회|views?|plays?|조회)?/i);
        if (ariaHit) best = Math.max(best, parseKoCount(ariaHit[0]));
        const texts = a.querySelectorAll("span, div");
        for (const el of texts) {
          const t = (el.textContent || "").trim();
          if (!t || t.length > 18) continue;
          if (!/^[\d.,]+([만천억KkMmBb])?$/.test(t.replace(/\s/g, ""))) continue;
          best = Math.max(best, parseKoCount(t));
        }
        if (best > 0) out.set(code, best);
      }
    } catch {
      /* ignore */
    }
    return out;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function buildTrend(list) {
    const months = new Map();
    let dated = 0;
    for (const r of list) {
      let ts = r.takenAt;
      if (ts && ts < 1e12) ts *= 1000;
      const d = ts ? new Date(ts) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      dated += 1;
      const key = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(r.playCount);
    }
    if (dated >= 3 && months.size >= 2) {
      const trend = [...months.entries()]
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([k, arr]) => ({ label: k, value: avg(arr) }));
      return { trend, mode: "month", title: "월별 평균 조회 추이", hint: "라인 · 게시 시점" };
    }

    // 날짜가 거의 없으면 수집 순서를 구간으로 나눠 라인이 보이도록 함
    const ordered = [...list];
    const bins = Math.min(8, Math.max(3, Math.ceil(ordered.length / 5)));
    const size = Math.max(1, Math.ceil(ordered.length / bins));
    const trend = [];
    for (let i = 0; i < bins; i++) {
      const slice = ordered.slice(i * size, (i + 1) * size);
      if (!slice.length) break;
      const from = i * size + 1;
      const to = i * size + slice.length;
      trend.push({ label: `${from}-${to}`, value: avg(slice.map((r) => r.playCount)) });
    }
    if (!trend.length && list.length) {
      trend.push({ label: "전체", value: avg(list.map((r) => r.playCount)) });
    }
    return { trend, mode: "bin", title: "구간별 평균 조회", hint: "라인 · 수집 순서" };
  }

  function normalize(list) {
    const domViews = scrapeDomViews();
    const base = (list || [])
      .map((r) => {
        const code = String(r.code || r.id || r.pk || r.media_id || "");
        const playCount = pickCount(
          r.playCount,
          r.play_count,
          r.ig_play_count,
          r.view_count,
          r.viewCount,
          r.plays,
          r.video_view_count,
          r.fb_play_count,
          r?.media?.play_count,
          r?.media?.ig_play_count,
          r?.media?.view_count,
          r?.media?.video_view_count,
          r?.raw?.play_count,
          r?.raw?.ig_play_count,
          r?.raw?.view_count,
          r?.raw?.video_view_count,
          r?.raw?.fb_play_count,
          code ? domViews.get(code) : 0
        );
        return {
          code,
          caption: r.caption?.text || r.caption || r.title || r.text || "",
          playCount,
          likeCount: pickCount(r.likeCount, r.like_count, r.likes, r?.raw?.like_count, r?.media?.like_count),
          commentCount: pickCount(
            r.commentCount,
            r.comment_count,
            r.comments,
            r?.raw?.comment_count,
            r?.media?.comment_count
          ),
          engagementRate: num(r.engagementRate),
          grade: r.grade || "",
          takenAt: pickTakenAt(r),
          url: r.url || (code ? `https://www.instagram.com/reel/${code}/` : ""),
          username: r.username || r.user?.username || "",
          raw: r,
        };
      })
      .filter((r) => r.playCount > 0 || r.code);
    return assignGrades(base);
  }

  function stats(list) {
    const views = list.map((r) => r.playCount);
    const med = median(views);
    const mean = views.length ? avg(views) : 0;
    const meanEng = list.length
      ? list.reduce((a, r) => a + r.engagementRate, 0) / list.length
      : 0;
    const hit = views.filter((v) => med > 0 && v >= med * 2).length;
    const top = med > 0 ? Math.max(0, ...views) / med : 0;
    const byGrade = { 폭발: 0, 강력: 0, 우수: 0, 보통: 0, 약함: 0 };
    for (const r of list) {
      const g = byGrade[r.grade] != null ? r.grade : "보통";
      byGrade[g] += 1;
    }
    const { trend, mode, title, hint } = buildTrend(list);

    return {
      med,
      mean,
      meanEng,
      hit,
      hitRate: list.length ? hit / list.length : 0,
      top,
      byGrade,
      trend,
      trendMode: mode,
      trendTitle: title,
      trendHint: hint,
      count: list.length,
    };
  }

  function filtered(tagged) {
    const base = filter === "전체" ? tagged : tagged.filter((r) => r.role === filter);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (num(av) - num(bv)) * dir;
    });
  }

  function clipCard(r, s) {
    const line = firstLine(capText(r)) || "캡션 없음 — 영상만 열어서 첫 1초를 확인";
    const href = r.url ? `href="${esc(r.url)}" target="_blank" rel="noreferrer"` : "";
    return `<a class="wpd-clip" ${href}>
      <span class="wpd-clip-meta">${esc(r.role)} · ${fmt(r.playCount)} · 반응 ${(r.engagementRate * 100).toFixed(1)}%</span>
      <strong>${esc(line)}</strong>
      <em>보통의 ${multiple(r, s.med).toFixed(1)}배</em>
    </a>`;
  }

  function patternHtml(title, p, tone) {
    if (!p) return `<article class="wpd-pat ${tone}"><h3>${title}</h3><p>비교할 영상이 아직 적습니다.</p></article>`;
    return `<article class="wpd-pat ${tone}">
      <h3>${title}</h3>
      <ul>
        <li><b>${p.avgLen}자</b><span>캡션 평균 길이</span></li>
        <li><b>${p.q}%</b><span>물음표가 있는 영상</span></li>
        <li><b>${p.num}%</b><span>숫자가 들어간 영상</span></li>
        <li><b>${p.short}%</b><span>40자 이하 한 줄</span></li>
        <li><b>${p.cmt.toFixed(2)}%</b><span>조회 대비 댓글</span></li>
        <li><b>${p.like.toFixed(1)}%</b><span>조회 대비 좋아요</span></li>
      </ul>
      ${p.sample ? `<p class="wpd-sample">예: ${esc(p.sample)}</p>` : ""}
    </article>`;
  }

  function mainEl() {
    return document.querySelector("main") || document.querySelector('[role="main"]');
  }

  function profileHeader(main) {
    const headers = [...main.querySelectorAll("header")];
    // 팔로워/소개가 있는 프로필 헤더. 상단 사이트 바는 제외
    return (
      headers.find((h) => /팔로워|followers|게시물|posts/i.test(h.textContent || "")) ||
      headers[headers.length - 1] ||
      null
    );
  }

  /** 릴스 그리드 시작점. 이 노드 '앞'에 붙이면 프로필·탭 아래가 된다 */
  function findGridBlock(main, header) {
    const reel = main.querySelector('a[href*="/reel/"]');
    if (!reel) return null;
    let node = reel;
    while (node.parentElement && node.parentElement !== main) {
      if (header && node.parentElement.contains(header)) break;
      node = node.parentElement;
    }
    if (header && node.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return null;
    }
    return node;
  }

  function placeRoot(el) {
    const main = mainEl();
    if (!main) return false;
    const header = profileHeader(main);
    const grid = findGridBlock(main, header);

    // 그리드 바로 앞 = 프로필과 탭 아래, 영상 목록 위
    if (grid?.parentElement) {
      if (el.nextElementSibling !== grid) grid.parentElement.insertBefore(el, grid);
      return true;
    }
    if (header) {
      if (el.previousElementSibling !== header) header.insertAdjacentElement("afterend", el);
      return true;
    }
    return false;
  }

  function pinBox(el) {
    el.style.setProperty("width", "min(1180px, calc(100% - 40px))", "important");
    el.style.setProperty("max-width", "1180px", "important");
    el.style.setProperty("margin", "16px auto 20px", "important");
    el.style.setProperty("align-self", "center", "important");
    el.style.setProperty("flex", "0 0 auto", "important");
  }

  function ensureRoot() {
    if (!root || !document.body.contains(root)) {
      root = document.getElementById("wings-pro-dash");
      if (!root) {
        root = document.createElement("section");
        root.id = "wings-pro-dash";
      }
    }
    pinBox(root);
    if (!placeRoot(root)) return null;
    // DOM 순서가 틀려 프로필보다 위에 그려지면 헤더 바로 아래로 다시 붙임
    const header = profileHeader(mainEl() || document);
    if (header) {
      const panelTop = root.getBoundingClientRect().top;
      const headerBottom = header.getBoundingClientRect().bottom;
      if (panelTop < headerBottom - 8) header.insertAdjacentElement("afterend", root);
    }
    return root;
  }

  function hideLegacy() {
    document.querySelectorAll("wings-sort").forEach((el) => {
      el.style.display = "none";
    });
  }

  const QUEUE = ["전체", "복제", "재배포", "허수"];
  const ROLE_COLOR = { 복제: "#2dd4bf", 재배포: "#fbbf24", 허수: "#fb7185", 중단: "#64748b", 유지: "#94a3b8" };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function capText(r) {
    return String(r.caption || "").replace(/\s+/g, " ").trim();
  }

  function firstLine(text) {
    const line = text.split(/[\n!?？。]/)[0].trim();
    return line.slice(0, 72);
  }

  function roleOf(r, med, medEng) {
    // 조회수 없으면 역할 분류 불가 — 0조회를 '재배포'로 오분류하지 않음
    if (!(r.playCount > 0) || !(med > 0)) return "유지";
    const mult = r.playCount / med;
    const eng = r.engagementRate;
    if (mult >= 2 && eng >= medEng) return "복제";
    if (mult < 1 && eng >= medEng * 1.2 && (r.commentCount > 0 || eng > 0)) return "재배포";
    if (mult >= 2 && eng < medEng * 0.75) return "허수";
    if (mult < 0.65) return "중단";
    return "유지";
  }

  function pattern(list) {
    if (!list.length) return null;
    const texts = list.map(capText);
    const q = texts.filter((t) => /[?？]/.test(t)).length / list.length;
    const num = texts.filter((t) => /\d/.test(t)).length / list.length;
    const short = texts.filter((t) => t.length > 0 && t.length <= 40).length / list.length;
    const cmt = avg(list.map((r) => (r.playCount ? (r.commentCount / r.playCount) * 100 : 0)));
    const like = avg(list.map((r) => (r.playCount ? (r.likeCount / r.playCount) * 100 : 0)));
    return {
      avgLen: Math.round(avg(texts.map((t) => t.length))),
      q: Math.round(q * 100),
      num: Math.round(num * 100),
      short: Math.round(short * 100),
      cmt,
      like,
      sample: firstLine(texts.find(Boolean) || ""),
    };
  }

  function brief(list) {
    const s = stats(list);
    const engs = list.map((r) => r.engagementRate).filter((x) => x > 0);
    const medEng = median(engs) || s.meanEng || 0;
    const tagged = list.map((r) => ({ ...r, role: roleOf(r, s.med, medEng) }));
    const byRole = { 복제: [], 재배포: [], 허수: [], 중단: [], 유지: [] };
    for (const r of tagged) byRole[r.role].push(r);
    const copy = [...byRole.복제].sort((a, b) => b.playCount - a.playCount).slice(0, 3);
    const remake = [...byRole.재배포].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 3);
    const hollow = [...byRole.허수].sort((a, b) => b.playCount - a.playCount).slice(0, 3);
    const winners = tagged.filter((r) => r.playCount >= s.med && r.engagementRate >= medEng);
    const weak = tagged.filter((r) => r.playCount < s.med * 0.7);
    const totalViews = list.reduce((a, r) => a + r.playCount, 0);
    const top3 = [...list].sort((a, b) => b.playCount - a.playCount).slice(0, 3);
    const topShare = totalViews ? top3.reduce((a, r) => a + r.playCount, 0) / totalViews : 0;
    const winP = pattern(winners.length ? winners : copy);
    const weakP = pattern(weak);
    let verdict = "아직 모은 영상이 없습니다. 릴스 탭에서 아래로 스크롤하면 채워집니다.";
    if (s.count) {
      if (topShare >= 0.55) {
        verdict = `조회수의 ${Math.round(topShare * 100)}%가 상위 3개에 몰려 있습니다. 평균을 따라가지 말고, 그 3개의 첫 문장·숫자·질문 구조를 다음 촬영의 기본 포맷으로 고정하세요.`;
      } else if (byRole.재배포.length >= 2) {
        verdict = `반응은 좋은데 조회가 안 탄 영상이 ${byRole.재배포.length}개입니다. 새 주제를 찍기 전에, 그 대본을 첫 1초만 바꿔 다시 올리는 게 더 빠릅니다.`;
      } else if (byRole.허수.length) {
        verdict = `많이 봤는데 댓글·좋아요가 얕은 영상이 있습니다. 그 주제는 ‘조회 공식’이지 ‘살 이유’가 아닙니다. 제품 문장만 빼서 짧은 버전으로 다시 쓰세요.`;
      } else {
        verdict = `이 계정 기준선은 ${fmt(s.med)} 조회입니다. 다음 영상은 이 숫자를 넘기되, 댓글 비율이 ${((medEng || 0) * 100).toFixed(1)}% 아래로 떨어지면 주제만 베낀 것으로 보면 됩니다.`;
      }
    }
    return { s, medEng, tagged, byRole, copy, remake, hollow, winP, weakP, topShare, top3, verdict };
  }

  function renderShell() {
    const el = ensureRoot();
    if (!el) return;
    const b = brief(reels);
    const s = b.s;
    const rows = filtered(b.tagged);
    const username =
      reels.find((r) => r.username)?.username ||
      (location.pathname.match(/^\/([A-Za-z0-9._]+)/) || [])[1] ||
      "account";
    const baseLine = s.med ? fmt(s.med) : "—";

    el.innerHTML = `
      <div class="wpd-top">
        <div class="wpd-top-row">
          <div class="wpd-brand">
            <span class="wpd-mark" aria-hidden="true">W</span>
            <div>
              <em class="wpd-kicker">WINGS · AI REELS</em>
              <strong>릴스 분석</strong>
              <span>@${esc(username)} · ${s.count}개로 다음 촬영을 고름</span>
            </div>
          </div>
          <div class="wpd-actions">
            <button type="button" data-act="refresh">다시 모으기</button>
            <button type="button" class="primary" data-act="export">표로 저장</button>
          </div>
        </div>
        <p class="wpd-verdict">${esc(b.verdict)}</p>
        <div class="wpd-kpis">
          <div class="wpd-kpi"><em>이 계정의 기준선</em><b>${baseLine}</b><small>다음 영상은 이 조회를 넘겨야 성공</small></div>
          <div class="wpd-kpi"><em>댓글이 다는 비율</em><b>${(b.medEng * 100).toFixed(2)}%</b><small>이보다 낮으면 주제만 베낀 것</small></div>
          <div class="wpd-kpi"><em>상위 3개가 먹는 조회</em><b>${Math.round(b.topShare * 100)}%</b><small>${b.topShare >= 0.5 ? "포맷이 한곳에 몰림" : "고르게 퍼짐"}</small></div>
          <div class="wpd-kpi"><em>바로 손댈 영상</em><b>${b.byRole.재배포.length + b.byRole.복제.length}</b><small>복제 ${b.byRole.복제.length} · 재배포 ${b.byRole.재배포.length}</small></div>
        </div>
      </div>
      <div class="wpd-actions-row">
        <section class="wpd-job wpd-job-copy">
          <header><span>1</span><div><strong>그대로 복제</strong><em>많이 보고, 댓글·좋아요도 있음</em></div></header>
          ${b.copy.length ? b.copy.map((r) => clipCard(r, s)).join("") : `<p class="wpd-none">아직 없습니다. 조회와 반응이 같이 높은 영상이 쌓이면 여기가 촬영 원본이 됩니다.</p>`}
        </section>
        <section class="wpd-job wpd-job-push">
          <header><span>2</span><div><strong>같은 대본, 첫 1초만 교체</strong><em>관심은 있는데 노출이 약함</em></div></header>
          ${b.remake.length ? b.remake.map((r) => clipCard(r, s)).join("") : `<p class="wpd-none">숨은 강자는 없습니다. 반응 비율이 기준선보다 높은데 조회가 적은 영상을 여기서 다시 올립니다.</p>`}
        </section>
        <section class="wpd-job wpd-job-skip">
          <header><span>3</span><div><strong>주제만 베끼지 말 것</strong><em>조회는 많은데 반응이 얕음</em></div></header>
          ${b.hollow.length ? b.hollow.map((r) => clipCard(r, s)).join("") : `<p class="wpd-none">허수 바이럴은 없습니다. 조회만 터지고 댓글이 없는 영상은 제품 문장을 빼고 다시 써야 합니다.</p>`}
        </section>
      </div>
      <div class="wpd-pats">
        ${patternHtml("잘 된 쪽의 공통점", b.winP, "good")}
        ${patternHtml("약한 쪽의 공통점", b.weakP, "bad")}
      </div>
      <div class="wpd-charts">
        <article class="wpd-pat chart">
          <h3>조회와 반응을 같이 보기</h3>
          <p class="wpd-chart-note">오른쪽 위 = 복제 · 왼쪽 위 = 재배포 · 오른쪽 아래 = 허수</p>
          <div class="wpd-chart-wrap">
            <canvas id="wpd-chart-views"></canvas>
            <div class="wpd-chart-empty" id="wpd-chart-views-empty" hidden>조회 데이터가 모이면 점이 찍힙니다. 「다시 모으기」를 눌러 주세요.</div>
          </div>
        </article>
        <article class="wpd-pat chart">
          <h3>${esc(s.trendTitle || "조회 추이")}</h3>
          <p class="wpd-chart-note">${esc(s.trendHint || "라인 차트")}</p>
          <div class="wpd-chart-wrap">
            <canvas id="wpd-chart-trend"></canvas>
            <div class="wpd-chart-empty" id="wpd-chart-trend-empty" hidden>추이 데이터가 아직 부족합니다.</div>
          </div>
        </article>
      </div>
      <div class="wpd-table-block">
        <div class="wpd-table-head">
          <strong>영상별 판정</strong>
          <div class="wpd-chips">
            ${QUEUE.map((q) => {
              const n = q === "전체" ? b.tagged.length : b.byRole[q].length;
              return `<button type="button" class="wpd-chip ${filter === q ? "active" : ""}" data-filter="${q}">${q} ${n}</button>`;
            }).join("")}
          </div>
        </div>
        <div class="wpd-table-wrap">
          ${
            rows.length
              ? `<table>
            <thead>
              <tr>
                <th data-sort="role">할 일</th>
                <th data-sort="playCount">조회</th>
                <th data-sort="commentCount">댓글</th>
                <th data-sort="likeCount">좋아요</th>
                <th data-sort="engagementRate">반응</th>
                <th>첫 문장</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .slice(0, 60)
                .map((r) => {
                  const line = firstLine(capText(r)) || "캡션 없음";
                  const why = {
                    복제: "첫 문장과 숫자 구조를 다음 촬영 대본에 그대로 쓰세요.",
                    재배포: "대본은 유지하고 첫 1초·표지만 바꿔 다시 올리세요.",
                    허수: "조회 공식입니다. 제품이 필요한 문장만 남기고 짧게 다시 쓰세요.",
                    중단: "이 계정 기준선 아래입니다. 같은 포맷은 접으세요.",
                    유지: "평균입니다. 실험 재료로만 쓰세요.",
                  }[r.role];
                  return `<tr>
                    <td><span class="grade" style="color:${ROLE_COLOR[r.role] || "#94a3b8"}">${esc(r.role)}</span></td>
                    <td>${fmt(r.playCount)}<small> ${multiple(r, s.med).toFixed(1)}배</small></td>
                    <td>${fmt(r.commentCount)}</td>
                    <td>${fmt(r.likeCount)}</td>
                    <td>${(r.engagementRate * 100).toFixed(1)}%</td>
                    <td>${
                      r.url
                        ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(line)}</a>`
                        : esc(line)
                    }<small>${esc(why)}</small></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>`
              : `<div class="wpd-empty">이 조건의 영상이 없습니다. 프로필 릴스 탭에서 「다시 모으기」를 눌러 주세요.</div>`
          }
        </div>
      </div>
    `;

    el.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.getAttribute("data-filter") || "전체";
        renderShell();
      });
    });
    el.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
        else {
          sortKey = key === "role" ? "role" : key;
          sortDir = "desc";
        }
        renderShell();
      });
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("hd-sort-request"));
      requestData();
    });
    el.querySelector('[data-act="export"]')?.addEventListener("click", exportCsv);
    paintCharts(b);
  }

  function destroyCharts() {
    try {
      chartViews?.destroy();
    } catch {
      /* ignore */
    }
    try {
      chartGrade?.destroy();
    } catch {
      /* ignore */
    }
    chartViews = null;
    chartGrade = null;
  }

  function paintCharts(b) {
    if (typeof Chart === "undefined") return;
    destroyCharts();
    const viewsCanvas = document.getElementById("wpd-chart-views");
    const trendCanvas = document.getElementById("wpd-chart-trend");
    const viewsEmpty = document.getElementById("wpd-chart-views-empty");
    const trendEmpty = document.getElementById("wpd-chart-trend-empty");
    const tick = "#9eb8b1";
    const grid = "rgba(255,255,255,0.08)";
    const pts = b.tagged.filter((r) => r.playCount > 0);
    if (viewsEmpty) viewsEmpty.hidden = pts.length > 0;
    if (viewsCanvas && pts.length) {
      chartViews = new Chart(viewsCanvas, {
        type: "scatter",
        data: {
          datasets: ["복제", "재배포", "허수", "중단", "유지"].map((role) => ({
            label: role,
            data: pts
              .filter((r) => r.role === role)
              .map((r) => ({ x: r.playCount, y: Math.max(0, r.engagementRate * 100) })),
            backgroundColor: ROLE_COLOR[role],
            borderColor: ROLE_COLOR[role],
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBorderWidth: 0,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 900, easing: "easeOutQuart" },
          plugins: {
            legend: {
              display: true,
              labels: { color: tick, boxWidth: 8, font: { size: 11, weight: "700" } },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` 조회 ${fmt(ctx.parsed.x)} · 반응 ${ctx.parsed.y.toFixed(1)}%`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: tick, font: { size: 10 }, callback: (v) => fmt(v) },
              grid: { color: grid },
              title: { display: true, text: "조회수", color: tick, font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              ticks: { color: tick, font: { size: 10 }, callback: (v) => `${v}%` },
              grid: { color: grid },
              title: { display: true, text: "반응 %", color: tick, font: { size: 11 } },
            },
          },
        },
      });
    }

    const trend = b.s?.trend || [];
    if (trendEmpty) trendEmpty.hidden = trend.length > 0;
    if (trendCanvas && trend.length) {
      chartGrade = new Chart(trendCanvas, {
        type: "line",
        data: {
          labels: trend.map((t) => t.label),
          datasets: [
            {
              label: "평균 조회",
              data: trend.map((t) => t.value),
              borderColor: "#5eead4",
              backgroundColor: "rgba(94, 234, 212, 0.18)",
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: "#ccfbf1",
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1000, easing: "easeOutQuart" },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => ` 평균 조회 ${fmt(ctx.parsed.y)}` },
            },
          },
          scales: {
            x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid } },
            y: {
              beginAtZero: true,
              ticks: { color: tick, font: { size: 10 }, callback: (v) => fmt(v) },
              grid: { color: grid },
            },
          },
        },
      });
    }
  }

  function exportCsv() {
    const b = brief(reels);
    const s = b.s;
    const rows = filtered(b.tagged);
    const header = ["role", "grade", "multiple", "playCount", "likeCount", "commentCount", "engagementRate", "caption", "url"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const mult = multiple(r, s.med);
      const cols = [
        r.role || "",
        r.grade,
        mult.toFixed(2),
        r.playCount,
        r.likeCount,
        r.commentCount,
        (r.engagementRate * (r.engagementRate <= 1 ? 100 : 1)).toFixed(3),
        `"${String(r.caption || "").replace(/"/g, '""')}"`,
        r.url,
      ];
      lines.push(cols.join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wings-reels-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function mergeReel(prev, next) {
    if (!prev) return next;
    // 나중에 온 0조회가 기존 값을 덮어쓰지 않도록 숫자는 최댓값 유지
    return {
      ...prev,
      ...next,
      playCount: Math.max(num(prev.playCount), num(next.playCount)),
      likeCount: Math.max(num(prev.likeCount), num(next.likeCount)),
      commentCount: Math.max(num(prev.commentCount), num(next.commentCount)),
      takenAt: num(next.takenAt) || num(prev.takenAt) || 0,
      caption: next.caption || prev.caption,
      url: next.url || prev.url,
      username: next.username || prev.username,
      engagementRate: Math.max(num(prev.engagementRate), num(next.engagementRate)),
      raw: next.raw || prev.raw,
    };
  }

  function ingest(list) {
    const next = normalize(list);
    if (!next.length) return;
    const map = new Map(reels.map((r) => [r.code || `${r.playCount}-${r.caption.slice(0, 12)}`, r]));
    for (const r of next) {
      const key = r.code || `${r.playCount}-${r.caption.slice(0, 12)}`;
      map.set(key, mergeReel(map.get(key), r));
    }
    reels = assignGrades([...map.values()]);
    hideLegacy();
    renderShell();
  }

  /** API가 조회를 안 줄 때 그리드 DOM만으로라도 보강 */
  function enrichFromDom() {
    if (!shouldShow() || !reels.length) return false;
    const dom = scrapeDomViews();
    if (!dom.size) return false;
    let changed = false;
    reels = assignGrades(
      reels.map((r) => {
        const v = r.code ? dom.get(r.code) : 0;
        if (!(v > 0) || v <= r.playCount) return r;
        changed = true;
        return { ...r, playCount: v };
      })
    );
    return changed;
  }

  function requestData() {
    window.dispatchEvent(new CustomEvent("hd-sort-request"));
  }

  function onSortReels(ev) {
    const detail = ev?.detail;
    const list = detail?.reels || detail || [];
    if (Array.isArray(list)) ingest(list);
  }

  function shouldShow() {
    return /^\/[A-Za-z0-9._]+\/reels\/?$/.test(location.pathname || "");
  }

  function syncRoute() {
    if (!shouldShow()) {
      if (root) root.remove();
      root = null;
      destroyCharts();
      return;
    }
    hideLegacy();
    ensureRoot();
    renderShell();
    requestData();
  }

  function boot() {
    window.addEventListener("hd-sort-reels", onSortReels);
    window.addEventListener("message", (ev) => {
      const data = ev?.data;
      if (!data || data.type !== "wings_MEDIA_BATCH" || !Array.isArray(data.media)) return;
      ingest(data.media);
    });
    window.addEventListener("wxt:locationchange", syncRoute);
    let last = location.pathname;
    setInterval(() => {
      if (location.pathname !== last) {
        last = location.pathname;
        syncRoute();
      }
      if (!shouldShow()) return;
      hideLegacy();
      const el = ensureRoot();
      // 탭바가 늦게 렌더되면 그때 마운트/재부착
      if (el && !el.querySelector(".wpd-body")) renderShell();
      // API 조회가 비어 있으면 그리드에 보이는 숫자로 보강
      if (enrichFromDom()) {
        hideLegacy();
        renderShell();
      }
    }, 1200);
    syncRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
