/** 썰 쇼핑숏폼 화면 템플릿 (1080x1920 기준 좌표) */

export type TextSlot =
  | 'channel' | 'handle' | 'title' | 'title1' | 'title2' | 'meta' | 'comment' | 'footer' | 'location' | 'price' | 'period'
  | { static: string }
  /** 게시글 통계 줄: {views}·{likes}·{comments} 자리에 제목에서 정해지는(매번 같은) 그럴듯한 숫자를 넣는다 */
  | { stats: string };

/** ASS \an 정렬 (숫자패드): 7 8 9 / 4 5 6 / 1 2 3 */
export type Align = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type TextStyle = {
  size: number;
  color: string; // #RRGGBB
  bold?: boolean;
  outline?: number;
  outlineColor?: string;
  shadow?: number;
  spacing?: number;
  /** 글자 뒤 불투명 박스 (ASS BorderStyle 3) */
  box?: { color: string; alpha?: number; pad?: number };
  italic?: boolean;
  /** 이 글자만 쓸 글꼴 패밀리 (사용자 글꼴 설정과 무관하게 고정) */
  font?: string;
};

/** 선 아이콘(lucide 24칸 좌표를 ASS 드로잉으로 옮긴 것) */
export type IconName =
  | 'back' | 'menu' | 'like' | 'chevrons' | 'avatar' | 'search' | 'pin'
  | 'magnifier' | 'arrowLeft' | 'arrowRight' | 'ellipsis' | 'star' | 'heart' | 'user' | 'users' | 'home' | 'cart'
  | 'bell' | 'sparkles' | 'bookmark' | 'chat' | 'send' | 'briefcase' | 'newspaper' | 'pen' | 'flame' | 'trophy'
  | 'zap' | 'smile' | 'store' | 'cookie' | 'crown';

export type Layer =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha?: number }
  | { kind: 'text'; slot: TextSlot; x: number; y: number; align: Align; style: TextStyle; maxWidth?: number; rotate?: number; alpha?: number }
  /** 둥근 사각형 (r = 모서리 반지름, h/2 면 알약·원). border 는 상자 안쪽으로 그린다 */
  | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number; color: string; alpha?: number; border?: number; borderColor?: string }
  /** stroke 가 있으면 lucide 처럼 선(굵기 = 24칸 기준 strokeWidth)으로, fill 이면 속까지 채운다. 둘 다 없으면 예전 채움 아이콘 */
  | { kind: 'icon'; name: IconName; x: number; y: number; size: number; color: string; stroke?: number; fill?: boolean }
  | { kind: 'watermark'; slot: TextSlot; color: string; alpha: number; size: number };

export type CaptionStyle = TextStyle & {
  x: number;
  y: number;
  align: Align;
  maxWidth: number;
  /** 자막 줄마다 번갈아 쓸 글자색 */
  alternateColors?: string[];
};

export type TemplateFamily = 'board' | 'app' | 'community' | 'letterbox' | 'headline' | 'fullscreen' | 'poster' | 'travel' | 'review' | 'remix' | 'storyv1';

/**
 * 리뷰·랭킹 모드: 상품마다 뜨는 순위 배지 + 상품명 카드 (실측: 랭킹 영상 대부분이 우상단 순위 박스 + 하단 상품명·가격 카드)
 */
export type BadgeStyle = {
  rank: { x: number; y: number; size: number; color: string; textColor: string };
  card: { x: number; y: number; w: number; size: number; color: string; textColor: string; alpha?: number };
};

export type Template = {
  id: string;
  name: string;
  family: TemplateFamily;
  description: string;
  canvas: string; // 배경색
  video: { x: number; y: number; w: number; h: number };
  layers: Layer[];
  caption: CaptionStyle;
  /** 첫 1.8초에 큰 2색 제목 */
  introPoster?: boolean;
  posterColors?: [string, string];
  /** 표지 모양: 'top' = 상단 어두운 띠 + 큰 2줄 제목 + 흰 제목 줄 (v1 썰쇼핑), 'band' = 전체 검정 + 가운데 흰 띠 (v1 윙스 메모장) */
  posterStyle?: 'top' | 'band';
  /** 'top' 표지의 모양 변형 (cover-variants.ts) */
  posterVariant?: string;
  /** 표지 동안 영상 아래 빈 곳도 위 띠 색으로 채움 */
  posterBottomFill?: boolean;
  /** 표지 동안 첫 문장 줄이 천천히 커짐 */
  posterZoom?: boolean;
  /** 리뷰·랭킹 배지 위치 (없으면 영상 영역 기준 기본값) */
  badge?: BadgeStyle;
};

export type TemplateData = {
  channel: string;
  title: [string, string];
  meta: string;
  comment: string;
  /** 구매 안내 등 하단 고정 문구 */
  footer?: string;
  /** 여행 모드: 지역·가격·기간 */
  location?: string;
  price?: string;
  period?: string;
  /** 해외판: 템플릿 고정 문구 번역 (원문 → 번역) */
  statics?: Record<string, string>;
  /** 자막·템플릿 글꼴 패밀리명 (없으면 Pretendard) */
  font?: string;
  /** 제목·채널명 글자 크기 배율 */
  titleScale?: number;
  channelScale?: number;
  /** 대본 첫 문장 (표지 아래 흰 줄에 표시) */
  firstSentence?: string;
};
