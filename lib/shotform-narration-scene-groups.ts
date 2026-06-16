import type { CutScriptContext } from "@/lib/shotform-visual-scene-match"
import { analysisByVideoId } from "@/lib/shotform-visual-scene-match"
import type { VideoAnalysis } from "@/lib/shotform-auto-edit-types"
import {
  buildCutSourceReference,
  mergeCutVisualWithSourceReference,
} from "@/lib/shotform-source-video-narration"
import { narrationBlockSimilarity } from "@/lib/shotform-narration-similarity"
import {
  combineVisualAndProductNarration,
  extractVisualNarrationCue,
  isOrganizerOrStorageProduct,
  isRepeatMetaNarration,
  isToothbrushHolderProduct,
} from "@/lib/shotform-shopping-visual-cues"
import { isCarMountOrHolderProduct } from "@/lib/shotform-user-keyword-product"

function visualDescFromCard(visualCard: string): string {
  return visualCard
    .replace(/^소스\s+[\d.:–\s]+초\s*/i, "")
    .replace(/^\(\d+(?:\.\d+)?초\)\s*/i, "")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/^\[인물[^\]]*\]\s*/i, "")
    .trim()
}

export type CutNarrationSceneMeta = {
  /** 0-based 컷 인덱스 */
  cutIndex: number
  visualKey: string
  sourceKey: string
  groupId: number
  /** 그룹 내 몇 번째 등장 (1부터) */
  occurrence: number
  groupSize: number
  /** 같은 화면이 2회 이상 */
  isRepeat: boolean
  /** 이 컷 대본에 녹일 제품 장점 힌트 */
  productBenefitHint: string
  /** 프롬프트·폴백용 풍부한 화면 설명 */
  enrichedVisual: string
}

const VISUAL_SIMILARITY_GROUP_THRESHOLD = 0.68

export function normalizeVisualSceneKey(visualCard: string): string {
  return visualDescFromCard(visualCard)
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase()
}

export function cutSourceRangeKey(ctx: Pick<CutScriptContext, "video_id" | "source_start" | "source_end">): string {
  return `${ctx.video_id}:${ctx.source_start.toFixed(1)}-${ctx.source_end.toFixed(1)}`
}

/** 화면 키워드 → 제품 장점 각도 (나레이션에 녹일 포인트) */
export function inferProductBenefitForVisual(
  visualDesc: string,
  keywords: readonly string[] = [],
  summary?: string
): string {
  const d = visualDesc
  const kwBlob = keywords.join(" ")
  const blob = `${d} ${kwBlob} ${summary || ""}`

  if (isToothbrushHolderProduct(blob)) {
    if (/벽에\s*걸|벽걸이|걸린/i.test(d)) return "벽걸이로 젖은 칫솔·바닥 물기 분리"
    if (/퍼즐|puzzle/i.test(d)) return "퍼즐 디자인·세면대 위 칫솔·치약 수납"
    if (/거치대|꽂/i.test(d)) return "칫솔·치약 한곳에 꽂아 정리"
    return "욕실 칫솔 수납·세면대 정돈"
  }
  if (isOrganizerOrStorageProduct(blob)) {
    if (/컵|필기구|펜|연필/i.test(d)) return "소품·필기구 한 컵에 모아 정리"
    if (/벽|걸/i.test(d)) return "벽 활용 수납·공간 절약"
    if (/욕실|세면대|싱크/i.test(d)) return "욕실·세면대 위 깔끔한 정리"
    if (/책상|데스크/i.test(d)) return "책상 위 어지러운 소품 정돈"
    return "한곳에 모아 찾기 쉬운 수납"
  }
  if (/부속|액세서리|노즐|브러시|툴|케이스|보관/i.test(d)) {
    return "다양한 부속으로 차량 곳곳 청소"
  }
  if (/손잡이|핸들|그립/i.test(d)) {
    return "그립감 좋은 핸들·한 손 조작"
  }
  if (/박스|포장|케이스|수납/i.test(d)) {
    return "보관·휴대가 편한 구성"
  }
  if (/바닥|매트|발밑/i.test(d)) {
    return "바닥·매트 먼지 강력 흡입"
  }
  if (/시트|등받이|쿠션/i.test(d)) {
    return "시트 틈새 먼지까지 흡입"
  }
  if (/틈새|구석|콘솔|대시보드|문틈/i.test(d)) {
    return "좁은 틈새 전용 노즐"
  }
  if (/사용\s*중|청소|흡입|먼지/i.test(d)) {
    return "실사용 흡입력·즉각 청소 체감"
  }
  if (/핸디|휴대|소형|컴팩트/i.test(d)) {
    return "핸디 사이즈·차량 휴대성"
  }
  const kw = keywords.map((k) => k.trim()).filter(Boolean)
  if (kw.length) return kw[0]!
  const sum = summary?.trim()
  if (sum && sum.length <= 40) return sum
  if (sum) return sum.slice(0, 36) + (sum.length > 36 ? "…" : "")
  return "제품 핵심 장점"
}

function visualKeysSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true
  return narrationBlockSimilarity(a, b) >= VISUAL_SIMILARITY_GROUP_THRESHOLD
}

/** 컷별 반복 장면 그룹·제품 장점 힌트 */
export function buildCutNarrationSceneMetas(
  cuts: readonly CutScriptContext[],
  productHints?: {
    keywords?: readonly string[]
    summary?: string
    category?: string
  },
  analyses?: readonly VideoAnalysis[]
): CutNarrationSceneMeta[] {
  const keywords = productHints?.keywords ?? []
  const summary = productHints?.summary ?? productHints?.category ?? ""
  const byVideoId = analyses?.length ? analysisByVideoId([...analyses]) : null

  const groups: Array<{
    id: number
    repVisualKey: string
    repSourceKey: string
    cutIndices: number[]
  }> = []

  const metas: CutNarrationSceneMeta[] = []

  for (let i = 0; i < cuts.length; i++) {
    const ctx = cuts[i]!
    const analysis = byVideoId?.get(ctx.video_id)
    const sourceRef = analysis
      ? buildCutSourceReference(analysis, ctx.source_start, ctx.source_end)
      : ""
    const mergedCard = mergeCutVisualWithSourceReference(ctx.visual_card, sourceRef)
    const visualKey = normalizeVisualSceneKey(mergedCard)
    const sourceKey = cutSourceRangeKey(ctx)
    const visualDesc = visualDescFromCard(mergedCard)

    let group = groups.find(
      (g) => g.repSourceKey === sourceKey || visualKeysSimilar(g.repVisualKey, visualKey)
    )
    if (!group) {
      group = {
        id: groups.length + 1,
        repVisualKey: visualKey,
        repSourceKey: sourceKey,
        cutIndices: [],
      }
      groups.push(group)
    }
    group.cutIndices.push(i)

    const occurrence = group.cutIndices.length
    const benefit = inferProductBenefitForVisual(visualDesc, keywords, summary)
    const enrichedVisual = [
      visualDesc,
      sourceRef && !visualDesc.includes(sourceRef.slice(0, 20)) ? sourceRef : "",
      `제품 장점 각도: ${benefit}`,
      occurrence > 1 ? `반복 장면 ${occurrence}/${group.cutIndices.length} — 앞 등장과 이어지되 문장은 새로` : "",
    ]
      .filter(Boolean)
      .join(" | ")

    metas.push({
      cutIndex: i,
      visualKey,
      sourceKey,
      groupId: group.id,
      occurrence,
      groupSize: 0,
      isRepeat: false,
      productBenefitHint: benefit,
      enrichedVisual,
    })
  }

  for (const g of groups) {
    const size = g.cutIndices.length
    for (const idx of g.cutIndices) {
      const m = metas[idx]!
      m.groupSize = size
      m.isRepeat = size > 1
    }
  }

  return metas
}

/** AI 프롬프트 — 반복 장면 그룹별 이어쓰기 규칙 */
export function buildRepeatedSceneGroupsPrompt(
  cuts: readonly CutScriptContext[],
  metas: readonly CutNarrationSceneMeta[]
): string {
  const repeatGroups = new Map<number, { cuts: number[]; visual: string; benefit: string }>()
  for (const m of metas) {
    if (!m.isRepeat) continue
    const row = repeatGroups.get(m.groupId) ?? {
      cuts: [],
      visual: visualDescFromCard(cuts[m.cutIndex]!.visual_card).slice(0, 48),
      benefit: m.productBenefitHint,
    }
    row.cuts.push(m.cutIndex + 1)
    repeatGroups.set(m.groupId, row)
  }
  if (!repeatGroups.size) return ""

  const lines = [
    "",
    "**반복 장면 (같은·유사 화면이 여러 컷)** — 아래 그룹은 **한 이야기를 이어가되**, 컷마다 **다른 문장**으로 작성:",
  ]
  let n = 0
  for (const [, g] of repeatGroups) {
    n++
    const cutList = g.cuts.join("→")
    lines.push(
      `- 그룹 ${n} · 컷 ${cutList} · 화면: 「${g.visual}」 · 장점: ${g.benefit}`,
      `  ①첫 등장: 장점 소개 · ②이후: 앞 컷 나레이션을 **내용으로 이어** 깊이 추가 (같은 문장·꼬리복사 금지) · ③마지막: 체감·정리`
    )
  }
  return lines.join("\n")
}

/** 반복 장면 — 화면 단서 + 제품명 결합 (메타 반복 문구 금지) */
export function narrationForRepeatedScene(args: {
  occurrence: number
  groupSize: number
  productBenefitHint: string
  priorInGroup: string
  visualHint: string
  cutIndex: number
  productName?: string
}): string {
  const { occurrence, productBenefitHint, priorInGroup, visualHint, cutIndex, productName } = args
  const desc = visualDescFromCard(visualHint)
  const product =
    productName?.trim() ||
    (productBenefitHint.length <= 24 && !/제품|핵심|장점/.test(productBenefitHint)
      ? productBenefitHint
      : "이 제품")
  const cue = extractVisualNarrationCue(desc)

  const candidates: string[] = []
  for (let attempt = 0; attempt < 8; attempt++) {
    const line = combineVisualAndProductNarration({
      visualDesc: desc,
      productName: product,
      cutIndex: cutIndex + attempt * 3,
      occurrence,
      role: occurrence >= 3 ? "repeat" : "demo",
    })
    if (line && !isRepeatMetaNarration(line)) candidates.push(line)
  }

  if (cue.kind === "wall_mount") {
    candidates.push(
      `${product} 벽걸이로 세면대 주변이 훨씬 넓어 보여요`,
      `벽에 걸어두니 젖은 칫솔 바닥에 안 둬도 돼요`
    )
  }
  if (cue.kind === "puzzle_holder") {
    candidates.push(
      `퍼즐 모양 ${product}, 다른 각도에서도 수납이 안정적이에요`,
      `${product} 디자인 포인트가 이 컷에서도 또 보여요`
    )
  }
  if (cue.kind === "car_mount" || isCarMountOrHolderProduct(`${product} ${desc}`)) {
    candidates.push(
      `다른 각도에서 봐도 ${product} 고정력은 똑같이 안정적이에요`,
      `각도만 달라도 ${product} 화면 보기가 편해요`,
      `같은 장착인데 시야각만 살짝 달라 보여요`,
      `운전석에서 ${product} 각도 조절이 수월해요`
    )
  }
  if (cue.kind === "cup_organizer" && isToothbrushHolderProduct(product)) {
    candidates.push(
      `욕실 소품 정리도 ${product}처럼 한곳에 모으면 끝이에요`,
      `세면대 어지러우면 ${product}로 이렇게 정돈해보세요`
    )
  }

  const priorNorm = priorInGroup.replace(/\n/g, " ").trim()
  const idx = (cutIndex + occurrence * 7) % Math.max(candidates.length, 1)
  for (let i = 0; i < candidates.length; i++) {
    const line = candidates[(idx + i) % candidates.length]!
    if (!line) continue
    if (priorNorm && narrationBlockSimilarity(line, priorNorm) >= 0.52) continue
    if (isRepeatMetaNarration(line)) continue
    return line
  }

  return combineVisualAndProductNarration({
    visualDesc: desc,
    productName: product,
    cutIndex: cutIndex + occurrence,
    occurrence,
    role: "repeat",
  })
}
