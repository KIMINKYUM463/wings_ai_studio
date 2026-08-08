/**
 * 쇼핑 숏폼 AI 이미지 — 인물(한국인 기본) + 장면 간 동일 인물 유지
 * 제품 image_input 락과 같은 역할의 텍스트/레퍼런스 규칙
 */

/** 프롬프트에 인물(얼굴·전신 등)이 나올 가능성이 있는지 */
export function promptLikelyShowsPerson(prompt: string): boolean {
  const t = String(prompt || "").toLowerCase()
  if (!t.trim()) return false
  // 명시적 제품-only / 얼굴 금지면 인물 씬으로 보지 않음
  if (
    /\b(product only|no (?:human )?face|no head|no people|hands only|손만|얼굴\s*없|인물\s*없)\b/i.test(
      t
    ) &&
    !/\b(woman|man|person|model|influencer|face|portrait|korean|여성|남성|인물|얼굴|모델)\b/i.test(
      t
    )
  ) {
    return false
  }
  return /\b(woman|man|person|people|model|influencer|creator|face|portrait|bust|medium shot of (?:a |the )?(?:woman|man|person)|korean|east asian|여성|남성|인물|사람|얼굴|모델|쇼호스트|리뷰어)\b/i.test(
    t
  )
}

/** IMAGE 기획용 — 한국인 기본 + 전 장면 동일 인물 */
export function personConsistencyPlanningBlock(): string {
  return `인물 규칙 (제품 형태 유지과 동급):
- 인물이 나오는 장면은 기본으로 **한국인**(East Asian / Korean facial features, 자연스러운 한국 숏폼 UGC 룩). 다른 국적을 명시하지 않는 한 서양인·남미인 등으로 바꾸지 말 것.
- **같은 사람**이 전 장면에 나와야 함: 얼굴·연령대·성별 인상·헤어·피부톤·체형을 첫 인물 장면에 맞춰 고정. 매 컷마다 다른 모델로 바꾸지 말 것.
- 의상·배경·앵글은 장면마다 달라도 됨. 인물 identity만 고정.
- 인물 설명 시 첫 장면에 구체적 앵커를 쓰고(예: 20대 후반 한국 여성, 단발 흑발, 자연광 메이크업), 이후 장면은 "동일 인물(앞 장면과 같은 얼굴·헤어)"로 이어갈 것.`
}

/** nano-banana 생성 시 프롬프트 끝에 붙이는 락 */
export function personIdentityLockPrompt(opts?: {
  hasCharacterReference?: boolean
}): string {
  const ref = opts?.hasCharacterReference
    ? `
CHARACTER REFERENCE LOCK (attached person photo — same priority as product ref):
- Match that person's face, age, gender presentation, hairstyle, skin tone, and body proportions EXACTLY.
- Do NOT swap to a different model or ethnicity.`
    : `
- If no character photo is attached: invent ONE consistent Korean person for this series and keep them identical whenever a person appears.`

  return `
CRITICAL PERSON IDENTITY (when a person is visible — same priority as product identity):
- Default ethnicity/look: Korean person, East Asian facial features, natural Korean shopping-UGC appearance (unless the scene prompt explicitly requests another ethnicity).
- Keep the SAME individual across scenes: same face, age range, gender presentation, hair, skin tone, body type.
- Background, angle, and outfit staging MAY change — person identity MUST NOT.
- Do not randomize a new face every shot.${ref}`
}

/** image_input: 제품 최대 2 + 인물 1 (총 3) */
export function mergeProductAndCharacterRefs(
  productRefs: string[],
  characterRefs: string[]
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const products = productRefs.slice(0, characterRefs.length > 0 ? 2 : 3)
  const characters = characterRefs.slice(0, 1)
  for (const url of [...products, ...characters]) {
    const u = String(url || "").trim()
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (out.length >= 3) break
  }
  return out
}
