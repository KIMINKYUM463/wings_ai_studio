/**
 * 쇼핑 숏폼 모션그래픽 엔진 (ASS 벡터 드로잉 & 태그 애니메이션)
 * - 원본 영상 픽셀·프레임은 전혀 건드리지 않고 자막 합성(libass) 단계에서 60fps로 매끄럽게 렌더링된다.
 * - 포함 요소:
 *   1) 상단 헤드카피 라운드 백플레이트 + 스윕 언더라인 바 + 오프닝 스타 스파클
 *   2) 자막 탄성 바운스 / 슬라이드 업 모션 순환 + 숫자·혜택 키워드 멀티 하이라이트
 *   3) '첫 번째 / 두 번째...' 포인트 문장 자동 캡슐 배지 (POINT 01, 02...)
 *   4) 핵심 문장 등장 시 마이크로 스파클 버스트 액센트
 *   5) 원본 영상 전환 경계 라이트 스윕 라인 (화면 암전/번쩍임 없이 세련된 전환감)
 *   6) 마지막 CTA 구간 플로팅 행동 유도 캡슐 배지 + 바운스 아이콘
 */
export type MotionBeatInfo = {
  start: number;
  end: number;
  text: string;
  role?: string;
};

export type MotionVideoRect = { x: number; y: number; w: number; h: number };

export type MotionOpts = {
  beatStarts: number[];
  beats?: MotionBeatInfo[];
  streamSwitchTimes?: number[];
  /** 템플릿 안 영상 영역. 없으면 풀스크린(1080×1920)으로 본다 */
  videoRect?: MotionVideoRect;
  /** 모션그래픽 템플릿 (fx-presets.ts). 없으면 full */
  preset?: import('../fx-presets').MotionPreset;
  /** 영상 언어 (해외판). 배지 글자를 그 언어로 */
  lang?: string;
  /** 효과음·모션 조합 번호 (다시 만들기) */
  seed?: number;
};

function t2(sec: number): string {
  const cs = Math.max(0, Math.round(Math.max(0, sec) * 100));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${p(Math.floor((cs % 360000) / 6000))}:${p(Math.floor((cs % 6000) / 100))}.${p(cs % 100)}`;
}

/** #RRGGBB → ASS BGR 색상 문자열 (&HBBGGRR&) */
function bgr(hex: string): string {
  const h = hex.replace('#', '');
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase();
}

/** 직사각형 벡터 패스 (좌상단 0,0 기준) */
const rect = (w: number, h: number) => `m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}`;

/** 둥근 사각형(캡슐/배지) 벡터 패스 (좌상단 0,0 ~ w,h 양수 좌표 → \an7\pos(cx-w/2, cy-h/2)로 정확히 중앙 정렬됨) */
function roundRect(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  const k = Math.round(rad * 0.5523);
  const W = Math.round(w);
  const H = Math.round(h);
  const R = Math.round(rad);
  return [
    `m ${R} 0`,
    `l ${W - R} 0`,
    `b ${W - R + k} 0 ${W} ${R - k} ${W} ${R}`,
    `l ${W} ${H - R}`,
    `b ${W} ${H - R + k} ${W - R + k} ${H} ${W - R} ${H}`,
    `l ${R} ${H}`,
    `b ${R - k} ${H} 0 ${H - R + k} 0 ${H - R}`,
    `l 0 ${R}`,
    `b 0 ${R - k} ${R - k} 0 ${R} 0`,
  ].join(' ');
}

/** 4각 반짝이 스타(✦) 벡터 패스 (좌상단 0,0 ~ 2r,2r 양수 좌표, 중심 r,r) */
function starSparkle(r: number): string {
  const s = Math.round(r);
  const d = s * 2;
  const q = Math.max(2, Math.round(r * 0.24));
  return [
    `m ${s} 0`,
    `b ${s + q} ${s - q} ${s + q} ${s - q} ${d} ${s}`,
    `b ${s + q} ${s + q} ${s + q} ${s + q} ${s} ${d}`,
    `b ${s - q} ${s + q} ${s - q} ${s + q} 0 ${s}`,
    `b ${s - q} ${s - q} ${s - q} ${s - q} ${s} 0`,
  ].join(' ');
}

/** 이미 이스케이프된 자막 텍스트에서 숫자·가격·단위와 핵심 쇼핑 키워드를 강조색으로 입힌다 */
const NUM_SRC = String.raw`\d[\d,.]*(?:\s?(?:만|천|억)(?:\s?\d[\d,.]*\s?(?:천|백)?)?)?\s?(?:원|%|퍼센트|배|개|분|초|시간|일|박|달러|엔|위안|km|kg|L|도|겹|단|가지|위|등)?`;
const WORD_SRC = '무료|특가|할인|반값|완벽|핵심|비결|추천|필수템|필수|꿀잠|간편|초간단|원터치|대박|최고|갓성비|가성비|한\s?번에|순식간에|깔끔하게|깔끔|품절|역대급|신박|꿀템|손쉽게|싹(?![가-힣])|쏙(?![가-힣])|스르륵|끝(?![가-힣])';
/**
 * 자막 강조 조각: 숫자·가격·단위(kind 'num')와 제품을 돋보이게 하는 핵심 단어(kind 'word').
 * 렌더(ASS)와 편집기 미리보기가 같은 규칙을 쓴다.
 */
export function emphasisParts(text: string): { text: string; kind?: 'num' | 'word' }[] {
  const re = new RegExp(`(${NUM_SRC})|(${WORD_SRC})`, 'g');
  const out: { text: string; kind?: 'num' | 'word' }[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0]) { re.lastIndex++; continue; }
    if (m[1] && /^\d$/.test(m[0].trim())) continue; // 숫자 한 글자만은 강조 안 함
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    // 핵심 단어는 줄마다 하나만 (너무 알록달록하지 않게)
    const kind = m[1] ? 'num' : out.some((x) => x.kind === 'word') ? undefined : 'word';
    out.push({ text: m[0], kind });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
/** 핵심 단어 색 (네온 민트) — 글자가 흰색일 때만 쓴다 */
export const EMPHASIS_WORD_HEX = '#5FFBE2';

export function emphasize(escaped: string, color: string, restore: string): string {
  // 숫자 + 단위: 지정 강조색 / 핵심 단어: 네온 민트 (어두운 글자일 땐 숫자만)
  const isLightRestore = /FFFFFF/i.test(restore);
  return emphasisParts(escaped)
    .map((p) => (p.kind === 'num' ? `{\\c${color}}${p.text}{\\c${restore}}` : p.kind === 'word' && isLightRestore ? `{\\c&HE2FB5F&}${p.text}{\\c${restore}}` : p.text))
    .join('');
}

/** 자막 줄 인덱스마다 탄성 팝 / 쫀득한 와이드 팝을 자연스럽게 교차한다 */
export function popTags(index = 0): string {
  const mode = index % 3;
  if (mode === 1) {
    // 가로로 살짝 넓게 펴지며 안착하는 스냅 팝
    return '\\fad(45,0)\\fscx86\\fscy86\\t(0,95,\\fscx106\\fscy104)\\t(95,185,\\fscx100\\fscy100)';
  }
  if (mode === 2) {
    // 임팩트 스탬프 (살짝 크게 등장해 쫀득하게 안착)
    return '\\fad(40,0)\\fscx114\\fscy114\\t(0,115,\\fscx98\\fscy98)\\t(115,190,\\fscx100\\fscy100)';
  }
  return '\\fad(40,0)\\fscx74\\fscy74\\t(0,105,\\fscx107\\fscy107)\\t(105,195,\\fscx100\\fscy100)';
}

export const titlePopTags = () => '\\fad(180,0)\\fscx68\\fscy68\\t(0,240,\\fscx105\\fscy105)\\t(240,350,\\fscx100\\fscy100)';

/** 문장 전환마다 번쩍이던 전체 화이트 플래시는 사용하지 않는다 */
export function flashLines(_beatStarts: number[]): string[] {
  return [];
}

/** 1) 상단 헤드카피 백플레이트 + 스윕 하이라이트 바 + 오프닝 스타 스파클 */
export function headcopyMotionLines(headcopy: [string, string], totalDuration: number): string[] {
  const lines = headcopy.map((h) => h.trim()).filter(Boolean);
  if (!lines.length || totalDuration <= 0.2) return [];

  const maxChars = Math.max(...lines.map((l) => [...l].length));
  const boxW = Math.min(980, Math.max(520, maxChars * 72 + 120));
  const isTwoLine = lines.length >= 2;
  const boxH = isTwoLine ? 248 : 146;
  const centerY = isTwoLine ? 268 : 218;
  const underlineY = centerY + Math.round(boxH / 2) - 18;
  const lineHalfW = Math.round((boxW - 96) / 2);

  const out: string[] = [];

  // 반투명 다크 라운드 백플레이트 (\an5 + 0..w,0..h 양수 패스로 정중앙 일치)
  out.push(
    `Dialogue: 0,${t2(0)},${t2(totalDuration)},Default,,0,0,0,,{\\an5\\pos(540,${centerY})\\bord2\\3c&H40FFFFFF&\\3a&HB8&\\shad0\\1c&H141010&\\1a&H58&\\fad(180,0)\\fscx88\\fscy88\\t(0,240,\\fscx100\\fscy100)\\p1}${roundRect(boxW, boxH, 36)}{\\p0}`,
  );

  // 상단 좌측 코너 골드 포인트 태그 바
  const leftX = Math.round(540 - boxW / 2 + 26);
  const topY = Math.round(centerY - boxH / 2 + 22);
  out.push(
    `Dialogue: 2,${t2(0.08)},${t2(totalDuration)},Default,,0,0,0,,{\\an7\\pos(${leftX},${topY})\\bord0\\shad0\\1c${bgr('#FFE500')}\\fad(120,0)\\p1}${rect(8, 34)}{\\p0}`,
  );

  // 하단 옐로우 네온 언더라인 스윕 애니메이션 (왼쪽 → 오른쪽으로 쫙 그어짐)
  const ulX0 = 540 - lineHalfW;
  const ulX1 = 540 + lineHalfW;
  out.push(
    `Dialogue: 2,${t2(0.12)},${t2(totalDuration)},Default,,0,0,0,,{\\an7\\pos(${ulX0},${underlineY})\\bord0\\shad0\\1c${bgr('#FFE500')}\\clip(${ulX0},${underlineY - 6},${ulX0},${underlineY + 14})\\t(0,380,\\clip(${ulX0},${underlineY - 6},${ulX1},${underlineY + 14}))\\p1}${rect(lineHalfW * 2, 7)}{\\p0}`,
  );

  // 오프닝 0.05~0.75초 양옆 스타 스파클 버스트
  const sparkEnd = Math.min(totalDuration, 0.78);
  const leftSparkX = Math.max(64, Math.round(540 - boxW / 2 - 22));
  const rightSparkX = Math.min(1016, Math.round(540 + boxW / 2 + 22));
  out.push(
    `Dialogue: 4,${t2(0.05)},${t2(sparkEnd)},Default,,0,0,0,,{\\an5\\pos(${leftSparkX},${centerY - 36})\\bord0\\shad0\\1c${bgr('#FFE500')}\\fscx20\\fscy20\\frz0\\t(0,220,\\fscx125\\fscy125\\frz35)\\t(220,680,\\fscx0\\fscy0\\frz90)\\p1}${starSparkle(28)}{\\p0}`,
    `Dialogue: 4,${t2(0.12)},${t2(Math.min(totalDuration, 0.85))},Default,,0,0,0,,{\\an5\\pos(${rightSparkX},${centerY + 24})\\bord0\\shad0\\1c${bgr('#5FFBE2')}\\fscx20\\fscy20\\frz-20\\t(0,220,\\fscx115\\fscy115\\frz25)\\t(220,680,\\fscx0\\fscy0\\frz75)\\p1}${starSparkle(24)}{\\p0}`,
  );

  return out;
}

const STEP_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /첫\s*번째|^1[\s.)]/, label: 'POINT 01' },
  { re: /두\s*번째|^2[\s.)]/, label: 'POINT 02' },
  { re: /세\s*번째|^3[\s.)]/, label: 'POINT 03' },
  { re: /네\s*번째|^4[\s.)]/, label: 'POINT 04' },
  { re: /다섯\s*번째|^5[\s.)]/, label: 'POINT 05' },
];

const CTA_RE = /(댓글|프로필|링크|고정|남겨|확인해|구매|클릭)/;
const HIGHLIGHT_BEAT_RE = /(특가|할인|비결|핵심|완벽|꿀잠|원터치|반값|\d+\s*(%|원|만\s?원|배|초))/;

/** 상품·시연·반전 등 '여기 보세요' 연출이 잘 맞는 비트 역할 */
const FOCUS_ROLES = new Set([
  'product_intro', 'feature', 'reveal', 'proof', 'usage', 'demo', 'twist', 'conflict', 'comparison', 'after',
]);
const FOCUS_TEXT_RE = /(이게|바로|핵심|비결|포인트|여기|보세요|이 부분|한 입|레전드|미쳤|대박|꼭|중요|차이)/;

function isFocusBeat(b: MotionBeatInfo, idx: number, total: number): boolean {
  if (b.role && FOCUS_ROLES.has(b.role)) return true;
  const clean = b.text.replace(/\s+/g, ' ');
  if (FOCUS_TEXT_RE.test(clean) || HIGHLIGHT_BEAT_RE.test(clean)) return true;
  // 중간 구간(도입·마무리 제외)은 한 칸 걸러 시선 유도
  if (idx > 0 && idx < total - 1 && idx % 2 === 1) return true;
  return false;
}

/** 펀치 줌을 걸 타임라인 구간 (핵심 비트만, 최대 5개) */
export function punchZoomWindows(beats: MotionBeatInfo[] | undefined): { start: number; end: number }[] {
  if (!beats?.length) return [];
  const out: { start: number; end: number }[] = [];
  beats.forEach((b, idx) => {
    if (!isFocusBeat(b, idx, beats.length)) return;
    const start = b.start + 0.05;
    const end = Math.min(b.end, b.start + Math.min(2.1, Math.max(0.9, (b.end - b.start) * 0.75)));
    if (end - start < 0.45) return;
    out.push({ start, end });
  });
  return out.slice(0, 5);
}

const FULL_FRAME: MotionVideoRect = { x: 0, y: 0, w: 1080, h: 1920 };

/** CTA 배지 글자: [댓글 유도, 프로필 링크, 기본(상세·구매 링크)] — 해외판은 그 나라 말로 */
const CTA_LABELS: Record<string, [string, string, string]> = {
  ko: ['▶ 지금 댓글 확인하기', '▼ 프로필 링크에서 확인', '★ 상세 정보 · 구매 링크 확인'],
  en: ['▶ Check the comments', '▼ Link in bio', '★ Details · Shop link'],
  ja: ['▶ コメントをチェック', '▼ プロフィールのリンクへ', '★ 詳細・購入リンクはこちら'],
  'zh-TW': ['▶ 快看留言', '▼ 個人簡介連結', '★ 詳情・購買連結'],
  es: ['▶ Mira los comentarios', '▼ Link en el perfil', '★ Detalles · Link de compra'],
  id: ['▶ Cek komentar', '▼ Link di bio', '★ Detail · Link beli'],
  vi: ['▶ Xem bình luận', '▼ Link trong bio', '★ Chi tiết · Link mua hàng'],
  th: ['▶ ดูคอมเมนต์', '▼ ลิงก์ในโปรไฟล์', '★ รายละเอียด · ลิงก์สั่งซื้อ'],
};
const COMMENT_RE = /댓글|comment|コメント|留言|comentario|komentar|bình luận|คอมเมนต์/i;
const PROFILE_RE = /프로필|bio|profile|プロフィール|個人簡介|perfil|โปรไฟล์/i;
export function ctaLabel(text: string, lang = 'ko'): string {
  const [comment, profile, base] = CTA_LABELS[lang] ?? CTA_LABELS.en!;
  return COMMENT_RE.test(text) ? comment : PROFILE_RE.test(text) ? profile : base;
}

/** 배지 위치 (1080×1920 좌표): 영상 영역 위쪽 POINT, 아래쪽 CTA */
export function calloutGeometry(v: MotionVideoRect) {
  return {
    cx: Math.round(v.x + v.w / 2),
    pointY: Math.round(v.y + Math.min(110, v.h * 0.14)),
    ctaY: Math.round(v.y + v.h - Math.min(120, v.h * 0.16)),
    ctaW: Math.min(540, v.w - 60),
  };
}

/** 편집기 미리보기용: 렌더와 같은 규칙으로 정한 CTA·POINT 배지 구간 */
export function motionCallouts(beats: MotionBeatInfo[], ctaOnly = false, lang = 'ko'): { start: number; end: number; kind: 'cta' | 'point'; label: string }[] {
  const out: { start: number; end: number; kind: 'cta' | 'point'; label: string }[] = [];
  beats.forEach((b, idx) => {
    const clean = b.text.replace(/\s+/g, ' ').trim();
    if (b.end <= b.start + 0.18) return;
    const isLast = idx === beats.length - 1;
    const isCta = b.role === 'cta' || CTA_RE.test(clean) || (isLast && beats.length >= 3);
    if (isCta && idx > 0) {
      const label = ctaLabel(clean, lang);
      out.push({ start: b.start, end: b.end, kind: 'cta', label });
      return;
    }
    if (ctaOnly) return;
    const step = STEP_PATTERNS.find((p) => p.re.test(clean));
    if (step) out.push({ start: b.start, end: Math.min(b.end, b.start + 2.2), kind: 'point', label: `✓ ${step.label}` });
  });
  return out;
}

/** 2) 문장별 포인트 스텝 배지(POINT 01~05) + 스파클 액센트 + 마무리 CTA 플로팅 배지 */
export function beatCalloutMotionLines(
  beats: MotionBeatInfo[] | undefined,
  totalDuration: number,
  _captionY = 960,
  ctaOnly = false,
  video: MotionVideoRect = FULL_FRAME,
  lang = 'ko',
): string[] {
  if (!beats?.length) return [];
  const out: string[] = [];
  // 모션그래픽은 영상 영역 안에만 (채널명·제목·대본 자리에는 넣지 않음)
  const { cx, pointY: badgeY, ctaY, ctaW } = calloutGeometry(video);
  const vx = video.x;
  const vw = video.w;

  beats.forEach((b, idx) => {
    const clean = b.text.replace(/\s+/g, ' ').trim();
    const start = b.start;
    const end = Math.min(totalDuration, b.end);
    if (end <= start + 0.18) return;

    const isLast = idx === beats.length - 1;
    const isCta = b.role === 'cta' || CTA_RE.test(clean) || (isLast && beats.length >= 3);

    // A) 마지막 / CTA 문장: 하단 플로팅 행동 유도 캡슐 배지
    if (isCta && idx > 0) {
      const badgeW = ctaW;
      const badgeH = 74;
      const label = ctaLabel(clean, lang);

      out.push(
        // 캡슐 배경 (바이올렛 + 골드 테두리 팝인, 정중앙 정렬)
        `Dialogue: 5,${t2(start)},${t2(end)},Default,,0,0,0,,{\\an5\\move(${cx},${ctaY + 26},${cx},${ctaY},0,180)\\bord3\\3c${bgr('#FFE500')}\\shad4\\4c&H80000000&\\1c${bgr('#5B21B6')}\\fad(100,140)\\fscx80\\fscy80\\t(0,150,\\fscx105\\fscy105)\\t(150,260,\\fscx100\\fscy100)\\p1}${roundRect(badgeW, badgeH, 37)}{\\p0}`,
        // 캡슐 텍스트
        `Dialogue: 6,${t2(start)},${t2(end)},Default,,0,0,0,,{\\an5\\move(${cx},${ctaY + 26},${cx},${ctaY},0,180)\\fnPretendard\\fs38\\b1\\bord0\\shad0\\1c&HFFFFFF&\\fad(100,140)\\fscx80\\fscy80\\t(0,150,\\fscx105\\fscy105)\\t(150,260,\\fscx100\\fscy100)}${label}`,
      );
      return;
    }
    if (ctaOnly) return;

    // B) 순서 포인트 배지 (첫 번째, 두 번째...) — 정중앙 자막 위쪽에 깔끔한 캡슐 팝업
    const matchedStep = STEP_PATTERNS.find((p) => p.re.test(clean));
    if (matchedStep) {
      const badgeEnd = Math.min(end, start + 2.2);
      const y = badgeY;
      out.push(
        `Dialogue: 5,${t2(start)},${t2(badgeEnd)},Default,,0,0,0,,{\\an5\\move(${cx},${y + 20},${cx},${y},0,150)\\bord2\\3c&H00FFFFFF&\\shad3\\4c&H90000000&\\1c${bgr('#111827')}\\1a&H18&\\fad(70,160)\\fscx70\\fscy70\\t(0,130,\\fscx108\\fscy108)\\t(130,220,\\fscx100\\fscy100)\\p1}${roundRect(246, 58, 29)}{\\p0}`,
        `Dialogue: 6,${t2(start)},${t2(badgeEnd)},Default,,0,0,0,,{\\an5\\move(${cx},${y + 20},${cx},${y},0,150)\\fnPretendard\\fs32\\b1\\bord0\\shad0\\1c${bgr('#FFE500')}\\fad(70,160)\\fscx70\\fscy70\\t(0,130,\\fscx108\\fscy108)\\t(130,220,\\fscx100\\fscy100)}✓ ${matchedStep.label}`,
      );
    }

    // C) 핵심 소구점 문장 정중앙 자막 양옆 마이크로 스파클 팝
    if (matchedStep || HIGHLIGHT_BEAT_RE.test(clean) || idx === 0) {
      const spEnd = Math.min(end, start + 0.55);
      out.push(
        `Dialogue: 5,${t2(start + 0.03)},${t2(spEnd)},Default,,0,0,0,,{\\an5\\pos(${vx + 64},${badgeY})\\bord0\\shad0\\1c${bgr('#FFE500')}\\fscx20\\fscy20\\frz0\\t(0,170,\\fscx115\\fscy115\\frz40)\\t(170,480,\\fscx0\\fscy0\\frz85)\\p1}${starSparkle(22)}{\\p0}`,
        `Dialogue: 5,${t2(start + 0.08)},${t2(Math.min(end, start + 0.62))},Default,,0,0,0,,{\\an5\\pos(${vx + vw - 64},${badgeY - 16})\\bord0\\shad0\\1c${bgr('#5FFBE2')}\\fscx20\\fscy20\\frz-15\\t(0,170,\\fscx105\\fscy105\\frz30)\\t(170,480,\\fscx0\\fscy0\\frz70)\\p1}${starSparkle(19)}{\\p0}`,
      );
    }
  });

  return out;
}

export type TransitionStyle = 'zoom' | 'glow' | 'sweep';
export const TRANSITION_IN = 0.14;
export const TRANSITION_OUT = 0.16;
const TRANSITION_STYLES: TransitionStyle[] = ['zoom', 'glow', 'zoom', 'sweep'];
/** 문장 줄마다 시작 시각 (글자 수 비율 — 미리보기 자막과 같은 근사) */
export function lineStarts(b: MotionBeatInfo): { t: number; text: string }[] {
  const lines = b.text.split('\n').map((l) => l.trim()).filter(Boolean);
  const total = lines.reduce((a, l) => a + l.length, 0) || 1;
  let acc = 0;
  return lines.map((l) => { const t = b.start + ((b.end - b.start) * acc) / total; acc += l.length; return { t, text: l }; });
}
const STICKER_RE = /(\d+(?:[.,]\d+)?\s*(?:초|분|시간|배|%|원|만\s?원|개|가지|위|단계|cm|kg|L))/;
/**
 * 추가 모션그래픽 계획 (풀 모션만): 문장(장면)이 바뀔 때마다 화면 전환 + 숫자·수치 줄에 기울어진 스티커 팝.
 * seed 가 바뀌면 전환 모양·색 순서가 달라진다.
 */
export function motionExtras(beats: MotionBeatInfo[], seed = 0) {
  const transitions = beats.slice(1)
    .map((b, i) => ({ t: b.start, style: TRANSITION_STYLES[(i + seed) % TRANSITION_STYLES.length]! }))
    .filter((x) => x.t > 0.3);
  const stickers: { start: number; end: number; label: string; rot: number }[] = [];
  beats.forEach((b, i) => {
    for (const ln of lineStarts(b)) {
      const m = ln.text.match(STICKER_RE);
      if (!m) continue;
      const start = Math.max(b.start + 0.15, ln.t);
      const end = Math.min(b.end, start + 1.3);
      if (end - start > 0.5) stickers.push({ start, end, label: m[1]!.replace(/\s+/g, ''), rot: (i + seed) % 2 ? 7 : -7 });
      break;
    }
  });
  return { transitions, stickers };
}
/** 스티커 자리 (1080×1920): 영상 영역 오른쪽 위 */
export function stickerGeometry(v: MotionVideoRect) {
  return { cx: Math.round(v.x + v.w - Math.min(190, v.w * 0.2)), cy: Math.round(v.y + Math.min(300, v.h * 0.24)) };
}

export type ZoomWindow = { start: number; end: number; amp: number; snap?: boolean };
/** 확대 정도 (0~1): 기본은 부드러운 사인, snap 은 확 들어갔다 잠깐 머물고 빠진다 — 렌더(ffmpeg)·미리보기 같은 식 */
export function zoomEnvelope(w: ZoomWindow, t: number): number {
  if (t < w.start || t >= w.end) return 0;
  const s = Math.sin((Math.PI * (t - w.start)) / (w.end - w.start));
  return w.snap ? Math.min(1, 4 * s) : s;
}
const SNAP_RE = /(이거|이게|바로|딱|진짜|완전|특히|핵심|비결|한\s?번에|그냥|싹|쏙|\d+\s*(초|분|배|%|원|만\s?원|개|가지))/;
/**
 * 줌 모션 (풀 모션): ① 장면이 바뀌는 순간 살짝(7%) 당겼다 놓는 줌 전환
 * ② 문장 중간에 제품을 강조하는 줄이 나오는 순간 '탁' 하고 10% 확대해 잠깐 머무는 스냅 줌 (문장마다 최대 1번)
 */
export function transitionZoomWindows(extras: ReturnType<typeof motionExtras>, beats: MotionBeatInfo[] = []): ZoomWindow[] {
  const out: ZoomWindow[] = extras.transitions.filter((x) => x.style === 'zoom').map((x) => ({ start: x.t - 0.15, end: x.t + 0.22, amp: 0.07 }));
  const cuts = extras.transitions.map((x) => x.t);
  beats.forEach((b, i) => {
    if (i === 0 && b.end < 2) return;
    const hit = lineStarts(b).slice(1).find((l) => SNAP_RE.test(l.text)) ?? (b.end - b.start >= 3 ? lineStarts(b)[Math.floor(lineStarts(b).length / 2)] : undefined);
    if (!hit) return;
    const start = Math.max(hit.t, 1.9);
    const end = Math.min(b.end - 0.25, start + 0.9);
    if (end - start < 0.5 || cuts.some((c) => c > start - 0.4 && c < end + 0.4)) return;
    out.push({ start, end, amp: 0.1, snap: true });
  });
  return out;
}

/** 4) 장면 전환 + 숫자 스티커 ASS */
export function extraMotionLines(beats: MotionBeatInfo[] | undefined, seed = 0, video: MotionVideoRect = FULL_FRAME): string[] {
  if (!beats?.length) return [];
  const { x, y, w, h } = video;
  const out: string[] = [];
  const clip = `\\clip(${x},${y},${x + w},${y + h})`;
  const { transitions, stickers } = motionExtras(beats, seed);
  for (const tr of transitions) {
    const a = tr.t - TRANSITION_IN;
    const ms = Math.round((TRANSITION_IN + TRANSITION_OUT) * 1000);
    const inMs = Math.round(TRANSITION_IN * 1000);
    if (tr.style === 'glow') {
      // 아주 옅은 흰 빛이 번졌다 사라진다 (최대 35%)
      out.push(`Dialogue: 8,${t2(a)},${t2(tr.t + TRANSITION_OUT)},Default,,0,0,0,,{\\an7\\pos(${x},${y})${clip}\\bord0\\shad0\\1c&HFFFFFF&\\1a&HFF&\\t(0,${inMs},\\1a&HA6&)\\t(${inMs},${ms},\\1a&HFF&)\\p1}${rect(w, h)}{\\p0}`);
    } else if (tr.style === 'sweep') {
      // 비스듬한 얇은 빛줄기가 스쳐 지나간다
      out.push(`Dialogue: 8,${t2(a)},${t2(tr.t + TRANSITION_OUT)},Default,,0,0,0,,{\\an7\\move(${x - 200},${y - 100},${x + w + 80},${y - 100},0,${ms})${clip}\\frz-12\\bord0\\shad0\\1c&HFFFFFF&\\1a&H90&\\blur16\\p1}${rect(110, h + 200)}{\\p0}`);
    }
    // zoom 은 영상 자체에 걸린다 (transitionZoomWindows)
  }
  const g = stickerGeometry(video);
  for (const st of stickers) {
    const pop = `\\fscx0\\fscy0\\t(0,160,\\fscx118\\fscy118)\\t(160,260,\\fscx100\\fscy100)\\fad(0,150)\\frz${-st.rot}`;
    const bw = Math.max(200, 60 + st.label.length * 46);
    out.push(
      `Dialogue: 10,${t2(st.start)},${t2(st.end)},Default,,0,0,0,,{\\an5\\pos(${g.cx},${g.cy})${pop}\\bord5\\3c&H000000&\\shad0\\1c${bgr('#FFE500')}\\p1}${roundRect(bw, 112, 30)}{\\p0}`,
      `Dialogue: 11,${t2(st.start)},${t2(st.end)},Default,,0,0,0,,{\\an5\\pos(${g.cx},${g.cy})${pop}\\fnPretendard\\fs72\\b1\\bord0\\shad0\\1c&H000000&}${st.label}`,
    );
  }
  return out;
}

/** 3) 원본 영상이 다음 영상으로 넘어가는 경계에 얇고 세련된 라이트 스윕 라인 연출 */
export function streamSweepMotionLines(switchTimes: number[] | undefined, totalDuration: number, video: MotionVideoRect = FULL_FRAME): string[] {
  const { x, y, w, h } = video;
  if (!switchTimes?.length) return [];
  const out: string[] = [];
  for (const sw of switchTimes) {
    if (sw <= 0.25 || sw >= totalDuration - 0.25) continue;
    const s0 = Math.max(0, sw - 0.11);
    const s1 = Math.min(totalDuration, sw + 0.15);
    // 화면 가로를 빠르게 스쳐 지나가는 얇은 골드·민트 빛줄기 (영상 가림 없음)
    out.push(
      `Dialogue: 7,${t2(s0)},${t2(s1)},Default,,0,0,0,,{\\an5\\move(${x - 180},${y + h / 2},${x + w + 180},${y + h / 2},0,240)\\clip(${x},${y},${x + w},${y + h})\\bord0\\shad0\\1c${bgr('#FFE500')}\\1a&H65&\\blur6\\p1}${rect(140, h)}{\\p0}`,
    );
  }
  return out;
}

/** 하단 진행바는 플레이어 재생바처럼 보이므로 그리지 않는다 */
export function progressBarLine(_total: number, _hex = '#FFE500'): string {
  return '';
}

/** 모션그래픽 전체 묶음 (일반 리믹스·쇼핑 화면용) */
export function buildMotionGraphicsLines(
  opts: { headcopy?: [string, string]; totalDuration: number; motion?: MotionOpts },
): string[] {
  if (!opts.motion) return [];
  return [
    ...(opts.headcopy ? headcopyMotionLines(opts.headcopy, opts.totalDuration) : []),
    ...beatCalloutMotionLines(opts.motion.beats, opts.totalDuration, 960, opts.motion.preset === 'clean', opts.motion.videoRect, opts.motion.lang),
    ...((opts.motion.preset ?? 'full') === 'full' ? extraMotionLines(opts.motion.beats, opts.motion.seed, opts.motion.videoRect) : []),
  ];
}

/** 조각마다 좌우 번갈아 느리게 이동 (호환용 유지) */
export const panDirection = (i: number): 1 | -1 => (i % 2 === 0 ? 1 : -1);

/** Default 스타일이 없는 ASS용 (모션 줄들이 참조) */
export const DEFAULT_STYLE = 'Style: Default,Pretendard,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1';
