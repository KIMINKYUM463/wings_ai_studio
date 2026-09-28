/**
 * 썸네일 편집기 — CTR 패키지(메인 2줄·서브 3개·이미지 프롬프트) 생성.
 */

import { buildThumbnailImageLiteralRulesKo } from './thumbnailScriptLiteralVisual'
import {
  buildThumbnailKoreanCtrCopyStyleBlockKo,
  finalizeCtrThumbnailCopyLines,
  isCtrThumbnailOptionValid,
  sanitizeThumbnailKoreanCopyLine,
} from './thumbnailKoreanCtrCopyStyleKo'

export const YOUTUBE_CTR_THUMBNAIL_SCRIPT_MAX_CHARS = 12_000

export type CtrThumbnailPackageOption = {
  id: string
  angle?: string
  mainLine1: string
  mainLine2: string
  subCopies: [string, string, string]
  imagePromptEn: string
}

export type CtrThumbnailPackageRequest = {
  scriptExcerpt: string
  videoTitle?: string
  topic?: string
  outputLanguage?: string
  /** 생성 옵션 수 (기본 10) */
  count?: number
}

export type CtrThumbnailPackageResponse = {
  options: CtrThumbnailPackageOption[]
}

export function buildYoutubeCtrThumbnailPackageSystemKo(): string {
  return `너는 유튜브 CTR(클릭률) 최적화 전문가이자 100만 구독자 채널의 메인 콘텐츠 전략가다.

제공된 영상 스크립트를 분석하여 시청자가 클릭하지 않고는 못 배길 수준의 유튜브 패키지를 생성하라.

출력해야 하는 것은 다음 3가지다.

1. 썸네일 메인카피(2줄)
2. 썸네일 서브카피 3개
3. 썸네일 이미지 생성 프롬프트

------------------------------------------------------------
썸네일 메인카피
- 반드시 2줄
- 각 줄 4~12자 (2줄은 충격 키워드면 14자까지 허용)
- **mainLine1(위) + mainLine2(아래) = 한 세트** — 1줄은 설정, 2줄은 결론·의문. 서로 다른 주제 금지.
- 2줄은 **「~한 진짜 이유」「~했을까?」「~일까?」** 등 **궁금증 유발** 패턴 적극 사용
- 핵심 키워드를 포함
- 제목을 반복하지 말고 보완할 것
- 모바일에서도 한눈에 읽히게 작성
- **~합니다 / ~입니다 / ~해요 / ~된다 / 2줄의 ~한다 종결 절대 금지** — 명사형·후킹형만
- 잘못된 예: 「인생 망한다」 → 올바른 예: 「인생 망한 진짜 이유」

${buildThumbnailKoreanCtrCopyStyleBlockKo()}

썸네일 서브카피
- 3개 생성
- 3~10자 내외
- 짧고 강렬하게 작성
- 반응·의문·숫자 충격 (ㄷㄷ, ?, ... OK)

예시: 주식 -1000% ㄷㄷ / 일본 개망함? / 결국 터짐

썸네일 이미지 프롬프트
- 영어로 작성
- 제목·대본·썸네일 문구를 **직관적으로** 보여주는 **단일 장면** 1컷
- 강한 감정 표현, 극적인 표정, 높은 대비, 시선 집중 구도, 영화 포스터 수준의 임팩트
- 텍스트 생성 금지
- 프롬프트 마지막에 반드시 아래 문구 포함:
no text, no letters, no words, no logo, no watermark

${buildThumbnailImageLiteralRulesKo()}

생성 규칙
- 10개 옵션 생성
- 각 옵션은 서로 다른 클릭 포인트를 사용 (충격·반전·비밀·몰락·성공·경고·비교·역사적 사실·숫자·미래 예측 등)
- 제목은 설명하지 말고 궁금하게 만들어라.
- 썸네일은 제목을 반복하지 말고 제목의 빈칸을 채워라.
- 제목과 썸네일을 동시에 봤을 때 클릭 욕구가 최대가 되도록 설계하라.
- 평범한 뉴스형 제목, 정보형 제목, 요약형 제목은 절대 금지한다.

출력: 분석·서론 없이 **유효한 JSON 객체 하나만** (마크다운 코드펜스 금지).

JSON 형식:
{
  "options": [
    {
      "id": "opt1",
      "angle": "충격",
      "mainLine1": "결국 밝혀진",
      "mainLine2": "충격의 진실",
      "subCopies": ["소름...", "알고보니", "결국 터짐"],
      "imagePromptEn": "English scene description ... no text, no letters, no words, no logo, no watermark"
    }
  ]
}`
}

export function buildYoutubeCtrThumbnailPackageUserKo(req: CtrThumbnailPackageRequest): string {
  const count = Math.min(10, Math.max(8, req.count ?? 10))
  const script = req.scriptExcerpt.trim()
  const title = req.videoTitle?.trim()
  const topic = req.topic?.trim()

  return [
    title ? `영상 제목:\n${title}` : '',
    topic && topic !== title ? `주제:\n${topic}` : '',
    '',
    '영상 스크립트(우리가 생성한 대본):',
    script,
    '',
    `지시: 위 대본${title ? '·제목' : ''}을 분석해 **정확히 ${count}개** 옵션을 JSON으로 출력하세요.`,
    '- options 배열 길이는 정확히 ' + String(count) + '개.',
    '- 각 옵션마다 mainLine1·mainLine2·subCopies(3개)·imagePromptEn 필수.',
    '- subCopies는 문자열 배열 길이 3.',
    '- mainLine1·mainLine2·subCopies는 **~합니다·~한다·~된다 금지**. 레퍼런스처럼 명사형·후킹형만.',
    '- imagePromptEn은 영어, 마지막에 no text... 문구 포함.',
    '- imagePromptEn은 대본 핵심을 **한눈에 알아볼 수 있는 단일 장면**으로 — 중구난방·무관 스톡 금지.',
    title
      ? '- 썸네일 메인카피는 제목을 반복하지 말고 제목의 빈칸을 채울 것.'
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function pickMainLines(row: Record<string, unknown>): { line1: string; line2: string } {
  const line1 =
    asStr(row.mainLine1) ||
    asStr(row.line1) ||
    asStr(row.main_line_1) ||
    asStr((row.mainCopy as Record<string, unknown> | undefined)?.line1)
  const line2 =
    asStr(row.mainLine2) ||
    asStr(row.line2) ||
    asStr(row.main_line_2) ||
    asStr((row.mainCopy as Record<string, unknown> | undefined)?.line2)
  return { line1, line2 }
}

function pickSubCopies(row: Record<string, unknown>): string[] {
  const raw = row.subCopies ?? row.sub_copies ?? row.subCopy ?? row.sub_copy
  if (Array.isArray(raw)) {
    return raw.map((x) => asStr(x)).filter(Boolean)
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    return [asStr(o.a), asStr(o.b), asStr(o.c)].filter(Boolean)
  }
  return []
}

import { sanitizeThumbnailImagePromptEn } from './thumbnailBackgroundImagePrompt'

function pickImagePrompt(row: Record<string, unknown>): string {
  let p =
    asStr(row.imagePromptEn) ||
    asStr(row.image_prompt_en) ||
    asStr(row.imagePrompt) ||
    asStr(row.image_prompt)
  if (!p) return p
  p = sanitizeThumbnailImagePromptEn(p)
  const suffix = 'no text, no letters, no words, no logo, no watermark'
  if (!p.toLowerCase().includes('no text')) {
    p = `${p.trim()}\n${suffix}`
  }
  return p
}

function clampMainLine(text: string, role: 'line1' | 'line2'): string {
  const t = sanitizeThumbnailKoreanCopyLine(text, role)
  if (!t) return t
  return t.length <= 14 ? t : t.slice(0, 14).trim()
}

function clampSubLine(text: string): string {
  const t = sanitizeThumbnailKoreanCopyLine(text, 'sub')
  if (!t) return t
  return t.length <= 10 ? t : t.slice(0, 10).trim()
}

export function polishCtrThumbnailOption(opt: CtrThumbnailPackageOption): CtrThumbnailPackageOption {
  const finalized = finalizeCtrThumbnailCopyLines(opt.mainLine1, opt.mainLine2, [...opt.subCopies])
  return {
    ...opt,
    ...finalized,
    mainLine1: clampMainLine(finalized.mainLine1, 'line1'),
    mainLine2: clampMainLine(finalized.mainLine2, 'line2'),
    subCopies: [
      clampSubLine(finalized.subCopies[0]),
      clampSubLine(finalized.subCopies[1]),
      clampSubLine(finalized.subCopies[2]),
    ],
  }
}

export function parseCtrThumbnailPackageJson(
  raw: string,
  maxCount = 10,
): CtrThumbnailPackageOption[] {
  const text = stripJsonFence(raw)
  let parsed: { options?: unknown } | null = null
  try {
    parsed = JSON.parse(text) as { options?: unknown }
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as { options?: unknown }
      } catch {
        return []
      }
    }
  }
  if (!Array.isArray(parsed?.options)) return []

  const out: CtrThumbnailPackageOption[] = []
  const seen = new Set<string>()

  for (let i = 0; i < parsed.options.length && out.length < maxCount; i++) {
    const row = parsed.options[i]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const { line1, line2 } = pickMainLines(r)
    if (!line1 || !line2) continue

    const subsRaw = pickSubCopies(r)
    const subs = subsRaw.length >= 3 ? subsRaw : [...subsRaw, 'ㄷㄷ', '소름...', '알고보니'].slice(0, 3)

    const polished = polishCtrThumbnailOption({
      id: asStr(r.id) || `opt${out.length + 1}`,
      angle: asStr(r.angle) || undefined,
      mainLine1: line1,
      mainLine2: line2,
      subCopies: [subs[0] ?? '', subs[1] ?? '', subs[2] ?? ''] as [string, string, string],
      imagePromptEn: pickImagePrompt(r),
    })

    if (!polished.imagePromptEn) continue
    if (!isCtrThumbnailOptionValid(polished)) continue

    const key = `${polished.mainLine1}|${polished.mainLine2}|${polished.subCopies[0]}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push(polished)
  }

  return out
}
