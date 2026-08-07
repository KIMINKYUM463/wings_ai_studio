/**
 * 쿠팡 상품평 페이지에서 실행 → 로컬 에이전트로 전송
 * (평소 쓰는 Chrome에서 Access Denied 없이 열린 페이지용)
 */
;(async function shotformCoupangSend() {
  const AGENT = "http://127.0.0.1:3847"
  const decode = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim()

  const productName = (() => {
    const h1 = document.querySelector("h1")
    if (h1?.textContent) return decode(h1.textContent)
    const og = document.querySelector('meta[property="og:title"]')
    return decode(og?.getAttribute("content") || document.title || "").replace(/\s*\|.*$/, "")
  })()

  const nodeSet = new Set()
  const selectors = [
    ".sdp-review__article__list__review",
    ".sdp-review__article__list article",
    ".sdp-review__article__list > li",
    ".js_reviewArticleReviewList > li",
    "[data-review-id]",
    "article",
  ]
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((n) => nodeSet.add(n))
  }
  for (const el of document.querySelectorAll("button, a, span, div")) {
    const t = decode(el.textContent)
    if (t !== "도움이 돼요" && !/^도움이\s*돼요/.test(t)) continue
    let cur = el
    for (let i = 0; i < 8 && cur; i++) {
      const txt = decode(cur.textContent)
      if (txt.length > 60 && /20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/.test(txt)) {
        nodeSet.add(cur)
        break
      }
      cur = cur.parentElement
    }
  }

  const reviews = []
  for (const node of nodeSet) {
    if (!node || node === document.body) continue
    const text = decode(node.textContent)
    if (text.length < 20) continue
    if (!/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}|도움이\s*돼요|판매자:/.test(text)) continue

    let content = ""
    const contentEl = node.querySelector(
      ".sdp-review__article__list__review__content, [class*='review__content'], [class*='ReviewContent']"
    )
    if (contentEl) content = decode(contentEl.textContent)
    const titleEl = node.querySelector(
      ".sdp-review__article__list__headline, [class*='headline'], [class*='title']"
    )
    const title = titleEl ? decode(titleEl.textContent) : ""
    if (!content) {
      content = text
        .replace(/도움이\s*돼요/g, " ")
        .replace(/신고하기/g, " ")
        .replace(/판매자:\s*[^\n]+/g, " ")
        .replace(/베스트순|최신순|모든 별점|검색어를 입력하세요/g, " ")
        .replace(/신선도|맛 만족도|아주 신선해요|맛있어요/g, " ")
        .replace(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }
    if (title && content && !content.includes(title)) content = `${title} ${content}`.trim()
    else if (title && !content) content = title
    if (content.length < 8) continue

    let author = ""
    const authorEl = node.querySelector(
      ".sdp-review__article__list__info__user__name, [class*='user__name'], [class*='info__user']"
    )
    if (authorEl) author = decode(authorEl.textContent).slice(0, 40)

    let date = ""
    const dm = text.match(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/)
    if (dm) date = dm[0].replace(/\s+/g, "")

    const images = []
    const imgNodes = node.querySelectorAll(
      "img[src], img[data-src], img[data-lazy-src], img[data-original]"
    )
    for (const img of imgNodes) {
      const raw =
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("src") ||
        ""
      const src = String(raw).trim()
      if (!/^https?:\/\//i.test(src)) continue
      if (/sprite|icon|logo|blank|1x1|avatar|profile/i.test(src)) continue
      if (src.includes("coupang") || src.includes("thumbnail") || /\.(jpe?g|png|webp)/i.test(src)) {
        images.push(src.split("?")[0] || src)
      }
    }

    reviews.push({
      author: author || undefined,
      content: content.slice(0, 2000),
      date: date || undefined,
      images: images.length ? Array.from(new Set(images)).slice(0, 6) : undefined,
    })
  }

  const seen = new Set()
  const unique = []
  for (const r of reviews) {
    const key = `${r.content.slice(0, 80)}|${r.date || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(r)
  }

  if (!unique.length) {
    alert("상품평을 찾지 못했습니다. 상품평 탭이 보이는 상태에서 다시 눌러 주세요.")
    return
  }

  const reviewImages = []
  const seenImg = new Set()
  for (const r of unique) {
    for (const u of r.images || []) {
      if (seenImg.has(u)) continue
      seenImg.add(u)
      reviewImages.push(u)
    }
  }

  const payload = {
    productName,
    productUrl: location.href,
    reviews: unique,
    reviewImages,
    reviewCount: unique.length,
    source: "bookmarklet",
    at: new Date().toISOString(),
  }

  try {
    const res = await fetch(`${AGENT}/coupang/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    alert(`Wings 숏폼으로 상품평 ${unique.length}개를 보냈습니다.\nWings 숏폼에서 「전송된 리뷰 불러오기」를 누르세요.`)
  } catch (e) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert(
        `로컬 에이전트 전송 실패 → JSON을 클립보드에 복사했습니다.\nWings 숏폼 상품 JSON에 붙여넣으세요.\n(${e && e.message ? e.message : e})`
      )
    } catch {
      alert(`전송 실패: ${e && e.message ? e.message : e}\nnpm run shotform:local-agent 실행 여부를 확인하세요.`)
    }
  }
})()
