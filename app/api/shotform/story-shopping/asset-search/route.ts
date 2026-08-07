import { NextRequest, NextResponse } from "next/server"
import {
  searchDouyinOnApify,
  searchXiaohongshuOnApify,
} from "@/lib/apify-product-search"
import {
  serpGoogleImagesAsKeyframes,
  serpGoogleLensVisualMatches,
  serpGoogleVideosSearch,
} from "@/lib/serpapi-product-search"
import { STORY_SHOPPING_SFX_CATALOG } from "@/lib/story-shopping-sfx-catalog"

export const runtime = "nodejs"
export const maxDuration = 300

const AUTO_ASSET_SOURCES = [
  "review-ai",
  "review-original",
  "pixabay-video",
  "pixabay-image",
  "douyin",
  "xiaohongshu",
  "klipy",
  "ai-image",
  "ai-video",
  "product",
] as const

type AutoAssetSource = (typeof AUTO_ASSET_SOURCES)[number]

type AutoAssetSlot = {
  sceneId: string
  lineIndex: number
  text: string
  contextText?: string
  visualPrompt?: string
  durationSec?: number
}

type AutoAssetAvailability = {
  review: boolean
  product: boolean
  pixabay: boolean
  apify: boolean
  klipy: boolean
  replicate: boolean
}

type AutoAssetPlan = {
  sceneId: string
  lineIndex: number
  source: AutoAssetSource
  needsProduct: boolean
  queryKo: string
  reason: string
}

type AutoSfxSlot = {
  sceneId: string
  lineIndex: number
  text: string
  startSec: number
  durationSec: number
}

type AutoSfxPlan = {
  sceneId: string
  lineIndex: number
  catalogId: string
  offsetSec: number
  volumePct: number
  maxDurationSec: number
  reason: string
}

type RankedVisualCandidate = {
  id: string
  imageUrl: string
  label: string
}

const AUTO_SFX_CATALOG_IDS = new Set([
  "004", "005", "006", "008", "009", "019", "029", "034", "036", "037", "043", "045",
  "051", "055", "057", "060", "067", "068", "083", "084", "086", "095",
  "097", "103", "110", "122", "126", "135", "143", "159", "163", "168",
  "174", "189", "211", "213", "214", "215", "216", "217",
])

const AUTO_SFX_CATALOG = STORY_SHOPPING_SFX_CATALOG.filter((item) =>
  AUTO_SFX_CATALOG_IDS.has(item.id)
)

/** 감정·상황별 후보 — 폴백에서 같은 id만 반복하지 않도록 로테이션 */
const AUTO_SFX_CATEGORY_POOLS: Record<string, string[]> = {
  surprise: ["034", "051", "135", "216", "217", "029", "189"],
  fail: ["068", "097", "043", "057", "159"],
  insight: ["086", "095", "036", "110", "174"],
  question: ["060", "103", "083", "097", "005"],
  click: ["009", "084", "163", "122", "067"],
  success: ["019", "126", "211", "037", "174", "110"],
  transition: ["008", "004", "213", "214", "215", "168", "045"],
  playful: ["005", "006", "036", "067", "143", "168", "004"],
}

const AUTO_SFX_ID_LIST = Array.from(AUTO_SFX_CATALOG_IDS)

function pickSfxFromPool(
  pool: string[],
  usedCounts: Map<string, number>,
  rotateIndex: number,
  avoidId?: string
): string {
  const candidates = pool.filter((id) => AUTO_SFX_CATALOG_IDS.has(id) && id !== avoidId)
  const list = candidates.length > 0 ? candidates : pool.filter((id) => AUTO_SFX_CATALOG_IDS.has(id))
  if (!list.length) {
    return AUTO_SFX_ID_LIST[rotateIndex % AUTO_SFX_ID_LIST.length]!
  }
  list.sort((a, b) => (usedCounts.get(a) || 0) - (usedCounts.get(b) || 0))
  const minCount = usedCounts.get(list[0]!) || 0
  const least = list.filter((id) => (usedCounts.get(id) || 0) === minCount)
  return least[rotateIndex % least.length]!
}

/**
 * 같은 catalogId 연속·과다 반복 제거.
 * - 연속 동일 금지
 * - 동일 id는 전체에서 maxPerId회까지 (기본 2, 슬롯 많으면 ceil(n/12))
 */
function diversifyAutoSfxPlans(plans: AutoSfxPlan[]): AutoSfxPlan[] {
  if (plans.length <= 1) return plans
  const maxPerId = Math.max(2, Math.ceil(plans.length / 12))
  const usedCounts = new Map<string, number>()
  const out: AutoSfxPlan[] = []

  const leastUsedAvoiding = (avoid?: string) => {
    let best = AUTO_SFX_ID_LIST[0]!
    let bestCount = Number.POSITIVE_INFINITY
    for (const id of AUTO_SFX_ID_LIST) {
      if (id === avoid) continue
      const c = usedCounts.get(id) || 0
      if (c < bestCount) {
        best = id
        bestCount = c
      }
    }
    return best
  }

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!
    let catalogId = plan.catalogId
    const prevId = out[out.length - 1]?.catalogId
    const count = usedCounts.get(catalogId) || 0

    if (catalogId === prevId || count >= maxPerId || !AUTO_SFX_CATALOG_IDS.has(catalogId)) {
      // 같은 카테고리 풀에서 대체 시도
      const poolEntry = Object.values(AUTO_SFX_CATEGORY_POOLS).find((pool) =>
        pool.includes(catalogId)
      )
      if (poolEntry) {
        catalogId = pickSfxFromPool(poolEntry, usedCounts, i, prevId)
      } else {
        catalogId = leastUsedAvoiding(prevId)
      }
      // 여전히 한도 초과면 전역 최소 사용
      if ((usedCounts.get(catalogId) || 0) >= maxPerId) {
        catalogId = leastUsedAvoiding(prevId)
      }
    }

    usedCounts.set(catalogId, (usedCounts.get(catalogId) || 0) + 1)
    out.push({
      ...plan,
      catalogId,
      reason:
        catalogId === plan.catalogId
          ? plan.reason
          : `${plan.reason} · 다양화`.slice(0, 100),
    })
  }
  return out
}

function matchFallbackSfx(
  text: string,
  rotateIndex: number,
  usedCounts: Map<string, number>,
  avoidId?: string
): { catalogId: string; reason: string } {
  const rules: Array<{ re: RegExp; pool: string; reason: string }> = [
    { re: /깜짝|놀랐|헉|충격|대박|서프라이즈/, pool: "surprise", reason: "놀람 강조" },
    { re: /실패|틀렸|아니었|문제|곤란|당황/, pool: "fail", reason: "실패·오답 강조" },
    { re: /알게|깨달|알고\s*보니|방법|해결|비밀|팁|꿀팁|비법/, pool: "insight", reason: "깨달음·해결책 등장" },
    { re: /왜|어떻게|뭘까|무엇|정말|궁금/, pool: "question", reason: "질문과 궁금증 강조" },
    {
      re: /누르|클릭|버튼|선택|입력|자르|썰|손질|깎|다지|섞|볶|굽|넣|담|붓|씻|털/,
      pool: "click",
      reason: "손동작·조리 포인트",
    },
    { re: /드디어|결국|완성|성공|좋았|만족|완성|끝/, pool: "success", reason: "긍정적인 결과 강조" },
    { re: /과일|신선|달콤|맛있|향|즙|과즙|딸기|키위|사과|망고/, pool: "playful", reason: "제품·식감 강조" },
    { re: /중반|전환|다음|장면/, pool: "transition", reason: "장면 전환·중반 포인트" },
  ]
  for (const rule of rules) {
    if (!rule.re.test(text)) continue
    const pool = AUTO_SFX_CATEGORY_POOLS[rule.pool] || AUTO_SFX_CATEGORY_POOLS.playful!
    return {
      catalogId: pickSfxFromPool(pool, usedCounts, rotateIndex, avoidId),
      reason: rule.reason,
    }
  }
  // 쇼핑·일반 나레이션도 빈 슬롯 없이 — 장면 리듬용 폴백
  const defaultPool =
    rotateIndex % 3 === 0
      ? AUTO_SFX_CATEGORY_POOLS.transition!
      : rotateIndex % 3 === 1
        ? AUTO_SFX_CATEGORY_POOLS.playful!
        : AUTO_SFX_CATEGORY_POOLS.click!
  return {
    catalogId: pickSfxFromPool(defaultPool, usedCounts, rotateIndex, avoidId),
    reason: "장면 리듬에 맞는 경쾌한 강조",
  }
}

function fallbackAutoAssetPlan(
  slots: AutoAssetSlot[],
  availability: AutoAssetAvailability
): AutoAssetPlan[] {
  const gifLimit =
    availability.klipy && slots.length >= 5
      ? Math.max(1, Math.floor(slots.length * 0.1))
      : 0
  const gifReactionPattern =
    /깜짝|놀랐|당황|실수|실패|짜증|충격|반전|헉|대박|황당|웃겼|화났/
  const gifIndexes = new Set(
    slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => gifReactionPattern.test(slot.text))
      .slice(0, gifLimit)
      .map(({ index }) => index)
  )
  const foreignIndexes = new Set(
    availability.apify
      ? slots
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) =>
            /사용|써보|시연|작동|설치|세척|보관|후기|리뷰|제품/.test(
              slot.text
            )
          )
          .slice(0, Math.max(1, Math.round(slots.length * 0.15)))
          .map(({ index }) => index)
      : []
  )
  return slots.map((slot, index) => {
    const productMoment =
      /제품|상품|사용|써보|설치|세척|버튼|기능|작동|후기|리뷰|구매|배송|구성품/.test(
        slot.text
      )
    let source: AutoAssetSource = "ai-image"
    if (gifIndexes.has(index)) {
      source = "klipy"
    } else if (foreignIndexes.has(index)) {
      source = index % 2 === 0 ? "douyin" : "xiaohongshu"
    } else if (availability.replicate && productMoment) {
      source = availability.review ? "review-ai" : "ai-image"
    } else if (availability.pixabay) {
      source = index % 2 === 0 ? "pixabay-video" : "pixabay-image"
    } else if (availability.apify) {
      source = index % 2 === 0 ? "douyin" : "xiaohongshu"
    } else if (availability.replicate) {
      source = index % 3 === 0 ? "ai-video" : "ai-image"
    }
    return {
      sceneId: slot.sceneId,
      lineIndex: slot.lineIndex,
      source,
      needsProduct: productMoment,
      queryKo: slot.visualPrompt || slot.text,
      reason:
        source === "klipy"
          ? "감정과 반전을 짧은 GIF로 강조"
          : productMoment
            ? "제품과 사용 상황을 정확히 보여주는 장면"
            : "대본 상황을 빠르게 이해시키는 장면",
    }
  })
}

function finalizeAutoAssetPlans(
  plans: AutoAssetPlan[],
  availability: AutoAssetAvailability
): AutoAssetPlan[] {
  if (!plans.length) return plans
  const finalized = plans.map((plan) => {
    if (
      plan.needsProduct &&
      (plan.source === "product" || plan.source === "review-original")
    ) {
      return {
        ...plan,
        source:
          availability.review && availability.replicate
            ? ("review-ai" as const)
            : ("ai-image" as const),
        reason: `${plan.reason} · 제품 원본을 직접 쓰지 않고 AI로 재구성`,
      }
    }
    if (
      !plan.needsProduct &&
      ["review-ai", "review-original", "product"].includes(plan.source)
    ) {
      return {
        ...plan,
        source: availability.pixabay
          ? ("pixabay-video" as const)
          : ("ai-image" as const),
        reason: `${plan.reason} · 일반 스토리 문맥에 맞는 비제품 장면`,
      }
    }
    return plan
  })
  const hasVideoPlan = finalized.some((plan) =>
    ["pixabay-video", "douyin", "xiaohongshu"].includes(plan.source)
  )
  if (!hasVideoPlan && finalized.length >= 2) {
    const videoIndex = finalized.findIndex((plan) => !plan.needsProduct)
    const targetIndex = videoIndex >= 0 ? videoIndex : finalized.length - 1
    if (availability.pixabay || availability.apify) {
      finalized[targetIndex] = {
        ...finalized[targetIndex]!,
        source:
          finalized[targetIndex]!.needsProduct && availability.apify
            ? "douyin"
            : "pixabay-video",
        reason: `${finalized[targetIndex]!.reason} · 전체 구성에 실제 영상 포함`,
      }
    }
  }
  return finalized
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const source = String(body.source || "")
    const query = String(body.query || "").trim()
    const imageUrl = String(body.imageUrl || "").trim()

    if (source === "sfx_plan") {
      const rawSlots: unknown[] = Array.isArray(body.slots) ? body.slots : []
      const slots: AutoSfxSlot[] = rawSlots
        .map((raw): AutoSfxSlot => {
          const slot = raw as Record<string, unknown>
          return {
            sceneId: String(slot.sceneId || ""),
            lineIndex: Math.max(0, Number(slot.lineIndex) || 0),
            text: String(slot.text || "").trim(),
            startSec: Math.max(0, Number(slot.startSec) || 0),
            durationSec: Math.max(0.4, Number(slot.durationSec) || 1),
          }
        })
        .filter((slot: AutoSfxSlot) =>
          Boolean(slot.sceneId && slot.text)
        )
        .slice(0, 100)
      if (!slots.length) {
        return NextResponse.json(
          { error: "효과음을 분석할 대본이 없습니다." },
          { status: 400 }
        )
      }
      const sceneIds = Array.from(
        new Set(slots.map((slot) => slot.sceneId))
      )
      const densityHigh = String(body.density || "").toLowerCase() === "high"
      // high: 슬롯(장면×포인트) 수만큼 · 기본도 슬롯 수를 최대한 채움
      const maxEffects = Math.min(
        48,
        densityHigh ? slots.length : Math.max(slots.length, sceneIds.length * 2)
      )
      const minEffects = Math.min(
        maxEffects,
        densityHigh
          ? Math.max(sceneIds.length, Math.ceil(slots.length * 0.85))
          : Math.max(sceneIds.length, Math.ceil(slots.length * 0.7))
      )
      const fallbackUsed = new Map<string, number>()
      let fallbackRotate = 0
      let lastFallbackId: string | undefined
      const fallbackPlans: AutoSfxPlan[] = []
      // 슬롯(장면×시작/중반)을 최대한 채워 타임라인 전체에 골고루 배치
      for (const slot of slots) {
        if (fallbackPlans.length >= maxEffects) break
        const matched = matchFallbackSfx(
          slot.text,
          fallbackRotate++,
          fallbackUsed,
          lastFallbackId
        )
        fallbackUsed.set(
          matched.catalogId,
          (fallbackUsed.get(matched.catalogId) || 0) + 1
        )
        lastFallbackId = matched.catalogId
        const isMid = slot.lineIndex >= 1
        fallbackPlans.push({
          sceneId: slot.sceneId,
          lineIndex: slot.lineIndex,
          catalogId: matched.catalogId,
          // 중반은 장면 한가운데, 시작은 살짝 뒤
          offsetSec: isMid
            ? Math.min(0.9, Math.max(0.25, slot.durationSec * 0.42))
            : Math.min(0.18, Math.max(0.04, slot.durationSec * 0.08)),
          volumePct: isMid ? 30 : 28,
          maxDurationSec: isMid ? 1.4 : 1.6,
          reason: matched.reason,
        })
      }
      // 폴백도 최종 다양화 적용
      const diversifiedFallback = diversifyAutoSfxPlans(fallbackPlans)
      const openaiApiKey =
        String(body.openaiApiKey || "").trim() ||
        process.env.OPENAI_API_KEY ||
        process.env.GPT_API_KEY ||
        ""
      if (!openaiApiKey) {
        return NextResponse.json({
          success: true,
          aiPlanned: false,
          plans: diversifiedFallback,
        })
      }
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.55,
            max_tokens: 5000,
            messages: [
              {
                role: "system",
                content: `당신은 세로형 스토리 쇼츠의 효과음 감독입니다.
대본 전체를 읽고 가능한 한 풍성하게 효과음을 배치하세요.

규칙:
- 전달된 ${slots.length}개 슬롯(sceneId·lineIndex)을 거의 전부 채우세요. 목표 ${minEffects}~${maxEffects}개 (빈 장면 금지)
- 장면마다 시작(lineIndex 0)과 중반(lineIndex 1+)에 각각 배치해 타임라인 전체에 골고루 퍼지게 하세요
- lineIndex가 1 이상인 슬롯은 장면 중반 강조용입니다. 시작음과 겹치지 않게 다른 catalogId·다른 질감으로 배치
- 쇼핑·조리·손질 대본도 손동작·전환·식감에 맞춰 짧은 효과음을 넣으세요 (감정 키워드가 없어도 배치)
- 짧은 연결 문장도 전환음·휙·톡·바운스 등 방해되지 않는 짧은 효과음을 선택
- 효과음 최소 간격은 약 0.35초면 충분합니다(앞쪽에만 몰지 말 것)
- 놀람, 반전, 실패, 질문, 클릭·조작, 손질·자르기, 등장, 깨달음, 성공 순간 우선
- 재미를 위해 만화적 휙·바운스·띠용·깨달음·전환음을 장면 분위기에 맞게 다양하게 활용
- 같은 catalogId를 연속 배치하지 않음
- 같은 catalogId는 전체에서 최대 2회까지만 (비슷한 감정이면 목록의 다른 id로 대체)
- 가능하면 서로 다른 catalogId를 골고루 사용 (상위 3개 id에 배치가 몰리지 않게)
- 내레이션을 방해하는 음성 밈, 욕설, 긴 BGM은 선택 금지
- volumePct는 24~38, offsetSec는 시작 슬롯 0~0.2초 / 중반 슬롯은 장면 길이의 35~55%
- maxDurationSec는 0.5~1.8초
- 아래 catalogId만 사용

효과음 목록:
${AUTO_SFX_CATALOG.map(
  (item) => `${item.id}: ${item.label}`
).join("\n")}

JSON만 출력:
{"plans":[{"sceneId":"...","lineIndex":0,"catalogId":"019","offsetSec":0.1,"volumePct":32,"maxDurationSec":1.4,"reason":"..."}]}`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  productName: String(body.productName || ""),
                  slots,
                }),
              },
            ],
          }),
        }
      )
      if (!response.ok) {
        return NextResponse.json({
          success: true,
          aiPlanned: false,
          plans: diversifiedFallback,
        })
      }
      const data = await response.json()
      let parsed: { plans?: Array<Record<string, unknown>> } = {}
      try {
        parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}")
      } catch {
        parsed = {}
      }
      const slotByKey = new Map<string, AutoSfxSlot>(
        slots.map((slot) => [
          `${slot.sceneId}:${slot.lineIndex}`,
          slot,
        ])
      )
      const usedKeys = new Set<string>()
      const plans: AutoSfxPlan[] = (
        Array.isArray(parsed.plans) ? parsed.plans : []
      )
        .map((plan) => {
          const sceneId = String(plan.sceneId || "")
          const lineIndex = Math.max(0, Number(plan.lineIndex) || 0)
          const key = `${sceneId}:${lineIndex}`
          const catalogId = String(plan.catalogId || "").padStart(3, "0")
          if (
            usedKeys.has(key) ||
            !slotByKey.has(key) ||
            !AUTO_SFX_CATALOG_IDS.has(catalogId)
          ) {
            return null
          }
          usedKeys.add(key)
          const slot = slotByKey.get(key)!
          return {
            sceneId,
            lineIndex,
            catalogId,
            offsetSec: Math.min(
              Math.max(0, Number(plan.offsetSec) || 0),
              Math.max(0, slot.durationSec - 0.15)
            ),
            volumePct: Math.min(
              40,
              Math.max(18, Number(plan.volumePct) || 28)
            ),
            maxDurationSec: Math.min(
              2,
              Math.max(0.4, Number(plan.maxDurationSec) || 1.4)
            ),
            reason: String(plan.reason || "대본 강조").slice(0, 100),
          }
        })
        .filter((plan): plan is AutoSfxPlan => plan !== null)
        .slice(0, maxEffects)
      // AI가 적게 골라도 폴백 슬롯을 기준으로 전체를 채운 뒤, 맞는 슬롯만 AI 선택으로 교체
      const aiByKey = new Map(
        plans.map((plan) => [`${plan.sceneId}:${plan.lineIndex}`, plan] as const)
      )
      const mergedPlans: AutoSfxPlan[] = diversifiedFallback.map((fallbackPlan) => {
        const key = `${fallbackPlan.sceneId}:${fallbackPlan.lineIndex}`
        return aiByKey.get(key) ?? fallbackPlan
      })
      for (const plan of plans) {
        if (mergedPlans.length >= maxEffects) break
        const key = `${plan.sceneId}:${plan.lineIndex}`
        if (mergedPlans.some((p) => `${p.sceneId}:${p.lineIndex}` === key)) continue
        mergedPlans.push(plan)
      }
      // 장면 순서·시작/중반 순으로 정렬해 앞쪽에만 몰리지 않게
      mergedPlans.sort((a, b) => {
        const sceneDiff =
          (Number(a.sceneId) || 0) - (Number(b.sceneId) || 0)
        if (sceneDiff !== 0) return sceneDiff
        return a.lineIndex - b.lineIndex
      })
      const finalPlans = diversifyAutoSfxPlans(
        mergedPlans.length >= minEffects
          ? mergedPlans.slice(0, maxEffects)
          : diversifiedFallback
      )
      return NextResponse.json({
        success: true,
        aiPlanned: true,
        plans: finalPlans,
      })
    }

    if (source === "rank_candidates") {
      const rawCandidates: unknown[] = Array.isArray(body.candidates)
        ? body.candidates
        : []
      const candidates: RankedVisualCandidate[] = rawCandidates
        .map((raw, index): RankedVisualCandidate => {
          const candidate = raw as Record<string, unknown>
          return {
            id: String(candidate.id ?? index),
            imageUrl: String(candidate.imageUrl || "").trim(),
            label: String(candidate.label || "").trim().slice(0, 180),
          }
        })
        .filter(
          (candidate: RankedVisualCandidate) =>
            /^https?:\/\//i.test(candidate.imageUrl)
        )
        .slice(0, 8)
      if (!candidates.length) {
        return NextResponse.json({ success: true, selectedId: null })
      }
      const openaiApiKey =
        String(body.openaiApiKey || "").trim() ||
        process.env.OPENAI_API_KEY ||
        process.env.GPT_API_KEY ||
        ""
      if (!openaiApiKey) {
        return NextResponse.json({
          success: true,
          selectedId: candidates[0]!.id,
          aiRanked: false,
        })
      }
      const content: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: `대본: ${String(body.sceneText || "").slice(0, 500)}
제품: ${String(body.productName || "").slice(0, 200)}
찾아야 할 화면: ${String(body.visualQuery || "").slice(0, 250)}

후보 이미지를 직접 보고 대본의 핵심 사물·행동·장소와 가장 정확히 맞는 것 하나를 고르세요.
반대 의미, 단순 단어 연상, 관련 없는 분위기 사진은 거부하세요.
예: 차가운 음료 장면에 불·난로·뜨거운 음식은 반드시 거부합니다.
대본이 "도움이 됐다", "좋았다", "감동했다"처럼 추상적인 평가라면 제품 또는 실제 사용 행동이 화면에 없으면 거부하세요.
단순히 웃는 사람, 춤추는 사람, 유명인, 밈, 글자 중심 이미지로 감정만 비슷하게 표현한 후보는 거부하세요.
제품·행동·상황 중 최소 두 가지가 대본과 직접 일치해야 합니다.
적합한 후보가 없거나 확신도가 75 미만이면 selectedId를 null로 반환하세요.
JSON만 출력: {"selectedId":"후보 ID 또는 null","confidence":0,"reason":"짧은 이유"}`,
        },
      ]
      for (const candidate of candidates) {
        content.push({
          type: "text",
          text: `후보 ID ${candidate.id} · ${candidate.label || "설명 없음"}`,
        })
        content.push({
          type: "image_url",
          image_url: { url: candidate.imageUrl, detail: "low" },
        })
      }
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 220,
            messages: [
              {
                role: "system",
                content:
                  "당신은 쇼츠 장면의 이미지 적합성을 엄격하게 판정하는 비주얼 에디터입니다.",
              },
              { role: "user", content },
            ],
          }),
        }
      )
      if (!response.ok) {
        return NextResponse.json({
          success: true,
          selectedId: candidates[0]!.id,
          aiRanked: false,
        })
      }
      const data = await response.json()
      let result: {
        selectedId?: string | null
        confidence?: number
        reason?: string
      } = {}
      try {
        result = JSON.parse(data.choices?.[0]?.message?.content || "{}")
      } catch {
        result = {}
      }
      const selectedId =
        Number(result.confidence || 0) >= 75 &&
        candidates.some(
          (candidate) => candidate.id === String(result.selectedId || "")
        )
          ? String(result.selectedId)
          : null
      return NextResponse.json({
        success: true,
        selectedId,
        confidence: Number(result.confidence || 0),
        reason: String(result.reason || ""),
        aiRanked: true,
      })
    }

    if (source === "auto_plan") {
      const slots = (Array.isArray(body.slots) ? body.slots : [])
        .map((slot: AutoAssetSlot) => ({
          sceneId: String(slot.sceneId || ""),
          lineIndex: Math.max(0, Number(slot.lineIndex) || 0),
          text: String(slot.text || "").trim(),
          contextText:
            String(slot.contextText || "").trim().slice(0, 500) ||
            undefined,
          visualPrompt: String(slot.visualPrompt || "").trim() || undefined,
          durationSec: Number(slot.durationSec) || undefined,
        }))
        .filter((slot: AutoAssetSlot) => slot.sceneId && slot.text)
        .slice(0, 80)
      if (!slots.length) {
        return NextResponse.json(
          { error: "자동 배치할 대본 장면이 없습니다." },
          { status: 400 }
        )
      }
      const availability: AutoAssetAvailability = {
        review: Boolean(body.availability?.review),
        product: Boolean(body.availability?.product),
        pixabay: Boolean(
          body.availability?.pixabay || process.env.PIXABAY_API_KEY
        ),
        apify: Boolean(body.availability?.apify || process.env.APIFY_TOKEN),
        klipy: Boolean(
          body.availability?.klipy ||
            process.env.KLIPY_API_KEY ||
            process.env.SHOTFORM_KLIPY_API_KEY
        ),
        replicate: Boolean(
          body.availability?.replicate || process.env.REPLICATE_API_TOKEN
        ),
      }
      const fallback = fallbackAutoAssetPlan(slots, availability)
      const openaiApiKey =
        String(body.openaiApiKey || "").trim() ||
        process.env.OPENAI_API_KEY ||
        process.env.GPT_API_KEY ||
        ""
      if (!openaiApiKey) {
        return NextResponse.json({
          success: true,
          aiPlanned: false,
          plans: finalizeAutoAssetPlans(fallback, availability),
        })
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.35,
          max_tokens: 2600,
          messages: [
            {
              role: "system",
              content: `당신은 세로형 스토리 쇼츠의 장면별 영상·이미지 감독입니다.
각 대본 줄에 가장 이해가 빠르고 시각적으로 정확한 소재 소스 하나를 고릅니다.
사용 가능 소스만 선택하세요: ${AUTO_ASSET_SOURCES.join(", ")}.

선택 원칙:
- 제품 외형·사용·후기·효과 증명: 상세페이지·상품·리뷰 원본을 참조 이미지로만 활용하는 review-ai 우선
- 일반 상황·장소·감정 B-roll: pixabay-video 우선, 없으면 pixabay-image
- 실제 해외 사용기·트렌드 장면: douyin 또는 xiaohongshu
- Apify를 사용할 수 있으면 제품 사용·시연·후기 장면의 10~15%는 douyin과 xiaohongshu를 번갈아 선택하세요.
- 짧은 감정·리액션·강조: klipy (전체 장면 남용 금지)
- 정확한 장면을 검색하기 어려움: ai-image
- 움직임이 핵심인 중요 장면: ai-video (비용이 높으므로 전체의 20% 이하)
- review-original과 product는 자동 배치에서 절대 선택하지 마세요. 원본 사진을 화면에 그대로 쓰면 안 됩니다.
- 상세페이지·상품·리뷰 사진은 반드시 review-ai로 변형한 결과만 사용하세요.
- AI와 실사 소재의 고정 비율은 없습니다. 각 대본 문맥에 가장 정확한 소스를 우선하고 전체에 실제 영상도 충분히 섞으세요.
- ai-video는 움직임 자체가 핵심이고 검색 영상으로 표현하기 어려운 경우에만 제한적으로 사용하세요.
- AI 이미지가 필요한 장면도 무조건 제품을 넣지 마세요. needsProduct=false이면 대본에 맞는 일반 인물·장소·상황 실사풍 AI 이미지를 생성해야 합니다.
- 모든 클립은 앞뒤 클립과 다른 이미지·영상 URL을 사용해야 합니다. 같은 소재를 정지/줌 효과만 바꿔 재사용하지 마세요.
- "그런데", "그래서"처럼 짧은 문장도 앞뒤 전체 문맥을 보고 반전 직전 상황, 결과 장면, 장소 B-roll 등 별개의 관련 화면을 선택하세요.
- 각 슬롯의 contextText에서 앞 문장·현재 문장·다음 문장을 함께 읽고, 현재 문장이 무엇을 가리키는지 먼저 해석한 뒤 queryKo를 작성하세요.
- 화면에 실제로 보여야 하는 구체적인 명사·행동·장소가 queryKo에 반드시 포함되어야 합니다.
- 제품 설명·사용·기능·후기 장면은 needsProduct=true로 분류하고 가능한 한 review-ai를 선택하세요.
- 캠핑·물·날씨·이동·장소·감정·배경 설명 등 일반 스토리는 needsProduct=false로 분류하고 pixabay 영상/이미지 또는 제품 없는 ai-image를 선택하세요.
- 먼저 각 대본을 needsProduct=true/false로 분류하세요.
- needsProduct=true는 제품 자체·사용법·기능·구성·후기·구매 결과를 직접 보여줘야 할 때만 사용하세요.
- 문제 제기, 감정, 일상 상황, 배경 설명, 궁금증, 전환 문장은 needsProduct=false입니다.
- needsProduct=false인 장면에는 제품·상세페이지·리뷰 사진을 절대 사용하지 마세요.
- needsProduct=true인 제품 사용 장면은 손이 제품을 조작·설치·세척·보관하는 구체적인 행동이어야 합니다.
- klipy는 최대 10%까지만 사용하고 대본에 놀람·당황·실패·웃음·충격·반전이 명시된 경우에만 선택하세요.
- 단순한 설명·평가·도움·감동 장면에는 GIF를 사용하지 마세요.
- 추상적인 분위기 사진보다 대본의 주어·행동·장소가 화면에 보이는 소재를 우선하세요.
- 같은 소스를 3번 이상 연속 사용하지 말고 영상과 이미지를 섞으세요.
- queryKo는 검색 가능한 짧은 한국어 명사구로 작성합니다.
- 입력에 없는 효능·사실·브랜드·인물을 만들지 않습니다.

JSON만 출력:
{"plans":[{"sceneId":"...","lineIndex":0,"source":"...","needsProduct":true,"queryKo":"...","reason":"..."}]}`,
            },
            {
              role: "user",
              content: JSON.stringify({
                productName: String(body.productName || ""),
                productDescription: String(body.productDescription || "").slice(0, 1500),
                availability,
                slots,
              }),
            },
          ],
        }),
      })
      if (!response.ok) {
        return NextResponse.json({
          success: true,
          aiPlanned: false,
          plans: finalizeAutoAssetPlans(fallback, availability),
        })
      }
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      let parsed: { plans?: Array<Record<string, unknown>> } = {}
      try {
        parsed =
          typeof content === "string"
            ? JSON.parse(content)
            : (content as { plans?: Array<Record<string, unknown>> })
      } catch {
        return NextResponse.json({
          success: true,
          aiPlanned: false,
          plans: finalizeAutoAssetPlans(fallback, availability),
        })
      }
      const rawPlans = Array.isArray(parsed?.plans) ? parsed.plans : []
      const byKey = new Map<string, Record<string, unknown>>(
        rawPlans.map((plan: Record<string, unknown>) => [
          `${String(plan.sceneId)}:${Math.max(0, Number(plan.lineIndex) || 0)}`,
          plan,
        ])
      )
      const plans: AutoAssetPlan[] = fallback.map((fallbackPlan) => {
        const candidate = byKey.get(
          `${fallbackPlan.sceneId}:${fallbackPlan.lineIndex}`
        )
        const needsProduct = candidate
          ? candidate.needsProduct === true ||
            String(candidate.needsProduct).toLowerCase() === "true"
          : fallbackPlan.needsProduct
        const requestedSourceRaw = String(candidate?.source || "")
        const requestedSource =
          needsProduct &&
          (requestedSourceRaw === "review-original" ||
            requestedSourceRaw === "product")
            ? availability.replicate ? "review-ai" : fallbackPlan.source
            : !needsProduct &&
                (requestedSourceRaw === "review-ai" ||
                  requestedSourceRaw === "review-original" ||
                  requestedSourceRaw === "product")
              ? availability.pixabay ? "pixabay-video" : "ai-image"
              : requestedSourceRaw
        const allowed = AUTO_ASSET_SOURCES.includes(
          requestedSource as AutoAssetSource
        )
        return {
          ...fallbackPlan,
          ...(candidate
            ? {
                source: allowed
                  ? (requestedSource as AutoAssetSource)
                  : fallbackPlan.source,
                needsProduct,
                queryKo:
                  String(candidate.queryKo || "").trim().slice(0, 80) ||
                  fallbackPlan.queryKo,
                reason:
                  String(candidate.reason || "").trim().slice(0, 160) ||
                  fallbackPlan.reason,
              }
            : {}),
        }
      })

      const gifLimit =
        availability.klipy && plans.length >= 5
          ? Math.max(1, Math.floor(plans.length * 0.1))
          : 0
      const reactionPattern =
        /깜짝|놀랐|당황|실수|실패|짜증|충격|반전|헉|대박|황당|웃겼|화났/
      for (let index = 0; index < plans.length; index += 1) {
        if (
          plans[index]!.source === "klipy" &&
          !reactionPattern.test(slots[index]?.text || "")
        ) {
          plans[index] = {
            ...fallback[index]!,
            source: availability.replicate
              ? "ai-image"
              : fallback[index]!.source,
            reason: "일반 설명 장면에는 GIF 대신 대본과 일치하는 장면 사용",
          }
        }
      }
      const gifIndexes: number[] = []
      for (let index = 0; index < slots.length; index += 1) {
        if (
          reactionPattern.test(slots[index]?.text || "") &&
          gifIndexes.every((picked) => Math.abs(picked - index) >= 2)
        ) {
          gifIndexes.push(index)
          if (gifIndexes.length >= gifLimit) break
        }
      }
      for (const index of gifIndexes) {
        plans[index]!.source = "klipy"
        plans[index]!.reason = "감정과 반전을 짧은 GIF로 강조"
      }

      if (availability.apify) {
        const foreignTarget = Math.max(
          1,
          Math.round(plans.length * 0.15)
        )
        const foreignUsePattern =
          /사용|써보|시연|작동|누르|잡|설치|세척|닦|보관|따르|넣|빼|열|닫|조립|후기|리뷰|제품/
        const foreignCandidates = plans
          .map((plan, index) => ({ plan, index }))
          .filter(
            ({ plan, index }) =>
              plan.source !== "klipy" &&
              plan.source !== "review-ai" &&
              plan.needsProduct &&
              foreignUsePattern.test(slots[index]?.text || "")
          )
        for (
          let order = 0;
          order < Math.min(foreignTarget, foreignCandidates.length);
          order += 1
        ) {
          const { plan } = foreignCandidates[order]!
          plan.source = order % 2 === 0 ? "douyin" : "xiaohongshu"
          plan.reason =
            order % 2 === 0
              ? "도우인에서 제품 실제 사용 영상을 검색"
              : "샤오홍슈에서 제품 실제 사용 후기를 검색"
        }
      }

      return NextResponse.json({
        success: true,
        aiPlanned: true,
        plans: finalizeAutoAssetPlans(plans, availability),
      })
    }

    if (source === "google_lens") {
      const apiKey =
        String(body.serpApiKey || "").trim() || process.env.SERPAPI_KEY || ""
      if (!apiKey) {
        return NextResponse.json(
          { error: "Google 렌즈 검색을 위한 SERPAPI_KEY가 필요합니다." },
          { status: 503 }
        )
      }
      const lensImage = imageUrl || query
      if (!lensImage.startsWith("http://") && !lensImage.startsWith("https://")) {
        return NextResponse.json(
          { error: "쿠팡 제품 메인 사진 URL(https)이 필요합니다." },
          { status: 400 }
        )
      }
      const rows = await serpGoogleLensVisualMatches(apiKey, lensImage, 24)
      return NextResponse.json({
        success: true,
        imageUrl: lensImage,
        items: rows.map((row, index) => ({
          id: `lens-${index}-${row.imageUrl.slice(-24)}`,
          title: row.title,
          thumbnailUrl: row.thumbnailUrl,
          mediaUrl: row.imageUrl,
          pageUrl: row.pageUrl,
          mediaType: "image",
          source: "google",
          attribution: row.source || "Google Lens",
        })),
      })
    }

    if (!query) {
      return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 })
    }

    if (source === "google" || source === "google_videos") {
      const apiKey =
        String(body.serpApiKey || "").trim() || process.env.SERPAPI_KEY || ""
      if (!apiKey) {
        return NextResponse.json(
          { error: "Google 검색을 위한 SERPAPI_KEY가 필요합니다." },
          { status: 503 }
        )
      }

      if (source === "google_videos") {
        const rows = await serpGoogleVideosSearch(apiKey, query, 18, { gl: "kr", hl: "ko" })
        return NextResponse.json({
          success: true,
          items: rows.map((row, index) => ({
            id: `gvid-${index}-${row.url}`,
            title: row.title || query,
            thumbnailUrl: row.thumbnail || "",
            mediaUrl: row.videoUrl || "",
            pageUrl: row.url,
            mediaType: "video",
            source: "google",
            attribution: row.author || "Google 동영상",
            durationSec: row.durationSec ?? undefined,
          })),
        })
      }

      const rows = await serpGoogleImagesAsKeyframes(apiKey, query, 18)
      return NextResponse.json({
        success: true,
        items: rows.map((row) => ({
          id: `google-${row.index}`,
          title: row.label || query,
          thumbnailUrl: row.imageUrl,
          mediaUrl: row.imageUrl,
          pageUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
          mediaType: "image",
          source: "google",
          attribution: "Google 이미지 검색 결과",
        })),
      })
    }

    if (source === "xiaohongshu" || source === "douyin") {
      const token =
        String(body.apifyApiKey || "").trim() || process.env.APIFY_TOKEN || ""
      if (!token) {
        return NextResponse.json(
          { error: "해외 영상 검색을 위한 Apify 토큰이 필요합니다." },
          { status: 503 }
        )
      }
      const keywords = Array.isArray(body.keywords)
        ? body.keywords.map(String).map((item: string) => item.trim()).filter(Boolean)
        : [query]
      const result =
        source === "xiaohongshu"
          ? await searchXiaohongshuOnApify(token, keywords, { maxKeywords: 3 })
          : await searchDouyinOnApify(token, keywords, {
              maxKeywords: 3,
              count: 18,
            })
      return NextResponse.json({
        success: true,
        actor: result.actor,
        keywordsUsed: result.keywordsUsed,
        items: result.rows.slice(0, 24).map((row, index) => ({
          id: `${source}-${index}-${row.url}`,
          title: row.title || `${source} 영상`,
          thumbnailUrl: row.thumbnail,
          mediaUrl: row.videoUrl,
          pageUrl: row.url,
          mediaType: "video",
          source,
          attribution: row.author,
          durationSec: row.durationSec,
          viewCount: row.viewCount,
        })),
      })
    }

    return NextResponse.json({ error: "지원하지 않는 소재 검색 방식입니다." }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소재 검색에 실패했습니다." },
      { status: 500 }
    )
  }
}
