import type { Template, TemplateFamily } from './types';
import { storyV1FrameTemplates } from './from-story-v1';
import { REMIX_MARKET_TEMPLATES } from './remix-market';

/**
 * 실제 썰 쇼핑 채널 화면을 관찰해 만든 템플릿 (docs/ssul-templates-observed.md).
 * 브랜드·채널 로고는 복제하지 않고 레이아웃 문법만 따른다.
 * storyv1 = AI 스토리 쇼핑 숏폼 버전1 채널 프레임 전체.
 */

export const FAMILIES: { id: TemplateFamily; name: string; description: string }[] = [
  { id: 'storyv1', name: '스토리 ver1', description: 'AI 스토리 쇼핑 숏폼 버전1 채널 화면 템플릿 전부' },
  { id: 'board', name: '게시판형', description: '컬러 헤더 + 굵은 제목 + 구분선, 자막은 영상 위 흰 영역' },
  { id: 'app', name: '앱 화면형', description: '앱 상단바(뒤로·로고·메뉴) + 제목 + 메타 줄' },
  { id: 'community', name: '커뮤니티 글형', description: '커뮤니티 게시글 화면처럼 좋아요 바·작성 정보' },
  { id: 'letterbox', name: '블랙 레터박스형', description: '검정 배경 2줄 2색 제목 + 가운데 영상 + 하단 코멘트' },
  { id: 'headline', name: '헤드라인형', description: '흰 배경 큰 2색 제목 또는 카드처럼 작은 영상' },
  { id: 'fullscreen', name: '풀스크린 자막형', description: '영상 전체 화면 + 자막' },
  { id: 'travel', name: '여행형', description: '위치 핀·가격표·특가 배지 등 여행 상품 정보 표시' },
  { id: 'poster', name: '포스터 인트로형', description: '첫 2초 큰 2색 제목 후 풀스크린' },
  { id: 'remix', name: '중앙자막 카드형', description: '상단 2줄 포인트 타이틀 + 영상 정중앙 큰 자막' },
  { id: 'review', name: '리뷰·랭킹형', description: '상품마다 순위 배지 + 상품명 카드 (리뷰·랭킹 쇼츠 56개 실측)' },
];

const W = 1080;
const DARK = '#111111';
const GRAY = '#8a8a8a';
const LINE = '#d9d9d9';

/** 흰 바탕 계열(게시판·앱·커뮤니티) 공통: 제목 아래 흰 영역에 자막, 그 아래 영상 */
const WHITE_CAPTION = { x: 540, y: 430, align: 5 as const, maxWidth: 980, size: 50, color: '#222222', bold: true };
const WHITE_VIDEO = { x: 0, y: 540, w: 1080, h: 960 };

function board(id: string, name: string, header: string, headerText: string): Template {
  return {
    id, name, family: 'board', canvas: '#ffffff',
    description: `${name} 헤더의 게시판형 (선물가게 스타일 문법)`,
    video: WHITE_VIDEO,
    layers: [
      { kind: 'rect', x: 0, y: 0, w: W, h: 160, color: header },
      { kind: 'text', slot: 'channel', x: 540, y: 82, align: 5, style: { size: 50, color: headerText, bold: true, spacing: 4 } },
      { kind: 'text', slot: 'title', x: 540, y: 245, align: 5, maxWidth: 1000, style: { size: 62, color: DARK, bold: true } },
      { kind: 'rect', x: 60, y: 318, w: 960, h: 4, color: LINE },
    ],
    caption: WHITE_CAPTION,
  };
}

function app(id: string, name: string, bar: string, logo: string, icon: string): Template {
  return {
    id, name, family: 'app', canvas: '#ffffff',
    description: `${name} 앱 화면형 (썰쇼템 스타일 문법)`,
    video: WHITE_VIDEO,
    layers: [
      { kind: 'rect', x: 0, y: 0, w: W, h: 150, color: bar },
      { kind: 'icon', name: 'back', x: 70, y: 75, size: 44, color: icon },
      { kind: 'text', slot: 'channel', x: 540, y: 78, align: 5, style: { size: 56, color: logo, bold: true, spacing: 2 } },
      { kind: 'icon', name: 'menu', x: 1010, y: 75, size: 46, color: icon },
      { kind: 'text', slot: 'title', x: 50, y: 225, align: 4, maxWidth: 980, style: { size: 58, color: DARK, bold: true } },
      { kind: 'text', slot: 'meta', x: 50, y: 290, align: 4, style: { size: 30, color: GRAY } },
      { kind: 'rect', x: 50, y: 330, w: 980, h: 4, color: LINE },
    ],
    caption: WHITE_CAPTION,
  };
}

function community(id: string, name: string, bar: string, kind: 'like' | 'board', accent: string, watermark: boolean): Template {
  const layers: Template['layers'] = [
    { kind: 'rect', x: 0, y: 0, w: W, h: 140, color: bar },
    ...(kind === 'like'
      ? [
          { kind: 'icon' as const, name: 'like' as const, x: 80, y: 70, size: 54, color: DARK },
          { kind: 'text' as const, slot: 'channel' as const, x: 540, y: 72, align: 5 as const, style: { size: 54, color: DARK, bold: true, spacing: 18 } },
          { kind: 'icon' as const, name: 'chevrons' as const, x: 1000, y: 70, size: 46, color: DARK },
        ]
      : [
          { kind: 'icon' as const, name: 'menu' as const, x: 70, y: 70, size: 44, color: DARK },
          { kind: 'text' as const, slot: 'channel' as const, x: 540, y: 72, align: 5 as const, style: { size: 50, color: DARK, bold: true } },
          { kind: 'icon' as const, name: 'avatar' as const, x: 1000, y: 70, size: 70, color: accent },
        ]),
    { kind: 'text', slot: 'title', x: 50, y: 210, align: 4, maxWidth: 980, style: { size: 54, color: DARK, bold: true } },
    { kind: 'text', slot: 'meta', x: 50, y: 272, align: 4, style: { size: 28, color: GRAY } },
    { kind: 'rect', x: 50, y: 310, w: 980, h: 3, color: LINE },
  ];
  if (watermark) layers.unshift({ kind: 'watermark', slot: 'channel', color: '#000000', alpha: 0.06, size: 40 });
  return {
    id, name, family: 'community', canvas: '#ffffff',
    description: `${name} 커뮤니티 글형 (썰템·썰 모아보기 스타일 문법)`,
    video: { x: 60, y: 540, w: 960, h: 960 },
    layers,
    caption: { ...WHITE_CAPTION, size: 46, y: 420 },
  };
}

function letterbox(id: string, name: string, accent: string, commentColor = '#ffffff'): Template {
  return {
    id, name, family: 'letterbox', canvas: '#000000',
    description: `검정 배경 + ${name} 강조 2줄 제목 (썰템도감 스타일 문법)`,
    video: { x: 0, y: 380, w: 1080, h: 1240 },
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 165, align: 5, maxWidth: 1020, style: { size: 70, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 270, align: 5, maxWidth: 1020, style: { size: 76, color: accent, bold: true } },
      { kind: 'text', slot: 'comment', x: 540, y: 1720, align: 5, maxWidth: 1000, style: { size: 40, color: commentColor } },
    ],
    caption: { x: 540, y: 1500, align: 5, maxWidth: 1000, size: 58, color: '#ffffff', bold: true, outline: 6, outlineColor: '#000000' },
  };
}

function fullscreen(id: string, name: string, description: string, caption: Template['caption'], extra: Template['layers'] = [], introPoster = false): Template {
  return {
    id, name, family: introPoster ? 'poster' : 'fullscreen', canvas: '#000000', description,
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: extra,
    caption,
    introPoster,
    posterColors: ['#ffffff', '#ffe500'],
  };
}

const CAP_OUTLINE = { x: 540, y: 960, align: 5 as const, maxWidth: 1000, size: 74, color: '#ffffff', bold: true, outline: 7, outlineColor: '#000000' };

export const TEMPLATES: Template[] = [
  // 게시판형 6
  board('board-green', '연두', '#9fdc7c', '#2f4a22'),
  board('board-sky', '하늘', '#9fd3f5', '#1d3b52'),
  board('board-pink', '핑크', '#ffc2d6', '#5a2238'),
  board('board-lavender', '라벤더', '#cdbcf5', '#35275a'),
  board('board-mint', '민트', '#a8ead8', '#1f4a3f'),
  board('board-beige', '베이지', '#ecdcc0', '#4a3a22'),
  // 앱 화면형 3
  app('app-yellow', '노랑 로고', '#ffffff', '#f2a900', '#222222'),
  app('app-dark', '다크 바', '#1c1c1e', '#ffffff', '#ffffff'),
  app('app-blue', '블루 바', '#2f6bff', '#ffffff', '#ffffff'),
  // 커뮤니티 글형 3
  community('community-like', '연노랑 좋아요 바', '#fff1b8', 'like', '#f2a900', false),
  community('community-board', '연보라 썰 모아보기', '#e3cdf2', 'board', '#7bc67b', true),
  community('community-mint', '민트 좋아요 바', '#c9f0e4', 'like', '#2fae86', false),
  // 블랙 레터박스형 3
  letterbox('letterbox-red', '빨강', '#ff4d4d'),
  letterbox('letterbox-purple', '보라', '#9b7bff'),
  letterbox('letterbox-yellow', '노랑', '#ffe14d'),
  // 풀스크린 자막형 4
  fullscreen('full-clean', '깔끔 자막', '영상 전체 + 중앙 위쪽 얇은 흰 자막 (살림딱 스타일 문법)', {
    x: 540, y: 820, align: 5, maxWidth: 1000, size: 54, color: '#ffffff', bold: true, shadow: 3, outline: 1, outlineColor: '#000000',
  }),
  fullscreen('full-ad', '[광고] 표기', '좌상단 [광고] + 중하단 외곽선 자막 (쿠팡 파트너스 채널 문법)', CAP_OUTLINE, [
    { kind: 'text', slot: { static: '[광고]' }, x: 60, y: 150, align: 7, style: { size: 40, color: '#ffffff', bold: true, outline: 3, outlineColor: '#000000' } },
  ]),
  fullscreen('full-bold-color', '굵은 강조색', '화면 중앙 큰 굵은 자막 + 강조색 외곽선 (득템 스타일 문법)', {
    x: 540, y: 980, align: 5, maxWidth: 1000, size: 86, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000', alternateColors: ['#ffffff', '#ffe500', '#7cf3ff'],
  }),
  fullscreen('full-yellow-white', '노랑·흰 교차', '중하단 노랑/흰 교차 자막 (딱살림 스타일 문법)', { ...CAP_OUTLINE, alternateColors: ['#ffe500', '#ffffff'] }),
  // 포스터 인트로형 2
  fullscreen('poster-yellow', '포스터 인트로 (노랑)', '첫 2초 큰 2색 제목 후 풀스크린 자막', CAP_OUTLINE, [], true),
  fullscreen('poster-ad', '포스터 인트로 + [광고]', '첫 2초 큰 제목 + [광고] 표기', CAP_OUTLINE, [
    { kind: 'text', slot: { static: '[광고]' }, x: 60, y: 150, align: 7, style: { size: 40, color: '#ffffff', bold: true, outline: 3, outlineColor: '#000000' } },
  ], true),
  // ── 2차 리서치(36개 채널 106개 영상 레이아웃 측정)로 추가 ──
  // 풀스크린 변형 (측정한 영상의 64%가 풀스크린 자막형)
  fullscreen('full-small-center', '작은 중앙 자막', '화면 정중앙 작은 흰 자막 + 얇은 외곽선 (리뷰띠·206호·소개팁 문법)', {
    x: 540, y: 960, align: 5, maxWidth: 980, size: 50, color: '#ffffff', bold: true, outline: 3, outlineColor: '#000000', shadow: 1,
  }),
  fullscreen('full-big-thin', '큰 얇은 자막', '중앙 위쪽 큰 흰 자막 + 그림자 (그래서리뷰 문법)', {
    x: 540, y: 700, align: 5, maxWidth: 1000, size: 84, color: '#ffffff', bold: false, outline: 2, outlineColor: '#333333', shadow: 4,
  }),
  fullscreen('full-box-black', '검정 박스 자막', '검정 박스 위 흰 글자 라벨 자막 (원룸만들기·206호 문법)', {
    x: 540, y: 1180, align: 5, maxWidth: 960, size: 58, color: '#ffffff', bold: true, box: { color: '#000000', alpha: 0.05, pad: 16 },
  }),
  fullscreen('full-box-white', '흰 박스 자막', '흰 박스 위 검정 글자 (밈 자막 문법)', {
    x: 540, y: 1180, align: 5, maxWidth: 960, size: 58, color: '#111111', bold: true, box: { color: '#ffffff', pad: 16 },
  }),
  fullscreen('full-top-yellow', '상단 노랑 자막', '화면 위쪽 노랑 굵은 자막 + 두꺼운 외곽선 (살림역·꿀바구니 문법)', {
    x: 540, y: 430, align: 5, maxWidth: 1000, size: 70, color: '#ffe14d', bold: true, outline: 7, outlineColor: '#000000',
  }),
  fullscreen('full-ad-right', '[광고] 우상단 + 워터마크', '우상단 [광고] + 가운데 옅은 @채널 워터마크 (썰핫템·리뷰띠 문법)', CAP_OUTLINE, [
    { kind: 'text', slot: { static: '[광고]' }, x: 1020, y: 140, align: 9, style: { size: 36, color: '#ffffff', bold: true, outline: 2, outlineColor: '#000000' } },
    { kind: 'text', slot: 'handle', x: 540, y: 1000, align: 5, alpha: 0.6, style: { size: 40, color: '#ffffff', bold: true } },
  ]),
  fullscreen('full-lower-band', '하단 반투명 띠', '아래쪽 반투명 검정 띠 + 흰 자막', {
    x: 540, y: 1460, align: 5, maxWidth: 1000, size: 56, color: '#ffffff', bold: true, box: { color: '#000000', alpha: 0.3, pad: 28 },
  }),
  // 레터박스 변형
  {
    ...letterbox('letterbox-poster', '흰+노랑 굵은 외곽선', '#ffe14d'),
    description: '검정 배경 큰 2색 제목 + 두꺼운 외곽선 (한국아우라·셀럽 문법)',
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 150, align: 5, maxWidth: 1020, style: { size: 84, color: '#ffffff', bold: true, outline: 6, outlineColor: '#000000' } },
      { kind: 'text', slot: 'title2', x: 540, y: 270, align: 5, maxWidth: 1020, style: { size: 90, color: '#ffe14d', bold: true, outline: 6, outlineColor: '#000000' } },
      { kind: 'text', slot: 'comment', x: 540, y: 1720, align: 5, maxWidth: 1000, style: { size: 40, color: '#ffffff' } },
    ],
  },
  {
    ...letterbox('letterbox-quote', '인용구 제목', '#ffe14d'),
    description: '따옴표 인용 제목, 둘째 줄 노랑 강조 (클리어 화일 활용법 문법)',
    layers: [
      { kind: 'text', slot: { static: '“' }, x: 70, y: 120, align: 7, style: { size: 120, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title1', x: 540, y: 175, align: 5, maxWidth: 940, style: { size: 70, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 275, align: 5, maxWidth: 940, style: { size: 74, color: '#ffe14d', bold: true } },
      { kind: 'text', slot: { static: '”' }, x: 1010, y: 230, align: 9, style: { size: 120, color: '#ffffff', bold: true } },
    ],
  },
  {
    id: 'banner-red', name: '빨강 라벨 배너', family: 'letterbox', canvas: '#000000',
    description: '빨강 라벨 + 노랑 헤드라인(빨강 외곽선) + 노랑 자막 (육아템 광고형 문법)',
    video: { x: 0, y: 420, w: 1080, h: 1180 },
    layers: [
      { kind: 'text', slot: { static: '궁금하면 여기 클릭' }, x: 60, y: 70, align: 7, style: { size: 38, color: '#ffffff', bold: true, box: { color: '#e02424', pad: 10 } } },
      { kind: 'text', slot: 'title1', x: 540, y: 225, align: 5, maxWidth: 1020, style: { size: 74, color: '#ffe14d', bold: true, outline: 6, outlineColor: '#c81e1e' } },
      { kind: 'text', slot: 'title2', x: 540, y: 330, align: 5, maxWidth: 1020, style: { size: 74, color: '#ffe14d', bold: true, outline: 6, outlineColor: '#c81e1e' } },
    ],
    caption: { x: 540, y: 1720, align: 5, maxWidth: 1000, size: 62, color: '#ffe14d', bold: true, outline: 5, outlineColor: '#000000' },
  },
  // 게시판·앱 변형
  {
    ...board('board-orange-avatar', '주황 + 캐릭터', '#ff7a3d', '#ffffff'),
    description: '주황 헤더 + 오른쪽 캐릭터 동그라미 (썰푸는 녀석들 문법)',
    layers: [
      ...board('x', 'x', '#ff7a3d', '#ffffff').layers,
      { kind: 'icon', name: 'avatar', x: 990, y: 80, size: 96, color: '#ffffff' },
    ],
  },
  {
    ...app('app-pink-footer', '핑크 + 구매 안내', '#ffe4ef', '#e0457b', '#222222'),
    description: '핑크 앱 헤더 + 하단 "구매방법 > 프로필 링크" 안내 (썰리뷰·핫템중개소 문법)',
    layers: [
      ...app('x', 'x', '#ffe4ef', '#e0457b', '#222222').layers,
      { kind: 'text', slot: 'footer', x: 60, y: 1560, align: 7, style: { size: 40, color: '#222222', bold: true } },
    ],
  },
  app('app-yellowbar', '노랑 앱바', '#ffe14d', '#111111', '#111111'),
  {
    id: 'card-maroon', name: '카드형 (와인 헤더)', family: 'headline', canvas: '#ffffff',
    description: '와인색 헤더 + 회색 기울임 제목 + 가운데 작은 영상 카드 (지름신 문법)',
    video: { x: 140, y: 620, w: 800, h: 800 },
    layers: [
      { kind: 'rect', x: 0, y: 0, w: W, h: 150, color: '#6b2140' },
      { kind: 'text', slot: 'channel', x: 540, y: 76, align: 5, style: { size: 54, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title', x: 540, y: 250, align: 5, maxWidth: 980, style: { size: 46, color: '#555555', italic: true } },
      // 영상 카드 테두리 (레이어는 영상 위에 그려지므로 테두리 선 4개로)
      { kind: 'rect', x: 134, y: 614, w: 812, h: 6, color: '#d0d0d0' },
      { kind: 'rect', x: 134, y: 1420, w: 812, h: 6, color: '#d0d0d0' },
      { kind: 'rect', x: 134, y: 614, w: 6, h: 812, color: '#d0d0d0' },
      { kind: 'rect', x: 940, y: 614, w: 6, h: 812, color: '#d0d0d0' },
    ],
    caption: { x: 540, y: 470, align: 5, maxWidth: 960, size: 56, color: '#333333', bold: false, italic: true },
  },
  {
    id: 'white-headline', name: '흰 배경 2색 헤드라인', family: 'headline', canvas: '#ffffff',
    description: '흰 배경 큰 2색 제목(검정 + 보라) + 아래 영상 (김영옥쌤 숏폼 문법)',
    video: { x: 0, y: 470, w: 1080, h: 1220 },
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 160, align: 5, maxWidth: 1020, style: { size: 82, color: '#111111', bold: true, outline: 4, outlineColor: '#ffffff' } },
      { kind: 'text', slot: 'title2', x: 540, y: 290, align: 5, maxWidth: 1020, style: { size: 88, color: '#7b3fe4', bold: true, outline: 4, outlineColor: '#ffffff' } },
    ],
    caption: { ...CAP_OUTLINE, y: 1500 },
  },
  // ── 여행 쇼핑숏폼 전용 ──
  {
    ...fullscreen('travel-pin', '위치 핀 + 가격표', '좌상단 위치 핀 라벨 + 우하단 노랑 가격표 + 중하단 자막', CAP_OUTLINE, [
      { kind: 'icon', name: 'pin', x: 78, y: 176, size: 46, color: '#ff4d4d' },
      { kind: 'text', slot: 'location', x: 112, y: 152, align: 7, style: { size: 40, color: '#111111', bold: true, box: { color: '#ffffff', pad: 12 } } },
      { kind: 'text', slot: 'price', x: 1010, y: 1560, align: 9, style: { size: 52, color: '#111111', bold: true, box: { color: '#ffe14d', pad: 14 } } },
    ]),
    family: 'travel',
  },
  {
    ...fullscreen('travel-deal', '특가 배지 + 기간', '좌상단 빨강 "특가" 배지 + 마감 기간 + 큰 자막', { ...CAP_OUTLINE, y: 1200, size: 72 }, [
      { kind: 'text', slot: { static: '특가' }, x: 60, y: 140, align: 7, style: { size: 52, color: '#ffffff', bold: true, box: { color: '#e02424', pad: 14 } } },
      { kind: 'text', slot: 'period', x: 230, y: 146, align: 7, style: { size: 40, color: '#ffffff', bold: true, box: { color: '#000000', alpha: 0.35, pad: 12 } } },
      { kind: 'text', slot: 'price', x: 540, y: 1520, align: 5, style: { size: 64, color: '#ffe14d', bold: true, outline: 6, outlineColor: '#000000' } },
    ]),
    family: 'travel',
  },
  {
    id: 'travel-board', name: '여행 게시판 (하늘)', family: 'travel', canvas: '#ffffff',
    description: '하늘색 헤더 + 제목 + 위치·가격 줄 + 흰 영역 자막',
    video: WHITE_VIDEO,
    layers: [
      { kind: 'rect', x: 0, y: 0, w: W, h: 160, color: '#5fb8f0' },
      { kind: 'text', slot: 'channel', x: 540, y: 82, align: 5, style: { size: 50, color: '#ffffff', bold: true, spacing: 4 } },
      { kind: 'text', slot: 'title', x: 540, y: 240, align: 5, maxWidth: 1000, style: { size: 60, color: DARK, bold: true } },
      { kind: 'icon', name: 'pin', x: 80, y: 312, size: 34, color: '#e02424' },
      { kind: 'text', slot: 'location', x: 108, y: 296, align: 7, style: { size: 32, color: '#444444', bold: true } },
      { kind: 'text', slot: 'price', x: 1020, y: 296, align: 9, style: { size: 32, color: '#e02424', bold: true } },
      { kind: 'rect', x: 60, y: 350, w: 960, h: 4, color: LINE },
    ],
    caption: { ...WHITE_CAPTION, y: 450 },
  },
  {
    ...letterbox('travel-letterbox', '여행 레터박스 + 정보 바', '#7eebff'),
    family: 'travel',
    description: '검정 배경 2색 제목 + 하단 위치·가격 정보 바',
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 165, align: 5, maxWidth: 1020, style: { size: 70, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 270, align: 5, maxWidth: 1020, style: { size: 76, color: '#7eebff', bold: true } },
      { kind: 'icon', name: 'pin', x: 80, y: 1720, size: 40, color: '#ff4d4d' },
      { kind: 'text', slot: 'location', x: 112, y: 1700, align: 7, style: { size: 40, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'price', x: 1020, y: 1700, align: 9, style: { size: 44, color: '#ffe14d', bold: true } },
    ],
  },

  // 리뷰·랭킹형 4 (리뷰·랭킹 쇼츠 56개 실측: 우상단 순위 박스 + 하단 상품명 카드, 2색 상단 제목)
  {
    ...fullscreen('review-rank-full', '랭킹 풀스크린 (노랑 배지)', '영상 전체 + 상단 2색 제목 + 우상단 순위 배지 + 상품명 카드', CAP_OUTLINE, [
      { kind: 'rect', x: 0, y: 0, w: W, h: 330, color: '#000000', alpha: 0.25 },
      { kind: 'text', slot: 'title1', x: 540, y: 120, align: 5, maxWidth: 1020, style: { size: 68, color: '#ffffff', bold: true, outline: 5, outlineColor: '#000000' } },
      { kind: 'text', slot: 'title2', x: 540, y: 230, align: 5, maxWidth: 1020, style: { size: 76, color: '#ffe500', bold: true, outline: 5, outlineColor: '#000000' } },
    ]),
    family: 'review',
    badge: { rank: { x: 1000, y: 370, size: 76, color: '#ffe500', textColor: '#111111' }, card: { x: 60, y: 1440, w: 960, size: 46, color: '#111111', textColor: '#ffffff', alpha: 0.2 } },
  },
  {
    ...board('review-board-rank', '랭킹 게시판 (주황)', '#ff5a36', '#ffffff'),
    family: 'review',
    description: '주황 헤더 게시판 + 영상 안 순위 배지·상품명 카드',
    badge: { rank: { x: 1040, y: 570, size: 64, color: '#ff5a36', textColor: '#ffffff' }, card: { x: 40, y: 1380, w: 1000, size: 42, color: '#ffffff', textColor: '#111111', alpha: 0.1 } },
  },
  {
    ...letterbox('review-letterbox-rank', '랭킹 레터박스 (민트)', '#3dffc5'),
    family: 'review',
    description: '검정 레터박스 2색 제목 + 순위 배지 + 상품명 카드',
    badge: { rank: { x: 1040, y: 410, size: 64, color: '#3dffc5', textColor: '#000000' }, card: { x: 40, y: 1610, w: 1000, size: 40, color: '#3dffc5', textColor: '#000000' } },
  },
  {
    ...fullscreen('review-clean', '솔직후기 클린 (흰 카드)', '영상 전체 + 흰 상품명 카드, 순위 없는 후기·비교용', { ...CAP_OUTLINE, y: 960 }, [
      { kind: 'text', slot: 'title', x: 540, y: 150, align: 5, maxWidth: 1000, style: { size: 64, color: '#ffffff', bold: true, outline: 6, outlineColor: '#000000' } },
    ]),
    family: 'review',
    badge: { rank: { x: 1000, y: 340, size: 64, color: '#ff3b6b', textColor: '#ffffff' }, card: { x: 60, y: 1420, w: 960, size: 44, color: '#ffffff', textColor: '#111111', alpha: 0.05 } },
  },

  // ── 리믹스 쇼핑숏폼 전용 템플릿 (자막 모두 영상 정중앙 배치) ──
  {
    id: 'remix-caption-only',
    name: '자막만 (기본)',
    family: 'remix',
    canvas: '#000000',
    description: '화면 전체 영상 + 가운데 자막만. 상단 제목 없이 가장 깔끔한 기본형',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [],
    caption: { x: 540, y: 960, align: 5, maxWidth: 980, size: 80, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' },
  },
  {
    id: 'remix-glass-default',
    name: '글래스 네온 풀스크린',
    family: 'remix',
    canvas: '#000000',
    description: '전체 화면 + 상단 반투명 글래스 카드 & 골드 라인 + 정중앙 입체 자막',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'rect', x: 90, y: 144, w: 900, h: 248, color: '#101418', alpha: 0.35 },
      { kind: 'rect', x: 116, y: 166, w: 8, h: 36, color: '#ffe500' },
      { kind: 'text', slot: 'title1', x: 540, y: 215, align: 5, maxWidth: 840, style: { size: 68, color: '#ffffff', bold: true, outline: 6, outlineColor: '#000000' } },
      { kind: 'text', slot: 'title2', x: 540, y: 312, align: 5, maxWidth: 840, style: { size: 74, color: '#ffe500', bold: true, outline: 6, outlineColor: '#000000' } },
      { kind: 'rect', x: 150, y: 374, w: 780, h: 6, color: '#ffe500' },
    ],
    caption: { x: 540, y: 960, align: 5, maxWidth: 980, size: 80, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' },
  },
  {
    id: 'remix-pop-box',
    name: '블랙 박스 풀스크린',
    family: 'remix',
    canvas: '#000000',
    description: '전체 화면 + 상단 옐로우 배지 제목 + 정중앙 블랙 박스 자막 (밝은 영상에서도 선명)',
    video: { x: 0, y: 0, w: 1080, h: 1920 },
    layers: [
      { kind: 'text', slot: 'title1', x: 540, y: 190, align: 5, maxWidth: 960, style: { size: 62, color: '#111111', bold: true, box: { color: '#ffe500', pad: 16 } } },
      { kind: 'text', slot: 'title2', x: 540, y: 300, align: 5, maxWidth: 980, style: { size: 74, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' } },
    ],
    caption: {
      x: 540, y: 960, align: 5, maxWidth: 940, size: 66, color: '#ffffff', bold: true,
      alternateColors: ['#ffffff', '#ffe500'],
      box: { color: '#0d0f14', alpha: 0.14, pad: 22 },
    },
  },
  {
    id: 'remix-cinema-dark',
    name: '시네마 블랙 프레임',
    family: 'remix',
    canvas: '#0d0f14',
    description: '상하단 블랙 시네마 레터박스 + 골드 2줄 빅 타이틀 + 영상 정중앙 자막',
    video: { x: 0, y: 370, w: 1080, h: 1220 },
    layers: [
      { kind: 'rect', x: 460, y: 86, w: 160, h: 6, color: '#ffe500' },
      { kind: 'text', slot: 'title1', x: 540, y: 168, align: 5, maxWidth: 1000, style: { size: 70, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 274, align: 5, maxWidth: 1000, style: { size: 78, color: '#ffe500', bold: true } },
      { kind: 'rect', x: 0, y: 366, w: 1080, h: 4, color: '#262b38' },
      { kind: 'rect', x: 0, y: 1590, w: 1080, h: 4, color: '#262b38' },
      { kind: 'text', slot: 'footer', x: 540, y: 1690, align: 5, maxWidth: 980, style: { size: 38, color: '#cbd5e1', bold: true } },
    ],
    caption: { x: 540, y: 980, align: 5, maxWidth: 980, size: 76, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' },
  },
  {
    id: 'remix-magazine-white',
    name: '매거진 화이트 액자',
    family: 'remix',
    canvas: '#ffffff',
    description: '순백 매거진 배경 + 블랙·바이올렛 2줄 제목 + 액자형 영상 & 정중앙 자막',
    video: { x: 54, y: 420, w: 972, h: 1220 },
    layers: [
      { kind: 'rect', x: 460, y: 92, w: 160, h: 8, color: '#6d28d9' },
      { kind: 'text', slot: 'title1', x: 540, y: 178, align: 5, maxWidth: 980, style: { size: 68, color: '#111827', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 284, align: 5, maxWidth: 980, style: { size: 76, color: '#6d28d9', bold: true } },
      { kind: 'rect', x: 54, y: 374, w: 972, h: 3, color: '#e2e8f0' },
      // 영상 액자 테두리
      { kind: 'rect', x: 50, y: 416, w: 980, h: 4, color: '#111827' },
      { kind: 'rect', x: 50, y: 1640, w: 980, h: 4, color: '#111827' },
      { kind: 'rect', x: 50, y: 416, w: 4, h: 1228, color: '#111827' },
      { kind: 'rect', x: 1026, y: 416, w: 4, h: 1228, color: '#111827' },
      { kind: 'text', slot: 'footer', x: 540, y: 1720, align: 5, maxWidth: 960, style: { size: 38, color: '#475569', bold: true } },
    ],
    caption: { x: 540, y: 1030, align: 5, maxWidth: 900, size: 72, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' },
  },
  {
    id: 'remix-hotdeal-red',
    name: '핫딜 특가 배너',
    family: 'remix',
    canvas: '#141115',
    description: '레드 HOT 추천 라벨 + 강렬한 옐로우 헤드라인 + 정중앙 교차 강조 자막',
    video: { x: 0, y: 390, w: 1080, h: 1200 },
    layers: [
      { kind: 'text', slot: { static: 'HOT 추천템' }, x: 540, y: 102, align: 5, style: { size: 38, color: '#ffffff', bold: true, box: { color: '#e11d48', pad: 14 } } },
      { kind: 'text', slot: 'title1', x: 540, y: 205, align: 5, maxWidth: 1000, style: { size: 68, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 306, align: 5, maxWidth: 1000, style: { size: 76, color: '#ffe500', bold: true } },
      { kind: 'rect', x: 0, y: 384, w: 1080, h: 6, color: '#e11d48' },
      { kind: 'rect', x: 0, y: 1590, w: 1080, h: 6, color: '#e11d48' },
      { kind: 'text', slot: 'footer', x: 540, y: 1690, align: 5, maxWidth: 980, style: { size: 40, color: '#fda4af', bold: true } },
    ],
    caption: {
      x: 540, y: 990, align: 5, maxWidth: 980, size: 78, color: '#ffffff', bold: true,
      outline: 8, outlineColor: '#000000', alternateColors: ['#ffe500', '#ffffff'],
    },
  },
  {
    id: 'remix-cozy-beige',
    name: '감성 웜 베이지 카드',
    family: 'remix',
    canvas: '#f6efe6',
    description: '따뜻한 크림 베이지 배경 + 브라운·골드 제목 + 카드형 영상 (리빙·침구 추천)',
    video: { x: 54, y: 420, w: 972, h: 1210 },
    layers: [
      { kind: 'rect', x: 470, y: 96, w: 140, h: 6, color: '#c27828' },
      { kind: 'text', slot: 'title1', x: 540, y: 180, align: 5, maxWidth: 980, style: { size: 66, color: '#2e2118', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 282, align: 5, maxWidth: 980, style: { size: 74, color: '#b86514', bold: true } },
      { kind: 'rect', x: 100, y: 368, w: 880, h: 3, color: '#e2d5c3' },
      { kind: 'rect', x: 50, y: 416, w: 980, h: 4, color: '#d5c4ad' },
      { kind: 'rect', x: 50, y: 1630, w: 980, h: 4, color: '#d5c4ad' },
      { kind: 'rect', x: 50, y: 416, w: 4, h: 1218, color: '#d5c4ad' },
      { kind: 'rect', x: 1026, y: 416, w: 4, h: 1218, color: '#d5c4ad' },
      { kind: 'text', slot: 'footer', x: 540, y: 1715, align: 5, maxWidth: 960, style: { size: 38, color: '#6b5340', bold: true } },
    ],
    caption: { x: 540, y: 1025, align: 5, maxWidth: 900, size: 72, color: '#ffffff', bold: true, outline: 8, outlineColor: '#241811' },
  },
  {
    id: 'remix-mint-board',
    name: '커뮤니티 꿀템 보드',
    family: 'remix',
    canvas: '#ffffff',
    description: '산뜻한 민트 헤더바 + 화이트 제목 카드 + 하단 와이드 영상 & 정중앙 자막',
    video: { x: 0, y: 390, w: 1080, h: 1310 },
    layers: [
      { kind: 'rect', x: 0, y: 0, w: 1080, h: 132, color: '#14b886' },
      { kind: 'text', slot: { static: '오늘의 생활 꿀템 추천' }, x: 540, y: 68, align: 5, style: { size: 46, color: '#ffffff', bold: true, spacing: 2 } },
      { kind: 'text', slot: 'title1', x: 540, y: 206, align: 5, maxWidth: 1000, style: { size: 62, color: '#111827', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 298, align: 5, maxWidth: 1000, style: { size: 68, color: '#0d946b', bold: true } },
      { kind: 'rect', x: 0, y: 384, w: 1080, h: 6, color: '#e2e8f0' },
      { kind: 'rect', x: 0, y: 1700, w: 1080, h: 220, color: '#111827' },
      { kind: 'text', slot: 'footer', x: 540, y: 1768, align: 5, maxWidth: 980, style: { size: 38, color: '#6ee7b7', bold: true } },
    ],
    caption: { x: 540, y: 1045, align: 5, maxWidth: 980, size: 74, color: '#ffffff', bold: true, outline: 8, outlineColor: '#000000' },
  },
  {
    id: 'remix-neon-purple',
    name: '바이올렛 쇼룸',
    family: 'remix',
    canvas: '#160f29',
    description: '딥 퍼플 쇼룸 배경 + 네온 민트 강조 타이틀 + 중앙 프레임 & 교차 자막',
    video: { x: 40, y: 380, w: 1000, h: 1210 },
    layers: [
      { kind: 'rect', x: 450, y: 88, w: 180, h: 6, color: '#4ff8d2' },
      { kind: 'text', slot: 'title1', x: 540, y: 172, align: 5, maxWidth: 1000, style: { size: 68, color: '#ffffff', bold: true } },
      { kind: 'text', slot: 'title2', x: 540, y: 276, align: 5, maxWidth: 1000, style: { size: 76, color: '#4ff8d2', bold: true } },
      { kind: 'rect', x: 36, y: 376, w: 1008, h: 4, color: '#7c3aed' },
      { kind: 'rect', x: 36, y: 1590, w: 1008, h: 4, color: '#7c3aed' },
      { kind: 'text', slot: 'footer', x: 540, y: 1690, align: 5, maxWidth: 980, style: { size: 38, color: '#ddd6fe', bold: true } },
    ],
    caption: {
      x: 540, y: 985, align: 5, maxWidth: 920, size: 74, color: '#ffffff', bold: true,
      outline: 8, outlineColor: '#0b0718', alternateColors: ['#ffffff', '#4ff8d2'],
    },
  },
  // ── 리믹스 ver2: 실제 쇼핑 숏폼 화면 문법 템플릿 (remix-market.ts) ──
  ...REMIX_MARKET_TEMPLATES,
];

/** 버전1 스토리 프레임을 합친 전체 목록 (렌더·옵션 공통) */
export const ALL_TEMPLATES: Template[] = [...TEMPLATES, ...storyV1FrameTemplates()];

export const REMIX_TEMPLATES: Template[] = TEMPLATES.filter((t) => t.family === 'remix');
export const DEFAULT_REMIX_TEMPLATE_ID = 'remix-glass-default';

export function getRemixTemplate(id: string | undefined): Template {
  return REMIX_TEMPLATES.find((t) => t.id === id) ?? REMIX_TEMPLATES[0]!;
}

/** 프로젝트가 쓰는 영상 템플릿 id: 썰·여행·리뷰는 ssul.templateId, 리믹스는 remixTemplateId */
export function projectTemplateId(p: { mode?: string; ssul?: { templateId?: string }; remixTemplateId?: string }): string | undefined {
  return p.mode === 'remix' ? p.remixTemplateId || DEFAULT_REMIX_TEMPLATE_ID : p.ssul?.templateId;
}

export function getTemplate(id: string | undefined): Template {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? ALL_TEMPLATES[0]!;
}
