/**
 * 광고·제휴 표기 (공정위 추천·보증 심사지침: 경제적 대가가 있으면 '제목 또는 첫 부분'에 명확히 표시)
 * + AI 생성 영상 표기 (2026.4 행정예고된 개정안: AI 가상인물 추천은 가상인물임을 표시)
 * 법률 자문이 아니라 보수적인 기본값이다. 문구는 화면에서 고칠 수 있다.
 */
export type Affiliate = 'none' | 'coupang' | 'youtube' | 'naver' | 'sponsored' | 'other';

export const AFFILIATES: { id: Affiliate; name: string }[] = [
  { id: 'none', name: '광고·제휴 아님' },
  { id: 'coupang', name: '쿠팡 파트너스' },
  { id: 'youtube', name: '유튜브 쇼핑 제휴' },
  { id: 'naver', name: '네이버 쇼핑커넥트 등 제휴' },
  { id: 'sponsored', name: '협찬·유료광고 (업체에서 대가 받음)' },
  { id: 'other', name: '기타 제휴 링크' },
];

/** 설명란·고정댓글 첫 줄에 넣는 문구 */
export function disclosureText(a: Affiliate): string {
  switch (a) {
    case 'coupang': return '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
    case 'youtube': return '이 영상은 유튜브 쇼핑 제휴 프로그램 참여 영상으로, 제품 링크로 구매 시 수수료를 받을 수 있습니다.';
    case 'naver': return '이 영상은 제휴 마케팅 활동의 일환으로, 링크를 통해 구매 시 수수료를 받을 수 있습니다.';
    case 'sponsored': return '이 영상은 업체로부터 제품 또는 대가를 제공받아 제작된 유료 광고입니다.';
    case 'other': return '이 영상에는 제휴 링크가 포함되어 있으며, 링크로 구매 시 수수료를 받을 수 있습니다.';
    default: return '';
  }
}

/** 제목 맨 앞 머리표 */
export const titlePrefix = (a: Affiliate) => (a === 'none' ? '' : a === 'sponsored' ? '[유료광고] ' : '[광고] ');

/** 화면 표기 문구 (짧게) */
export function onScreenText(a: Affiliate): string {
  if (a === 'none') return '';
  if (a === 'coupang') return '광고 · 쿠팡 파트너스 활동으로 수수료를 받을 수 있음';
  if (a === 'sponsored') return '유료광고 · 업체로부터 대가를 받아 제작';
  return '광고 · 제휴 링크로 구매 시 수수료를 받을 수 있음';
}

/** 해외판 화면 표기 (미국 FTC 등도 '광고' 명시를 요구 → 짧은 현지어) */
const TAGS: Record<string, { ad: string; paid: string; ai: string; banner: string }> = {
  ko: { ad: '광고', paid: '유료광고', ai: 'AI 생성 영상 포함', banner: '' },
  en: { ad: 'Ad', paid: 'Paid partnership', ai: 'Contains AI-generated footage', banner: 'Ad · I may earn a commission from links' },
  ja: { ad: '広告', paid: 'PR', ai: 'AI生成映像を含む', banner: '広告 · リンク経由の購入で報酬を受け取る場合があります' },
  'zh-TW': { ad: '廣告', paid: '業配', ai: '含 AI 生成影像', banner: '廣告 · 透過連結購買我可能獲得佣金' },
  es: { ad: 'Publicidad', paid: 'Colaboración pagada', ai: 'Incluye video generado con IA', banner: 'Publicidad · Puedo ganar comisión por los enlaces' },
  id: { ad: 'Iklan', paid: 'Kemitraan berbayar', ai: 'Berisi video buatan AI', banner: 'Iklan · Saya bisa dapat komisi dari tautan' },
  vi: { ad: 'Quảng cáo', paid: 'Hợp tác có trả phí', ai: 'Có video tạo bằng AI', banner: 'Quảng cáo · Tôi có thể nhận hoa hồng từ liên kết' },
  th: { ad: 'โฆษณา', paid: 'ได้รับค่าตอบแทน', ai: 'มีวิดีโอที่สร้างด้วย AI', banner: 'โฆษณา · อาจได้รับค่าคอมมิชชันจากลิงก์' },
};
const tags = (lang?: string) => TAGS[lang ?? 'ko'] ?? TAGS.en;

/** 업로드 문구용 표기 (해외판이면 현지어) */
export function localDisclosure(a: Affiliate, lang?: string): { line: string; prefix: string; linkLabel: string; profile: string } {
  if (!lang || lang === 'ko') return { line: disclosureText(a), prefix: titlePrefix(a), linkLabel: '구매 링크', profile: '프로필 링크' };
  const tg = tags(lang);
  if (a === 'none') return { line: '', prefix: '', linkLabel: 'Link', profile: 'link in bio' };
  return { line: a === 'sponsored' ? tg.paid : tg.banner, prefix: `[${a === 'sponsored' ? tg.paid : tg.ad}] `, linkLabel: 'Link', profile: 'link in bio' };
}

function t2(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${p(Math.floor((cs % 360000) / 6000))}:${p(Math.floor((cs % 6000) / 100))}.${p(cs % 100)}`;
}

/**
 * ASS 이벤트 줄: 첫 3초 상단 배너 + 영상 내내 왼쪽 아래 작은 '광고' 태그, AI 영상이 있으면 'AI 생성 영상 포함' 태그.
 * 'Default' 스타일(모션 모듈)이 있어야 한다 — 두 자막 빌더 모두 포함함.
 */
export function disclosureLines(o: { affiliate: Affiliate; text?: string; aiUsed: boolean; total: number; lang?: string }): string[] {
  const out: string[] = [];
  const tg = tags(o.lang);
  const foreign = !!o.lang && o.lang !== 'ko';
  const defaultBanner = o.affiliate === 'none' ? '' : foreign ? tg.banner : onScreenText(o.affiliate);
  const banner = (foreign ? defaultBanner : (o.text?.trim() || defaultBanner)).replace(/[{}\\]/g, '');
  if (banner) {
    const end = Math.min(3, o.total);
    // BorderStyle 3 대신 반투명 사각형을 직접 그린다 (스타일 영향 안 받게)
    out.push(`Dialogue: 10,${t2(0)},${t2(end)},Default,,0,0,0,,{\\an7\\pos(40,1700)\\bord0\\shad0\\1c&H000000&\\1a&H50&\\p1\\fad(150,200)}m 0 0 l 1000 0 l 1000 92 l 0 92{\\p0}`);
    out.push(`Dialogue: 11,${t2(0)},${t2(end)},Default,,0,0,0,,{\\an8\\pos(540,1724)\\fs34\\b1\\bord0\\shad0\\1c&HFFFFFF&\\fad(150,200)}${banner}`);
  }
  out.push(`Dialogue: 12,${t2(0)},${t2(o.total)},Default,,0,0,0,,{\\an9\\pos(1048,40)\\fs40\\b1\\bord3\\shad0\\1c&HFFFFFF&\\3c&H000000&}[${adLabel(o.affiliate, o.lang)}]`);
  if (o.aiUsed) {
    out.push(`Dialogue: 11,${t2(0)},${t2(o.total)},Default,,0,0,0,,{\\an1\\pos(28,1888)\\fs28\\b1\\bord3\\shad0\\1c&HFFFFFF&\\3c&H000000&\\1a&H20&}${tg.ai}`);
  }
  return out;
}

/** 우측 상단 [광고] 표기 문구 (미리보기·렌더 공통) */
export const adLabel = (a: string, lang?: string) => (a === 'sponsored' ? tags(lang).paid : tags(lang).ad);

/** 완성된 ASS 문자열 끝(Events)에 표기 줄을 덧붙인다 */
export const withDisclosure = (ass: string, lines: string[]) => (lines.length ? `${ass.replace(/\n*$/, '\n')}${lines.join('\n')}\n` : ass);
