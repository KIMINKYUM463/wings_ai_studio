export type ThumbnailTextRewritePresetId =
  | 'more_hook'
  | 'more_provocative'
  | 'longer'
  | 'shorter'
  | 'punchier'
  | 'tone_pro'
  | 'tone_casual'
  | 'tone_urgent'
  | 'translate'

export type ThumbnailTextRewritePreset = {
  id: ThumbnailTextRewritePresetId
  label: string
  instruction: string
}

export const THUMBNAIL_TEXT_REWRITE_PRESETS: readonly ThumbnailTextRewritePreset[] = [
  {
    id: 'more_hook',
    label: '더 후킹되게',
    instruction:
      '유튜브 CTR 최우선. cliffhanger·숫자·반전·미완결로 바꿔. 말이 끊긴 느낌, 클릭하고 싶게. 밋밋한 설명형은 금지.',
  },
  {
    id: 'more_provocative',
    label: '더 자극적으로',
    instruction:
      '호기심·긴장·충격·FOMO가 터지게 더 자극적으로. 감정 단어·구체 수치·대조 강화. 허위·조작된 사실·선정적 거짓은 금지.',
  },
  {
    id: 'longer',
    label: '더 길게',
    instruction:
      'maxCharacters 한도 안에서 가능한 한 글자 수를 채워 디테일·임팩트를 높여. 핵심은 유지.',
  },
  {
    id: 'shorter',
    label: '더 짧게',
    instruction: '군더더기 없이 짧고 강하게. 한눈에 읽히게.',
  },
  {
    id: 'punchier',
    label: '한 방에 꽂히게',
    instruction: '유튜브 썸네일 CTR — 구체 명사·숫자·결과·대조로 더 세고 짧게. 클릭 impulse.',
  },
  {
    id: 'tone_pro',
    label: '전문·신뢰 톤',
    instruction: '전문가·신뢰감 있는 톤. 단정하고 깔끔하게, 과장 없이.',
  },
  {
    id: 'tone_casual',
    label: '친근·구어체',
    instruction: '친구에게 말하듯 구어체·친근하게. 유튜브 브이로그 느낌.',
  },
  {
    id: 'tone_urgent',
    label: '긴급·지금 확인',
    instruction: '지금 당장 봐야 할 것 같은 긴급감·FOMO. 클릭 유도.',
  },
]

/** 언어 적용(번역) 전용 — UI 우클릭·사이드바 프리셋 목록에는 노출하지 않음 */
export const THUMBNAIL_TEXT_TRANSLATE_PRESET: ThumbnailTextRewritePreset = {
  id: 'translate',
  label: '번역',
  instruction: '지정 언어로 자연스럽게 번역. 의미·후킹·임팩트·대략적인 길이는 유지.',
}

export type ThumbnailTextRewriteRequest = {
  slotKey: string
  slotLabel: string
  currentText: string
  maxCharacters: number
  presetId: ThumbnailTextRewritePresetId
  customInstruction?: string
  topic?: string
  scriptExcerpt?: string
  videoTitle?: string
  outputLanguage?: string
  /** hook+highlight 등 연결된 줄 — 함께 다시 쓸 때 */
  linkedSlot?: {
    slotKey: string
    slotLabel: string
    currentText: string
    maxCharacters: number
  }
}

export type ThumbnailTextRewriteResponse = {
  text: string
  linkedText?: string
}

export function buildThumbnailTextRewritePrompt(req: ThumbnailTextRewriteRequest): string {
  const preset =
    THUMBNAIL_TEXT_REWRITE_PRESETS.find((p) => p.id === req.presetId) ??
    (req.presetId === 'translate' ? THUMBNAIL_TEXT_TRANSLATE_PRESET : undefined) ??
    THUMBNAIL_TEXT_REWRITE_PRESETS[0]
  const lang = (req.outputLanguage ?? 'ko').trim() || 'ko'
  const linked = req.linkedSlot

  return [
    '썸네일 문구 한 줄(또는 연결된 두 줄)을 다시 써라. JSON만 출력.',
    `언어: ${lang}`,
    '',
    req.topic?.trim() ? `주제: ${req.topic.trim()}` : '',
    req.videoTitle?.trim() ? `영상 제목: ${req.videoTitle.trim()}` : '',
    req.scriptExcerpt?.trim()
      ? `대본 발췌:\n${req.scriptExcerpt.trim().slice(0, 1200)}`
      : '',
    '',
    `슬롯: ${req.slotKey} (${req.slotLabel})`,
    `현재 문구: ${req.currentText.trim() || '(비어 있음)'}`,
    `maxCharacters: ${req.maxCharacters} (절대 초과 금지)`,
    linked
      ? [
          '',
          '연결된 줄 (hook→highlight / line1→line2 — **한 호흡·한 이야기**):',
          `- ${linked.slotKey} (${linked.slotLabel}): "${linked.currentText.trim()}" max ${linked.maxCharacters}자`,
          '- 위 줄=설정, 아래 줄=「~한 진짜 이유」「~했을까?」「~일까?」 등 **호기심 결론**',
          '- 두 줄을 합치면 하나의 질문·반전·미완결 문장이 되게. 서로 다른 주제 금지.',
        ].join('\n')
      : lang === 'ko' || lang === '한국어'
        ? [
            '',
            '한 줄만 써도 **궁금증** 유지 — 「~한 이유」「~했을까?」 패턴 적극 사용.',
          ].join('\n')
        : '',
    '',
    `지시: ${req.customInstruction?.trim() || preset.instruction}`,
    '',
    '금지: "이게 ~였습니다", "사람들이 모르는", "생각보다 심각", 뉴스·교과서체',
    '',
    linked
      ? 'JSON: { "text": "...", "linkedText": "..." }'
      : 'JSON: { "text": "..." }',
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseThumbnailTextRewriteJson(
  raw: string,
  maxChars: number,
  linkedMaxChars?: number,
): ThumbnailTextRewriteResponse | null {
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

  const clamp = (s: string, max: number) => {
    const x = s.trim()
    if (!max || max < 1) return x
    return x.length <= max ? x : x.slice(0, max).trim()
  }

  const text =
    typeof parsed.text === 'string'
      ? parsed.text
      : typeof parsed.replacement === 'string'
        ? parsed.replacement
        : ''
  if (!text.trim()) return null

  const linkedRaw =
    typeof parsed.linkedText === 'string'
      ? parsed.linkedText
      : typeof parsed.highlight === 'string'
        ? parsed.highlight
        : typeof parsed.linked === 'string'
          ? parsed.linked
          : undefined

  return {
    text: clamp(text, maxChars),
    linkedText:
      linkedRaw?.trim() && linkedMaxChars
        ? clamp(linkedRaw, linkedMaxChars)
        : linkedRaw?.trim()
          ? clamp(linkedRaw, linkedMaxChars ?? maxChars)
          : undefined,
  }
}
