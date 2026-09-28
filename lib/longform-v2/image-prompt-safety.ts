/** Flux 등 안전 필터(NSFW) 회피 — 폭력·시체 묘사를 상징·비유 장면으로 완화 */

const NSFW_PHRASE_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\btragic fallen forms?\b/gi, "scattered abandoned gear"],
  [/\bfallen (comrades|soldiers|forms?|bodies)\b/gi, "empty armor and discarded shields"],
  [/\b(dead|death|died|dying|corpse|corpses|cadaver)\b/gi, "aftermath"],
  [/\b(bodies|body piles?|mass graves?)\b/gi, "abandoned equipment"],
  [/\b(blood|bloody|gore|gory|massacre|slaughter|decapitat\w*|dismember\w*)\b/gi, "dust"],
  [/\b(agony|torture|mutilat\w*|execution)\b/gi, "solemn tension"],
  [/\bgrief-stricken\b/gi, "solemn"],
  [/\btears shining on (his|her|their) shadowed face\b/gi, "a heavy, reflective expression"],
  [/\btears\b/gi, "emotion"],
  [/\bkneeling in total despair\b/gi, "kneeling in quiet reflection"],
  [/\bprofound guilt, regret, and agony\b/gi, "quiet regret and resolve"],
]

const SAFE_SUFFIX =
  "safe for work, no gore, no blood, no corpses, no dead bodies, no explicit violence, " +
  "symbolic empty battlefield with abandoned weapons only, cinematic still, tasteful drama"

export function isNsfwImageError(err: unknown): boolean {
  const s = err instanceof Error ? err.message : String(err ?? "")
  return /nsfw|safety|content.?detect|user input error|sensitive|inappropriate/i.test(s)
}

/** NSFW 재시도용 — 자극 표현 제거 후 안전한 장면으로 재작성 */
export function softenImagePromptForSafety(prompt: string): string {
  let p = String(prompt || "").trim()
  if (!p) return SAFE_SUFFIX

  for (const [re, rep] of NSFW_PHRASE_REPLACEMENTS) {
    p = p.replace(re, rep)
  }

  // 잔여 위험 구문 대략 제거
  p = p
    .replace(/\b(violent|brutality|killing|killed|murder)\b/gi, "conflict aftermath")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim()

  if (!/safe for work/i.test(p)) {
    p = `${p}. ${SAFE_SUFFIX}`
  }
  return p
}
