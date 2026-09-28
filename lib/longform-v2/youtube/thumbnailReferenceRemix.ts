/** 참고 썸네일 업로드 → 글자 제거 배경 리믹스 + 하단 2줄 문구 */

export type ThumbnailReferenceRemixAnalysis = {
  extractedLines: string[]
  bottomMainLines: string[]
  visualStyle: string
  subjects: string
  hasPeople: boolean
}

export type ThumbnailReferenceRemixResult = {
  imageUrl: string
  line1: string
  line2: string
  extractedLines: string[]
  styleNote: string
}

export const THUMBNAIL_REFERENCE_REMIX_VISION_PROMPT = `You analyze a YouTube thumbnail reference image (16:9).

Tasks:
1) Read ALL visible on-image overlay text (Korean/English/mixed), top-to-bottom. Put every distinct line in extractedLines.
2) Guess which two lines are the BOTTOM main headline pair (largest bottom text) → bottomMainLines (0–2 items).
3) Describe visual style in English: layout, palette, lighting, composition, mood (visualStyle).
4) Describe subjects/people in English: who, pose, count, framing (subjects). Set hasPeople true if any human faces/bodies appear.

Output ONLY valid JSON (no markdown):
{
  "extractedLines": ["..."],
  "bottomMainLines": ["...", "..."],
  "visualStyle": "English prose",
  "subjects": "English prose",
  "hasPeople": true
}`

export const THUMBNAIL_REFERENCE_REMIX_IMAGE_APPENDIX = [
  'REFERENCE REMIX (critical):',
  '- Recreate the SAME general composition, palette mood, camera framing, and subject placement as the style description.',
  '- ABSOLUTELY NO text, letters, numbers, watermarks, or logos anywhere.',
  '- People/characters must look DIFFERENT from the reference (new faces, similar role/pose/emotion only — not identical likeness).',
  '- MANDATORY for every human figure: thick clean WHITE outline/stroke around the body (sticker/cutout style), high contrast against the background.',
  '- 16:9 YouTube thumbnail, clear focal point, safe margins.',
].join('\n')

export function parseThumbnailReferenceRemixAnalysisJson(
  raw: string,
): ThumbnailReferenceRemixAnalysis | null {
  const t = raw.trim()
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(t) as Record<string, unknown>
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as Record<string, unknown>
      } catch {
        return null
      }
    }
  }
  if (!parsed) return null

  const lines = Array.isArray(parsed.extractedLines)
    ? parsed.extractedLines.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  const bottom = Array.isArray(parsed.bottomMainLines)
    ? parsed.bottomMainLines.map((x) => String(x ?? '').trim()).filter(Boolean)
    : []

  const visualStyle = String(parsed.visualStyle ?? '').trim()
  const subjects = String(parsed.subjects ?? '').trim()
  if (!visualStyle && !subjects && !lines.length) return null

  return {
    extractedLines: lines,
    bottomMainLines: bottom.slice(0, 2),
    visualStyle,
    subjects,
    hasPeople: parsed.hasPeople === true,
  }
}

export function buildReferenceRemixCopyUserPrompt(opts: {
  extractedLines: string[]
  bottomMainLines: string[]
  topic?: string
  scriptExcerpt?: string
  videoTitle?: string
  outputLanguage?: string
  line1Max: number
  line2Max: number
}): string {
  const lang = (opts.outputLanguage ?? 'ko').trim() || 'ko'
  const refBlock =
    opts.bottomMainLines.length > 0
      ? opts.bottomMainLines.join(' / ')
      : opts.extractedLines.slice(-2).join(' / ') || opts.extractedLines.join(' / ') || '(없음)'

  const topic = opts.topic?.trim() || opts.videoTitle?.trim() || ''
  const script = opts.scriptExcerpt?.trim().slice(0, 1200) || ''

  return [
    `참고 썸네일에 있던 문구(원문):`,
    refBlock,
    opts.extractedLines.length ? `전체 OCR: ${opts.extractedLines.join(' | ')}` : '',
    topic ? `영상 주제: ${topic}` : '',
    script ? `대본 발췌:\n${script}` : '',
    '',
    `위 **참고 문구의 톤·핵심 키워드·후킹 각도**를 살려, 새로운 썸네일 **하단 2줄** 문구를 ${lang === 'ko' || lang === '한국어' ? '한국어' : lang}로 작성하세요.`,
    '- line1: 첫 줄 (짧고 강한 후킹)',
    '- line2: 둘째 줄 (궁금증·결과·감정)',
    '- 참고 문구를 그대로 복사하지 말고, 같은 의도로 새로 쓰세요.',
    `- line1 최대 ${opts.line1Max}자, line2 최대 ${opts.line2Max}자 (공백 포함).`,
    '',
    'JSON만: {"line1":"...","line2":"..."}',
  ]
    .filter(Boolean)
    .join('\n')
}

export function clampReferenceRemixLine(text: string, max: number): string {
  const t = text.trim()
  if (!max || max < 1) return t
  return t.length <= max ? t : t.slice(0, max).trim()
}
