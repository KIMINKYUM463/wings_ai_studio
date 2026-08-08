/**
 * 쿠팡 상품 페이지 → 상품/리뷰 JSON
 * 1순위: same-origin next-api (쿠키 포함)
 * 2순위: DOM 파싱
 * window.__shotformCollectCoupang()
 */
;(function () {
  function decode(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
  }

  function extractProductId() {
    const m = location.href.match(/\/products\/(\d+)/)
    return m?.[1] || ""
  }

  function absUrl(src) {
    if (!src) return ""
    try {
      return new URL(src, location.href).href
    } catch {
      return src.startsWith("//") ? `https:${src}` : src
    }
  }

  function pushUniqueUrl(list, src, max) {
    const u = absUrl(src)
    if (!u.startsWith("http")) return
    if (/data:|sprite|icon|logo|badge|blank/i.test(u)) return
    if (!/coupangcdn|image\.coupang|\.(jpg|jpeg|png|webp)/i.test(u) && !u.includes("coupang")) {
      // 쿠팡 CDN이 아니어도 상세 이미지일 수 있음
      if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u)) return
    }
    if (list.includes(u)) return
    list.push(u)
    if (max && list.length >= max) return
  }

  function collectOptions() {
    const options = []
    const sels = [
      ".prod-option__item",
      ".OptionItem",
      "[class*='option-item']",
      "[class*='prod-option'] button",
      "[class*='prod-option'] label",
      "select option",
    ]
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        const t = decode(el.textContent || el.getAttribute("value") || "")
        if (!t || t.length > 80) return
        if (/선택|옵션을|장바구니|구매하기|로그인/.test(t)) return
        if (!options.includes(t)) options.push(t)
      })
    }
    return options.slice(0, 40)
  }

  function collectEssentialInfo() {
    const out = {}
    const tables = document.querySelectorAll(
      "table, .product-item__table, [class*='essential'], [class*='Essential'], [class*='table-']"
    )
    for (const table of tables) {
      const text = decode(table.textContent)
      if (!/품명|모델명|인증|제조|원산지|크기|중량|소재|KC/.test(text)) continue
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = tr.querySelectorAll("th, td")
        if (cells.length >= 2) {
          const k = decode(cells[0].textContent)
          const v = decode(cells[1].textContent)
          if (k && v && k.length < 40 && v.length < 200) out[k] = v
        }
      })
      // dt/dd
      table.querySelectorAll("dt").forEach((dt) => {
        const k = decode(dt.textContent)
        const dd = dt.nextElementSibling
        const v = decode(dd?.textContent || "")
        if (k && v) out[k] = v
      })
    }
    // 페이지 전역 dt/dd
    document.querySelectorAll("dl").forEach((dl) => {
      const t = decode(dl.textContent)
      if (!/품명|모델명|제조|원산지/.test(t)) return
      const dts = dl.querySelectorAll("dt")
      dts.forEach((dt) => {
        const k = decode(dt.textContent)
        const dd = dt.nextElementSibling
        const v = decode(dd?.textContent || "")
        if (k && v && !out[k]) out[k] = v
      })
    })
    return out
  }

  function collectProductMeta() {
    const productName = (() => {
      const h1 = document.querySelector("h1")
      if (h1?.textContent) return decode(h1.textContent)
      const og = document.querySelector('meta[property="og:title"]')
      return decode(og?.getAttribute("content") || document.title || "").replace(/\s*\|.*$/, "")
    })()

    let price = ""
    const priceCandidates = [
      ".total-price strong",
      ".total-price",
      ".price-amount",
      ".prod-price .total-price",
      "[class*='total-price']",
      "strong.price-value",
    ]
    for (const sel of priceCandidates) {
      const el = document.querySelector(sel)
      const t = decode(el?.textContent || "")
      if (/\d/.test(t) && t.length < 40) {
        price = t
        break
      }
    }
    if (!price) {
      const m = (document.body?.innerText || "").match(/([\d,]+)\s*원/)
      if (m) price = m[0]
    }

    // 대표 이미지 (썸네일/메인)
    const images = []
    const mainImgSels = [
      ".prod-image__detail img",
      ".product-image img",
      "[class*='prod-image'] img",
      "[class*='ProductImage'] img",
      'meta[property="og:image"]',
    ]
    for (const sel of mainImgSels) {
      if (sel.startsWith("meta")) {
        pushUniqueUrl(images, document.querySelector(sel)?.getAttribute("content"), 12)
        continue
      }
      document.querySelectorAll(sel).forEach((img) => {
        pushUniqueUrl(
          images,
          img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-img-src"),
          12
        )
      })
    }

    let delivery = ""
    const body = document.body?.innerText || ""
    const dm = body.match(/로켓배송|내일\s*도착|모레\s*도착|무료배송|하루배송/)
    if (dm) delivery = dm[0]

    const shortDescription = decode(
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        document.querySelector('meta[name="description"]')?.getAttribute("content") ||
        ""
    ).slice(0, 500)

    const options = collectOptions()
    const essentialInfo = collectEssentialInfo()

    return {
      productName,
      price,
      images: images.slice(0, 12),
      delivery,
      productUrl: location.href,
      shortDescription,
      options,
      essentialInfo,
    }
  }

  function looksLikeJunkText(s) {
    const t = String(s || "")
    return (
      /function\s*\(|localStorage|sessionStorage|web-adapter|#region|getLocalStorage|setLocalStorage|typeof\s+window|<\/?script|\{[\s\S]*["']use strict["']/i.test(
        t
      ) || (t.length > 400 && /[\{\};]\s*(const|let|var|function)\b/.test(t))
    )
  }

  /** script/style 제거 후 화면에 보이는 텍스트만 (줄바꿈 유지) */
  function visibleText(el, maxLen = 4000) {
    if (!el) return ""
    try {
      const clone = el.cloneNode(true)
      clone
        .querySelectorAll("script, style, noscript, svg, template, [hidden], [aria-hidden='true']")
        .forEach((n) => n.remove())
      let t = String(clone.innerText || clone.textContent || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
      // 코드/번들 JS 라인 제거
      t = t
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length >= 2 && !looksLikeJunkText(line) && !/^[{};]$/.test(line))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
      if (looksLikeJunkText(t)) return ""
      return t.slice(0, maxLen)
    } catch {
      return ""
    }
  }

  function isUsableImageUrl(u) {
    if (!u || typeof u !== "string") return false
    if (!/^https?:\/\//i.test(u)) return false
    if (/sprite|icon|favicon|1x1|blank\.|spacer|loading|logo|badge|qrcode/i.test(u)) return false
    return true
  }

  /** 썸네일 CDN → 원본에 가까운 URL로 정규화 */
  function upgradeImageUrl(u) {
    let s = absUrl(u)
    if (!s) return ""
    s = s
      .replace(/\/thumbnails\/remote\/[^/]+\//i, "/")
      .replace(/\/thumbnail(\d)\./i, "/image$1.")
      .replace(/([?&])w=\d+/gi, "$1w=1000")
      .replace(/([?&])h=\d+/gi, "$1h=1000")
    return s
  }

  function extractIds() {
    const href = location.href
    const params = new URLSearchParams(location.search)
    const productId =
      (href.match(/\/products\/(\d+)/) || [])[1] ||
      params.get("productId") ||
      ""
    const itemId = params.get("itemId") || params.get("ItemId") || ""
    const vendorItemId =
      params.get("vendorItemId") ||
      params.get("vendoritemid") ||
      (href.match(/vendorItemId=(\d+)/i) || [])[1] ||
      ""
    // 페이지 버튼/링크에서도 vendorItemId 찾기
    let vendorFromDom = vendorItemId
    if (!vendorFromDom) {
      const a = document.querySelector("a[href*='vendorItemId='], [data-vendor-item-id], [data-vendoritemid]")
      const hrefA = a?.getAttribute?.("href") || ""
      vendorFromDom =
        a?.getAttribute?.("data-vendor-item-id") ||
        a?.getAttribute?.("data-vendoritemid") ||
        (hrefA.match(/vendorItemId=(\d+)/i) || [])[1] ||
        ""
    }
    return { productId, itemId, vendorItemId: vendorFromDom || vendorItemId }
  }

  /** 파일명 지문으로 갤러리·상세 중복 판별 */
  function urlFingerprint(u) {
    const s = upgradeImageUrl(u) || absUrl(u)
    const m = s.match(/([a-f0-9]{8,}[-a-f0-9]*\.(?:jpg|jpeg|png|webp))/i)
    if (m) return m[1].toLowerCase()
    const base = s.split("?")[0].split("/").pop() || s
    return base.toLowerCase()
  }

  /**
   * 상단 갤러리 제품사진 전부 수집 (중복 제거)
   * - 최종 1·2번 선정은 Wings 쪽에서 AI가 함
   * - 여기선 대략적 품질 점수로만 정렬해 후보 순서를 잡음
   */
  function collectAllProductPhotos(max = 12) {
    const limit = Math.min(16, Math.max(4, Number(max) || 12))
    const candidates = []
    const seen = new Set()

    const push = (src, el, bonus = 0) => {
      if (!src) return
      const u = upgradeImageUrl(src) || absUrl(src)
      if (!isUsableImageUrl(u)) return
      if (/\/(?:16|24|32|48|64|86)x(?:16|24|32|48|64|86)\//i.test(u)) return
      if (/sprite|icon|logo|badge|qrcode|favicon/i.test(u)) return
      const fp = urlFingerprint(u)
      if (seen.has(fp)) return
      seen.add(fp)
      candidates.push({ url: u, el: el || null, bonus })
    }

    // 메인 확대컷
    document
      .querySelectorAll(
        ".prod-image__detail img, .prod-image__item--active img, [class*='prod-image'] [class*='detail'] img"
      )
      .forEach((img, i) => {
        push(
          img.getAttribute("data-zoom-image") ||
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-img-src"),
          img,
          55 - i
        )
      })

    // 좌측·상단 갤러리 썸네일 전체
    document
      .querySelectorAll(
        ".prod-image img, ul.prod-image li img, [class*='prod-image'] img, [class*='ProductImage'] img, [class*='tw-gallery'] img, [class*='ImageGallery'] img, [class*='ImageShowcase'] img, [class*='thumbnail'] img, [class*='Thumb'] img"
      )
      .forEach((img, i) => {
        push(
          img.getAttribute("data-zoom-image") ||
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-img-src"),
          img,
          Math.max(0, 28 - i)
        )
      })

    push(document.querySelector('meta[property="og:image"]')?.getAttribute("content"), null, 42)

    const scored = candidates.map((c, i) => {
      let score = (c.bonus || 0) + Math.max(0, 12 - i)
      const w = c.el?.naturalWidth || c.el?.width || 0
      const h = c.el?.naturalHeight || c.el?.height || 0
      if (w >= 480 && h >= 480) score += 40
      else if (w >= 320 && h >= 320) score += 22
      else if (w >= 160) score += 8
      if (w > 0 && h > 0) {
        const ratio = h / w
        if (ratio >= 0.85 && ratio <= 1.2) score += 35
        else if (ratio > 1.45) score -= 18
        else if (ratio < 0.7) score -= 8
      }
      const u = c.url.toLowerCase()
      if (/492x492|860x860|1000x1000|640x640|original/.test(u)) score += 16
      if (/represent|vendoritem|product.?image/i.test(u)) score += 8
      return { url: c.url, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map((x) => x.url)
  }

  /** 상품상세 본문 root (상단 갤러리와 구분) */
  function detailScopes(doc) {
    return [
      doc.querySelector("#productDetail"),
      doc.querySelector("#product-detail"),
      doc.querySelector("#srcProductDetail"),
      doc.querySelector(".product-detail-content"),
      doc.querySelector(".product-detail-content-inside"),
      doc.querySelector("[class*='product-detail-content']"),
      doc.querySelector("[class*='ProductDetailContent']"),
      doc.querySelector("#contents [class*='detail-content']"),
      doc.querySelector("iframe#productDetail"),
      doc.querySelector("iframe#srcProductDetail"),
      doc.querySelector("iframe[src*='vendoritem']"),
      doc.querySelector("iframe[src*='productDetail']"),
      doc.querySelector("iframe[src*='product-detail']"),
    ].filter(Boolean)
  }

  function isInsideDetailScope(el, doc = document) {
    if (!el || !el.closest) return false
    const roots = detailScopes(doc).filter((n) => n && n.tagName !== "IFRAME")
    return roots.some((root) => {
      try {
        return root.contains(el)
      } catch {
        return false
      }
    })
  }

  /** 상단 대표/옵션 갤러리 URL — 상세에서 반드시 제외 */
  function collectGalleryDenySet() {
    const denyFp = new Set()
    const denyUrl = new Set()
    const add = (src) => {
      if (!src) return
      const raw = absUrl(src)
      const u = upgradeImageUrl(src) || raw
      if (!/^https?:\/\//i.test(u) && !/^https?:\/\//i.test(raw)) return
      const t = isUsableImageUrl(u) ? u : raw
      if (!/^https?:\/\//i.test(t)) return
      denyUrl.add(t)
      denyUrl.add(raw)
      denyFp.add(urlFingerprint(t))
      denyFp.add(urlFingerprint(raw))
    }

    const addImgEl = (img) => {
      if (!img) return
      add(img.getAttribute("src"))
      add(img.getAttribute("data-src"))
      add(img.getAttribute("data-img-src"))
      add(img.getAttribute("data-zoom-image"))
      add(img.getAttribute("data-original"))
      add(img.getAttribute("data-lazy-src"))
      const srcset = img.getAttribute("srcset") || ""
      if (srcset) {
        srcset.split(",").forEach((part) => add(part.trim().split(/\s+/)[0]))
      }
    }

    const gallerySels = [
      ".prod-image img",
      ".prod-image__detail img",
      "[class*='prod-image'] img",
      "[class*='ProductImage'] img",
      "[class*='tw-gallery'] img",
      "[class*='ImageGallery'] img",
      "[class*='image-gallery'] img",
      "[class*='ImageShowcase'] img",
      "[class*='image-showcase'] img",
      "[class*='ProductThumbnail'] img",
      "[class*='thumbnail-list'] img",
      "[class*='ThumbList'] img",
      "[class*='prod-atf'] img",
      "ul.prod-image li img",
      "#repImageContainer img",
      "[id*='repImage'] img",
      "[class*='owl-carousel'] img",
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'link[rel="image_src"]',
    ]
    for (const sel of gallerySels) {
      if (sel.startsWith("meta") || sel.startsWith("link")) {
        const n = document.querySelector(sel)
        add(n?.getAttribute("content") || n?.getAttribute("href"))
        continue
      }
      document.querySelectorAll(sel).forEach(addImgEl)
    }

    // 상품상세·리뷰 밖 img = 상단/사이드 컷으로 차단
    document.querySelectorAll("img").forEach((img) => {
      if (isInsideDetailScope(img)) return
      if (
        img.closest(
          "#sdpReview, [class*='sdp-review'], [class*='ProductReview'], [class*='qna'], [class*='inquiry'], footer, header, nav"
        )
      ) {
        return
      }
      addImgEl(img)
    })

    return { denyFp, denyUrl }
  }

  function isDeniedGallery(src, deny) {
    if (!src || !deny) return false
    const u = upgradeImageUrl(src) || absUrl(src)
    const raw = absUrl(src)
    if (deny.denyUrl.has(u) || deny.denyUrl.has(raw)) return true
    if (deny.denyFp.has(urlFingerprint(u)) || deny.denyFp.has(urlFingerprint(raw))) return true
    return false
  }

  function isNoticeOrJunkDetailUrl(u) {
    const s = String(u || "").toLowerCase()
    // 배송 공지 등 (완벽하진 않지만 흔한 패턴)
    if (/gongji|notice|공지|delivery.?holiday|banner.?notice/i.test(s)) return true
    return false
  }

  /**
   * 상품상세 본문 컷인지 (등록 갤러리와 구분)
   * - 세로로 긴 소개컷 / 가로로 넓은 배너컷 위주
   * - 정사각에 가까운 등록용 썸네일 제외
   */
  function looksLikeDetailPageShot(el, url) {
    if (isNoticeOrJunkDetailUrl(url)) return false
    const w = el?.naturalWidth || el?.width || 0
    const h = el?.naturalHeight || el?.height || 0
    if (w >= 80 && h >= 80) {
      const ratio = h / w
      // 등록 갤러리는 거의 1:1. 상세 소개컷은 세로형(>1.15) 또는 넓은 배너(w>=650 && ratio!=~1)
      if (ratio >= 1.12) return true
      if (w >= 650 && (ratio <= 0.9 || ratio >= 1.12)) return true
      if (ratio >= 0.85 && ratio <= 1.15 && w < 900) return false // 정사각 갤러리 컷
    }
    // 치수를 모르면 URL만으로는 갤러리와 구분 어려움 → DOM 위치 + deny로만 허용
    return true
  }

  function pushExclusiveDetail(list, src, deny, max = 60, el = null) {
    const u = upgradeImageUrl(src) || absUrl(src)
    if (!isUsableImageUrl(u)) return
    if (isDeniedGallery(u, deny) || isDeniedGallery(src, deny)) return
    if (isNoticeOrJunkDetailUrl(u)) return
    if (/\/(?:16|24|32|48|64|86|100|120)x(?:16|24|32|48|64|86|100|120)\//i.test(u)) return
    if (el && !looksLikeDetailPageShot(el, u)) return
    if (list.some((x) => urlFingerprint(x) === urlFingerprint(u))) return
    list.push(u)
  }

  function collectImgFromDetailEl(el, list, deny, max) {
    if (!el) return
    // 상품상세 본문 밖이면 수집 금지 (상단 갤러리·옵션컷)
    if (!isInsideDetailScope(el) && el.ownerDocument === document) return
    // 필수표기 테이블 / 상단 갤러리 제외
    if (
      el.closest?.(
        "table, .prod-image, [class*='prod-image'], [class*='ProductImage'], [class*='essential'], [class*='Essential'], [class*='tw-gallery'], [class*='ImageGallery'], [class*='ImageShowcase'], [class*='thumbnail']"
      )
    ) {
      return
    }
    const attrs = [
      el.getAttribute?.("src"),
      el.getAttribute?.("data-src"),
      el.getAttribute?.("data-img-src"),
      el.getAttribute?.("data-original"),
      el.getAttribute?.("data-lazy-src"),
    ]
    const srcset = el.getAttribute?.("srcset") || ""
    if (srcset) {
      const best = srcset
        .split(",")
        .map((p) => p.trim().split(/\s+/)[0])
        .filter(Boolean)
        .pop()
      attrs.push(best)
    }
    const style = el.getAttribute?.("style") || ""
    const bg = style.match(/url\(['"]?([^'")]+)['"]?\)/i)
    if (bg) attrs.push(bg[1])
    for (const a of attrs) {
      if (a) pushExclusiveDetail(list, a, deny, max, el.tagName === "IMG" ? el : null)
    }
  }

  /** contents/contentDetails 의 detailType=IMAGE 만 (등록 갤러리 images[] 금지) */
  function walkContentDetailsOnly(node, out, deny, depth = 0, inContents = false) {
    if (!node || depth > 16 || out.length >= 60) return
    if (Array.isArray(node)) {
      for (const x of node) walkContentDetailsOnly(x, out, deny, depth + 1, inContents)
      return
    }
    if (typeof node !== "object") return

    const keys = Object.keys(node)
    // 등록 이미지 배열은 절대 순회하지 않음
    if (!inContents) {
      for (const key of keys) {
        if (/^images$/i.test(key)) continue
        if (/^(contents|contentDetails|detailContents|productDetail|vendorItemContents)$/i.test(key)) {
          walkContentDetailsOnly(node[key], out, deny, depth + 1, true)
        } else if (/content|detail|description|html/i.test(key)) {
          walkContentDetailsOnly(node[key], out, deny, depth + 1, false)
        }
      }
      return
    }

    const type = String(node.detailType || node.contentsType || node.contentType || node.type || "").toUpperCase()
    const imageType = String(
      node.imageType || node.vendorItemImageType || node.representationType || ""
    ).toUpperCase()
    // 상단 대표/옵션 갤러리 JSON 컷 제외
    if (/REPRESENT|THUMB|OPTION|GALLERY|MAIN/.test(imageType)) {
      /* skip this node image; still walk children below */
    } else if (type === "IMAGE" || type === "IMG") {
      const candidates = [node.content, node.cdnPath, node.vendorPath, node.url, node.src, node.imageUrl]
      for (const c of candidates) {
        if (typeof c !== "string" || c.length < 8) continue
        let u = c.trim().replace(/\\u002F/gi, "/").replace(/\\\//g, "/")
        if (u.startsWith("//")) u = "https:" + u
        if (!/^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp)/i.test(u)) {
          u = `https://image6.coupangcdn.com/image/${u.replace(/^\//, "")}`
        }
        if (/^https?:\/\//i.test(u)) pushExclusiveDetail(out, u, deny, 60)
      }
    }

    for (const key of keys) {
      if (/^images$/i.test(key)) continue
      walkContentDetailsOnly(node[key], out, deny, depth + 1, true)
    }
  }

  function collectDetailImagesFromEmbeddedJson(deny) {
    const out = []
    const tryText = (text) => {
      if (!text || text.length < 40) return
      // detailType IMAGE 만 (vendor_inventory 전체 스캔 금지 = 등록컷이 섞임)
      const chunkRe =
        /"detailType"\s*:\s*"IMAGE"[\s\S]{0,500}?"(?:content|cdnPath|vendorPath|url)"\s*:\s*"([^"]+)"/gi
      let m
      while ((m = chunkRe.exec(text))) {
        let u = m[1].replace(/\\u002F/gi, "/").replace(/\\\//g, "/")
        if (u.startsWith("//")) u = "https:" + u
        if (!/^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp)/i.test(u)) {
          u = `https://image6.coupangcdn.com/image/${u.replace(/^\//, "")}`
        }
        pushExclusiveDetail(out, u, deny, 60)
      }
      try {
        walkContentDetailsOnly(JSON.parse(text), out, deny)
      } catch {
        /* ignore */
      }
    }

    document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__').forEach((sc) => {
      tryText(sc.textContent || "")
    })
    document.querySelectorAll("script:not([src])").forEach((sc) => {
      const t = sc.textContent || ""
      if (t.length < 200 || t.length > 2_000_000) return
      if (!/"detailType"\s*:\s*"IMAGE"|contentDetails/i.test(t)) return
      tryText(t.slice(0, 1_000_000))
    })
    try {
      if (window.__PRELOADED_STATE__) walkContentDetailsOnly(window.__PRELOADED_STATE__, out, deny)
      if (window.__NEXT_DATA__) walkContentDetailsOnly(window.__NEXT_DATA__, out, deny)
    } catch {
      /* ignore */
    }
    return out
  }

  async function expandDetailSection() {
    const tabWords = ["상품상세", "상품 상세"]
    for (const word of tabWords) {
      const el = Array.from(document.querySelectorAll("a, button, [role='tab'], li, span")).find((n) => {
        const t = decode(n.textContent)
        if (!t || t.length > 16) return false
        if (/필수|교환|반품|리뷰|상품평|문의|배송/.test(t)) return false
        return t === word || t.startsWith(word)
      })
      if (el) {
        try {
          el.click()
        } catch {
          /* ignore */
        }
        await sleep(1000)
        break
      }
    }

    for (let round = 0; round < 4; round++) {
      const more = Array.from(document.querySelectorAll("button, a, div, span")).find((n) => {
        const t = decode(n.textContent)
        return t === "상세정보 더보기" || t.includes("상세정보 더보기") || t === "상품정보 더보기"
      })
      if (!more) break
      try {
        more.click()
      } catch {
        /* ignore */
      }
      await sleep(800)
    }
  }

  /** 상품상세(긴 소개)만 — 상단 대표 갤러리 사진 제외 */
  async function collectDetailPageImages() {
    const ids = extractIds()
    await expandDetailSection()
    // 탭 연 뒤 상단 갤러리를 deny에 넣음 (상세 iframe 밖 컷)
    const deny = collectGalleryDenySet()

    const roots = detailScopes(document).filter((n) => n && n.tagName !== "IFRAME")
    for (const root of roots) {
      try {
        root.scrollIntoView({ behavior: "instant", block: "start" })
      } catch {
        /* ignore */
      }
    }

    for (let i = 0; i < 10; i++) {
      window.scrollBy(0, 700)
      await sleep(280)
    }
    if (roots[0]) {
      try {
        roots[0].scrollIntoView({ behavior: "instant", block: "start" })
      } catch {
        /* ignore */
      }
      await sleep(500)
    }

    // 스크롤로 lazy-load된 상단 컷도 다시 deny
    const deny2 = collectGalleryDenySet()
    for (const fp of deny2.denyFp) deny.denyFp.add(fp)
    for (const u of deny2.denyUrl) deny.denyUrl.add(u)

    const detailImages = []

    // 1) contentDetails IMAGE 만 — 상단 갤러리 fingerprint deny
    for (const u of collectDetailImagesFromEmbeddedJson(deny)) {
      pushExclusiveDetail(detailImages, u, deny, 60)
    }

    // 2) 상품상세 DOM / iframe 본문만 (상단 갤러리 DOM은 여기 안 들어옴)
    const docs = [document]
    document.querySelectorAll("iframe").forEach((iframe) => {
      const src = iframe.getAttribute("src") || ""
      if (src && !/detail|vendoritem|vendor-item|productDetail/i.test(src)) return
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc) docs.push(doc)
      } catch {
        /* cross-origin */
      }
    })

    for (const doc of docs) {
      const scopes = detailScopes(doc).filter((n) => n && n.tagName !== "IFRAME")
      if (doc !== document && doc.body && /detail|vendoritem/i.test(doc.URL || "")) {
        scopes.push(doc.body)
      } else if (doc !== document && doc.body) {
        const frameEl = [...document.querySelectorAll("iframe")].find((f) => {
          try {
            return f.contentDocument === doc
          } catch {
            return false
          }
        })
        const fsrc = frameEl?.getAttribute("src") || ""
        if (/detail|vendoritem|vendor-item|productDetail/i.test(fsrc)) scopes.push(doc.body)
      }

      for (const scope of scopes) {
        scope.querySelectorAll("img, [style*='background'], source").forEach((el) => {
          // iframe body 전체일 때도 테이블(필수표기)·갤러리 클래스는 collectImgFromDetailEl에서 제외
          if (doc === document && !isInsideDetailScope(el, doc)) return
          collectImgFromDetailEl(el, detailImages, deny, 60)
        })
      }
    }

    // 최종: 상단 갤러리와 지문이 같은 컷 제거
    const cleaned = detailImages.filter((u) => !isDeniedGallery(u, deny))

    return {
      detailImages: cleaned.slice(0, 60),
      debugIds: ids,
      galleryDenied: deny.denyFp.size,
    }
  }

  function isAccessDeniedPage() {
    const t = `${document.title || ""} ${document.body?.innerText || ""}`.slice(0, 2000)
    return (
      /Access Denied/i.test(t) ||
      /You don't have permission to access/i.test(t) ||
      /errors\.edgesuite\.net/i.test(t)
    )
  }

  function flattenReviewNodes(node, out = []) {
    if (!node) return out
    if (Array.isArray(node)) {
      for (const x of node) flattenReviewNodes(x, out)
      return out
    }
    if (typeof node !== "object") return out

    const content =
      node.content ||
      node.reviewContent ||
      node.reviewText ||
      node.comment ||
      node.text ||
      node.title ||
      node.headline ||
      node.review
    if (typeof content === "string" && content.trim().length >= 5) {
      out.push(node)
      return out
    }
    for (const k of Object.keys(node)) {
      if (/review|rData|datalist|list|items|contents|rList/i.test(k)) {
        flattenReviewNodes(node[k], out)
      }
    }
    return out
  }

  function normalizeApiReview(r) {
    // title/headline은 옵션·상품명인 경우가 많아 content만 사용
    const content = decode(
      r.content || r.reviewContent || r.reviewText || r.comment || r.text || ""
    )
    if (content.length < 5) return null
    if (/function\s*\(|localStorage|web-adapter|#region/i.test(content)) return null
    return { content: content.slice(0, 1500) }
  }

  /**
   * 리뷰 API는 Akamai 차단을 유발하기 쉬워 기본 비활성.
   * DOM 페이지네이션으로 수집합니다.
   */
  async function fetchReviewsViaApi(_productId, _maxCount) {
    return { reviews: [], source: "dom-only", tried: [], skipped: "akamai-safe" }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  function dedupeReviews(list, limit) {
    const seen = new Map()
    const unique = []
    for (const r of list) {
      const key = `${(r.content || "").slice(0, 120)}`
      const existing = seen.get(key)
      if (existing) {
        existing.images = Array.from(
          new Set([...(existing.images || []), ...(r.images || [])])
        ).slice(0, 12)
        continue
      }
      seen.set(key, r)
      unique.push(r)
      if (unique.length >= limit) break
    }
    return unique
  }

  function normalizeReviewImageUrl(raw) {
    let value = String(raw || "")
      .replace(/&amp;/g, "&")
      .trim()
    if (!value || /^(?:data|blob|javascript):/i.test(value)) return ""
    value = value.split(/\s+/)[0] || ""
    if (value.startsWith("//")) value = `https:${value}`
    else if (value.startsWith("/")) {
      try {
        value = new URL(value, location.origin).href
      } catch {
        return ""
      }
    } else if (!/^https?:\/\//i.test(value) && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(value)) {
      try {
        value = new URL(value, location.href).href
      } catch {
        return ""
      }
    }
    if (!/^https?:\/\//i.test(value)) return ""
    if (
      /(?:avatar|profile|rating|star|sprite|icon|logo|badge|emoji|loading|placeholder)/i.test(
        value
      )
    ) {
      return ""
    }
    return value
  }

  function collectReviewImagesFromCard(card) {
    const urls = []
    const add = (raw) => {
      const values = String(raw || "").match(
        /(?:(?:https?:)?\/\/|\/)[^'")\s,]+/gi
      ) || [raw]
      for (const value of values) {
        const url = normalizeReviewImageUrl(value)
        if (url && !urls.includes(url)) urls.push(url)
      }
    }

    const mediaNodes = [
      ...(card.matches?.("img, source") ? [card] : []),
      ...card.querySelectorAll("img, source"),
    ]
    mediaNodes.forEach((media) => {
      const width = Number(media.naturalWidth || media.getAttribute("width") || 0)
      const height = Number(media.naturalHeight || media.getAttribute("height") || 0)
      if (width > 0 && height > 0 && (width < 48 || height < 48)) return

      add(media.currentSrc)
      for (const attr of [
        "src",
        "data-src",
        "data-lazy-src",
        "data-original",
        "data-image",
        "data-image-url",
        "data-origin",
        "data-origin-path",
        "data-attachment-url",
        "data-url",
        "style",
      ]) {
        add(media.getAttribute(attr))
      }
      for (const attr of ["srcset", "data-srcset"]) {
        const srcset = media.getAttribute(attr) || ""
        srcset.split(",").forEach((candidate) => add(candidate.trim()))
      }
    })

    card.querySelectorAll("*").forEach((element) => {
      for (const attribute of Array.from(element.attributes || [])) {
        if (/src|image|photo|attach|origin|style|url/i.test(attribute.name)) {
          add(attribute.value)
        }
      }
      const inline = element.style?.backgroundImage || ""
      add(inline)
      if (
        /attach|photo|image/i.test(String(element.className || "")) ||
        /attach|photo|image/i.test(String(element.getAttribute?.("data-testid") || ""))
      ) {
        try {
          add(getComputedStyle(element).backgroundImage)
        } catch {
          // 숨겨진/분리된 DOM 노드는 inline 속성만 사용합니다.
        }
      }
    })

    return urls.slice(0, 12)
  }

  function collectReviewImagesFromRoot() {
    const root = reviewRoot()
    const urls = []
    const addAll = (node) => {
      for (const url of collectReviewImagesFromCard(node)) {
        if (!urls.includes(url)) urls.push(url)
      }
    }
    const selectors = [
      ".sdp-review__article__list__attachment",
      "[class*='review__attachment']",
      "[class*='ReviewAttachment']",
      "[class*='review-photo']",
      "[class*='ReviewPhoto']",
      "[class*='review-image']",
      "[class*='ReviewImage']",
      "[data-image-url]",
      "[data-origin-path]",
      "[data-attachment-url]",
    ]
    for (const selector of selectors) {
      root.querySelectorAll(selector).forEach(addAll)
    }
    root.querySelectorAll("img, source").forEach((media) => {
      const raw = [
        media.currentSrc,
        media.getAttribute("src"),
        media.getAttribute("data-src"),
        media.getAttribute("data-origin"),
        media.getAttribute("data-origin-path"),
      ].join(" ")
      if (/productreview|review|attachment/i.test(raw)) addAll(media)
    })
    return urls.slice(0, 80)
  }

  /** 「더보기」펼쳐서 접힌 리뷰 본문 확보 */
  function expandReviewMoreButtons() {
    const root = reviewRoot()
    const scope = root && root !== document ? root : document
    const buttons = Array.from(scope.querySelectorAll("button, a, span, div")).filter((el) => {
      const t = decode(el.textContent)
      return t.length > 0 && t.length <= 12 && /^(더보기|더 보기|펼치기|전체보기)$/.test(t)
    })
    for (const el of buttons.slice(0, 40)) {
      try {
        el.click()
      } catch {
        /* ignore */
      }
    }
  }

  /** 카드 DOM에서 리뷰 본문만 추출 */
  function extractReviewBodyFromCard(node) {
    if (!node) return ""

    const contentSelectors = [
      ".sdp-review__article__list__review__content",
      ".sdp-review__article__list__review",
      "[class*='review__content']",
      "[class*='ReviewContent']",
      "[class*='review-content']",
      "[class*='reviewContent']",
      "[class*='ArticleContent']",
      "[class*='article__content']",
      "[data-review-content]",
      "[class*='twc-'][class*='content']",
    ]
    for (const sel of contentSelectors) {
      const el = node.querySelector(sel)
      if (!el) continue
      // content 노드 자체가 card인 경우(자기 자신) 스킵하고 전체 휴리스틱으로
      if (el === node) continue
      const t = decode(visibleText(el, 1600) || el.textContent)
      if (t.length >= 8 && /[가-힣]{2,}/.test(t)) return t
    }

    // data-* 속성
    for (const el of node.querySelectorAll("[data-content], [data-review-content], [data-text]")) {
      const t = decode(
        el.getAttribute("data-content") ||
          el.getAttribute("data-review-content") ||
          el.getAttribute("data-text") ||
          ""
      )
      if (t.length >= 8 && /[가-힣]{2,}/.test(t)) return t
    }

    // 「도움이 돼요」앞쪽 덩어리를 본문으로 사용
    const raw = decode(visibleText(node, 2500) || node.textContent)
    if (!raw) return ""
    let body = raw
    const helpIdx = body.search(/도움이\s*돼요/)
    if (helpIdx > 20) body = body.slice(0, helpIdx)
    const reportIdx = body.search(/신고하기|신고\s*$/)
    if (reportIdx > 20) body = body.slice(0, reportIdx)

    body = body
      .replace(/판매자\s*[:：]\s*\S+/g, " ")
      .replace(/베스트순|최신순|모든 별점|검색어를 입력하세요|사진\s*\/\s*동영상|포토\s*상품평/g, " ")
      .replace(/신선도|맛 만족도|아주 신선해요|맛있어요|보통이에요|별점\s*\d/g, " ")
      .replace(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/g, " ")
      .replace(/^\s*[★☆⭐]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // 앞쪽 짧은 작성자/옵션 줄 제거 (한글 이름 + 옵션)
    body = body.replace(/^[가-힣*]{2,8}\s+[^\s]{0,40}\s+(?=[가-힣a-zA-Z])/u, "").trim()

    return body
  }

  function looksLikeReviewCard(node) {
    if (!node || node === document.body || node === document.documentElement) return false
    const text = decode(node.textContent || "")
    if (text.length < 20 || text.length > 8000) return false
    const hasHangul = /[가-힣]{4,}/.test(text)
    const hasHelp = /도움이\s*돼요|신고하기/.test(text)
    const hasReviewImg = Boolean(
      node.querySelector?.(
        "img[src*='productreview'], img[src*='review'], img[data-src*='productreview'], source[srcset*='productreview']"
      )
    )
    const cls = String(node.className || "")
    const hasReviewClass = /review|Review|sdp-review|twc-/i.test(cls)
    return hasHangul && (hasHelp || hasReviewImg || hasReviewClass)
  }

  /** 현재 화면에 보이는 리뷰만 (페이지당 ~10개) */
  function collectReviewsDomFromCurrentPage() {
    expandReviewMoreButtons()
    const nodeSet = new Set()
    const root = reviewRoot()
    const scope = root && root !== document ? root : document

    const selectors = [
      ".sdp-review__article__list__review",
      ".sdp-review__article__list__review__content",
      ".sdp-review__article__list article",
      ".sdp-review__article__list > li",
      ".sdp-review__article__list li",
      ".js_reviewArticleReviewList > li",
      "[data-review-id]",
      "[class*='ReviewArticle']",
      "[class*='review__article']",
      "[class*='sdp-review__article']",
      "article[class*='review']",
      "article[class*='Review']",
      "[class*='twc-'][class*='review' i]",
      "li[class*='review' i]",
    ]
    for (const sel of selectors) {
      try {
        scope.querySelectorAll(sel).forEach((n) => {
          let card = n
          if (/content/i.test(String(n.className || ""))) {
            card =
              n.closest(
                "article, li, [class*='review__article'], [class*='Review'], [class*='sdp-review__article']"
              ) ||
              n.parentElement ||
              n
          }
          nodeSet.add(card)
        })
      } catch {
        /* invalid selector in some browsers */
      }
    }

    // 「도움이 돼요」앵커 → 카드
    for (const el of scope.querySelectorAll("button, a, span, div")) {
      const t = decode(el.textContent)
      if (!/^도움이\s*돼요/.test(t) && t !== "도움이 돼요") continue
      let cur = el
      for (let i = 0; i < 12 && cur; i++) {
        if (looksLikeReviewCard(cur)) {
          nodeSet.add(cur)
          break
        }
        cur = cur.parentElement
      }
    }

    // 리뷰 사진 URL 기준으로 카드 역추적 (사진은 잡히는데 본문 셀렉터만 깨진 경우)
    scope.querySelectorAll("img, source").forEach((media) => {
      const raw = [
        media.currentSrc,
        media.getAttribute("src"),
        media.getAttribute("data-src"),
        media.getAttribute("data-origin"),
        media.getAttribute("srcset"),
      ].join(" ")
      if (!/productreview|\/review\/|reviewimage|attachment/i.test(raw)) return
      let cur = media.parentElement
      for (let i = 0; i < 14 && cur; i++) {
        if (looksLikeReviewCard(cur)) {
          nodeSet.add(cur)
          break
        }
        cur = cur.parentElement
      }
    })

    const reviews = []
    for (const node of nodeSet) {
      if (!looksLikeReviewCard(node)) continue

      let content = extractReviewBodyFromCard(node)
      if (!content || content.length < 8) {
        content = decode(visibleText(node, 2000) || node.textContent)
          .replace(/도움이\s*돼요[\s\S]*$/g, " ")
          .replace(/신고하기[\s\S]*$/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }

      if (content.length < 8) continue
      if (/^별점|^평점|^상품평$|^포토\s*상품평$/.test(content)) continue
      if (/function\s*\(|localStorage|web-adapter|#region/i.test(content)) continue
      // UI 크롬만 남은 경우 제외
      if (
        content.length < 40 &&
        /베스트순|최신순|모든 별점|검색어|사진\s*\/\s*동영상/.test(content) &&
        !/[가-힣]{10,}/.test(content)
      ) {
        continue
      }

      reviews.push({
        content: content.slice(0, 1500),
        images: collectReviewImagesFromCard(node),
      })
    }

    return dedupeReviews(reviews, 80)
  }

  function reviewRoot() {
    return (
      document.querySelector("#sdpReview") ||
      document.querySelector("[class*='sdp-review']") ||
      document.querySelector("[class*='ProductReview']") ||
      document
    )
  }

  /** 갤러리/모달 닫기 (페이지 번호 오클릭으로 자주 열림) */
  function closeOverlays() {
    const titles = Array.from(document.querySelectorAll("h1, h2, h3, div, span, strong")).filter((el) => {
      const t = decode(el.textContent)
      return t === "갤러리" || t === "Gallery"
    })
    const looksOpen = titles.some((el) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

    // ESC
    ;["keydown", "keyup"].forEach((type) => {
      document.dispatchEvent(
        new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true })
      )
    })

    const closeSelectors = [
      "[class*='close']",
      "[class*='Close']",
      "[aria-label*='닫기']",
      "[aria-label*='close' i]",
      "button",
    ]
    for (const sel of closeSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        const t = decode(el.textContent)
        const aria = (el.getAttribute("aria-label") || "").toLowerCase()
        if (
          t === "×" ||
          t === "X" ||
          t === "닫기" ||
          t === "닫기 버튼" ||
          aria.includes("close") ||
          aria.includes("닫기") ||
          /close/i.test(el.className || "")
        ) {
          // 화면 중앙 근처 모달의 닫기만
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.left > 0) {
            try {
              el.click()
            } catch {
              /* ignore */
            }
          }
        }
      }
    }

    // 딤드 백드롭 클릭
    for (const el of document.querySelectorAll("[class*='dimmed'], [class*='Dimmed'], [class*='overlay'], [class*='backdrop']")) {
      const r = el.getBoundingClientRect()
      if (r.width > window.innerWidth * 0.5 && r.height > window.innerHeight * 0.5) {
        try {
          el.click()
        } catch {
          /* ignore */
        }
      }
    }

    return looksOpen
  }

  /** 상품평 하단 페이지네이션 컨테이너만 찾기 (갤러리·별점 숫자 제외) */
  function findPaginationContainer() {
    const root = reviewRoot()
    if (!root || root === document) {
      // 리뷰 루트가 없으면 페이지네이션 클릭 자체를 하지 않음
      return null
    }

    const selectors = [
      ".sdp-review__article__page",
      "[class*='sdp-review'][class*='page']",
      "[class*='review'][class*='page']",
      "[class*='paging']",
      "[class*='Pagination']",
      "[class*='pagination']",
      "nav",
    ]
    for (const sel of selectors) {
      for (const c of root.querySelectorAll(sel)) {
        if (isPaginationContainer(c)) return c
      }
    }

    // 숫자 1~5가 나란히 있는 작은 블록 탐색
    const blocks = root.querySelectorAll("div, ul, ol, nav, section")
    for (const c of blocks) {
      if (isPaginationContainer(c)) return c
    }
    return null
  }

  function isPaginationContainer(el) {
    if (!el) return false
    // 이미지/갤러리 영역 제외
    if (el.closest("[class*='gallery'], [class*='Gallery'], [class*='modal'], [class*='Modal']")) {
      return false
    }
    if (el.querySelector("img") && !/page|paging|pagination/i.test(el.className || "")) {
      // 이미지 많은 블록은 갤러리/리뷰카드일 확률 큼 — page 클래스 없으면 제외
      const imgs = el.querySelectorAll("img").length
      if (imgs >= 3) return false
    }

    const kids = Array.from(el.querySelectorAll("a, button, span, li")).filter((n) => {
      const t = decode(n.textContent)
      return /^([1-9]|1[0-5])$/.test(t) || t === ">" || t === "›" || t === "<" || t === "‹"
    })
    const nums = kids.filter((n) => /^([1-9]|1[0-5])$/.test(decode(n.textContent)))
    if (nums.length < 2) return false

    // 컨테이너가 너무 크면(리뷰 전체) 제외
    const textLen = decode(el.textContent).length
    if (textLen > 120) return false
    return true
  }

  function isSafePageControl(el) {
    if (!el) return false
    if (el.closest("img, picture, video, [class*='gallery'], [class*='Gallery'], [class*='thumb'], [class*='modal']")) {
      return false
    }
    if (el.querySelector("img")) return false
    const t = decode(el.textContent)
    if (!/^([1-9]|1[0-5])$/.test(t) && t !== ">" && t !== "›" && t !== "다음") return false
    return true
  }

  /** 상품평 페이지 번호 클릭 — 페이지네이션 안에서만 */
  function clickReviewPageNumber(pageNum) {
    closeOverlays()
    const pager = findPaginationContainer()
    if (!pager) return false
    const want = String(pageNum)
    const nodes = Array.from(pager.querySelectorAll("a, button, span, li")).filter(isSafePageControl)
    for (const el of nodes) {
      if (decode(el.textContent) !== want) continue
      const disabled =
        el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled") ||
        /disabled|is-disabled/i.test(el.className || "")
      if (disabled) return false
      el.click()
      return true
    }
    return false
  }

  function clickReviewNext() {
    closeOverlays()
    const pager = findPaginationContainer()
    if (!pager) return false
    const nodes = Array.from(pager.querySelectorAll("a, button, span, li"))
    for (const el of nodes) {
      if (!isSafePageControl(el)) continue
      const t = decode(el.textContent)
      const aria = (el.getAttribute("aria-label") || "").toLowerCase()
      if (t === ">" || t === "›" || t === "다음" || /next|다음/.test(aria)) {
        const disabled =
          el.getAttribute("aria-disabled") === "true" ||
          el.hasAttribute("disabled") ||
          /disabled/i.test(el.className || "")
        if (disabled) return false
        el.click()
        return true
      }
    }
    return false
  }

  /** 페이지네이션을 넘기며 maxCount까지 수집 (page / indexOnPage 포함) */
  async function collectReviewsDomPaged(maxCount) {
    const limit = Math.min(80, Math.max(1, Number(maxCount) || 20))
    const maxPages = Math.min(15, Math.max(2, Math.ceil(limit / 8) + 1))
    const all = []

    await scrollReviewsIntoView()
    closeOverlays()
    await sleep(400)
    expandReviewMoreButtons()
    await sleep(350)

    for (let p = 1; p <= maxPages; p++) {
      closeOverlays()
      if (p > 1) {
        let moved = clickReviewPageNumber(p)
        if (!moved) moved = clickReviewNext()
        if (!moved) break
        await sleep(1000)
        closeOverlays()
        await sleep(300)
        const root = reviewRoot()
        if (root && root !== document) {
          root.scrollIntoView({ behavior: "instant", block: "center" })
        }
        expandReviewMoreButtons()
        await sleep(300)
      }

      const batch = collectReviewsDomFromCurrentPage()
      const before = all.length
      for (let i = 0; i < batch.length; i++) {
        all.push({
          content: batch[i].content,
          images: batch[i].images || [],
          page: p,
          indexOnPage: i + 1,
        })
      }
      const merged = dedupeReviews(all, limit)
      all.length = 0
      all.push(...merged)

      if (p > 1 && all.length === before) break
      if (all.length >= limit) break
    }

    closeOverlays()
    return dedupeReviews(all, limit)
  }

  async function scrollReviewsIntoView() {
    const tabCandidates = Array.from(document.querySelectorAll("a, button, [role='tab'], li, span"))
    let best = null
    let bestScore = 0
    for (const el of tabCandidates) {
      const t = decode(el.textContent)
      if (!t || t.length > 36) continue
      let score = 0
      if (t.includes("상품평")) score = 10
      else if (t.includes("상품 리뷰")) score = 9
      else if (/^리뷰/.test(t)) score = 6
      if (score > bestScore) {
        bestScore = score
        best = el
      }
    }
    best?.click()
    await new Promise((r) => setTimeout(r, 900))

    const root =
      document.querySelector("#sdpReview") ||
      document.querySelector("[class*='sdp-review']") ||
      document.querySelector("[class*='ProductReview']")
    if (root) root.scrollIntoView({ behavior: "instant", block: "center" })
    else window.scrollTo(0, Math.max(700, document.body.scrollHeight * 0.5))
    await new Promise((r) => setTimeout(r, 600))
    for (let i = 0; i < 3; i++) {
      window.scrollBy(0, 320)
      await new Promise((r) => setTimeout(r, 450))
    }
  }

  async function activatePhotoReviewFilter() {
    const root = reviewRoot()
    const candidates = Array.from(
      root.querySelectorAll("button, a, label, [role='tab'], li, span")
    )
    const matched = candidates.find((element) => {
      const text = decode(element.textContent)
      if (!text || text.length > 30) return false
      return (
        /^(?:포토|사진)(?:\s*[&/+·]\s*동영상)?\s*(?:리뷰|상품평)$/i.test(text) ||
        /^(?:사진|동영상)\s*(?:리뷰|상품평)/i.test(text) ||
        /^(?:리뷰|상품평)\s*(?:사진|동영상)/i.test(text)
      )
    })
    if (!matched) return false

    const clickable =
      matched.closest("button, a, label, [role='tab'], li") || matched
    const rect = clickable.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    clickable.click()
    await sleep(1200)
    const nextRoot = reviewRoot()
    if (nextRoot && nextRoot !== document) {
      nextRoot.scrollIntoView({ behavior: "instant", block: "center" })
    }
    for (let index = 0; index < 4; index++) {
      window.scrollBy(0, 280)
      await sleep(350)
    }
    return true
  }

  /** 작성자·판매자·상품명·옵션 접두어 제거 → 리뷰 본문만 */
  function stripReviewMetaPrefix(content, productName) {
    let s = String(content || "")
      .replace(/\s+/g, " ")
      .trim()
    if (!s) return ""

    // 한효석 온스컴퍼니[한정특가] … 10kg, 1박스, 가정용 (못난이) 10kg
    const headerRe =
      /^(?:[가-힣*]{2,8}\s+)?[가-힣A-Za-z0-9&·]{2,30}\s*\[[^\]]{1,40}\][\s\S]{5,200}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉))(?:\s*,\s*[가-힣A-Za-z0-9()[\]\s./\-]{0,80}?(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|\([^)]{0,40}\))){0,6}\s*/i
    let after = s.replace(headerRe, "").trim()
    if (after.length >= 8) s = after

    const pn = String(productName || "")
      .replace(/\s+/g, " ")
      .trim()
    if (pn) {
      const variants = [pn, pn.replace(/^\[[^\]]+\]\s*/, "").trim()].filter((v) => v.length >= 6)
      for (const v of variants) {
        const idx = s.indexOf(v)
        if (idx >= 0 && idx < 120) {
          after = s
            .slice(idx + v.length)
            .replace(/^[\s,]+/, "")
            .replace(
              /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
              ""
            )
            .trim()
          if (after.length >= 8) {
            s = after
            break
          }
        }
      }
    }

    s = s
      .replace(
        /^(?:,?\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|입|개|팩|박스|병|세트|봉)|가정용|못난이|특가|\([^)]{0,40}\)))+/i,
        ""
      )
      .trim()

    return s
  }

  function cleanReviewContent(raw, productName) {
    let s = decode(raw)
    if (!s) return ""
    s = s
      .replace(/판매자:\s*[^\n]+/g, " ")
      .replace(/도움이\s*돼요/g, " ")
      .replace(/신고하기/g, " ")
      .replace(/신선도\s*[^\n]*/g, " ")
      .replace(/맛 만족도\s*[^\n]*/g, " ")
      .replace(/아주 신선해요|맛있어요|보통이에요/g, " ")
      .replace(/20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (looksLikeJunkText(s)) return ""
    const stripped = stripReviewMetaPrefix(s, productName)
    // 메타 제거가 과도하면 원문 유지 (본문이 통째로 사라지는 문제 방지)
    if (stripped.length >= 8) s = stripped
    if (looksLikeJunkText(s)) return ""
    if (s.length < 5 || !/[가-힣a-zA-Z]/.test(s)) return ""
    return s.slice(0, 1500)
  }

  async function collectAll(opts) {
    if (isAccessDeniedPage()) {
      throw new Error(
        "쿠팡이 Access Denied(차단) 상태입니다.\n\n" +
          "1) 이 탭을 닫고 10~30분 뒤 다시 접속하세요\n" +
          "2) 일반 브라우저로 상품 페이지가 열릴 때까지 기다리세요\n" +
          "3) 상품상세·상품평이 보인 뒤에만 수집기를 다시 누르세요\n\n" +
          "(수집기는 더 이상 쿠팡 API를 연속 호출하지 않도록 수정됐습니다)"
      )
    }

    const maxReviews = opts?.maxReviews ?? 20
    const reviewPhotosOnly = Boolean(opts?.reviewPhotosOnly)
    const productId = extractProductId()
    const meta = collectProductMeta()
    // 상품 상세페이지 = 상세 이미지들 (필수표기 텍스트 제외) — fetch 없음
    const detail = reviewPhotosOnly
      ? { detailImages: [], debugIds: {}, galleryDenied: 0 }
      : await collectDetailPageImages()

    // 리뷰: 일반 목록과 포토 상품평 필터를 한 번에 순회합니다.
    // API fetch는 Akamai 차단을 유발하므로 DOM만 사용합니다.
    const regularReviews = await collectReviewsDomPaged(maxReviews)
    const collectedReviewImages = [
      ...regularReviews.flatMap((review) => review.images || []),
      ...collectReviewImagesFromRoot(),
    ]
    let photoReviews = []
    const photoFilterActivated = await activatePhotoReviewFilter()
    if (photoFilterActivated) {
      photoReviews = await collectReviewsDomPaged(maxReviews)
      collectedReviewImages.push(
        ...photoReviews.flatMap((review) => review.images || []),
        ...collectReviewImagesFromRoot()
      )
    }
    const reviews = dedupeReviews(
      [...regularReviews, ...photoReviews],
      maxReviews
    )
    const collectSource = photoFilterActivated ? "dom+photo-filter" : "dom"

    const productName = meta.productName || ""
    const slimReviews = dedupeReviews(reviews, maxReviews)
      .map((r) => {
        const content = cleanReviewContent(r.content, productName)
        if (!content || content.length < 5) return null
        const page = Number(r.page) > 0 ? Math.floor(Number(r.page)) : undefined
        const indexOnPage =
          Number(r.indexOnPage) > 0 ? Math.floor(Number(r.indexOnPage)) : undefined
        const images = Array.from(
          new Set(Array.isArray(r.images) ? r.images.filter(Boolean) : [])
        ).slice(0, 12)
        return {
          content,
          ...(page ? { page } : {}),
          ...(indexOnPage ? { indexOnPage } : {}),
          ...(images.length ? { images } : {}),
        }
      })
      .filter(Boolean)

    // 상단 갤러리 제품사진 전부 (최종 1·2번은 Wings AI가 선정)
    const productImages = reviewPhotosOnly ? [] : collectAllProductPhotos(12)
    const productFp = new Set(productImages.map(urlFingerprint))
    // 상세페이지 = 상품상세 본문만 (제품사진 지문 제외)
    const detailImages = (Array.isArray(detail.detailImages) ? detail.detailImages : []).filter(
      (u) => u && !productFp.has(urlFingerprint(u))
    )

    return {
      productName,
      price: meta.price || "",
      productPrice: meta.price || "",
      delivery: meta.delivery || "",
      productDelivery: meta.delivery || "",
      images: productImages,
      productImages,
      detailImages,
      // 임시 대표(AI 선정 전). Wings에서 재선정됨
      productImage: productImages[0] || "",
      productUrl: meta.productUrl || location.href,
      productId,
      vendorItemId: detail.debugIds?.vendorItemId || "",
      reviews: slimReviews,
      reviewImages: Array.from(
        new Set([
          ...collectedReviewImages,
          ...slimReviews.flatMap((review) => review.images || []),
        ])
      ),
      reviewCount: slimReviews.length,
      detailImageCount: detailImages.length,
      productImageCount: productImages.length,
      galleryDenied: detail.galleryDenied || 0,
      collectSource,
      source: "chrome-extension",
      at: new Date().toISOString(),
    }
  }

  window.__shotformCollectCoupang = collectAll
})()
