/** 우주·추상 과학 주제 판별 — WingsStudio shared 이식 최소본 */
export function isCosmicOrScienceAbstractTopic(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return /우주|은하|블랙홀|행성|별자리|천체|nebula|galaxy|black\s*hole|cosmos|astronomy|quantum|우주론/i.test(
    t,
  )
}
