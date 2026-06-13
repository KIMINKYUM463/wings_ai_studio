import type { CutScriptContext } from "@/lib/shotform-visual-scene-match"
import { narrationBlockSimilarity } from "@/lib/shotform-narration-similarity"

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
  }
): CutNarrationSceneMeta[] {
  const keywords = productHints?.keywords ?? []
  const summary = productHints?.summary ?? productHints?.category ?? ""

  const groups: Array<{
    id: number
    repVisualKey: string
    repSourceKey: string
    cutIndices: number[]
  }> = []

  const metas: CutNarrationSceneMeta[] = []

  for (let i = 0; i < cuts.length; i++) {
    const ctx = cuts[i]!
    const visualKey = normalizeVisualSceneKey(ctx.visual_card)
    const sourceKey = cutSourceRangeKey(ctx)
    const visualDesc = visualDescFromCard(ctx.visual_card)

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

function shortenBenefit(benefit: string, max = 18): string {
  const t = benefit.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1) + "…"
}

/** 반복 장면 2회차 이후 — 앞 컷과 이어지는 나레이션 */
export function narrationForRepeatedScene(args: {
  occurrence: number
  groupSize: number
  productBenefitHint: string
  priorInGroup: string
  visualHint: string
  cutIndex: number
}): string {
  const { occurrence, productBenefitHint, priorInGroup, visualHint, cutIndex } = args
  const benefit = shortenBenefit(productBenefitHint)
  const desc = visualDescFromCard(visualHint)

  const templates: string[] = []
  if (occurrence === 2) {
    templates.push(
      `방금 그 ${benefit}, 여기서도 똑같이 보여요`,
      `앞 장면 이어서 보면 ${benefit}이 확실해요`,
      `${benefit} 포인트, 이 화면에서도 그대로예요`,
      `같은 제품인데 ${desc.includes("부속") ? "부속 구성" : "이 각도"}에서도 ${benefit}`,
      `아까 말한 ${benefit}, 반복 봐도 체감돼요`
    )
  } else if (occurrence >= 3) {
    templates.push(
      `몇 번 봐도 ${benefit}, 꾸준히 느껴져요`,
      `또 나와도 ${benefit}은 동일해요`,
      `반복 장면이지만 ${benefit} 포인트는 확실해요`,
      `이어서 보면 ${benefit}이 더 와닿아요`,
      `${benefit}, 여러 번 확인해도 만족스러워요`
    )
  }

  const priorTail = priorInGroup.replace(/\n/g, " ").split(/[,，]/).pop()?.trim() ?? ""
  const idx = (cutIndex + occurrence * 3) % Math.max(templates.length, 1)
  let line = templates[idx] ?? templates[0] ?? `${benefit}, 여기서도 체감돼요`

  if (priorTail && line.includes(priorTail.slice(0, 8))) {
    line = templates[(idx + 2) % templates.length] ?? line
  }
  return line
}
