/** Canva Magic Write 스타일 — 썸네일 한 줄 훅 후보 */
export type ThumbnailHookSuggestionsRequest = {
  topic?: string
  scriptExcerpt?: string
  videoTitle?: string
  outputLanguage?: string
  /** 슬롯별 maxCharacters — 후보 길이 상한 */
  maxCharacters?: number
  count?: number
}

export type ThumbnailHookSuggestionsResponse = {
  hooks: string[]
}

export function buildThumbnailHookSuggestionsPrompt(req: ThumbnailHookSuggestionsRequest): string {
  const lang = (req.outputLanguage ?? 'ko').trim() || 'ko'
  const count = Math.min(8, Math.max(3, req.count ?? 5))
  const maxChars = Math.max(8, Math.min(40, req.maxCharacters ?? 24))

  return [
    `유튜브 썸네일 CTR용 **후킹 한 줄** ${count}개를 제안해라. JSON만 출력.`,
    `언어: ${lang}`,
    '',
    req.topic?.trim() ? `주제: ${req.topic.trim()}` : '',
    req.videoTitle?.trim() ? `영상 제목: ${req.videoTitle.trim()}` : '',
    req.scriptExcerpt?.trim()
      ? `대본 발췌:\n${req.scriptExcerpt.trim().slice(0, 1500)}`
      : '',
    '',
    `각 후보 ${maxChars}자 이내, 서로 다른 각도:`,
    '- 숫자·금액·기간 / 반전·미완결 / 충격 대사·고유명사 / 감정(FOMO·불안·놀람) / 대조·결과',
    '피드에서 손가락이 멈출 정도로 자극적 — 단, 대본에 없는 사실·수치 지어내기 금지.',
    '금지 클리셰: "이게 ~였습니다", "사람들이 모르는", "생각보다 심각", 뉴스·교과서체.',
    '',
    `JSON: { "hooks": ["...", "..."] }`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseThumbnailHookSuggestionsJson(
  raw: string,
  maxChars: number,
): ThumbnailHookSuggestionsResponse | null {
  const t = raw.trim()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(t) as Record<string, unknown>
  } catch {
    const brace = t.match(/\{[\s\S]*\}/)
    if (brace) {
      try {
        parsed = JSON.parse(brace[0]) as Record<string, unknown>
      } catch {
        return null
      }
    }
  }
  if (!parsed) return null

  const arr = parsed.hooks
  if (!Array.isArray(arr)) return null

  const clamp = (s: string) => {
    const x = s.trim()
    if (!maxChars || maxChars < 1) return x
    return x.length <= maxChars ? x : x.slice(0, maxChars).trim()
  }

  const hooks = arr
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => clamp(x))
    .filter((x, i, a) => a.indexOf(x) === i)
    .slice(0, 8)

  if (!hooks.length) return null
  return { hooks }
}
