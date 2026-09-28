/**
 * 한국어 유튜브 CTR 썸네일 문구 스타일 — 고조회 레퍼런스 패턴.
 * (2줄 메인 흰색+노랑/빨강, 연두 서브, 명사형·후킹, ~합니다·~한다 금지)
 */

import type { CtrThumbnailPackageOption } from './youtubeCtrThumbnailPackageKo'

export type ThumbnailCopyLineRole = 'line1' | 'line2' | 'sub'

/** 정중체·설명형·평서형 종결 — 썸네일 문구에 쓰면 실패 */
export const THUMBNAIL_COPY_FORBIDDEN_ENDINGS_KO = [
  '합니다',
  '입니다',
  '해요',
  '돼요',
  '됩니다',
  '드립니다',
  '습니다',
  '이에요',
  '예요',
  '할게요',
  '하세요',
  '보세요',
  '알려드',
  '설명',
  '한다',
  '된다',
  '겠다',
  '있었다',
  '없다',
  '였다',
] as const

/** 레퍼런스형 메인 2줄 + 서브 예시 */
export const THUMBNAIL_CTR_COPY_REFERENCE_EXAMPLES_KO = [
  { line1: '미국이 붕괴될 뻔했던', line2: '경제 대공황', sub: '주식 -1000% ㄷㄷ' },
  { line1: '경제 대국, 일본이', line2: '빠르게 무너지는 진짜 이유', sub: '일본 개망함?' },
  { line1: '돈이 증발해버린 날', line2: '미국이 거지된 진짜 이유', sub: '모두 다 실직자? ㄷㄷ' },
  { line1: '이 사람과 엮이면', line2: '인생 망한 진짜 이유', sub: '최악의 관계 ㄷㄷ' },
  { line1: '초등학생도 이해 가능한', line2: 'AI버블의 모든 것', sub: 'AI버블 결국 터짐?' },
  { line1: '평생 파트너 고를 때', line2: "반드시 체크해야 할 '이것'", sub: '연애 1타 공식' },
  { line1: '지구가 탄생한 날', line2: '어떤 일이 일어났을까?', sub: '충돌 1분전..ㄷㄷ' },
  { line1: '한번 빠지면 탈출하기 힘든', line2: '한국 사이비 종교 TOP5', sub: '소름...' },
  { line1: '왜 인도와 중국만', line2: '사람이 엄청 많을까?', sub: '알고보니' },
  { line1: '밤하늘에 숨겨진', line2: '우주의 진짜 얼굴?', sub: '소름...' },
  { line1: '이게 우리가 본', line2: '우주가 아닐까?', sub: '착각? ㄷㄷ' },
  { line1: '블랙홀이 숨긴', line2: '충격적인 진실', sub: '과학계 발칵' },
] as const

/** 1줄+2줄 연결·호기심 유발 패턴 (한국어 CTR) */
export const THUMBNAIL_TWO_LINE_CURIOSITY_PATTERNS_KO = [
  '~한 진짜 이유',
  '~한 이유',
  '~했을까?',
  '~일까?',
  '~뻔했던',
  '~숨겨진',
  '왜 ~일까?',
  '어떤 일이 ~',
] as const

export function buildThumbnailTwoLineCuriosityBlockKo(): string {
  const patterns = THUMBNAIL_TWO_LINE_CURIOSITY_PATTERNS_KO.map((p) => `- ${p}`).join('\n')
  return `[1줄+2줄 연결 규칙 — 필수]
- **위 줄(1줄) = 설정·조건·상황**, **아래 줄(2줄) = 핵심·결론·의문** — 반드시 **한 가지 이야기**로 이어질 것.
- 1줄만, 2줄만 따로 읽어도 맥락이 통하고, **합치면 완전한 호기심**이 되게.
- 2줄은 꼭 **궁금증**을 남길 것 — 평서 설명 금지.
- 권장 2줄 패턴:
${patterns}
- 좋은 예: 「미국이 붕괴될 뻔했던」→「경제 대공황」 / 「지구가 탄생한 날」→「어떤 일이 일어났을까?」 / 「밤하늘에 숨겨진」→「우주의 진짜 얼굴?」
- 나쁜 예: 1줄과 2줄 **주제 불일치**, 2줄이 「~한다」「~됩니다」 평서형, 서로 **무관한 키워드 나열**`
}

const DECLARATIVE_END_RE =
  /(?:한다|된다|겠다|있었다|없다|였다|할것이다|일것이다|인것이다)\.?$/u

/** 2줄 하단·서브 — 평서형 「~한다」 금지. 1줄은 「~하면」「~때」 허용 */
export function hasDeclarativeVerbEndingKo(text: string, role: ThumbnailCopyLineRole): boolean {
  const t = text.trim()
  if (!t) return false
  if (role === 'line1') {
    if (/(?:한다|된다|겠다)\.?$/u.test(t) && !/(?:하면|일때|될때|할때)\.?$/u.test(t)) return true
    return false
  }
  return DECLARATIVE_END_RE.test(t)
}

export function buildThumbnailKoreanCtrCopyStyleBlockKo(): string {
  const examples = THUMBNAIL_CTR_COPY_REFERENCE_EXAMPLES_KO.slice(0, 7)
    .map(
      (e, i) =>
        `  예 ${i + 1}) 1줄: ${e.line1}\n      2줄: ${e.line2}\n      서브: ${e.sub}`,
    )
    .join('\n')

  const forbidden = THUMBNAIL_COPY_FORBIDDEN_ENDINGS_KO.map((w) => `- 「~${w}」`).join('\n')

  return `------------------------------------------------------------
[한국 고CTR 썸네일 문구 스타일 — 반드시 준수]

메인카피 2줄 (하단 대형 자막)
- 1줄: 맥락·조건·대상 (4~12자). 「~하면」「~때」「~뻔했던」「~숨겨진」 등 **끊긴 설정** OK.
- 2줄: **1줄과 반드시 연결** — 충격·핵심·호기심 (4~14자). **「~한 진짜 이유」「~했을까?」「~일까?」** 적극 사용.
- 1줄+2줄 = 시청자가 「뭐지?」 하고 클릭하는 **한 세트** (서로 다른 주제 금지).
- 2줄 **절대 금지**: 「인생 망한다」「이렇게 된다」 같은 **평서형 ~한다 / ~된다** 문장.
- 2줄 **올바른 예**: 「인생 망한 진짜 이유」「경제 대공황」「빠르게 무너지는 진짜 이유」「어떤 일이 일어났을까?」
- **절대 금지 종결**:
${forbidden}
- 뉴스 요약·교과서·설명문 금지.

${buildThumbnailTwoLineCuriosityBlockKo()}

서브카피 3개 — 짧은 반응·의문 (3~10자). ㄷㄷ, ?, ... OK.

레퍼런스 (그대로 복사 금지):
${examples}`
}

/** 평서형 ~한다 등을 명사형 후킹으로 자동 교정 */
export function rewriteDeclarativeThumbnailCopyKo(
  text: string,
  role: ThumbnailCopyLineRole,
): string {
  let t = text.trim()
  if (!t) return t

  const replacements: [RegExp, string][] = [
    [/인생\s*망한다\.?$/u, '인생 망한 이유'],
    [/망한다\.?$/u, '망한 이유'],
    [/망된다\.?$/u, '망하는 이유'],
    [/된다\.?$/u, '되는 이유'],
    [/한다\.?$/u, '한 이유'],
    [/겠다\.?$/u, ''],
    [/있었다\.?$/u, ''],
    [/없다\.?$/u, ''],
  ]

  if (role !== 'line1' || DECLARATIVE_END_RE.test(t)) {
    for (const [re, rep] of replacements) {
      if (re.test(t)) {
        t = t.replace(re, rep).trim()
        break
      }
    }
  }

  return t
}

/** 생성된 문구에서 정중체·평서형 톤 제거 */
export function sanitizeThumbnailKoreanCopyLine(
  text: string,
  role: ThumbnailCopyLineRole = 'line2',
): string {
  let t = text.trim().replace(/^["'`「『]+|["'`」』]+$/g, '')
  if (!t) return t

  t = t
    .replace(/알려드립니다\.?/gi, '')
    .replace(/설명합니다\.?/gi, '')
    .replace(/소개합니다\.?/gi, '')
    .trim()

  const politeEndings: [RegExp, string][] = [
    [/합니다\.?$/u, ''],
    [/입니다\.?$/u, ''],
    [/해요\.?$/u, ''],
    [/돼요\.?$/u, ''],
    [/됩니다\.?$/u, ''],
    [/드립니다\.?$/u, ''],
    [/습니다\.?$/u, ''],
    [/이에요\.?$/u, ''],
    [/예요\.?$/u, ''],
    [/할게요\.?$/u, ''],
    [/하세요\.?$/u, ''],
    [/보세요\.?$/u, ''],
  ]

  for (const [re, rep] of politeEndings) {
    if (re.test(t)) {
      t = t.replace(re, rep).trim()
      break
    }
  }

  t = rewriteDeclarativeThumbnailCopyKo(t, role)
  return t.trim()
}

export function isForbiddenThumbnailCopyToneKo(
  text: string,
  role: ThumbnailCopyLineRole = 'line2',
): boolean {
  const t = text.trim()
  if (!t) return true

  if (/합니다|입니다|해요|됩니다|드립니다|습니다|하세요|보세요|알려드|설명합니다/.test(t)) {
    return true
  }

  if (hasDeclarativeVerbEndingKo(t, role)) return true

  for (const w of THUMBNAIL_COPY_FORBIDDEN_ENDINGS_KO) {
    if (t.endsWith(w) && w.length >= 2) return true
  }

  return false
}

export function finalizeCtrThumbnailCopyLines(
  mainLine1: string,
  mainLine2: string,
  subCopies: string[],
): { mainLine1: string; mainLine2: string; subCopies: [string, string, string] } {
  const l1 = sanitizeThumbnailKoreanCopyLine(mainLine1, 'line1')
  let l2 = sanitizeThumbnailKoreanCopyLine(mainLine2, 'line2')
  if (isForbiddenThumbnailCopyToneKo(l2, 'line2') && /망|최악|위험|파국/.test(l2 + l1)) {
    l2 = l2.replace(/한다\.?$/u, '').trim()
    if (!l2 || isForbiddenThumbnailCopyToneKo(l2, 'line2')) l2 = '망한 진짜 이유'
  }
  const subs = subCopies
    .slice(0, 3)
    .map((s) => sanitizeThumbnailKoreanCopyLine(s, 'sub'))
    .filter((s) => s && !isForbiddenThumbnailCopyToneKo(s, 'sub'))

  while (subs.length < 3) subs.push(subs.length === 0 ? 'ㄷㄷ' : subs.length === 1 ? '소름...' : '알고보니')

  return {
    mainLine1: l1,
    mainLine2: l2,
    subCopies: [subs[0]!, subs[1]!, subs[2]!],
  }
}

export function isCtrThumbnailOptionValid(opt: CtrThumbnailPackageOption): boolean {
  if (!opt.mainLine1.trim() || !opt.mainLine2.trim()) return false
  if (isForbiddenThumbnailCopyToneKo(opt.mainLine1, 'line1')) return false
  if (isForbiddenThumbnailCopyToneKo(opt.mainLine2, 'line2')) return false
  if (opt.subCopies.some((s) => !s.trim() || isForbiddenThumbnailCopyToneKo(s, 'sub'))) return false
  if (!opt.imagePromptEn.trim()) return false
  return true
}

export function buildThumbnailCtrCopyVerifySystemKo(): string {
  return `당신은 한국 유튜브 CTR 썸네일 **검수·교정** 전문가다.
입력된 썸네일 패키지가 규칙을 어기면 **대본·제목에 맞게** 고쳐 JSON으로만 출력한다.

검수 규칙 (위반 시 반드시 수정):
1. mainLine2·subCopies에 「~한다」「~된다」「~합니다」「~입니다」 **절대 금지**.
2. 2줄은 레퍼런스처럼 명사형·의문형·TOP·숫자 후킹 (예: 「망한 진짜 이유」「경제 대공황」「~할까?」).
3. 「인생 망한다」→「인생 망한 이유」처럼 **평서형을 명사형**으로 바꿀 것.
4. mainLine1+mainLine2가 **한 호흡·한 이야기**로 이어지고, 2줄에 **~한 진짜 이유 / ~했을까? / ~일까?** 등 호기심 패턴을 쓸 것.
5. subCopies 3개 — 짧은 반응·의문 (ㄷㄷ, ? OK).
6. imagePromptEn — **영어**. mainLine·sub·대본 핵심과 **직관적으로 맞는 단일 장면** 1컷. 무관한 궁전·우주·스톡 인물 금지.
7. imagePromptEn 끝: no text, no letters, no words, no logo, no watermark

출력: JSON 하나만. { "mainLine1", "mainLine2", "subCopies": [3개], "imagePromptEn", "fixes": ["수정 요약"] }`
}

export function buildThumbnailCtrCopyVerifyUserKo(opts: {
  scriptExcerpt: string
  videoTitle?: string
  option: CtrThumbnailPackageOption
}): string {
  const o = opts.option
  return [
    opts.videoTitle?.trim() ? `영상 제목: ${opts.videoTitle.trim()}` : '',
    '',
    '대본:',
    opts.scriptExcerpt.trim().slice(0, 4000),
    '',
    '검수·교정할 패키지:',
    JSON.stringify(
      {
        mainLine1: o.mainLine1,
        mainLine2: o.mainLine2,
        subCopies: o.subCopies,
        imagePromptEn: o.imagePromptEn,
      },
      null,
      2,
    ),
    '',
    buildThumbnailKoreanCtrCopyStyleBlockKo(),
    '',
    '위 패키지를 규칙에 맞게 고친 JSON만 출력하세요. 특히 ~한다·~됩니다 톤이 있으면 반드시 명사형 후킹으로 바꾸세요.',
    'imagePromptEn은 고친 mainLine·대본 내용과 **같은 장면**이 보이게 다시 쓰세요.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseCtrThumbnailVerifyJson(
  raw: string,
  fallback: CtrThumbnailPackageOption,
): CtrThumbnailPackageOption {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as Record<string, unknown>
      } catch {
        return fallback
      }
    }
  }
  if (!parsed) return fallback

  const subs = Array.isArray(parsed.subCopies)
    ? parsed.subCopies.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
    : [...fallback.subCopies]

  const finalized = finalizeCtrThumbnailCopyLines(
    typeof parsed.mainLine1 === 'string' ? parsed.mainLine1 : fallback.mainLine1,
    typeof parsed.mainLine2 === 'string' ? parsed.mainLine2 : fallback.mainLine2,
    subs.length >= 3 ? subs : [...fallback.subCopies],
  )

  let imagePromptEn =
    typeof parsed.imagePromptEn === 'string' && parsed.imagePromptEn.trim()
      ? parsed.imagePromptEn.trim()
      : fallback.imagePromptEn
  if (!imagePromptEn.toLowerCase().includes('no text')) {
    imagePromptEn += '\nno text, no letters, no words, no logo, no watermark'
  }

  return {
    id: fallback.id,
    angle: fallback.angle,
    ...finalized,
    imagePromptEn,
  }
}
