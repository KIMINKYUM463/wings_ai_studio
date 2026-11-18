import { z } from "zod"

export const storyEvidenceSourceSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["product", "detail", "review", "review-summary", "reference"]),
  identity: z.string().min(1).max(200),
  text: z.string().min(1).max(6000),
})

export const storyClaimSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  category: z.enum(["factual", "numeric", "efficacy", "opinion"]),
  sourceIds: z.array(z.string().min(1)).max(20),
  verified: z.boolean(),
})

export const storySentenceGroundingSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  sourceIds: z.array(z.string().min(1)).max(20),
  claimIds: z.array(z.string().min(1)).max(20).default([]),
})

export const generatedStorySceneSchema = z
  .object({
    narration: z.string().trim().min(1).max(2000),
    caption: z.string().trim().max(300).default(""),
    visualPrompt: z.string().trim().max(2000).default(""),
    durationSec: z.coerce.number().finite().positive().max(60),
    sourceIds: z.array(z.string().min(1)).max(20).default([]),
    claimIds: z.array(z.string().min(1)).max(20).default([]),
    sentences: z.array(storySentenceGroundingSchema).max(20).optional(),
  })
  .passthrough()

export const generatedStoryModelSchema = z
  .object({
    typeReason: z.string().trim().max(1000).default(""),
    hook: z.string().trim().max(1000).default(""),
    title: z.string().trim().min(1).max(200),
    script: z.string().trim().max(20_000).default(""),
    claims: z.array(storyClaimSchema).max(100).default([]),
    scenes: z.array(generatedStorySceneSchema).min(1).max(30),
  })
  .passthrough()

/** 브라우저와 서버에서 같은 결과가 필요한 비보안 식별자용 안정 해시입니다. */
export function stableStoryIdentity(value: unknown): string {
  const input = stableStringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

const NUMERIC_CLAIM_PATTERN =
  /(?:\d+(?:[.,]\d+)?\s*(?:%|퍼센트|개|명|회|배|초|분|시간|일|주|개월|년|원|만원|kg|g|ml|cm|mm|위|세대))/
const EFFICACY_CLAIM_PATTERN =
  /(치료|예방|완치|개선|감소|증가|효과|효능|통증|염증|혈압|혈당|다이어트|살\s*빠|항균|살균|제거|차단|회복)/i

export function classifyGroundedClaim(text: string): "numeric" | "efficacy" | null {
  if (NUMERIC_CLAIM_PATTERN.test(text)) return "numeric"
  if (EFFICACY_CLAIM_PATTERN.test(text)) return "efficacy"
  return null
}

export function splitGroundedSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function assertGroundedStory(input: {
  claims: z.infer<typeof storyClaimSchema>[]
  scenes: Array<{
    narration: string
    sourceIds: string[]
    claimIds: string[]
    sentences?: z.infer<typeof storySentenceGroundingSchema>[]
  }>
  validSourceIds: Set<string>
}) {
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim]))
  for (const claim of input.claims) {
    if (claim.sourceIds.some((id) => !input.validSourceIds.has(id))) {
      throw new Error(`claim ${claim.id}가 존재하지 않는 source ID를 참조합니다.`)
    }
    if (
      (claim.category === "numeric" || claim.category === "efficacy") &&
      (!claim.verified || claim.sourceIds.length === 0)
    ) {
      throw new Error(`수치·효능 claim ${claim.id}에 검증 근거가 없습니다.`)
    }
  }

  input.scenes.forEach((scene, sceneIndex) => {
    if (scene.sourceIds.some((id) => !input.validSourceIds.has(id))) {
      throw new Error(`장면 ${sceneIndex + 1}이 존재하지 않는 source ID를 참조합니다.`)
    }
    const sentences = scene.sentences?.length
      ? scene.sentences
      : splitGroundedSentences(scene.narration).map((text, index) => ({
          id: `scene_${sceneIndex + 1}_sentence_${index + 1}`,
          text,
          sourceIds: scene.sourceIds,
          claimIds: scene.claimIds,
        }))
    for (const sentence of sentences) {
      if (sentence.sourceIds.some((id) => !input.validSourceIds.has(id))) {
        throw new Error(`장면 ${sceneIndex + 1} 문장이 잘못된 source ID를 참조합니다.`)
      }
      const category = classifyGroundedClaim(sentence.text)
      if (!category) continue
      const supportingClaims = sentence.claimIds
        .map((id) => claimById.get(id))
        .filter((claim): claim is z.infer<typeof storyClaimSchema> => Boolean(claim))
      const supported = supportingClaims.some(
        (claim) =>
          claim.verified &&
          claim.sourceIds.length > 0 &&
          claim.category === category
      )
      if (!supported || sentence.sourceIds.length === 0) {
        throw new Error(
          `장면 ${sceneIndex + 1}의 수치·효능 문장에 검증된 claim/source ID가 없습니다: ${sentence.text}`
        )
      }
    }
  })
}
