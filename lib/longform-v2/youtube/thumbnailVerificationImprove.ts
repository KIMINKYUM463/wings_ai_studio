import type { ThumbnailVerificationReport } from './thumbnailVerification'

export type ThumbnailVerifyImproveSlotInput = {
  slotKey: string
  label: string
  currentText: string
  maxCharacters: number
  yn: number
  fontSize: number
}

export type ThumbnailVerifyImproveRequest = {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  outputLanguage?: string
  report: ThumbnailVerificationReport
  slots: ThumbnailVerifyImproveSlotInput[]
}

export type ThumbnailVerifyImproveSlotAdjustment = {
  slotKey: string
  yn?: number
  fontSize?: number
  /** textStylePresets id: outline | yellow_pop | box_line | neon 등 */
  stylePresetId?: string
}

export type ThumbnailVerifyImproveResult = {
  replacements: Record<string, string>
  slotAdjustments: ThumbnailVerifyImproveSlotAdjustment[]
  summary: string
}

export function reportHasActionableWeaknesses(report: ThumbnailVerificationReport): boolean {
  if (report.weaknesses.length > 0) return true
  if (report.overallScore < 80) return true
  if (report.hookStrength.score < 72) return true
  const weakPins = report.pins.filter(
    (p) => p.kind === 'weakness' || p.kind === 'hook' || p.kind === 'composition',
  )
  return weakPins.length > 0
}

export function buildThumbnailVerificationImprovePrompt(
  req: ThumbnailVerifyImproveRequest,
): string {
  const r = req.report
  const weaknessPins = r.pins
    .filter((p) => p.kind === 'weakness' || p.kind === 'hook' || p.kind === 'composition' || p.kind === 'readability')
    .map((p) => `- [${p.kind}] ${p.label}: ${p.detail}`)
    .join('\n')

  const slotLines = req.slots
    .map(
      (s) =>
        `- ${s.slotKey} (${s.label}): 현재 "${s.currentText}" | max ${s.maxCharacters}자 | yn=${s.yn.toFixed(2)} fontSize=${s.fontSize}`,
    )
    .join('\n')

  const lang = (req.outputLanguage ?? 'ko').trim() || 'ko'
  const langNote = lang === 'ko' ? '모든 문구는 한국어.' : `모든 문구는 ${lang}.`

  return [
    '당신은 YouTube 썸네일 CTR 개선 전문가다.',
    '아래 CTR 검증 리포트의 보완점을 반영해, 같은 템플릿·배경을 유지한 채 문구·배치·스타일만 개선하라.',
    langNote,
    '',
    '## 검증 결과',
    `종합 점수: ${r.overallScore} — ${r.overallVerdict}`,
    `후킹 점수: ${r.hookStrength.score} — ${r.hookStrength.summary}`,
    `비주얼 점수: ${r.photoQuality.score} — ${r.photoQuality.summary}`,
    '',
    '### 보완할 점',
    ...(r.weaknesses.length ? r.weaknesses.map((w) => `- ${w}`) : ['- (요약 없음)']),
    '',
    '### 화살표 분석 (보완·후킹·구도·가독성)',
    weaknessPins || '- 없음',
    '',
    '## 영상 맥락',
    `주제: ${req.topic}`,
    req.videoTitle?.trim() ? `제목: ${req.videoTitle.trim()}` : '',
    '',
    '대본 발췌:',
    req.scriptExcerpt.slice(0, 2400),
    '',
    '## 텍스트 슬롯',
    slotLines,
    '',
    '## 개선 규칙',
    '- **CTR·후킹 최우선**: 숫자·고유명사·반전·미완결·감정(FOMO·충격) — 형식적 "이게 ~였습니다", "~왜 ~일까"만 쓰지 말 것.',
    '- 밋밋한 설명·뉴스 제목형 문구 → 클릭 impulse 문구로 교체. 허위 사실은 금지.',
    '- 슬롯마다 서로 다른 문구. maxCharacters 초과 금지.',
    '- 배경 인물·별·유성우 등 중요 비주얼을 가리지 않도록 yn을 조정할 수 있다 (0.52~0.82).',
    '- 폰트가 밋밋하다는 지적이 있으면 stylePresetId로 outline, yellow_pop, box_line, neon 중 선택.',
    '- 사진·비주얼 점수가 이미 높으면 배경 관련 문구는 건드리지 말고 텍스트·구도만 개선.',
    '',
    'JSON만 출력 (마크다운 없음):',
    '{',
    '  "replacements": { "slotKey": "새 문구", ... },',
    '  "slotAdjustments": [',
    '    { "slotKey": "hook", "yn": 0.62, "fontSize": 76, "stylePresetId": "outline" }',
    '  ],',
    '  "summary": "한 문장 개선 요약"',
    '}',
    '',
    `templateId: ${req.templateId}`,
    'replacements에는 모든 slotKey가 비어 있지 않게 포함.',
  ]
    .filter(Boolean)
    .join('\n')
}

function extractJsonObjectText(raw: string): string {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  const brace = t.match(/\{[\s\S]*\}/)
  return brace ? brace[0] : t
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

const ALLOWED_PRESETS = new Set([
  'none',
  'box_line',
  'box_highlight',
  'outline',
  'yellow_pop',
  'red_hook',
  'neon',
  'karaoke',
  'elevate',
])

export function parseThumbnailVerificationImproveJson(
  raw: string,
  maxByKey: Record<string, number>,
): ThumbnailVerifyImproveResult | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJsonObjectText(raw)) as Record<string, unknown>
  } catch {
    return null
  }

  const replacements: Record<string, string> = {}
  const repObj = parsed.replacements
  if (repObj && typeof repObj === 'object') {
    for (const [key, val] of Object.entries(repObj as Record<string, unknown>)) {
      if (typeof val !== 'string' || !val.trim()) continue
      const max = maxByKey[key] ?? 24
      const t = val.trim()
      replacements[key] = t.length <= max ? t : t.slice(0, max).trim()
    }
  }

  const slotAdjustments: ThumbnailVerifyImproveSlotAdjustment[] = []
  const adjRaw = parsed.slotAdjustments
  if (Array.isArray(adjRaw)) {
    for (const item of adjRaw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const slotKey = typeof o.slotKey === 'string' ? o.slotKey.trim() : ''
      if (!slotKey) continue
      const adj: ThumbnailVerifyImproveSlotAdjustment = { slotKey }
      if (typeof o.yn === 'number' && Number.isFinite(o.yn)) {
        adj.yn = clamp(o.yn, 0.48, 0.86)
      }
      if (typeof o.fontSize === 'number' && Number.isFinite(o.fontSize)) {
        adj.fontSize = clamp(Math.round(o.fontSize), 32, 120)
      }
      const preset =
        typeof o.stylePresetId === 'string' ? o.stylePresetId.trim() : ''
      if (preset && ALLOWED_PRESETS.has(preset)) adj.stylePresetId = preset
      slotAdjustments.push(adj)
    }
  }

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'CTR 검증 보완점을 반영해 문구·배치를 조정했습니다.'

  if (Object.keys(replacements).length === 0) return null

  return { replacements, slotAdjustments, summary }
}
