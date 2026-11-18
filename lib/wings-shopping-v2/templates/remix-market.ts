import type { CaptionStyle, Layer, Template } from './types';

/**
 * 리믹스 쇼핑숏폼 ver2 — 실제 쇼핑 숏폼(쿠팡파트너스 쇼츠·뷰티/생활 추천·틱톡샵/도우인 带货·릴스 광고·핫딜/랭킹 채널)
 * 화면 문법을 따라 만든 추가 템플릿. 브랜드 로고·이름은 복제하지 않고 배치·색 문법만 따른다.
 * 좌표 1080x1920, 위·아래 ~120px 는 플랫폼 UI 자리라 글자를 두지 않는다.
 */

/** 영상 위 기본 자막 (흰 글자 + 검정 외곽선) */
const cap = (y: number, extra: Partial<CaptionStyle> = {}): CaptionStyle => ({
  x: 540, y, align: 5, maxWidth: 960, size: 72, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000', ...extra,
});

const title1 = (y: number, color: string, size = 66, extra: Partial<Extract<Layer, { kind: 'text' }>> = {}): Layer =>
  ({ kind: 'text', slot: 'title1', x: 540, y, align: 5, maxWidth: 980, style: { size, color, bold: true }, ...extra });
const title2 = (y: number, color: string, size = 76, extra: Partial<Extract<Layer, { kind: 'text' }>> = {}): Layer =>
  ({ kind: 'text', slot: 'title2', x: 540, y, align: 5, maxWidth: 980, style: { size, color, bold: true }, ...extra });
const footer = (y: number, color: string, size = 38): Layer =>
  ({ kind: 'text', slot: 'footer', x: 540, y, align: 5, maxWidth: 960, style: { size, color, bold: true } });
/** 슬롯·고정 문구를 색 박스 배지로 (글이 비면 박스도 안 보임) */
const pill = (slot: Extract<Layer, { kind: 'text' }>['slot'], x: number, y: number, size: number, color: string, bg: string, align: 4 | 5 | 6 = 5, maxWidth = 960): Layer =>
  ({ kind: 'text', slot, x, y, align, maxWidth, style: { size, color, bold: true, box: { color: bg, pad: Math.round(size * 0.35) } } });
/** 사각 테두리 (영상 액자) */
const frame = (x: number, y: number, w: number, h: number, t: number, color: string): Layer[] => [
  { kind: 'rect', x, y, w, h: t, color },
  { kind: 'rect', x, y: y + h - t, w, h: t, color },
  { kind: 'rect', x, y, w: t, h, color },
  { kind: 'rect', x: x + w - t, y, w: t, h, color },
];
/** 점선 (영수증·쿠폰 절취선) */
const dashes = (x: number, y: number, w: number, color: string, seg = 24, gap = 16): Layer[] =>
  Array.from({ length: Math.floor(w / (seg + gap)) }, (_, i) => ({ kind: 'rect' as const, x: x + i * (seg + gap), y, w: seg, h: 4, color }));

/** 레터박스형 기본 영상 영역 */
const V = { x: 0, y: 400, w: 1080, h: 1200 };

export const REMIX_MARKET_TEMPLATES: Template[] = [
  // 1. 핫딜 채널: 노란 상단 + 빨간 가격표 스티커
  {
    id: 'remix-m-hotdeal-tag', name: '핫딜 가격표', family: 'remix', canvas: '#ffe14d',
    description: '노란 바탕 검정 제목 + 하단 빨간 가격표 스티커 (핫딜·쿠팡파트너스 특가 채널)',
    video: V,
    layers: [
      title1(190, '#111111', 64),
      title2(298, '#e60023', 78),
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 320, color: '#111111' },
      pill({ static: '오늘만 특가' }, 540, 1680, 52, '#ffffff', '#e60023'),
      footer(1786, '#ffe14d', 36),
    ],
    caption: cap(1000),
  },
  // 2. 랭킹 채널: 좌상단 TOP 배지
  {
    id: 'remix-m-rank-top', name: 'TOP 랭킹 배지', family: 'remix', canvas: '#0b1020',
    description: '네이비 바탕 + 좌측 큰 TOP 배지와 2줄 제목 (랭킹·순위 추천 채널)',
    video: V,
    layers: [
      { kind: 'rect', x: 50, y: 150, w: 200, h: 200, color: '#ffd400' },
      { kind: 'text', slot: { static: 'TOP' }, x: 150, y: 222, align: 5, style: { size: 56, color: '#0b1020', bold: true } },
      { kind: 'text', slot: { static: 'PICK' }, x: 150, y: 292, align: 5, style: { size: 44, color: '#0b1020', bold: true } },
      { kind: 'text', slot: 'title1', x: 290, y: 200, align: 4, maxWidth: 740, style: { size: 58, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 290, y: 300, align: 4, maxWidth: 740, style: { size: 66, color: '#ffd400', bold: true } },
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 8, color: '#ffd400' },
      footer(1700, '#c7d2fe'),
    ],
    caption: cap(1000, { alternateColors: ['#ffffff', '#ffd400'] }),
  },
  // 3. 뉴스 속보 배너
  {
    id: 'remix-m-breaking-news', name: '속보 뉴스 배너', family: 'remix', canvas: '#0a0a0a',
    description: '빨간 속보 라벨 + 흰 헤드라인 바 + 하단 뉴스 자막 띠 (이슈·화제템 채널)',
    video: { x: 0, y: 360, w: 1080, h: 1220 },
    layers: [
      { kind: 'rect', x: 0, y: 140, w: 1080, h: 200, color: '#ffffff' },
      { kind: 'rect', x: 0, y: 140, w: 220, h: 200, color: '#d40000' },
      { kind: 'text', slot: { static: '속보' }, x: 110, y: 240, align: 5, style: { size: 64, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title1', x: 250, y: 196, align: 4, maxWidth: 800, style: { size: 52, color: '#111111', bold: true } },
      { kind: 'text', slot: 'title2', x: 250, y: 284, align: 4, maxWidth: 800, style: { size: 58, color: '#d40000', bold: true } },
      { kind: 'rect', x: 0, y: 1580, w: 1080, h: 110, color: '#d40000' },
      { kind: 'rect', x: 0, y: 1580, w: 180, h: 110, color: '#111111' },
      { kind: 'text', slot: { static: 'NEWS' }, x: 90, y: 1635, align: 5, style: { size: 40, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'footer', x: 210, y: 1635, align: 4, maxWidth: 840, style: { size: 36, color: '#ffffff', bold: true } },
    ],
    caption: cap(1420, { box: { color: '#000000', alpha: 0.25, pad: 18 }, outline: 0, size: 62 }),
  },
  // 4. 검색창
  {
    id: 'remix-m-search-bar', name: '검색창 스타일', family: 'remix', canvas: '#ffffff',
    description: '흰 화면 상단 검색창에 제목이 입력된 모양 + 아래 강조 문구 (꿀템 검색·추천 채널)',
    video: { x: 0, y: 420, w: 1080, h: 1200 },
    layers: [
      { kind: 'rect', x: 50, y: 150, w: 980, h: 120, color: '#f1f3f5' },
      ...frame(50, 150, 980, 120, 5, '#03c75a'),
      { kind: 'icon', name: 'search', x: 112, y: 210, size: 36, color: '#03c75a' },
      { kind: 'text', slot: 'title1', x: 160, y: 210, align: 4, maxWidth: 840, style: { size: 50, color: '#111111', bold: true } },
      title2(350, '#03a04a', 70),
      { kind: 'rect', x: 0, y: 1620, w: 1080, h: 300, color: '#f8f9fa' },
      footer(1710, '#495057'),
    ],
    caption: cap(1020),
  },
  // 5. 메신저 대화
  {
    id: 'remix-m-chat-bubble', name: '메신저 대화', family: 'remix', canvas: '#b2c7da',
    description: '하늘색 채팅방 배경 + 친구 말풍선(제목) · 내 노란 말풍선(강조) (지인 추천·썰 채널)',
    video: { x: 40, y: 460, w: 1000, h: 1140 },
    layers: [
      { kind: 'icon', name: 'avatar', x: 90, y: 180, size: 70, color: '#ffffff' },
      { kind: 'text', slot: 'channel', x: 140, y: 160, align: 4, maxWidth: 600, style: { size: 30, color: '#3d4a5c', bold: true } },
      { kind: 'text', slot: 'title1', x: 140, y: 232, align: 4, maxWidth: 800, style: { size: 46, color: '#111111', bold: true, box: { color: '#ffffff', pad: 18 } } },
      { kind: 'text', slot: 'title2', x: 1030, y: 360, align: 6, maxWidth: 860, style: { size: 52, color: '#111111', bold: true, box: { color: '#fee500', pad: 18 } } },
      footer(1700, '#3d4a5c', 36),
    ],
    caption: cap(1030),
  },
  // 6. 댓글 답장 스티커 (틱톡·쇼츠 공통)
  {
    id: 'remix-m-comment-reply', name: '댓글 답장 스티커', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 상단 흰 댓글 말풍선에 "님의 댓글에 답장" (댓글 요청 답변형 쇼츠)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'text', slot: { static: '이거 어디서 사요?' }, x: 540, y: 270, align: 5, maxWidth: 900, style: { size: 52, color: '#111111', bold: true, box: { color: '#ffffff', pad: 22 } } },
      { kind: 'text', slot: 'handle', x: 540, y: 186, align: 5, maxWidth: 900, style: { size: 32, color: '#ffffff', bold: true, box: { color: '#fe2c55', pad: 12 } } },
      { kind: 'text', slot: 'title2', x: 540, y: 410, align: 5, maxWidth: 980, style: { size: 70, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' } },
      { kind: 'text', slot: 'footer', x: 540, y: 1660, align: 5, maxWidth: 960, style: { size: 38, color: '#ffffff', bold: true, outline: 5, outlineColor: '#000000' } },
    ],
    caption: cap(1000, { size: 76 }),
  },
  // 7. 비포/애프터
  {
    id: 'remix-m-before-after', name: '비포 애프터', family: 'remix', canvas: '#111111',
    description: '회색 BEFORE · 컬러 AFTER 라벨이 붙은 2단 제목 (청소·정리·뷰티 효과 비교 채널)',
    video: V,
    layers: [
      { kind: 'text', slot: { static: 'BEFORE' }, x: 60, y: 190, align: 4, style: { size: 34, color: '#ffffff', bold: true, box: { color: '#6b7280', pad: 10 } } },
      { kind: 'text', slot: 'title1', x: 260, y: 190, align: 4, maxWidth: 780, style: { size: 56, color: '#d1d5db', bold: true } },
      { kind: 'text', slot: { static: 'AFTER' }, x: 60, y: 310, align: 4, style: { size: 34, color: '#111111', bold: true, box: { color: '#22d3ee', pad: 10 } } },
      { kind: 'text', slot: 'title2', x: 260, y: 310, align: 4, maxWidth: 780, style: { size: 64, color: '#22d3ee', bold: true } },
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 6, color: '#22d3ee' },
      footer(1700, '#a5f3fc'),
    ],
    caption: cap(1000, { alternateColors: ['#ffffff', '#22d3ee'] }),
  },
  // 8. 영수증 카드
  {
    id: 'remix-m-receipt', name: '영수증 카드', family: 'remix', canvas: '#e9e6df',
    description: '상단 흰 영수증 카드 + 절취 점선 + TOTAL 줄 (가성비·내돈내산 결산 채널)',
    video: { x: 60, y: 480, w: 960, h: 1120 },
    layers: [
      { kind: 'rect', x: 60, y: 130, w: 960, h: 330, color: '#ffffff' },
      { kind: 'text', slot: { static: 'RECEIPT · 내돈내산' }, x: 540, y: 172, align: 5, style: { size: 30, color: '#6b6b6b', bold: true, spacing: 4 } },
      ...dashes(90, 206, 900, '#bdbdbd'),
      { kind: 'text', slot: 'title1', x: 540, y: 262, align: 5, maxWidth: 880, style: { size: 52, color: '#222222', bold: true } },
      ...dashes(90, 312, 900, '#bdbdbd'),
      { kind: 'text', slot: { static: 'TOTAL' }, x: 100, y: 386, align: 4, style: { size: 40, color: '#222222', bold: true } },
      { kind: 'text', slot: 'title2', x: 990, y: 386, align: 6, maxWidth: 700, style: { size: 56, color: '#d9480f', bold: true } },
      ...frame(56, 476, 968, 1128, 4, '#222222'),
      footer(1700, '#3f3f3f'),
    ],
    caption: cap(1060),
  },
  // 9. 리뷰 별점 띠
  {
    id: 'remix-m-review-stars', name: '별점 리뷰 띠', family: 'remix', canvas: '#ffffff',
    description: '노란 별점 줄 + 굵은 후기 제목 + 하단 회색 후기 카드 (솔직후기·구매평 리뷰 채널)',
    video: { x: 0, y: 430, w: 1080, h: 1170 },
    layers: [
      { kind: 'text', slot: { static: '★★★★★' }, x: 540, y: 160, align: 5, style: { size: 56, color: '#ffb400', bold: true, spacing: 6 } },
      title1(252, '#111111', 60),
      title2(350, '#ff6a00', 68),
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 320, color: '#f3f4f6' },
      { kind: 'text', slot: 'comment', x: 540, y: 1680, align: 5, maxWidth: 960, style: { size: 42, color: '#111111', bold: true } },
      footer(1768, '#6b7280', 34),
    ],
    caption: cap(1015),
  },
  // 10. 마감 임박 카운트다운
  {
    id: 'remix-m-countdown', name: '마감 임박', family: 'remix', canvas: '#111111',
    description: '검정 바탕 노란 경고 띠 + "마감 임박" 배지 + 하단 타이머 띠 (한정수량·타임딜 채널)',
    video: V,
    layers: [
      pill({ static: '마감 임박' }, 540, 160, 40, '#111111', '#ffd400'),
      title1(250, '#ffffff', 62),
      title2(340, '#ffd400', 72),
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 130, color: '#ffd400' },
      { kind: 'text', slot: { static: 'LIMITED · 수량 소진 시 종료' }, x: 540, y: 1665, align: 5, maxWidth: 980, style: { size: 44, color: '#111111', bold: true } },
      footer(1790, '#ffd400', 34),
    ],
    caption: cap(1000, { alternateColors: ['#ffffff', '#ffd400'] }),
  },
  // 11. 미니멀 화이트
  {
    id: 'remix-m-minimal-white', name: '미니멀 화이트', family: 'remix', canvas: '#fafafa',
    description: '여백 많은 흰 바탕 + 작은 검정 제목 + 얇은 선 액자 (감성 리빙·브랜드 추천 채널)',
    video: { x: 90, y: 440, w: 900, h: 1140 },
    layers: [
      { kind: 'text', slot: 'channel', x: 540, y: 170, align: 5, maxWidth: 800, style: { size: 28, color: '#9ca3af', bold: true, spacing: 6 } },
      title1(250, '#111111', 52),
      title2(330, '#111111', 60),
      ...frame(86, 436, 908, 1148, 2, '#111111'),
      footer(1680, '#6b7280', 34),
    ],
    caption: cap(1010, { size: 64, maxWidth: 840 }),
  },
  // 12. 네온 나이트
  {
    id: 'remix-m-neon-night', name: '네온 나이트', family: 'remix', canvas: '#05010f',
    description: '깜깜한 배경 + 핑크·시안 네온 외곽선 제목과 네온 테두리 (게이밍·조명·테크 채널)',
    video: { x: 40, y: 420, w: 1000, h: 1160 },
    layers: [
      title1(200, '#ffffff', 64, { style: { size: 64, color: '#ffffff', bold: true, outline: 5, outlineColor: '#ff2bd6' } }),
      title2(310, '#ffffff', 74, { style: { size: 74, color: '#ffffff', bold: true, outline: 6, outlineColor: '#00e5ff' } }),
      ...frame(34, 414, 1012, 1172, 6, '#ff2bd6'),
      ...frame(24, 404, 1032, 1192, 3, '#00e5ff'),
      footer(1680, '#00e5ff'),
    ],
    caption: cap(1000, { outlineColor: '#7a00ff', alternateColors: ['#ffffff', '#7cf9ff'] }),
  },
  // 13. 파스텔 큐트
  {
    id: 'remix-m-pastel-cute', name: '파스텔 큐트', family: 'remix', canvas: '#ffe4ef',
    description: '연분홍 바탕 + 하늘·분홍 스티커 제목 + 하트 포인트 (다이어리·소품·키덜트 추천 채널)',
    video: { x: 60, y: 440, w: 960, h: 1140 },
    layers: [
      { kind: 'text', slot: { static: '♥ 귀여움 주의 ♥' }, x: 540, y: 160, align: 5, style: { size: 34, color: '#ff5c8a', bold: true } },
      { kind: 'text', slot: 'title1', x: 540, y: 250, align: 5, maxWidth: 940, style: { size: 54, color: '#4a3b6b', bold: true, box: { color: '#c7ecff', pad: 16 } } },
      { kind: 'text', slot: 'title2', x: 540, y: 358, align: 5, maxWidth: 940, rotate: 2, style: { size: 62, color: '#ffffff', bold: true, box: { color: '#ff7aa8', pad: 16 } } },
      ...frame(52, 432, 976, 1156, 8, '#ffffff'),
      footer(1680, '#b0507a', 36),
    ],
    caption: cap(1010, { outlineColor: '#d6336c' }),
  },
  // 14. 럭셔리 블랙골드
  {
    id: 'remix-m-luxury-gold', name: '럭셔리 블랙골드', family: 'remix', canvas: '#0b0b0b',
    description: '블랙 바탕 + 골드 얇은 이중 액자와 자간 넓은 제목 (명품·향수·선물 추천 채널)',
    video: { x: 80, y: 440, w: 920, h: 1140 },
    layers: [
      { kind: 'text', slot: { static: 'PREMIUM SELECTION' }, x: 540, y: 160, align: 5, style: { size: 26, color: '#c9a45c', bold: true, spacing: 10 } },
      title1(242, '#f5f0e6', 54, { style: { size: 54, color: '#f5f0e6', bold: true, spacing: 2 } }),
      title2(330, '#d4af37', 64, { style: { size: 64, color: '#d4af37', bold: true, spacing: 2 } }),
      ...frame(70, 430, 940, 1160, 3, '#d4af37'),
      ...frame(56, 416, 968, 1188, 1, '#8a6d2f'),
      footer(1690, '#c9a45c', 34),
    ],
    caption: cap(1010, { size: 66, color: '#fff8e7', outlineColor: '#000000' }),
  },
  // 15. 뷰티 추천픽 (드럭스토어 랭킹 쇼츠)
  {
    id: 'remix-m-beauty-pick', name: '뷰티 추천픽', family: 'remix', canvas: '#f4fbe9',
    description: '연두 바탕 + 초록 "추천픽" 라벨과 2줄 제목 (드럭스토어·화장품 추천 쇼츠)',
    video: { x: 0, y: 420, w: 1080, h: 1180 },
    layers: [
      { kind: 'rect', x: 0, y: 130, w: 14, h: 250, color: '#7ac70c' },
      pill({ static: '찐 추천픽' }, 60, 170, 38, '#ffffff', '#4f9a00', 4),
      { kind: 'text', slot: 'title1', x: 60, y: 258, align: 4, maxWidth: 980, style: { size: 58, color: '#1f2a12', bold: true } },
      { kind: 'text', slot: 'title2', x: 60, y: 348, align: 4, maxWidth: 980, style: { size: 66, color: '#4f9a00', bold: true } },
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 320, color: '#4f9a00' },
      footer(1700, '#ffffff'),
    ],
    caption: cap(1010),
  },
  // 16. 천원 꿀템 (생활용품 가성비)
  {
    id: 'remix-m-budget-red', name: '가성비 꿀템', family: 'remix', canvas: '#ffffff',
    description: '흰 바탕 + 빨간 "가성비 끝판왕" 띠와 굵은 제목 (생활용품점·천원 꿀템 채널)',
    video: V,
    layers: [
      { kind: 'rect', x: 0, y: 130, w: 1080, h: 84, color: '#e60012' },
      { kind: 'text', slot: { static: '가성비 끝판왕' }, x: 540, y: 172, align: 5, style: { size: 44, color: '#ffffff', bold: true, spacing: 2 } },
      title1(270, '#111111', 60),
      title2(350, '#e60012', 66),
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 10, color: '#e60012' },
      footer(1700, '#333333'),
    ],
    caption: cap(1000, { alternateColors: ['#ffffff', '#fff200'] }),
  },
  // 17. 풀스크린 스티커 제목
  {
    id: 'remix-m-sticker-full', name: '기울인 스티커', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 살짝 기울어진 노랑·흰 스티커 제목 (틱톡·릴스 상품 리뷰 크리에이터)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 230, align: 5, maxWidth: 900, rotate: 3, style: { size: 58, color: '#111111', bold: true, box: { color: '#ffffff', pad: 18 } } },
      { kind: 'text', slot: 'title2', x: 540, y: 350, align: 5, maxWidth: 940, rotate: -3, style: { size: 70, color: '#111111', bold: true, box: { color: '#ffe500', pad: 18 } } },
      { kind: 'text', slot: 'footer', x: 540, y: 1660, align: 5, maxWidth: 960, style: { size: 36, color: '#ffffff', bold: true, box: { color: '#000000', alpha: 0.4, pad: 14 } } },
    ],
    caption: cap(1000, { size: 76 }),
  },
  // 18. 레터박스 훅 + 상품 띠
  {
    id: 'remix-m-hook-strip', name: '빅훅 + 상품띠', family: 'remix', canvas: '#000000',
    description: '검정 레터박스 위 초대형 훅 문구 + 영상 아래 흰 상품 정보 띠 (쿠팡파트너스 쇼츠 정석형)',
    video: { x: 0, y: 480, w: 1080, h: 1080 },
    layers: [
      title1(220, '#ffffff', 74),
      title2(350, '#ff3b3b', 86),
      { kind: 'rect', x: 0, y: 1560, w: 1080, h: 150, color: '#ffffff' },
      { kind: 'text', slot: 'comment', x: 540, y: 1635, align: 5, maxWidth: 980, style: { size: 48, color: '#111111', bold: true } },
      footer(1780, '#9ca3af', 34),
    ],
    caption: cap(1020),
  },
  // 19. 매거진 커버
  {
    id: 'remix-m-magazine-cover', name: '매거진 커버', family: 'remix', canvas: '#f2ede4',
    description: '아이보리 바탕 + 커버 스토리 라벨과 큰 굵은 제목, 굵은 상하 괘선 (에디토리얼 큐레이션 채널)',
    video: { x: 60, y: 470, w: 960, h: 1110 },
    layers: [
      { kind: 'rect', x: 60, y: 130, w: 960, h: 10, color: '#111111' },
      { kind: 'text', slot: { static: 'COVER STORY' }, x: 60, y: 176, align: 4, style: { size: 30, color: '#b91c1c', bold: true, spacing: 8 } },
      { kind: 'text', slot: 'channel', x: 1020, y: 176, align: 6, maxWidth: 500, style: { size: 28, color: '#555555', bold: true } },
      { kind: 'text', slot: 'title1', x: 60, y: 270, align: 4, maxWidth: 960, style: { size: 64, color: '#111111', bold: true } },
      { kind: 'text', slot: 'title2', x: 60, y: 370, align: 4, maxWidth: 960, style: { size: 72, color: '#b91c1c', bold: true } },
      { kind: 'rect', x: 60, y: 440, w: 960, h: 4, color: '#111111' },
      { kind: 'rect', x: 60, y: 1600, w: 960, h: 4, color: '#111111' },
      footer(1680, '#333333', 34),
    ],
    caption: cap(1030),
  },
  // 20. 릴스 광고형
  {
    id: 'remix-m-reels-ad', name: '릴스 광고형', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 상단 프로필·추천 라벨 + 하단 파란 "자세히 보기" 버튼 (인스타 릴스 상품 광고)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'icon', name: 'avatar', x: 90, y: 180, size: 72, color: '#ffffff' },
      { kind: 'text', slot: 'handle', x: 145, y: 166, align: 4, maxWidth: 700, style: { size: 36, color: '#ffffff', bold: true, outline: 3, outlineColor: '#000000' } },
      { kind: 'text', slot: { static: '추천 · 쇼핑' }, x: 145, y: 208, align: 4, style: { size: 28, color: '#e5e7eb', bold: true, outline: 3, outlineColor: '#000000' } },
      { kind: 'text', slot: 'title', x: 540, y: 340, align: 5, maxWidth: 980, style: { size: 64, color: '#ffffff', bold: true, outline: 7, outlineColor: '#000000' } },
      { kind: 'rect', x: 60, y: 1620, w: 960, h: 104, color: '#0095f6' },
      { kind: 'text', slot: { static: '자세히 보기  →' }, x: 540, y: 1672, align: 5, style: { size: 44, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'footer', x: 540, y: 1780, align: 5, maxWidth: 960, style: { size: 30, color: '#ffffff', bold: true, outline: 3, outlineColor: '#000000' } },
    ],
    caption: cap(1000),
  },
  // 21. 장바구니 태그 (틱톡샵 상품 앵커)
  {
    id: 'remix-m-cart-tag', name: '장바구니 태그', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 좌하단 주황 장바구니 상품 태그 (틱톡샵 상품 링크 영상)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 220, align: 5, maxWidth: 980, style: { size: 64, color: '#ffffff', bold: true, outline: 7, outlineColor: '#000000' } },
      { kind: 'text', slot: 'title2', x: 540, y: 320, align: 5, maxWidth: 980, style: { size: 72, color: '#ffde00', bold: true, outline: 7, outlineColor: '#000000' } },
      { kind: 'rect', x: 50, y: 1560, w: 760, h: 120, color: '#ffffff', alpha: 0.05 },
      { kind: 'rect', x: 50, y: 1560, w: 120, h: 120, color: '#ff6a00' },
      { kind: 'text', slot: { static: '담기' }, x: 110, y: 1620, align: 5, style: { size: 36, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'footer', x: 195, y: 1620, align: 4, maxWidth: 600, style: { size: 34, color: '#111111', bold: true } },
    ],
    caption: cap(1000, { size: 74 }),
  },
  // 22. 도우인 대형 배너
  {
    id: 'remix-m-douyin-banner', name: '대륙 빅배너', family: 'remix', canvas: '#c8102e',
    description: '빨간 바탕 + 노랑 초대형 외곽선 제목 + 하단 노랑 띠 (도우인 带货 영상 문법)',
    video: { x: 30, y: 420, w: 1020, h: 1160 },
    layers: [
      title1(200, '#ffffff', 66, { style: { size: 66, color: '#ffffff', bold: true, outline: 6, outlineColor: '#7a0010' } }),
      title2(320, '#ffe600', 86, { style: { size: 86, color: '#ffe600', bold: true, outline: 8, outlineColor: '#7a0010' } }),
      ...frame(24, 414, 1032, 1172, 6, '#ffe600'),
      { kind: 'rect', x: 0, y: 1620, w: 1080, h: 120, color: '#ffe600' },
      { kind: 'text', slot: 'footer', x: 540, y: 1680, align: 5, maxWidth: 980, style: { size: 40, color: '#c8102e', bold: true } },
    ],
    caption: cap(1000, { outline: 9, alternateColors: ['#ffffff', '#ffe600'] }),
  },
  // 23. 라이브 방송형
  {
    id: 'remix-m-live', name: '라이브 방송', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 좌상단 LIVE 배지·채널명 + 하단 반투명 공지 띠 (라이브커머스 클립)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'text', slot: { static: '● LIVE' }, x: 50, y: 175, align: 4, style: { size: 34, color: '#ffffff', bold: true, box: { color: '#ff1f4b', pad: 12 } } },
      { kind: 'text', slot: 'channel', x: 230, y: 175, align: 4, maxWidth: 780, style: { size: 34, color: '#ffffff', bold: true, box: { color: '#000000', alpha: 0.5, pad: 12 } } },
      { kind: 'text', slot: 'title', x: 540, y: 310, align: 5, maxWidth: 980, style: { size: 64, color: '#ffffff', bold: true, outline: 7, outlineColor: '#000000' } },
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 120, color: '#000000', alpha: 0.45 },
      { kind: 'text', slot: { static: '공지' }, x: 50, y: 1660, align: 4, style: { size: 32, color: '#111111', bold: true, box: { color: '#ffd400', pad: 10 } } },
      { kind: 'text', slot: 'footer', x: 150, y: 1660, align: 4, maxWidth: 880, style: { size: 34, color: '#ffffff', bold: true } },
    ],
    caption: cap(1000),
  },
  // 24. VS 비교
  {
    id: 'remix-m-vs-compare', name: 'VS 비교', family: 'remix', canvas: '#0f172a',
    description: '좌 파랑 · 우 빨강 대결 띠에 두 제목 + 가운데 VS (비교·대결 리뷰 채널)',
    video: V,
    layers: [
      { kind: 'rect', x: 0, y: 140, w: 540, h: 230, color: '#2563eb' },
      { kind: 'rect', x: 540, y: 140, w: 540, h: 230, color: '#dc2626' },
      { kind: 'text', slot: 'title1', x: 270, y: 255, align: 5, maxWidth: 440, style: { size: 52, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 810, y: 255, align: 5, maxWidth: 440, style: { size: 52, color: '#ffffff', bold: true } },
      { kind: 'text', slot: { static: 'VS' }, x: 540, y: 255, align: 5, style: { size: 54, color: '#111111', bold: true, box: { color: '#ffd400', pad: 14 } } },
      footer(1700, '#cbd5e1'),
    ],
    caption: cap(1000, { alternateColors: ['#93c5fd', '#fca5a5'] }),
  },
  // 25. 질문 훅
  {
    id: 'remix-m-question', name: 'Q&A 질문훅', family: 'remix', canvas: '#1d4ed8',
    description: '파란 바탕 + 큰 Q. 와 질문 제목, A. 답 강조 (궁금증 해결·꿀팁 채널)',
    video: { x: 40, y: 430, w: 1000, h: 1150 },
    layers: [
      { kind: 'text', slot: { static: 'Q.' }, x: 60, y: 230, align: 4, style: { size: 110, color: '#ffd400', bold: true } },
      { kind: 'text', slot: 'title1', x: 200, y: 230, align: 4, maxWidth: 840, style: { size: 58, color: '#ffffff', bold: true } },
      { kind: 'text', slot: { static: 'A.' }, x: 66, y: 350, align: 4, style: { size: 56, color: '#ffd400', bold: true } },
      { kind: 'text', slot: 'title2', x: 150, y: 350, align: 4, maxWidth: 890, style: { size: 60, color: '#111111', bold: true, box: { color: '#ffffff', pad: 12 } } },
      footer(1690, '#dbeafe'),
    ],
    caption: cap(1005),
  },
  // 26. 메모장
  {
    id: 'remix-m-memo', name: '노란 메모장', family: 'remix', canvas: '#fff5b8',
    description: '노란 메모지 줄무늬 + 빨간 세로 여백선 + 손글씨 느낌 제목 (살림 메모·리스트 채널)',
    video: { x: 60, y: 450, w: 960, h: 1130 },
    layers: [
      { kind: 'rect', x: 0, y: 130, w: 1080, h: 40, color: '#f2c94c' },
      { kind: 'rect', x: 110, y: 170, w: 4, h: 260, color: '#ff6b6b' },
      { kind: 'rect', x: 0, y: 290, w: 1080, h: 2, color: '#e3d38a' },
      { kind: 'rect', x: 0, y: 400, w: 1080, h: 2, color: '#e3d38a' },
      { kind: 'text', slot: 'title1', x: 140, y: 240, align: 4, maxWidth: 900, style: { size: 56, color: '#333333', bold: true } },
      { kind: 'text', slot: 'title2', x: 140, y: 350, align: 4, maxWidth: 900, style: { size: 64, color: '#d6336c', bold: true } },
      footer(1680, '#7a6a1f', 36),
    ],
    caption: cap(1015),
  },
  // 27. 세일 폭탄
  {
    id: 'remix-m-sale-bomb', name: '세일 폭탄', family: 'remix', canvas: '#ff2d55',
    description: '핑크레드 바탕 + 큰 SALE 워터마크 + 흰 박스 제목 (블프·시즌 세일 홍보 쇼츠)',
    video: { x: 40, y: 430, w: 1000, h: 1150 },
    layers: [
      { kind: 'watermark', slot: { static: 'SALE' }, color: '#ffffff', alpha: 0.12, size: 90 },
      { kind: 'text', slot: 'title1', x: 540, y: 200, align: 5, maxWidth: 980, style: { size: 60, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 320, align: 5, maxWidth: 940, style: { size: 70, color: '#ff2d55', bold: true, box: { color: '#ffffff', pad: 16 } } },
      ...frame(34, 424, 1012, 1162, 6, '#ffffff'),
      footer(1680, '#ffffff'),
    ],
    caption: cap(1005, { alternateColors: ['#ffffff', '#ffe600'] }),
  },
  // 28. 살림템 체크리스트
  {
    id: 'remix-m-living-check', name: '살림템 체크', family: 'remix', canvas: '#fdf6ec',
    description: '크림 바탕 + 초록 체크 표시 2줄 제목 (주방·청소 살림템 추천 채널)',
    video: { x: 0, y: 430, w: 1080, h: 1170 },
    layers: [
      { kind: 'text', slot: { static: '✓' }, x: 60, y: 230, align: 4, style: { size: 56, color: '#ffffff', bold: true, box: { color: '#2f9e44', pad: 8 } } },
      { kind: 'text', slot: 'title1', x: 140, y: 230, align: 4, maxWidth: 900, style: { size: 58, color: '#2b2118', bold: true } },
      { kind: 'text', slot: { static: '✓' }, x: 60, y: 340, align: 4, style: { size: 56, color: '#ffffff', bold: true, box: { color: '#2f9e44', pad: 8 } } },
      { kind: 'text', slot: 'title2', x: 140, y: 340, align: 4, maxWidth: 900, style: { size: 64, color: '#2f9e44', bold: true } },
      { kind: 'rect', x: 0, y: 1600, w: 1080, h: 320, color: '#2b2118' },
      footer(1690, '#fdf6ec'),
    ],
    caption: cap(1015),
  },
  // 29. 언박싱 크라프트
  {
    id: 'remix-m-unboxing', name: '언박싱 박스', family: 'remix', canvas: '#c89f6c',
    description: '크라프트 상자색 바탕 + 상단 테이프 띠 + 택배 송장풍 라벨 (언박싱·하울 채널)',
    video: { x: 50, y: 450, w: 980, h: 1130 },
    layers: [
      { kind: 'rect', x: 0, y: 130, w: 1080, h: 60, color: '#e8d3a8', alpha: 0.2 },
      { kind: 'text', slot: { static: 'UNBOXING' }, x: 540, y: 160, align: 5, style: { size: 34, color: '#7a5230', bold: true, spacing: 12 } },
      { kind: 'rect', x: 80, y: 220, w: 920, h: 200, color: '#ffffff' },
      { kind: 'text', slot: { static: '받는 분' }, x: 110, y: 262, align: 4, style: { size: 28, color: '#888888', bold: true } },
      { kind: 'text', slot: 'title1', x: 250, y: 262, align: 4, maxWidth: 720, style: { size: 44, color: '#222222', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 362, align: 5, maxWidth: 880, style: { size: 60, color: '#b44d12', bold: true } },
      ...frame(46, 446, 988, 1138, 4, '#7a5230'),
      footer(1680, '#3b2716'),
    ],
    caption: cap(1015),
  },
  // 30. 테크 리뷰 스펙
  {
    id: 'remix-m-tech-spec', name: '테크 스펙 시트', family: 'remix', canvas: '#111318',
    description: '다크 그레이 + 파란 포인트 선과 SPEC 라벨 (전자기기·가전 리뷰 채널)',
    video: { x: 0, y: 420, w: 1080, h: 1160 },
    layers: [
      { kind: 'text', slot: { static: 'REVIEW · SPEC' }, x: 60, y: 165, align: 4, style: { size: 28, color: '#3b82f6', bold: true, spacing: 6 } },
      { kind: 'text', slot: 'title1', x: 60, y: 250, align: 4, maxWidth: 960, style: { size: 58, color: '#f3f4f6', bold: true } },
      { kind: 'text', slot: 'title2', x: 60, y: 340, align: 4, maxWidth: 960, style: { size: 64, color: '#60a5fa', bold: true } },
      { kind: 'rect', x: 60, y: 396, w: 120, h: 6, color: '#3b82f6' },
      { kind: 'rect', x: 0, y: 1580, w: 1080, h: 2, color: '#374151' },
      footer(1680, '#9ca3af', 34),
    ],
    caption: cap(1000, { box: { color: '#0b0d12', alpha: 0.2, pad: 18 }, outline: 0, size: 62 }),
  },
  // 31. 상하 듀얼 밴드
  {
    id: 'remix-m-dual-band', name: '상하 듀얼 밴드', family: 'remix', canvas: '#111111',
    description: '위 노랑 띠(검정 제목) + 아래 검정 띠(노랑 문구) 대비형 (쇼핑 쇼츠 대량 운영 채널)',
    video: { x: 0, y: 420, w: 1080, h: 1180 },
    layers: [
      { kind: 'rect', x: 0, y: 0, w: 1080, h: 420, color: '#ffd400' },
      title1(220, '#111111', 64),
      title2(330, '#111111', 76),
      footer(1700, '#ffd400', 40),
    ],
    caption: cap(1010),
  },
  // 32. 폴라로이드
  {
    id: 'remix-m-polaroid', name: '폴라로이드', family: 'remix', canvas: '#d9cfc1',
    description: '베이지 바탕 + 흰 폴라로이드 사진 틀(아래 두꺼운 여백에 문구) (감성 소품·인테리어 채널)',
    video: { x: 100, y: 470, w: 880, h: 1020 },
    layers: [
      // 레이어는 영상 위에 그려지므로 틀은 영상 바깥 4면만 칠한다 (아래는 두꺼운 여백)
      { kind: 'rect', x: 70, y: 440, w: 940, h: 30, color: '#ffffff' },
      { kind: 'rect', x: 70, y: 440, w: 30, h: 1230, color: '#ffffff' },
      { kind: 'rect', x: 980, y: 440, w: 30, h: 1230, color: '#ffffff' },
      { kind: 'rect', x: 70, y: 1490, w: 940, h: 180, color: '#ffffff' },
      { kind: 'rect', x: 470, y: 420, w: 140, h: 44, color: '#f5e6a8', alpha: 0.15 },
      title1(220, '#3a2f25', 58),
      title2(320, '#a0522d', 66),
      { kind: 'text', slot: 'comment', x: 540, y: 1580, align: 5, maxWidth: 860, style: { size: 46, color: '#3a2f25', bold: true } },
      footer(1750, '#5a4a3a', 34),
    ],
    caption: cap(990, { size: 66, maxWidth: 840 }),
  },
  // 33. 쿠폰 티켓
  {
    id: 'remix-m-coupon', name: '할인 쿠폰', family: 'remix', canvas: '#fff0e6',
    description: '주황 쿠폰 티켓(절취 점선 + COUPON 라벨) 안에 제목 (할인코드·쿠폰 안내 채널)',
    video: { x: 40, y: 450, w: 1000, h: 1130 },
    layers: [
      { kind: 'rect', x: 50, y: 130, w: 980, h: 290, color: '#ff6b00' },
      { kind: 'rect', x: 50, y: 130, w: 200, h: 290, color: '#e25b00' },
      { kind: 'text', slot: { static: 'COUPON' }, x: 150, y: 275, align: 5, rotate: 90, style: { size: 44, color: '#ffffff', bold: true, spacing: 4 } },
      { kind: 'rect', x: 248, y: 140, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 180, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 220, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 260, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 300, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 340, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'rect', x: 248, y: 380, w: 4, h: 20, color: '#fff0e6' },
      { kind: 'text', slot: 'title1', x: 640, y: 225, align: 5, maxWidth: 740, style: { size: 52, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 640, y: 330, align: 5, maxWidth: 740, style: { size: 62, color: '#fff200', bold: true } },
      footer(1680, '#b34700'),
    ],
    caption: cap(1015),
  },
  // 34. 경고 테이프
  {
    id: 'remix-m-caution-tape', name: '경고 테이프', family: 'remix', canvas: '#111111',
    description: '노랑·검정 줄무늬 경고 테이프 + "사기 전 필독" 라벨 (주의·솔직 단점 리뷰 채널)',
    video: { x: 0, y: 440, w: 1080, h: 1140 },
    layers: [
      ...Array.from({ length: 14 }, (_, i): Layer => ({ kind: 'rect', x: i * 80, y: 130, w: 40, h: 36, color: '#ffd400' })),
      pill({ static: '사기 전 필독' }, 540, 222, 36, '#111111', '#ffd400'),
      title1(310, '#ffffff', 60),
      title2(396, '#ffd400', 64),
      ...Array.from({ length: 14 }, (_, i): Layer => ({ kind: 'rect', x: i * 80, y: 1580, w: 40, h: 36, color: '#ffd400' })),
      footer(1700, '#ffd400', 36),
    ],
    caption: cap(1010),
  },
  // 35. 푸시 알림 팝업
  {
    id: 'remix-m-push-alert', name: '푸시 알림', family: 'remix', canvas: '#000000',
    description: '전체 화면 + 상단 휴대폰 푸시 알림 카드(앱 아이콘·제목·내용) (알림형 후킹 쇼츠)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'rect', x: 40, y: 140, w: 1000, h: 250, color: '#f5f5f7', alpha: 0.06 },
      { kind: 'rect', x: 76, y: 172, w: 64, h: 64, color: '#ff3b30' },
      { kind: 'text', slot: { static: '!' }, x: 108, y: 204, align: 5, style: { size: 44, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'channel', x: 162, y: 204, align: 4, maxWidth: 640, style: { size: 30, color: '#6b7280', bold: true } },
      { kind: 'text', slot: { static: '지금' }, x: 1004, y: 204, align: 6, style: { size: 28, color: '#9ca3af', bold: true } },
      { kind: 'text', slot: 'title1', x: 80, y: 280, align: 4, maxWidth: 920, style: { size: 46, color: '#111111', bold: true } },
      { kind: 'text', slot: 'title2', x: 80, y: 346, align: 4, maxWidth: 920, style: { size: 42, color: '#374151', bold: true } },
      { kind: 'text', slot: 'footer', x: 540, y: 1660, align: 5, maxWidth: 960, style: { size: 36, color: '#ffffff', bold: true, outline: 4, outlineColor: '#000000' } },
    ],
    caption: cap(1000, { size: 76 }),
  },
  // 36. 찜 하트
  {
    id: 'remix-m-wishlist', name: '찜 필수 하트', family: 'remix', canvas: '#fff1f3',
    description: '연핑크 바탕 + 빨간 하트 "찜 필수" 배지와 2줄 제목 (위시리스트·선물 추천 채널)',
    video: { x: 40, y: 440, w: 1000, h: 1140 },
    layers: [
      pill({ static: '♥ 찜 필수' }, 540, 166, 36, '#ffffff', '#f03e3e'),
      title1(262, '#2b2b2b', 58),
      title2(358, '#f03e3e', 68),
      ...frame(34, 434, 1012, 1152, 6, '#ffc9d1'),
      footer(1680, '#c92a2a', 36),
    ],
    caption: cap(1010, { outlineColor: '#7a1020' }),
  },
];
