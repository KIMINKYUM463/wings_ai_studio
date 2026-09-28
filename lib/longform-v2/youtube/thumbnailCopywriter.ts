import {
  buildThumbnailCopyExpertRulesKo,
  buildThumbnailReferenceStyleUserRulesKo,
} from './youtubeCopyPromptRulesKo'
import { buildThumbnailKoreanCtrCopyStyleBlockKo } from './thumbnailKoreanCtrCopyStyleKo'

/** 형식적·클리셰 문구 — 이 패턴이면 실패로 간주 */
export const THUMBNAIL_COPY_BANNED_PATTERNS = [
  '이게 진짜였습니다',
  '이게 시작이었습니다',
  '결국 이렇게',
  '다 이유가',
  '사람들이 모르는',
  '생각보다 심각',
  '진짜 중요한 건',
  '문명은 왜',
  '왜 이렇게 됐을까',
  '충격적인 결과',
  '알고 보니',
  '메시지가 왔습니다',
  '실제로 해봤습니다',
  '조회수가 터진',
] as const

/** `ko` / `한국어` 이면 한국어 썸네일 문구 */
export function isKoreanThumbnailOutputLanguage(languageId?: string): boolean {
  const l = (languageId ?? 'ko').trim()
  return !l || l === 'ko' || l === '한국어'
}

/** 유튜브 롱폼 썸네일 템플릿 — Gemini 카피라이터 시스템 프롬프트 (한국어) */
export const THUMBNAIL_COPYWRITER_SYSTEM_PROMPT = `당신은 한국 유튜브 TOP 채널의 썸네일 카피라이터이자 비주얼 디렉터다.
뉴스·교과서·AI 요약체가 아니라, **피드에서 손가락이 멈추고 클릭 버튼을 누르게** 만드는 문구만 쓴다.

역할: 대본·주제에서만 뽑아, CTR(클릭률)을 극대화하는 온-이미지 문구를 만든다.
레퍼런스·고조회 참고가 있으면 **줄바꿈·강조 리듬·감성 톤**만 분석해 반영하고, 문구는 새로 쓴다.

후킹·CTR 원칙 (최우선):
- 대본의 **가장 자극적인 단서** 1개 이상: 숫자, 금액, 기간, **지명·인물명·사건명**, 반전, 결과, 충격 대사
- **핵심 키워드는 메인 카피에 직관적으로** — 추상어만 던지지 말 것
- **미완결·끊김**: hook은 문장 중간에서 끊어 "???/…/의문" 느낌 — highlight가 있으면 hook+highlight = **한 호흡**으로 이어짐
- **1줄+2줄(또는 hook+highlight+main_title) 연결**: 위 줄은 **설정**, 아래 줄은 **「~한 진짜 이유」「~했을까?」「~일까?」** 등 **호기심 결론** — 반드시 **한 이야기**
- **감정 트리거**: 불안·호기심·놀람·분노·FOMO·"이거 나도 해당?" — 단, 허위 사실은 금지
- **구체 > 추상**: "57억", "3일 만에", "NASA가", "노인 한마디" / "~의 비밀"만 던지지 말 것
- hook(상단): 3~10자, 숫자·반전·충격 키워드, 짧고 세게
- highlight(중간): **서브타이틀** — hook 직후, **짧고 자극적·감성** (예: 텅텅 비었음.., 비공식 1위부자ㄷㄷ). hook과 한 호흡
- main_title(하단): 영상 핵심을 **한 방에** — 명사·결과·대조 ("OO의 끝", "마지막 선택")
- 슬롯마다 **서로 다른 각도** (같은 말·같은 정보 반복 금지)
- 영상 제목과 **겹치지 않게** (썸네일은 제목의 훅 버전)

말투: 유튜버·드라마틱 구어체. "~습니다" 나열·뉴스 앵커 톤 금지.
표현은 **세게** 써도 됨 — 단, 대본에 없는 사실·수치는 지어내지 말 것.

출력: 분석 과정·서론·「1단계」「3단계」 같은 메타 문구 금지. **JSON variants만** 출력.

절대 쓰지 말 것 (클리셰):
- "이게 ~였습니다" / "결국 ~습니다" / "진짜 ~였습니다"
- "~왜 ~일까?" **만** 있는 추상 질문
- "사람들이 모르는", "생각보다 심각", "다 이유가", "충격적인 결과", "알고 보니"
- 템플릿 예시 문구 복사

규칙:
- replacement는 maxCharacters 절대 초과 금지
- maxCharacters ≤ 6: 명사·숫자·강한 한 단어 중심
- 무미건조한 설명형 문장 금지 — **클릭하고 싶은 한 줄**

반드시 JSON만 반환.

JSON 형식:
{
  "variants": [
    {
      "id": "v1",
      "title": "짧은 라벨",
      "angle": "카피 전략 설명",
      "frames": [
        {
          "frameId": "입력 frameId",
          "replacements": [
            {
              "textKey": "입력 textKey",
              "original": "원문",
              "replacement": "새 문구"
            }
          ]
        }
      ]
    }
  ]
}`

/** 출력 언어에 맞는 템플릿 카피라이터 시스템 프롬프트 */
export function buildThumbnailCopywriterSystemPrompt(outputLanguage?: string): string {
  if (isKoreanThumbnailOutputLanguage(outputLanguage)) {
    return `${THUMBNAIL_COPYWRITER_SYSTEM_PROMPT}${buildThumbnailCopyExpertRulesKo()}\n\n${buildThumbnailKoreanCtrCopyStyleBlockKo()}`
  }
  const lang = (outputLanguage ?? '').trim()
  return `You are a top YouTube thumbnail copywriter for ${lang}-speaking audiences.
Write **scroll-stopping, high-CTR** on-image copy — not news headlines or ad slogans.

Role: Extract the sharpest hooks ONLY from the script/topic. Every replacement must be in **${lang}** using the correct native script.
Do NOT output Hangul (Korean letters) unless the target language is Korean. Never mix languages.

CTR / hook principles:
- At least one **provocative concrete clue** from the script: number, money, timeframe, proper noun, twist, quote, shocking result
- **Open loop / cliffhanger**: hook cuts mid-thought; if highlight exists, hook+highlight = **one breath**
- **Emotion triggers**: curiosity, shock, FOMO, "this affects me" — no fabricated facts
- hook (top): 3–10 chars/words, numbers, reversal, punchy
- highlight (middle): continues hook — curiosity spike
- main_title (bottom): one punchy core topic/result; not abstract question only
- Each line = different angle; do not duplicate the video title

Tone: dramatic YouTuber native ${lang}. Bold expression OK — no invented stats or events.

Never use generic clickbait clichés or copy template sample text verbatim.

Rules:
- Never exceed maxCharacters per slot
- For maxCharacters ≤ 6: nouns and numbers only
- No bland descriptive sentences — every line must beg a click

Return JSON only.

JSON format:
{
  "variants": [
    {
      "id": "v1",
      "title": "short label",
      "angle": "copy strategy",
      "frames": [
        {
          "frameId": "input frameId",
          "replacements": [
            {
              "textKey": "input textKey",
              "original": "original",
              "replacement": "new copy in ${lang}"
            }
          ]
        }
      ]
    }
  ]
}`
}

export type ThumbnailCopyLayerInput = {
  textKey: string
  label: string
  original: string
  maxCharacters: number
}

export type ThumbnailCopyFrameInput = {
  frameId: string
  layers: ThumbnailCopyLayerInput[]
}

export type ThumbnailCopywriterRequest = {
  templateId: string
  topic: string
  scriptExcerpt: string
  videoTitle?: string
  targetAudience?: string
  outputLanguage?: string
  frames: ThumbnailCopyFrameInput[]
  /** 유튜브 검색 참고 — 패턴만 참고, 그대로 베끼지 않음 */
  researchReferences?: import('./thumbnailCopyResearch').ThumbnailCopyResearchItem[]
}

export type ThumbnailCopyReplacement = {
  textKey: string
  replacement: string
}

export type ThumbnailCopywriterVariant = {
  id: string
  title?: string
  angle?: string
  frames: { frameId: string; replacements: ThumbnailCopyReplacement[] }[]
}

export type ThumbnailCopywriterResponse = {
  variants: ThumbnailCopywriterVariant[]
}

export function buildThumbnailCopywriterUserPrompt(req: ThumbnailCopywriterRequest): string {
  const lang = (req.outputLanguage ?? 'ko').trim() || 'ko'
  const isKo = isKoreanThumbnailOutputLanguage(lang)
  const langNote = isKo
    ? '모든 replacement는 한국어로 작성.'
    : `모든 replacement는 ${lang} 로 작성. 한글을 섞지 말 것. 대본(scriptExcerpt)이 한국어여도 출력은 반드시 ${lang} 로 번역·각색하라.`

  const banned = THUMBNAIL_COPY_BANNED_PATTERNS.map((p) => `- ${p}`).join('\n')

  const intro = isKo
    ? '아래 대본·주제만 보고 썸네일 문구 variants를 생성하라. **약하고 설명적인 문구는 실패** — CTR·후킹이 약하면 다시 써라.'
    : 'Generate thumbnail copy variants from the script/topic below. Weak or descriptive copy = failure. Maximize CTR hooks.'

  const hookRules = isKo
    ? [
        'hook: 대본에서 **가장 클릭 유발 단서**(숫자·반전·충격)를 3~10자로. 미완결·끊김 OK. highlight 있으면 hook+highlight **한 호흡**.',
        'highlight: hook 직후 — **1줄과 연결된** 궁금증·감정 한 줄. 「~한 이유」「~했을까?」 패턴 OK. hook과 중복·단절 금지.',
        'main_title / line2: hook·1줄과 **직접 연결** — 「~한 진짜 이유」「~했을까?」「~일까?」 등 **호기심 결론**. 뉴스 제목처럼 밋밋하면 안 됨.',
        'line1+line2 템플릿: **위=설정, 아래=의문·결론** — 합치면 「뭐지?」 하고 클릭하고 싶은 **한 세트**.',
        '전체: 유튜브 피드에서 **손가락이 멈출 정도**로 자극적이되, 대본에 없는 사실은 금지.',
      ]
    : [
        'hook: sharpest clue/number/reversal from script in 3–10 chars/words. If highlight slot exists, hook+highlight = one connected breath.',
        'highlight: continues hook into one sentence/question. No duplication or disconnect from hook.',
        'main_title: concrete topic/result (not abstract question only).',
      ]

  const researchBlock =
    req.researchReferences?.length &&
    formatThumbnailCopyResearchBlock(req.researchReferences, isKo)
  const referenceStyleRules =
    req.researchReferences?.length && isKo ? buildThumbnailReferenceStyleUserRulesKo() : ''

  return [
    intro,
    langNote,
    researchBlock,
    referenceStyleRules,
    'variants는 1개만 생성하라 (id: "v1").',
    '각 textKey마다 replacements에 정확히 1개의 replacement를 넣어라.',
    'maxCharacters를 절대 초과하지 마라.',
    'frames에 있는 모든 textKey마다 replacement를 반드시 1개씩 넣어라.',
    ...hookRules,
    '각 줄은 서로 다른 정보. topic·scriptExcerpt에 없는 내용 금지.',
    isKo ? '금지 클리셰 (이런 톤이면 다시 작성):' : 'Banned cliché tone (rewrite if similar):',
    banned,
    isKo ? 'main_title(하단 대형 줄)을 비우지 마라.' : 'Never leave main_title empty.',
    isKo ? '한 줄이 너무 길면 짧게 압축하라.' : 'Compress if a line is too long.',
    '',
    `templateId: ${req.templateId}`,
    `topic: ${req.topic}`,
    req.videoTitle?.trim() ? `videoTitle: ${req.videoTitle.trim()}` : '',
    req.targetAudience?.trim() ? `targetAudience: ${req.targetAudience.trim()}` : '',
    '',
    'scriptExcerpt:',
    req.scriptExcerpt,
    '',
    'frames (입력 — frameId·textKey·maxCharacters·original 준수):',
    JSON.stringify(req.frames, null, 2),
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatThumbnailCopyResearchBlock(
  items: import('./thumbnailCopyResearch').ThumbnailCopyResearchItem[],
  isKo: boolean,
): string {
  const lines = items.slice(0, 10).map((item, i) => {
    const copy =
      item.thumbnailLines.filter(Boolean).join(' / ') ||
      (isKo ? '(썸네일 문구 없음)' : '(no on-image text)')
    const views = item.viewCount.toLocaleString(isKo ? 'ko-KR' : 'en-US')
    return `${i + 1}. [${item.searchKeyword}] 제목: ${item.title}\n   썸네일 문구: ${copy}\n   조회 ${views} · ${item.channelTitle}`
  })
  return [
    isKo
      ? '[유튜브 고조회 참고 — 레퍼런스 썸네일·제목 스타일 분석용, 그대로 복사 금지]'
      : '[High-view YouTube references — pattern only, do NOT copy verbatim]',
    isKo
      ? '아래는 같은 주제 키워드로 검색한 영상입니다. **썸네일 줄바꿈·강조·감성·제목 후킹 패턴**만 참고하고, 우리 주제·대본 **핵심 키워드**로 새로 작성하세요.'
      : 'Videos from similar keyword searches. Learn hook angles, line breaks, length, and tone — write fresh copy for our topic/script.',
    lines.join('\n'),
  ].join('\n')
}

function clampReplacement(text: string, max: number): string {
  const t = text.trim()
  if (!max || max < 1) return t
  if (t.length <= max) return t
  return t.slice(0, max).trim()
}

/** variants JSON 파싱 — 첫 variant의 replacements 맵 반환 */
export function parseThumbnailCopywriterVariants(
  raw: string,
  maxByKey: Record<string, number>,
): Record<string, string> {
  const out: Record<string, string> = {}
  const t = raw.trim()
  let parsed: ThumbnailCopywriterResponse | null = null
  try {
    parsed = JSON.parse(t) as ThumbnailCopywriterResponse
  } catch {
    const brace = t.match(/\{[\s\S]*\}/)
    if (brace) {
      try {
        parsed = JSON.parse(brace[0]) as ThumbnailCopywriterResponse
      } catch {
        return out
      }
    }
  }
  const variant = parsed?.variants?.[0] as Record<string, unknown> | undefined

  const collectRep = (key: string, replacement: string) => {
    const k = key.trim()
    if (!k || !replacement.trim()) return
    const max = maxByKey[k] ?? 24
    out[k] = clampReplacement(replacement, max)
  }

  if (variant) {
    for (const frame of (variant.frames as { replacements?: unknown[] }[] | undefined) ?? []) {
      for (const rep of frame.replacements ?? []) {
        if (!rep || typeof rep !== 'object') continue
        const r = rep as Record<string, unknown>
        const key = typeof r.textKey === 'string' ? r.textKey : ''
        const replacement =
          typeof r.replacement === 'string'
            ? r.replacement
            : typeof r.text === 'string'
              ? r.text
              : ''
        collectRep(key, replacement)
      }
    }
    // 슬롯 키가 루트에 직접 온 경우: { "hook": "문구", ... }
    for (const key of Object.keys(maxByKey)) {
      const v = variant[key]
      if (typeof v === 'string' && v.trim() && !out[key]) collectRep(key, v)
    }
  }

  // variants 없이 replacements 배열만 있는 경우
  if (Object.keys(out).length === 0 && parsed && Array.isArray((parsed as { replacements?: unknown }).replacements)) {
    for (const rep of (parsed as unknown as { replacements: unknown[] }).replacements) {
      if (!rep || typeof rep !== 'object') continue
      const r = rep as Record<string, unknown>
      collectRep(typeof r.textKey === 'string' ? r.textKey : '', typeof r.replacement === 'string' ? r.replacement : '')
    }
  }

  const requiredKeys = Object.keys(maxByKey)
  if (requiredKeys.length > 0) {
    const vals = Object.values(out).filter((v) => v.trim())
    requiredKeys.forEach((key, i) => {
      if (!out[key]?.trim() && vals[i]) out[key] = vals[i]
    })
  }

  // 인덱스 순 폴백 (textKey0, slot0 …)
  if (Object.keys(out).length === 0 && variant) {
    const keys = Object.keys(maxByKey)
    const blocks = (variant.textBlocks ?? variant.layers) as unknown
    if (Array.isArray(blocks)) {
      blocks.forEach((b, i) => {
        if (!b || typeof b !== 'object') return
        const r = b as Record<string, unknown>
        const slotKey = keys[i] ?? (typeof r.role === 'string' ? r.role : `slot_${i}`)
        const text =
          typeof r.replacement === 'string'
            ? r.replacement
            : typeof r.text === 'string'
              ? r.text
              : ''
        collectRep(slotKey, text)
      })
    }
  }

  return out
}

/** 슬롯별 글자 수 — 폰트 크기·박스 여부 기반 추정 */
export function estimateMaxCharactersForSlot(fontSize: number, hasBox?: boolean): number {
  if (fontSize >= 90) return 8
  if (fontSize >= 70) return 10
  if (fontSize >= 50) return hasBox ? 12 : 14
  if (fontSize >= 40) return hasBox ? 14 : 16
  return 18
}
