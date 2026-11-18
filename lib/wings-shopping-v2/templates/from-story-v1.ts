/**
 * 버전1 스토리 프레임 템플릿(STORY_FRAME_TEMPLATES, app/WingsAIStudioShotForm/story-shopping/StoryChannelFrame.tsx)을
 * 버전2 ASS 렌더용 Template 문법으로 옮긴다.
 * v1 의 FrameHeader(채널 헤더) · StoryPostPanel(제목·메타·구분선) · StoryCaptionPanel(자막 띠) 모양을 variant 별로 그대로 따른다.
 * 좌표는 1080x1920 기준 (v1 의 1cqw = 10.8px).
 */
import type { CaptionStyle, IconName, Layer, Template, TextSlot, TextStyle } from './types';

type Variant =
  | 'shop' | 'search' | 'pill' | 'minimal' | 'star' | 'community' | 'knowledge' | 'dark' | 'story' | 'magazine' | 'profile'
  | 'emotion' | 'cinema' | 'heart' | 'essay' | 'impact' | 'review' | 'board' | 'hot' | 'best-comment' | 'chat' | 'office'
  | 'breaking' | 'webtoon' | 'diary' | 'fullbleed';

/** v1 ShopHeaderStyle (nameFont 은 번들 글꼴 중 가장 비슷한 것으로) */
type Shop = {
  layout?: 'center' | 'menu-search' | 'wings-note';
  icon?: IconName;
  badge?: string;
  iconRight?: boolean;
  font?: string;
  nameCqw?: number;
  postMeta?: boolean;
  clock?: boolean;
  ad?: boolean;
};

type V1Frame = { id: string; name: string; description: string; color: string; foreground?: string; v: Variant; shop?: Shop };

/** v1 StoryChannelFrame 목록과 같은 id·이름·색·variant·shop 옵션 */
const V1_FRAMES: V1Frame[] = [
  { id: 'channel-wings-search', name: '윙스 메모장 · 검색', description: '수동 제작 템플릿 · 주황 상단바', color: '#FC5230', foreground: '#1a1a1a', v: 'shop', shop: { layout: 'wings-note', icon: 'magnifier', clock: true } },
  { id: 'channel-wings-profile', name: '윙스 메모장 · 프로필', description: '수동 제작 템플릿 · 노란 상단바', color: '#FFCD4A', foreground: '#1a1a1a', v: 'shop', shop: { layout: 'wings-note', icon: 'user', clock: true } },
  { id: 'channel-wings-cart', name: '윙스 메모장 · 장바구니', description: '수동 제작 템플릿 · 파란 상단바', color: '#18A8F1', foreground: '#1a1a1a', v: 'shop', shop: { layout: 'wings-note', icon: 'cart', clock: true } },
  { id: 'channel-wings-arrow', name: '윙스 메모장 · 화살표', description: '수동 제작 템플릿 · 호박색 상단바', color: '#FD9F28', foreground: '#1a1a1a', v: 'shop', shop: { layout: 'wings-note', icon: 'arrowRight', clock: true } },
  { id: 'channel-wings-home', name: '윙스 메모장 · 홈', description: '수동 제작 템플릿 · 민트 상단바', color: '#82CBC4', foreground: '#1a1a1a', v: 'shop', shop: { layout: 'wings-note', icon: 'home', clock: true } },
  { id: 'channel-shop-green', name: '썰쇼핑 그린형', description: '선물가게 스타일 · 연두 헤더', color: '#9fd36d', foreground: '#1d3510', v: 'shop' },
  { id: 'channel-shop-orange', name: '썰쇼핑 오렌지형', description: '수상한상점 스타일 · 주황 헤더', color: '#f6a03b', foreground: '#ffffff', v: 'shop' },
  { id: 'channel-shop-white', name: '썰쇼핑 화이트형', description: '신사들 스타일 · 흰 헤더', color: '#ffffff', foreground: '#111111', v: 'shop', shop: { icon: 'store' } },
  // Jua(둥근 고딕) → 배민 도현체
  { id: 'channel-shop-navy', name: '썰쇼핑 네이비 배지형', description: '남색 헤더', color: '#1f3a72', foreground: '#ffffff', v: 'shop', shop: { icon: 'smile', badge: '#ffffff', font: 'Do Hyeon' } },
  { id: 'channel-shop-yellow', name: '썰쇼핑 옐로 메뉴형', description: '샛노랑 앱 헤더', color: '#ffe100', foreground: '#111111', v: 'shop', shop: { layout: 'menu-search', nameCqw: 5.6, postMeta: true } },
  { id: 'channel-shop-tomato', name: '썰쇼핑 토마토형', description: '주홍 헤더', color: '#e8572b', foreground: '#1a1a1a', v: 'shop', shop: { icon: 'smile', badge: '#fff4e0', iconRight: true, font: 'Do Hyeon', nameCqw: 7.4, postMeta: true } },
  { id: 'channel-shop-forest', name: '썰쇼핑 포레스트형', description: '짙은 초록 헤더', color: '#4c7a43', foreground: '#fff6c8', v: 'shop', shop: { icon: 'cookie', badge: '#fff6c8', font: 'Do Hyeon', nameCqw: 7.4 } },
  // Song Myung(명조)은 번들에 없어 기본 글꼴
  { id: 'channel-shop-lime', name: '썰쇼핑 라임 명조형', description: '라임 앱 헤더', color: '#bdf46c', foreground: '#111111', v: 'shop', shop: { layout: 'menu-search', nameCqw: 6, postMeta: true } },
  { id: 'channel-shop-ad', name: '썰쇼핑 광고표기형', description: '흰 헤더 · 제휴 영상용', color: '#ffffff', foreground: '#111111', v: 'shop', shop: { icon: 'crown', badge: '#f2c14e', nameCqw: 5.4, postMeta: true, ad: true } },
  // Black Han Sans → 티몬 몬소리
  { id: 'channel-shop-mint', name: '썰쇼핑 민트 대제목형', description: '연민트 헤더', color: '#dcf2cf', foreground: '#111111', v: 'shop', shop: { font: 'TmonMonsori Black', nameCqw: 8.4 } },
  { id: 'channel-fullbleed', name: '풀화면 자막형', description: '검은 상단 띠 + 풀스크린 자막', color: '#111111', foreground: '#ffffff', v: 'fullbleed' },
  { id: 'channel-search', name: '검색 바형', description: '뒤로가기·검색·메뉴', color: '#f7cf68', v: 'search' },
  { id: 'channel-pill', name: '중앙 검색형', description: '강한 노란색 채널 헤더', color: '#ffc400', v: 'pill' },
  { id: 'channel-minimal', name: '미니멀형', description: '차분한 크림색 헤더', color: '#f6e8bf', v: 'minimal' },
  { id: 'channel-star', name: '즐겨찾기형', description: '파란색 헤더와 별 아이콘', color: '#8bc8ef', v: 'star' },
  { id: 'channel-red', name: '커뮤니티형', description: '댓글을 강조한 빨간 헤더', color: '#d83e3e', foreground: '#ffffff', v: 'community' },
  { id: 'channel-green', name: '지식 채널형', description: '연두색 정보형 헤더', color: '#add484', v: 'knowledge' },
  { id: 'channel-dark', name: '다크 다큐형', description: '검정 헤더', color: '#20242b', foreground: '#ffffff', v: 'dark' },
  { id: 'channel-purple', name: '퍼플 스토리형', description: '반전·사연용 보라 헤더', color: '#7656d6', foreground: '#ffffff', v: 'story' },
  { id: 'channel-orange', name: '오렌지 매거진형', description: '매거진형 주황 헤더', color: '#f28b38', foreground: '#ffffff', v: 'magazine' },
  { id: 'channel-mint', name: '민트 라이프형', description: '생활·건강 산뜻한 헤더', color: '#79d7c4', v: 'profile' },
  { id: 'channel-lavender', name: '라벤더 감성형', description: '공감·힐링 감성형', color: '#c7b7ef', v: 'emotion' },
  { id: 'channel-navy', name: '네이비 시네마형', description: '몰입형 네이비 헤더', color: '#243b64', foreground: '#ffffff', v: 'cinema' },
  { id: 'channel-pink', name: '핑크 공감형', description: '관계·후기 따뜻한 헤더', color: '#f3a6b8', v: 'heart' },
  { id: 'channel-paper', name: '페이퍼 에세이형', description: '기록·에세이 분위기', color: '#e8dfcf', v: 'essay' },
  { id: 'channel-neon', name: '네온 임팩트형', description: '첫 3초 훅 강조', color: '#c9f43b', v: 'impact' },
  { id: 'channel-review', name: '리뷰 인증형', description: '실사용 후기·신뢰', color: '#0f9f7a', foreground: '#ffffff', v: 'review' },
  { id: 'channel-board', name: '익명 게시판형', description: '사연 게시판 구성', color: '#23a6a8', foreground: '#ffffff', v: 'board' },
  { id: 'channel-hot', name: '포텐 커뮤니티형', description: '실시간 인기글', color: '#2563a8', foreground: '#ffffff', v: 'hot' },
  { id: 'channel-best-comment', name: '댓글 베스트형', description: '댓글 반응 강조', color: '#f05a47', foreground: '#ffffff', v: 'best-comment' },
  { id: 'channel-chat', name: '메신저 대화형', description: '대화 썰 채팅형', color: '#f7dc48', v: 'chat' },
  { id: 'channel-office', name: '직장인 익명형', description: '회사·퇴사 사연', color: '#ef6c35', foreground: '#ffffff', v: 'office' },
  { id: 'channel-breaking', name: '속보 이슈형', description: '긴급 반전 강조', color: '#c9252d', foreground: '#ffffff', v: 'breaking' },
  { id: 'channel-webtoon', name: '웹툰 말풍선형', description: '캐릭터 사연', color: '#8b5cf6', foreground: '#ffffff', v: 'webtoon' },
  { id: 'channel-diary', name: '1인칭 일기형', description: '감동·고백 기록형', color: '#d9c7a5', v: 'diary' },
];

const W = 1080;
const DARK = '#111111';
/** 헤더 좌우 아이콘 중심 x (px-[5%] + 아이콘 6.5cqw 의 절반) */
const IL = 89;
const IR = W - IL;
/** 채널명 글자 크기는 v1 px ÷ 1.5 — 기본 채널명 배율(150%)에서 v1 과 같은 크기 */
const CH = 1 / 1.5;
/** v1 AutoFitTitle 최대 5cqw(54px) 보다 살짝 크게 */
const TITLE = 58;
const VIDEO_H = 960;
const FULL_VIDEO = { x: 0, y: 0, w: 1080, h: 1920 };

const rect = (x: number, y: number, w: number, h: number, color: string, alpha?: number): Layer => ({ kind: 'rect', x, y, w, h, color, ...(alpha ? { alpha } : {}) });
const rr = (x: number, y: number, w: number, h: number, r: number, color: string, o: { alpha?: number; border?: number; borderColor?: string } = {}): Layer => ({ kind: 'rrect', x, y, w, h, r, color, ...o });
const ic = (name: IconName, x: number, y: number, color: string, o: { size?: number; stroke?: number; fill?: boolean } = {}): Layer => ({
  kind: 'icon', name, x, y, size: o.size ?? 70, color, stroke: o.stroke ?? 3, ...(o.fill ? { fill: true } : {}),
});
const tx = (slot: TextSlot, x: number, y: number, align: 4 | 5 | 6, style: TextStyle, maxWidth?: number): Layer => ({ kind: 'text', slot, x, y, align, style, ...(maxWidth ? { maxWidth } : {}) });
const st = (s: string): TextSlot => ({ static: s });
const stats = (s: string): TextSlot => ({ stats: s });
/** 채널명 (px = v1 화면 기준 글자 크기) */
const name = (x: number, y: number, px: number, color: string, o: { align?: 4 | 5 | 6; maxWidth?: number; font?: string; spacing?: number; italic?: boolean } = {}): Layer =>
  tx('channel', x, y, o.align ?? 5, {
    size: Math.round(px * CH), color, bold: true,
    ...(o.font ? { font: o.font } : {}), ...(o.spacing ? { spacing: o.spacing } : {}), ...(o.italic ? { italic: true } : {}),
  }, o.maxWidth ?? 760);
const title = (x: number, y: number, color: string, maxWidth: number, align: 4 | 5 = 4): Layer => tx('title', x, y, align, { size: TITLE, color, bold: true }, maxWidth);
const small = (slot: TextSlot, x: number, y: number, align: 4 | 5 | 6, color: string, size = 25, bold = false): Layer => tx(slot, x, y, align, { size, color, bold });

type Built = { layers: Layer[]; videoY: number; caption: Partial<CaptionStyle> & { y: number } };

/** 흰 알약 검색창 (v1 ChannelPill): 채널명 + 돋보기, 검은 테두리 */
function channelPill(x0: number, x1: number, H: number): Layer[] {
  const h = 166;
  const cx = (x0 + x1) / 2;
  // 채널명 오른쪽 끝을 고정 (긴 이름은 왼쪽으로 늘어나고 돋보기와 겹치지 않는다)
  return [
    rr(x0, (H - h) / 2, x1 - x0, h, h / 2, '#ffffff', { border: 8, borderColor: '#000000' }),
    name(cx + 105, H / 2, 65, DARK, { align: 6, maxWidth: cx + 105 - x0 - 70 }),
    ic('magnifier', cx + 163, H / 2, DARK, { size: 62 }),
  ];
}

/** v1 기본 게시글 패널(흰 바탕 · 왼쪽 정렬 제목 · 회색 메타 · 검은 밑줄) + 흰 자막 띠 */
function standard(f: V1Frame, H: number, header: Layer[], meta: (y: number) => Layer[]): Built {
  const ty = H + 32 + 29;
  const my = ty + 29 + 32 + 19;
  const line = my + 19 + 32;
  return {
    layers: [rect(0, 0, W, H, f.color), ...header, title(86, ty, DARK, 908), ...meta(my), rect(0, line, W, 4, '#000000')],
    caption: { y: line + 4 + 75 },
    videoY: line + 4 + 150,
  };
}

const metaLine = (fmt: string) => (y: number) => [small(stats(fmt), 86, y, 4, '#575757', 30, true)];

function variantLayout(f: V1Frame): Built {
  const fg = f.foreground ?? '#000000';
  const H = 180;
  const y = H / 2;
  const views = metaLine('조회수 {views} | 좋아요 {likes}개');
  const center = (px = 70, o: Parameters<typeof name>[4] = {}) => name(540, y, px, fg, o);
  switch (f.v) {
    case 'search':
      return standard(f, 240, [ic('arrowLeft', IL, 120, fg), ...channelPill(148, 932, 240), ic('menu', IR, 120, fg)], views);
    case 'pill':
      return standard(f, 240, channelPill(140, 940, 240), metaLine('익명 | 조회수 {views} | 좋아요 {likes}개'));
    case 'story':
      return standard(f, 240, [ic('sparkles', IL, 120, fg), ...channelPill(148, 932, 240), ic('bell', IR, 120, fg)], views);
    case 'minimal':
      return standard(f, H, [ic('arrowLeft', IL, y, fg), center(), ic('ellipsis', IR, y, fg)], metaLine('익명 | 조회수 {views}'));
    case 'star':
      return standard(f, H, [ic('menu', IL, y, fg), center(), ic('star', IR, y, fg, { fill: true })], views);
    case 'community':
      return standard(f, H, [ic('user', IL, y, fg), center(), ic('menu', IR, y, fg)], (my) => [
        small(stats('조회수 {views} | 좋아요 {likes}개'), 86, my, 4, '#575757', 30, true),
        rr(W - 86 - 150, my - 24, 150, 48, 0, '#ffffff', { border: 2, borderColor: '#494949' }),
        small(stats('댓글 {comments}'), W - 86 - 75, my, 5, '#bd3a3b', 26, true),
      ]);
    case 'knowledge':
      return standard(f, H, [ic('magnifier', IL, y, '#777777'), center(), ic('menu', IR, y, '#777777')], views);
    case 'dark':
      return standard(f, H, [ic('menu', IL, y, fg), rr(354, y - 11, 22, 22, 11, '#ef4444'), name(398, y, 70, fg, { align: 4, maxWidth: 520 }), ic('magnifier', IR, y, fg)], views);
    case 'magazine':
      return standard(f, H, [
        rr(54, y - 37, 150, 74, 13, f.color, { border: 5, borderColor: fg }), small(st('STORY'), 129, y, 5, fg, 37, true),
        name(580, y, 70, fg, { maxWidth: 640 }), ic('menu', IR, y, fg),
      ], views);
    case 'profile':
      return standard(f, H, [rr(IL - 43, y - 43, 86, 86, 43, '#ffffff', { alpha: 0.3 }), ic('user', IL, y, fg, { size: 54, stroke: 2.7 }), center(), ic('bell', IR, y, fg)], views);
    case 'emotion':
      return standard(f, H, [ic('sparkles', IL, y, fg), center(), ic('heart', IR, y, fg, { fill: true })], views);
    case 'cinema':
      return standard(f, H, [ic('home', IL, y, fg), center(59, { spacing: 5 }), ic('bookmark', IR, y, fg, { fill: true })], views);
    case 'heart':
      return standard(f, H, [ic('heart', IL, y, fg, { fill: true }), center(), ic('chat', IR, y, fg)], views);
    case 'essay':
      return standard(f, H, [ic('arrowLeft', IL, y, fg), center(67), ic('ellipsis', IR, y, fg)], views);
    case 'review':
      return standard(f, H, [ic('chat', IL, y, fg), center(), ic('star', IR, y, fg, { fill: true })], views);
    case 'impact':
      return standard(f, H, [ic('zap', IL, y, fg, { fill: true }), center(70, { italic: true }), ic('magnifier', IR, y, fg)], views);
    case 'shop':
      return shopLayout(f, fg);
    case 'board':
      return board(f, fg);
    case 'hot':
      return hot(f, fg);
    case 'best-comment':
      return bestComment(f, fg);
    case 'chat':
      return chat(f, fg);
    case 'office':
      return office(f, fg);
    case 'breaking':
      return breaking(f, fg);
    case 'webtoon':
      return webtoon(f, fg);
    case 'diary':
      return diary(f, fg);
    case 'fullbleed':
      return { layers: [], videoY: 0, caption: { y: 1580 } };
  }
}

/** 썰쇼핑(shop) 헤더: wings-note(☰ … 아이콘, 채널명 없음) · menu-search(☰ 채널명 🔍) · center(배지 + 채널명) */
function shopLayout(f: V1Frame, fg: string): Built {
  const s = f.shop ?? {};
  const px = (s.nameCqw ?? 6.2) * 10.8;
  const layers: Layer[] = [];
  let H: number;
  if (s.layout === 'wings-note') {
    H = 152;
    layers.push(rect(0, 0, W, H, f.color), rect(0, H, W, 6, '#000000'), ic('menu', IL + 3, H / 2, fg, { size: 76, stroke: 2.3 }));
    if (s.icon) layers.push(ic(s.icon, IR - 3, H / 2, fg, { size: 76, stroke: 2.3 }));
    H += 6;
  } else if (s.layout === 'menu-search') {
    H = Math.round(76 + Math.max(70, px * 1.5));
    layers.push(rect(0, 0, W, H, f.color), ic('menu', IL, H / 2, fg), name(540, H / 2, px, fg, { font: s.font, maxWidth: 700 }), ic('magnifier', IR, H / 2, fg));
  } else {
    const box = s.badge ? 97 : 70;
    H = Math.round(89 + Math.max(s.icon ? box : 0, px * 1.5));
    layers.push(rect(0, 0, W, H, f.color));
    const y = H / 2;
    if (!s.icon) layers.push(name(540, y, px, fg, { font: s.font, maxWidth: 900 }));
    else {
      // 아이콘 + 채널명 묶음을 가운데에 (채널명 폭은 6글자 안팎으로 어림)
      const nw = px * 4.6;
      const x0 = 540 - (box + 22 + nw) / 2;
      const ix = s.iconRight ? x0 + nw + 22 + box / 2 : x0 + box / 2;
      if (s.badge) layers.push(rr(ix - box / 2, y - box / 2, box, box, box / 2, s.badge));
      layers.push(ic(s.icon, ix, y, s.badge ? '#1a1a1a' : fg, s.badge ? { size: 65, stroke: 2.4 } : { stroke: 2.6 }));
      layers.push(s.iconRight
        ? name(x0 + nw, y, px, fg, { align: 6, font: s.font, maxWidth: x0 + nw - 40 })
        : name(x0 + box + 22, y, px, fg, { align: 4, font: s.font, maxWidth: W - 40 - (x0 + box + 22) }));
    }
    if (s.ad) layers.push(rr(W - 27 - 60, Math.round(H * 0.08), 60, 38, 6, f.color, { border: 2, borderColor: '#8a8a8a' }), small(st('광고'), W - 27 - 30, Math.round(H * 0.08) + 19, 5, '#8a8a8a', 23, true));
  }
  // 제목 패널: 메타·시계 줄이 있으면 왼쪽 정렬, 없으면 가운데
  const left = !!(s.postMeta || s.clock);
  const ty = H + 35 + 27;
  layers.push(left ? title(65, ty, DARK, 950) : title(540, ty, DARK, 950, 5));
  let bottom: number;
  if (s.clock) {
    const cy = ty + 27 + 28 + 25;
    const ly = cy + 25 + 16;
    layers.push(tx(st('19 : 03  |'), 65, cy, 4, { size: 33, color: '#8d8d8d', bold: true, spacing: 2 }), rect(65, ly, 950, 4, '#8d8d8d'));
    bottom = ly + 4 + 32;
  } else {
    let ly = ty + 27 + 35;
    if (s.postMeta) {
      const my = ty + 27 + 17 + 18;
      layers.push(small(stats('익명 | 조회 {views}'), 65, my, 4, '#8a8a8a', 28));
      ly = my + 18 + 35;
    }
    layers.push(rect(65, ly, 950, 3, '#d6d6d6'));
    bottom = ly + 3;
  }
  // 자막 띠: 최소 24cqw 높이 가운데
  return { layers, caption: { y: bottom + 130 }, videoY: bottom + 259 };
}

function board(f: V1Frame, fg: string): Built {
  const H = 175;
  const top = 231;
  const ty = top + 18 + 22 + 27;
  const sy = ty + 27 + 27 + 18;
  const line = sy + 18 + 38;
  const cap = line + 4;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('users', IL, H / 2, fg), name(540, H / 2, 65, fg), ic('menu', IR, H / 2, fg),
      small(st('오늘의 익명 사연'), 76, top, 4, '#0e8184', 25, true), small(st('일상 · 인기'), W - 76, top, 6, '#0e8184', 25),
      title(76, ty, DARK, 928),
      small(st('익명'), 76, sy, 4, '#9fb9ba', 25, true), small(stats('조회 {views}   공감 {likes}개'), W - 76, sy, 6, '#586667', 25),
      rect(0, line, W, 4, '#293b3c'),
      rect(0, cap, W, 159, '#172020'), rect(0, cap, 22, 159, '#006d70'),
    ],
    caption: { y: cap + 80, x: 551, color: '#ffffff', maxWidth: 900 },
    videoY: cap + 159,
  };
}

function hot(f: V1Frame, fg: string): Built {
  const H = 171;
  const top = H + 38 + 22;
  const ty = top + 22 + 22 + 27;
  const sy = ty + 27 + 27 + 18;
  const line = sy + 18 + 38;
  const cap = line + 5;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('flame', IL, H / 2, '#ffb020', { fill: true }),
      name(405, H / 2 - 18, 59, fg, { align: 4, maxWidth: 520 }), small(st('실시간 인기글'), 405, H / 2 + 32, 4, '#dbeafe', 25, true),
      ic('magnifier', IR, H / 2, fg),
      rect(0, H, W, line - H, '#fbffff'),
      rr(76, top - 22, 112, 44, 9, '#f59e0b'), small(st('POTEN'), 132, top, 5, '#000000', 26, true), small(st('실시간 화제'), 204, top, 4, '#464d59', 26),
      title(76, ty, DARK, 928),
      small(stats('조회 {views}    추천 {likes}개    댓글 {comments}'), 76, sy, 4, '#4d5868', 25, true),
      rect(0, line, W, 5, '#803100'),
      rect(0, cap, W, 159, '#eff5ff'), rect(0, cap + 155, W, 4, '#dbe3f1'),
    ],
    caption: { y: cap + 80 },
    videoY: cap + 159,
  };
}

function bestComment(f: V1Frame, fg: string): Built {
  const H = 170;
  const top = H + 38 + 26;
  const ty = top + 26 + 22 + 27;
  const dv = ty + 27 + 27;
  const sy = dv + 3 + 22 + 18;
  const cap = sy + 18 + 38;
  const card = cap + 38;
  const label = card + 4 + 27 + 18;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('trophy', IL, H / 2, fg),
      tx(st('베스트 ·'), 478, H / 2, 6, { size: 63, color: fg, bold: true }), name(496, H / 2, 63, fg, { align: 4, maxWidth: 400 }),
      ic('chat', IR, H / 2, fg),
      rect(0, H, W, cap - H, '#1e1a18'),
      rr(76, top - 26, 190, 52, 26, '#f05a47'), small(st('댓글이 난리 난 글'), 171, top, 5, '#181818', 25, true), small(st('BEST'), W - 76, top, 6, '#935d55', 24),
      title(76, ty, '#ffffff', 928),
      rect(76, dv, 928, 3, '#3e2c28'),
      small(stats('공감 ♥ {likes}개'), 76, sy, 4, '#c08a82', 25), small(stats('댓글 {comments}'), W - 76, sy, 6, '#c08a82', 25),
      rect(0, cap, W, 258, '#281f1c'),
      rr(65, card, 950, 182, 22, '#ffffff', { border: 4, borderColor: '#653429' }),
      small(st('베스트 댓글'), 101, label, 4, '#ad0d01', 24, true),
    ],
    caption: { y: label + 18 + 11 + 37, maxWidth: 880 },
    videoY: cap + 258,
  };
}

function chat(f: V1Frame, fg: string): Built {
  const H = 174;
  const pill = H + 38;
  const card = pill + 53 + 22;
  const row = card + 27 + 21;
  const ty = row + 21 + 16 + 27;
  const post = card + 167 + 38;
  const bub = post + 38;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('arrowLeft', IL, H / 2, fg),
      name(540, H / 2 - 18, 63, fg), small(st('대화 중'), 540, H / 2 + 32, 5, '#8f8130', 24),
      ic('send', IR, H / 2, fg),
      rect(0, H, W, post - H + 203, '#374752'),
      rr(495, pill, 90, 53, 26, '#000000', { alpha: 0.85 }), small(st('오늘'), 540, pill + 27, 5, '#ffffff', 24),
      rr(76, card, 928, 167, 22, '#ffffff', { alpha: 0.15 }),
      rr(119, row - 21, 43, 43, 21.5, '#d3b800'), small(st('익명'), 178, row, 4, '#6c7a85', 24, true), small(st('방금'), 961, row, 6, '#6c7a85', 24),
      title(119, ty, DARK, 842),
      rr(65, bub, 76, 76, 38, '#ffffff'), small(st('나'), 103, bub + 38, 5, DARK, 32, true),
      rr(163, bub, 852, 127, 19, '#ffffff'),
    ],
    caption: { y: bub + 63, x: 589, maxWidth: 800 },
    videoY: post + 203,
  };
}

function office(f: V1Frame, fg: string): Built {
  const H = 181;
  const card = H + 38;
  const ty = card + 32 + 75 + 22 + 27;
  const sy = ty + 27 + 27 + 18;
  const post = card + 278 + 38;
  const ccard = post + 38;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('briefcase', IL, H / 2, fg),
      name(651, H / 2, 70, fg, { align: 6, maxWidth: 500 }),
      rr(673, H / 2 - 22, 76, 44, 22, f.color, { border: 2, borderColor: '#f9c4ae' }), small(st('익명'), 711, H / 2, 5, fg, 24, true),
      ic('bell', IR, H / 2, fg),
      rect(0, H, W, post - H + 203, '#212223'),
      rr(65, card, 950, 278, 16, '#ffffff'),
      rr(108, card + 37, 54, 54, 27, '#5a95ff'), small(st('B'), 135, card + 64, 5, '#181818', 26, true),
      small(st('회사원 · 익명'), 178, card + 50, 4, DARK, 25, true), small(st('방금 전'), 178, card + 83, 4, '#52555a', 24),
      title(108, ty, DARK, 864),
      small(stats('조회 {views}    추천 {likes}개    댓글 {comments}'), 108, sy, 4, '#5f6269', 24),
      rr(65, ccard, 950, 127, 16, '#ffffff'), rect(65, ccard, 13, 127, '#194eb7'),
    ],
    caption: { y: ccard + 63, x: 546, maxWidth: 880 },
    videoY: post + 203,
  };
}

function breaking(f: V1Frame, fg: string): Built {
  const H = 162;
  const row = H + 38 + 29;
  const ty = row + 29 + 22 + 27;
  const sy = ty + 27 + 27 + 18;
  const line = sy + 18 + 38;
  const cap = line + 11;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('newspaper', IL, H / 2, fg),
      rr(357, H / 2 - 27, 84, 54, 0, '#ffffff'), small(st('속보'), 399, H / 2, 5, '#d33135', 27, true),
      name(463, H / 2, 57, fg, { align: 4, maxWidth: 470 }),
      ic('menu', IR, H / 2, fg),
      rr(65, row - 29, 96, 58, 0, '#c9252d'), small(st('단독'), 113, row, 5, '#181818', 27, true),
      small(st('지금 가장 뜨거운 이야기'), 183, row, 4, '#6e6e6e', 25, true),
      title(65, ty, DARK, 950),
      small(st('익명 제보'), 65, sy, 4, '#636363', 24), small(stats('조회 {views}'), W - 65, sy, 6, '#636363', 24),
      rect(0, line, W, 11, '#d33135'),
      rect(0, cap, W, 149, '#c9252d'),
      small(st('핵심'), 54, cap + 75, 4, '#ffffff', 27, true), rect(130, cap + 52, 2, 46, '#ffffff', 0.6),
    ],
    caption: { y: cap + 75, x: 589, color: '#ffffff', maxWidth: 860 },
    videoY: cap + 149,
  };
}

function webtoon(f: V1Frame, fg: string): Built {
  const H = 202;
  const card = H + 38;
  const ep = card + 8 + 32 + 20;
  const ty = ep + 20 + 16 + 27;
  const line = card + 189 + 38;
  const cap = line + 8;
  const bub = cap + 38;
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('chat', IL, H / 2, '#ffffff', { fill: true }),
      rr(350, H / 2 - 57, 380, 115, 16, '#000000', { alpha: 0.85, border: 5, borderColor: '#ffffff' }),
      name(540, H / 2, 59, fg, { maxWidth: 320 }),
      ic('sparkles', IR, H / 2, fg),
      rect(0, H, W, line - H, '#fffdf3'),
      rect(81, card + 16, 950, 189, '#f5c842'),
      rr(65, card, 950, 189, 0, '#ffffff', { border: 8, borderColor: '#000000' }),
      small(st('EP. 오늘의 황당한 썰'), 116, ep, 4, '#1158e1', 26, true),
      title(116, ty, DARK, 860),
      rect(0, line, W, 8, '#000000'),
      rect(0, cap, W, 229, '#1b1913'),
      rr(76, bub + 11, 950, 153, 76, '#8b5cf6'),
      rr(65, bub, 950, 153, 76, '#ffffff', { border: 8, borderColor: '#000000' }),
    ],
    caption: { y: bub + 76, maxWidth: 820 },
    videoY: cap + 229,
  };
}

function diary(f: V1Frame, fg: string): Built {
  const H = 170;
  const row = H + 43 + 18;
  const ty = row + 18 + 22 + 27;
  const sy = ty + 27 + 27 + 18;
  const line = sy + 18 + 43;
  const cap = line + 4;
  // 줄 노트 (repeating-linear-gradient 5.8cqw 간격)
  const rules = Array.from({ length: Math.floor((line - H) / 63) }, (_, i) => rect(0, H + 59 + i * 63, W, 2, '#7e6948', 0.85));
  return {
    layers: [
      rect(0, 0, W, H, f.color), ic('pen', IL, H / 2, fg),
      tx(st('오늘의 기록 ·'), 510, H / 2, 6, { size: 63, color: fg, bold: true }), name(528, H / 2, 63, fg, { align: 4, maxWidth: 410 }),
      ic('bookmark', IR, H / 2, fg),
      rect(0, H, W, line - H, '#f8f0df'), ...rules,
      small(st('익명의 기록'), 86, row, 4, '#7d6a4d', 25, true), small(st('오늘, 맑음'), W - 86, row, 6, '#7d6a4d', 25, true),
      title(86, ty, DARK, 908),
      small(stats('조회 {views}'), W - 86, sy, 6, '#715e40', 24),
      rect(0, line, W, 4, '#5b4d33'),
      rect(0, cap, W, 219, '#282215'), rect(76, cap + 43, 928, 3, '#55472a'), rect(76, cap + 43 + 130, 928, 3, '#55472a'),
    ],
    caption: { y: cap + 43 + 66, color: '#f8f0df', maxWidth: 900 },
    videoY: cap + 219,
  };
}

/** v1 StoryChannelFrame 의 표지 강조색·윙스 띠 인트로 여부 (없으면 기본 노랑) */
const V1_COVER: Record<string, [string, boolean]> = {
  'channel-wings-search': ['#ffd400', true], 'channel-wings-profile': ['#ffd400', true], 'channel-wings-cart': ['#7fd4ff', true],
  'channel-wings-arrow': ['#ffd400', true], 'channel-wings-home': ['#b8fff2', true],
  'channel-shop-green': ['#8dff3c', false], 'channel-shop-orange': ['#ffd500', false], 'channel-shop-white': ['#ff9d1c', false],
  'channel-shop-navy': ['#43c6ff', false], 'channel-shop-yellow': ['#ffe100', false], 'channel-shop-tomato': ['#ffd400', false],
  'channel-shop-forest': ['#a6ff4d', false], 'channel-shop-lime': ['#b4ff5a', false], 'channel-shop-ad': ['#ffcf33', false],
  'channel-shop-mint': ['#ffe14d', false], 'channel-fullbleed': ['#ffd400', false],
};
const DEFAULT_COVER_ACCENT = '#ffe14d';

/** v1 프레임 → v2 Template (id는 channel-* 유지) */
export function storyV1FrameTemplates(): Template[] {
  return V1_FRAMES.map((f): Template => {
    const [coverAccent, coverBand] = V1_COVER[f.id] ?? [DEFAULT_COVER_ACCENT, false];
    const poster = { posterColors: ['#ffffff', coverAccent] as [string, string], posterStyle: coverBand ? ('band' as const) : ('top' as const) };
    const base = { id: f.id, name: f.name, family: 'storyv1' as const, description: `v1 · ${f.description}`, ...poster };
    if (f.v === 'fullbleed') {
      // v1 FullBleedTitleBand: 검은 띠에 흰 윗줄 + 강조색 아랫줄
      return {
        ...base,
        canvas: '#000000',
        video: FULL_VIDEO,
        layers: [
          rect(0, 0, W, 250, '#111111'),
          tx('title1', 540, 88, 5, { size: 50, color: '#ffffff', bold: true }, 980),
          tx('title2', 540, 170, 5, { size: 60, color: coverAccent, bold: true }, 980),
        ],
        caption: { x: 540, y: 1580, align: 5, maxWidth: 980, size: 64, color: '#ffffff', bold: true, outline: 6, outlineColor: '#000000' },
      };
    }
    const b = variantLayout(f);
    return {
      ...base,
      canvas: '#ffffff',
      // 영상 아래 여백을 남겨 영상 비율(정사각·꽉 채움) 옵션이 계속 동작하게
      video: { x: 0, y: b.videoY, w: W, h: Math.min(VIDEO_H, 1910 - b.videoY) },
      layers: b.layers,
      caption: { x: 540, align: 5, maxWidth: 940, size: 56, color: DARK, bold: true, ...b.caption },
    };
  });
}

export const STORY_V1_TEMPLATE_FAMILY = {
  id: 'story-v1' as const,
  name: '스토리 ver1 템플릿',
  description: 'AI 스토리 쇼핑 숏폼 버전1에 있던 채널 화면 템플릿 전체',
};
