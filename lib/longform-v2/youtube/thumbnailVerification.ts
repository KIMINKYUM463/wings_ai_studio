import { jsonrepair } from 'jsonrepair'

export type ThumbnailVerifyPinKind =
  | 'strength'
  | 'weakness'
  | 'photo'
  | 'hook'
  | 'readability'
  | 'composition'

export type ThumbnailVerifyPin = {
  id: string
  kind: ThumbnailVerifyPinKind
  /** 화살표가 가리키는 지점 (0–1, 이미지 좌상단 기준) */
  xn: number
  yn: number
  /** 짧은 라벨 (캡션) */
  label: string
  /** 상세 설명 */
  detail: string
}

export type ThumbnailQualityVerdict = 'good' | 'ok' | 'weak'
export type ThumbnailHookVerdict = 'strong' | 'moderate' | 'weak'

export type ThumbnailVerificationReport = {
  overallScore: number
  overallVerdict: string
  photoQuality: {
    score: number
    verdict: ThumbnailQualityVerdict
    summary: string
  }
  hookStrength: {
    score: number
    verdict: ThumbnailHookVerdict
    summary: string
  }
  strengths: string[]
  weaknesses: string[]
  pins: ThumbnailVerifyPin[]
  analyzedAt: number
}

export const THUMBNAIL_VERIFY_VISION_PROMPT = `You are a senior YouTube thumbnail CTR consultant.

Analyze this finished 16:9 YouTube thumbnail (text overlays included).

CRITICAL OUTPUT RULES:
- Reply with ONE raw JSON object only.
- No markdown, no code fences, no text before or after the JSON.
- Use exactly these English keys: overallScore, overallVerdict, photoQuality, hookStrength, strengths, weaknesses, pins.
- All string VALUES must be Korean.

Schema:
{
  "overallScore": 65,
  "overallVerdict": "한 문장 종합 평가",
  "photoQuality": { "score": 80, "verdict": "good", "summary": "사진·비주얼 요약" },
  "hookStrength": { "score": 55, "verdict": "moderate", "summary": "후킹·CTR 요약" },
  "strengths": ["구체적 강점1", "강점2"],
  "weaknesses": ["구체적 보완1", "보완2"],
  "pins": [
    { "id": "p1", "kind": "hook", "xn": 0.5, "yn": 0.3, "label": "짧은라벨", "detail": "1-2문장 설명" }
  ]
}

photoQuality.verdict: "good" | "ok" | "weak"
hookStrength.verdict: "strong" | "moderate" | "weak"
pin.kind: "strength" | "weakness" | "photo" | "hook" | "readability" | "composition"
- pins: 5 to 8 items. xn and yn MUST be numbers between 0.05 and 0.95 (arrow tip position).
- strengths/weaknesses: 2-4 items each, specific to this thumbnail.`

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function stripMarkdownFence(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/m, '').trim()
  }
  return t
}

/** 중첩 괄호 균형으로 첫 JSON 객체만 추출 */
function extractBalancedJsonObject(raw: string): string {
  const s = stripMarkdownFence(raw)
  const start = s.indexOf('{')
  if (start < 0) return s
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return s.slice(start)
}

function tryParseJsonObject(blob: string): Record<string, unknown> | null {
  const trimmed = blob.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(jsonrepair(trimmed)) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

/** Gemini가 한글 키·snake_case로 줄 때 정규화 */
function normalizeVerificationRoot(raw: Record<string, unknown>): Record<string, unknown> {
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null) return raw[k]
    }
    return undefined
  }

  const photo = pick('photoQuality', 'photo_quality', 'photo', '비주얼', '사진품질')
  const hook = pick('hookStrength', 'hook_strength', 'hook', '후킹', 'ctr')
  const pins = pick('pins', '핀', 'markers', 'annotations', 'arrows')

  return {
    overallScore: pick('overallScore', 'overall_score', 'score', '종합점수', 'totalScore'),
    overallVerdict: pick('overallVerdict', 'overall_verdict', 'verdict', 'summary', '종합평가'),
    photoQuality: photo,
    hookStrength: hook,
    strengths: pick('strengths', '강점', 'good_points', 'positives'),
    weaknesses: pick('weaknesses', '보완', 'weak_points', 'improvements', 'negatives'),
    pins,
  }
}

function normalizeMetricBlock(
  block: unknown,
  fallbackSummary: string,
): { score: number; verdict: string; summary: string } {
  if (!block || typeof block !== 'object') {
    return { score: 0, verdict: '', summary: fallbackSummary }
  }
  const o = block as Record<string, unknown>
  return {
    score: typeof o.score === 'number' ? o.score : Number(o.score) || 0,
    verdict: typeof o.verdict === 'string' ? o.verdict : String(o.verdict ?? ''),
    summary:
      typeof o.summary === 'string'
        ? o.summary
        : typeof o.description === 'string'
          ? o.description
          : fallbackSummary,
  }
}

/** pins 파싱 실패 시 strengths/weaknesses에서 기본 핀 생성 */
function synthesizePinsFromLists(
  strengths: string[],
  weaknesses: string[],
): ThumbnailVerifyPin[] {
  const out: ThumbnailVerifyPin[] = []
  const slots: { kind: ThumbnailVerifyPinKind; text: string; xn: number; yn: number }[] = []
  weaknesses.slice(0, 3).forEach((t, i) => {
    slots.push({ kind: 'weakness', text: t, xn: 0.22 + i * 0.18, yn: 0.72 })
  })
  strengths.slice(0, 2).forEach((t, i) => {
    slots.push({ kind: 'strength', text: t, xn: 0.55 + i * 0.15, yn: 0.28 })
  })
  if (slots.length < 3) {
    slots.push({
      kind: 'hook',
      text: '후킹·클릭 유도력 검토',
      xn: 0.5,
      yn: 0.5,
    })
  }
  slots.slice(0, 8).forEach((s, i) => {
    out.push({
      id: `syn${i + 1}`,
      kind: s.kind,
      xn: s.xn,
      yn: s.yn,
      label: s.text.slice(0, 12),
      detail: s.text,
    })
  })
  return out
}

const PIN_KINDS: ThumbnailVerifyPinKind[] = [
  'strength',
  'weakness',
  'photo',
  'hook',
  'readability',
  'composition',
]

function normPinKind(v: unknown): ThumbnailVerifyPinKind {
  if (typeof v === 'string' && PIN_KINDS.includes(v as ThumbnailVerifyPinKind)) {
    return v as ThumbnailVerifyPinKind
  }
  return 'composition'
}

function normPhotoVerdict(v: unknown): ThumbnailQualityVerdict {
  if (v === 'good' || v === 'ok' || v === 'weak') return v
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s.includes('good') || s.includes('좋') || s.includes('우수')) return 'good'
  if (s.includes('weak') || s.includes('부족') || s.includes('나쁨')) return 'weak'
  return 'ok'
}

function normHookVerdict(v: unknown): ThumbnailHookVerdict {
  if (v === 'strong' || v === 'moderate' || v === 'weak') return v
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s.includes('strong') || s.includes('강') || s.includes('높')) return 'strong'
  if (s.includes('weak') || s.includes('약') || s.includes('낮')) return 'weak'
  return 'moderate'
}

function normPin(raw: unknown, index: number): ThumbnailVerifyPin | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const pos =
    o.position && typeof o.position === 'object'
      ? (o.position as Record<string, unknown>)
      : o
  const xnRaw = o.xn ?? o.x ?? pos.xn ?? pos.x
  const ynRaw = o.yn ?? o.y ?? pos.yn ?? pos.y
  let xn = typeof xnRaw === 'number' ? xnRaw : Number(xnRaw)
  let yn = typeof ynRaw === 'number' ? ynRaw : Number(ynRaw)
  if (!Number.isFinite(xn) || !Number.isFinite(yn)) {
    xn = 0.2 + (index % 4) * 0.2
    yn = 0.25 + Math.floor(index / 4) * 0.35
  }
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  const detail = typeof o.detail === 'string' ? o.detail.trim() : ''
  if (!label && !detail) return null
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `p${index + 1}`,
    kind: normPinKind(o.kind),
    xn: clamp(xn, 0.03, 0.97),
    yn: clamp(yn, 0.03, 0.97),
    label: label || detail.slice(0, 12),
    detail: detail || label,
  }
}

function normStringList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, max)
}

export function parseThumbnailVerificationJson(raw: string): ThumbnailVerificationReport | null {
  const blob = extractBalancedJsonObject(raw)
  const parsed = tryParseJsonObject(blob)
  if (!parsed) return null

  const root = normalizeVerificationRoot(parsed)
  const photoMetric = normalizeMetricBlock(root.photoQuality, '사진·비주얼 품질을 검토했습니다.')
  const hookMetric = normalizeMetricBlock(root.hookStrength, '후킹·클릭 유도력을 검토했습니다.')

  const strengths = normStringList(root.strengths, 6)
  const weaknesses = normStringList(root.weaknesses, 6)

  const pinsRaw = Array.isArray(root.pins) ? root.pins : []
  let pins = pinsRaw
    .map((p, i) => normPin(p, i))
    .filter((p): p is ThumbnailVerifyPin => p != null)
    .slice(0, 10)

  if (pins.length === 0) {
    pins = synthesizePinsFromLists(strengths, weaknesses)
  }

  const overallScore = clamp(
    typeof root.overallScore === 'number'
      ? root.overallScore
      : Number(root.overallScore) || 0,
    0,
    100,
  )

  return {
    overallScore,
    overallVerdict:
      typeof root.overallVerdict === 'string'
        ? root.overallVerdict.trim()
        : '분석이 완료되었습니다.',
    photoQuality: {
      score: clamp(photoMetric.score, 0, 100),
      verdict: normPhotoVerdict(photoMetric.verdict),
      summary: photoMetric.summary.trim() || '사진·비주얼 품질을 검토했습니다.',
    },
    hookStrength: {
      score: clamp(hookMetric.score, 0, 100),
      verdict: normHookVerdict(hookMetric.verdict),
      summary: hookMetric.summary.trim() || '후킹·클릭 유도력을 검토했습니다.',
    },
    strengths,
    weaknesses,
    pins,
    analyzedAt: Date.now(),
  }
}

export const THUMBNAIL_VERIFY_PIN_KIND_LABEL: Record<ThumbnailVerifyPinKind, string> = {
  strength: '강점',
  weakness: '보완',
  photo: '비주얼',
  hook: '후킹',
  readability: '가독성',
  composition: '구도',
}

export const THUMBNAIL_VERIFY_PIN_KIND_COLOR: Record<ThumbnailVerifyPinKind, string> = {
  strength: '#22c55e',
  weakness: '#f97316',
  photo: '#3b82f6',
  hook: '#a855f7',
  readability: '#06b6d4',
  composition: '#eab308',
}
