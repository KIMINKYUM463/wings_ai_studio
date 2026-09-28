import type { ThumbnailCopyResearchItem } from './thumbnailCopyResearch'
import { formatThumbnailCopyResearchBlock } from './thumbnailCopywriter'
import { buildThumbnailKoreanCtrCopyStyleBlockKo } from './thumbnailKoreanCtrCopyStyleKo'

export type ThumbnailCopyComboSlotSpec = {
  line1Key: string
  line1Label: string
  line1Max: number
  line2Key: string
  line2Label: string
  line2Max: number
}

export type ThumbnailCopyCombo = {
  id: string
  angle?: string
  line1: string
  line2: string
}

export type ThumbnailCopyCombosRequest = {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  slotSpec: ThumbnailCopyComboSlotSpec
  researchItems?: ThumbnailCopyResearchItem[]
  /** 생성 개수 (기본 15, 최대 20) */
  count?: number
}

export type ThumbnailCopyCombosResponse = {
  combos: ThumbnailCopyCombo[]
}

export function clampCopyComboLine(text: string, max: number): string {
  const t = text.trim()
  if (!max || max < 1) return t
  return t.length <= max ? t : t.slice(0, max).trim()
}

export function comboToReplacements(
  combo: ThumbnailCopyCombo,
  spec: ThumbnailCopyComboSlotSpec,
): Record<string, string> {
  if (spec.line2Key === MAIN_COPY_LINE2_VIRTUAL_KEY) {
    return {
      [spec.line1Key]: clampCopyComboLine(combo.line1, spec.line1Max),
    }
  }
  return {
    [spec.line1Key]: clampCopyComboLine(combo.line1, spec.line1Max),
    [spec.line2Key]: clampCopyComboLine(combo.line2, spec.line2Max),
  }
}

/** 메인 카피 1줄 템플릿 — 2번째 줄은 새 텍스트 레이어로 추가 */
export const MAIN_COPY_LINE2_VIRTUAL_KEY = '__main_copy_line2__'

/** Gemini user 프롬프트 — 2줄 조합 N개 */
export function buildThumbnailCopyCombosUserPrompt(req: ThumbnailCopyCombosRequest): string {
  const count = Math.min(20, Math.max(8, req.count ?? 15))
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
      ? `대본·주제·유튜브 참고를 바탕으로 **서로 다른 각도**의 썸네일 **2줄 조합 ${count}개**를 JSON으로 출력하세요.`
      : `Output ${count} distinct 2-line thumbnail copy combinations as JSON.`,
    isKo
      ? `각 조합은 썸네일 **위→아래 2줄**입니다. 한 호흡으로 이어지게 — ${spec.line1Label} + ${spec.line2Label}.`
      : `Each combo is two lines: ${spec.line1Key} then ${spec.line2Key}.`,
    `- ${spec.line1Key} (${spec.line1Label}): **최대 ${spec.line1Max}자**`,
    `- ${spec.line2Key} (${spec.line2Label}): **최대 ${spec.line2Max}자**`,
    isKo
      ? '- 대본 **핵심 키워드**(지명·인물·사건·숫자)를 line1 또는 line2에 직관적으로 포함'
      : '- Include concrete keywords from script in line1 or line2',
    isKo
      ? '- 참고 썸네일 **줄바꿈·감성·후킹 패턴만** 참고, 문구 복제 금지'
      : '- Learn hook patterns from references; do not copy verbatim',
    isKo ? '- 조합마다 angle(짧은 전략 라벨)을 다르게' : '- Unique angle label per combo',
    isKo ? '- 서론·분석·단계 설명 없이 JSON만' : '- JSON only',
    '',
    researchBlock,
    '',
    `templateId: ${req.templateId}`,
    `topic: ${req.topic}`,
    req.videoTitle?.trim() ? `videoTitle: ${req.videoTitle.trim()}` : '',
    '',
    'scriptExcerpt:',
    req.scriptExcerpt.slice(0, 2800),
    '',
    'JSON 형식:',
    `{ "combos": [ { "id": "c1", "angle": "숫자 강조", "line1": "...", "line2": "..." }, ... ] }`,
    isKo
      ? `combos 배열 길이는 정확히 ${count}개. line1·line2는 글자 수 상한을 절대 넘기지 마세요.`
      : `Exactly ${count} combos. Respect max character limits.`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildThumbnailCopyCombosSystemPrompt(outputLanguage?: string): string {
  const isKo = !outputLanguage || outputLanguage === 'ko' || outputLanguage === '한국어'
  if (isKo) {
    return `당신은 한국 유튜브 TOP 비주얼 디렉터·썸네일 카피라이터입니다.
CTR·후킹 최우선. **2줄 조합을 여러 각도**로 제안합니다.
line1은 짧고 세게(설정·빌드업), line2는 hook과 **한 호흡**으로 이어지는 충격 한 줄.
**~합니다·~입니다·~해요 종결 절대 금지** — 명사형·후킹형만.
허위 사실 금지. **유효한 JSON 객체 하나만** 출력 (마크다운 금지).

${buildThumbnailKoreanCtrCopyStyleBlockKo()}`
  }
  return `You are a top YouTube thumbnail copywriter. Output one JSON object with a "combos" array only. High-CTR two-line pairs. No markdown.`
}

export function parseThumbnailCopyCombosJson(
  raw: string,
  spec: ThumbnailCopyComboSlotSpec,
  maxCount: number,
): ThumbnailCopyCombo[] {
  const t = raw.trim()
  let parsed: { combos?: unknown } | null = null
  try {
    parsed = JSON.parse(t) as { combos?: unknown }
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as { combos?: unknown }
      } catch {
        return []
      }
    }
  }
  if (!Array.isArray(parsed?.combos)) return []

  const out: ThumbnailCopyCombo[] = []
  const seen = new Set<string>()
  for (let i = 0; i < parsed.combos.length && out.length < maxCount; i++) {
    const row = parsed.combos[i]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const line1 =
      typeof r.line1 === 'string'
        ? r.line1
        : typeof r.hook === 'string'
          ? r.hook
          : ''
    const line2 =
      typeof r.line2 === 'string'
        ? r.line2
        : typeof r.highlight === 'string'
          ? r.highlight
          : ''
    if (!line1.trim() || !line2.trim()) continue
    const key = `${line1.trim()}|${line2.trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `c${out.length + 1}`,
      angle: typeof r.angle === 'string' ? r.angle.trim() : undefined,
      line1: clampCopyComboLine(line1, spec.line1Max),
      line2: clampCopyComboLine(line2, spec.line2Max),
    })
  }
  return out
}
