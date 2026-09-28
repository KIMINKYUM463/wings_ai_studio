import type { ThumbnailCopyResearchItem } from './thumbnailCopyResearch'
import { formatThumbnailCopyResearchBlock } from './thumbnailCopywriter'

export type ThumbnailSubCopySlotSpec = {
  subKey: string
  subLabel: string
  subMax: number
}

/** 썸네일 이미지 위 괄호·라벨형 서브카피 (예: ('효' 강조), (삼강행실도)) */
export type ThumbnailSubCopy = {
  id: string
  text: string
  angle?: string
  /** 배치 힌트 — 어느 시각 요소를 짚는지 */
  placementHint?: string
}

export type ThumbnailSubCopiesRequest = {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  slotSpec: ThumbnailSubCopySlotSpec
  researchItems?: ThumbnailCopyResearchItem[]
  count?: number
}

export type ThumbnailSubCopiesResponse = {
  subCopies: ThumbnailSubCopy[]
}

export function clampSubCopyText(text: string, max: number): string {
  const t = text.trim()
  if (!max || max < 1) return t
  return t.length <= max ? t : t.slice(0, max).trim()
}

export function subCopyToReplacement(
  sub: ThumbnailSubCopy,
  spec: ThumbnailSubCopySlotSpec,
): Record<string, string> {
  return {
    [spec.subKey]: clampSubCopyText(sub.text, spec.subMax),
  }
}

/** Gemini user 프롬프트 — 괄호형 서브카피 N개 */
export function buildThumbnailSubCopiesUserPrompt(req: ThumbnailSubCopiesRequest): string {
  const count = Math.min(12, Math.max(6, req.count ?? 10))
  const isKo = !req.outputLanguage || req.outputLanguage === 'ko' || req.outputLanguage === '한국어'
  const researchBlock =
    req.researchItems?.length && isKo
      ? formatThumbnailCopyResearchBlock(req.researchItems, true)
      : req.researchItems?.length
        ? formatThumbnailCopyResearchBlock(req.researchItems, false)
        : ''

  const spec = req.slotSpec
  return [
    isKo
      ? `대본·주제·유튜브 참고를 바탕으로 **괄호형 서브카피 ${count}개**를 JSON으로 출력하세요.`
      : `Output ${count} parenthetical thumbnail sub-copy labels as JSON.`,
    isKo
      ? '서브카피는 메인 2줄 카피가 **아닙니다**. 썸네일 **이미지·일러스트·자료·키워드**를 짧게 짚는 **괄호 라벨**입니다.'
      : 'Sub-copy labels visual elements — not main headline lines.',
    isKo
      ? `형식 예: ('효' 강조), (삼강행실도), ('57억' 폭로), (실제 장면) — **괄호 () 필수**, **최대 ${spec.subMax}자**`
      : `Format: short parenthetical labels, max ${spec.subMax} chars.`,
    isKo
      ? '- 대본·주제의 **핵심 키워드·인물·사료·장면**을 1개씩 짚을 것'
      : '- Point at one concrete keyword/scene per label',
    isKo
      ? '- 참고 썸네일의 **괄호·작은 라벨·강조 표기** 패턴만 참고, 문구 복제 금지'
      : '- Learn parenthetical label patterns from references; do not copy verbatim',
    isKo
      ? '- angle: 짧은 전략(키워드 강조·출처·장면·대조 등), placementHint: 어느 영역을 짚는지 한 줄'
      : '- Unique angle and optional placementHint per item',
    isKo ? '- 서론·분석 없이 JSON만' : '- JSON only',
    '',
    researchBlock,
    '',
    `templateId: ${req.templateId}`,
    `topic: ${req.topic}`,
    req.videoTitle?.trim() ? `videoTitle: ${req.videoTitle.trim()}` : '',
    `subCopySlot: ${spec.subKey} (${spec.subLabel}), max ${spec.subMax} chars`,
    '',
    'scriptExcerpt:',
    req.scriptExcerpt.slice(0, 2800),
    '',
    'JSON 형식:',
    `{ "subCopies": [ { "id": "s1", "text": "('효' 강조)", "angle": "키워드 강조", "placementHint": "왼쪽 삼강오륜 일러스트" }, ... ] }`,
    isKo
      ? `subCopies 배열 길이는 정확히 ${count}개. text는 괄호로 시작·끝, 글자 수 상한 준수.`
      : `Exactly ${count} items. Respect max length.`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildThumbnailSubCopiesSystemPrompt(outputLanguage?: string): string {
  const isKo = !outputLanguage || outputLanguage === 'ko' || outputLanguage === '한국어'
  if (isKo) {
    return `당신은 한국 유튜브 TOP 비주얼 디렉터·썸네일 카피라이터입니다.
메인 카피가 아닌 **이미지 위 괄호형 서브 라벨**만 제안합니다. (예: ('효' 강조), (삼강행실도))
CTR·시각 이해를 돕는 **짧은 괄호 문구**. 허위 사실 금지.
**유효한 JSON 객체 하나만** 출력 (마크다운 금지).`
  }
  return `You are a YouTube thumbnail visual director. Output one JSON object with a "subCopies" array only. Short parenthetical on-image labels. No markdown.`
}

export function parseThumbnailSubCopiesJson(
  raw: string,
  spec: ThumbnailSubCopySlotSpec,
  maxCount: number,
): ThumbnailSubCopy[] {
  const t = raw.trim()
  let parsed: { subCopies?: unknown } | null = null
  try {
    parsed = JSON.parse(t) as { subCopies?: unknown }
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as { subCopies?: unknown }
      } catch {
        return []
      }
    }
  }
  if (!Array.isArray(parsed?.subCopies)) return []

  const out: ThumbnailSubCopy[] = []
  const seen = new Set<string>()
  for (let i = 0; i < parsed.subCopies.length && out.length < maxCount; i++) {
    const row = parsed.subCopies[i]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const text =
      typeof r.text === 'string'
        ? r.text
        : typeof r.subCopy === 'string'
          ? r.subCopy
          : typeof r.label === 'string'
            ? r.label
            : ''
    if (!text.trim()) continue
    const normalized = normalizeSubCopyParentheses(text.trim())
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `s${out.length + 1}`,
      text: clampSubCopyText(normalized, spec.subMax),
      angle: typeof r.angle === 'string' ? r.angle.trim() : undefined,
      placementHint:
        typeof r.placementHint === 'string'
          ? r.placementHint.trim()
          : typeof r.hint === 'string'
            ? r.hint.trim()
            : undefined,
    })
  }
  return out
}

/** 괄호형 서브카피 — 앞뒤 () 보정 */
export function normalizeSubCopyParentheses(text: string): string {
  let t = text.trim()
  if (!t) return t
  if (!t.startsWith('(')) t = `(${t}`
  if (!t.endsWith(')')) t = `${t})`
  return t
}
