/**
 * 첫 화면 표지·썸네일 모양 변형 ('top' 표지: 위 띠 + 큰 2줄 제목 + 아래 문장 줄).
 * 같은 구성에서 띠 색·투명도·구분선·강조색만 바꾼다. 썸네일 스튜디오와 영상 렌더가 같이 쓴다.
 */
export type CoverVariant = {
  id: string;
  name: string;
  description: string;
  /** 위 띠 (위쪽 절반, 아래쪽 절반) */
  band: [string, string];
  /** 0 불투명 ~ 1 투명 */
  bandAlpha?: number;
  /** 띠 아래쪽 가로 줄 */
  rule?: string;
  strip: string;
  stripText: string;
  /** 문장 줄 아래 굵은 줄 */
  stripRule?: string;
  /** 지정하면 템플릿 강조색 대신 이 색 */
  accent?: string;
  topText?: string;
  outline?: boolean;
};

export const COVER_VARIANTS: CoverVariant[] = [
  { id: 'dark', name: '다크 띠', description: '짙은 회색 띠 + 강조색 둘째 줄 (기본)', band: ['#1a1a1a', '#2e2e2e'], strip: '#ffffff', stripText: '#000000' },
  { id: 'smoke', name: '반투명 띠', description: '영상이 비치는 반투명 띠 + 흰 구분선', band: ['#202020', '#202020'], bandAlpha: 0.38, rule: '#ffffff', strip: '#ffffff', stripText: '#000000', accent: '#20e3ff' },
  { id: 'black', name: '블랙 박스', description: '완전 검정 띠 + 노랑 강조', band: ['#000000', '#000000'], strip: '#ffffff', stripText: '#000000', stripRule: '#000000', accent: '#ffe14d' },
  { id: 'neon', name: '네온 그린', description: '검정 띠 + 형광 연두 강조', band: ['#0b0b0b', '#141414'], strip: '#ffffff', stripText: '#000000', accent: '#8dff3c' },
  { id: 'red', name: '레드 경고', description: '검정 띠 + 빨강 강조, 경고·폭로형', band: ['#111111', '#1c1c1c'], rule: '#ff3b30', strip: '#ffffff', stripText: '#000000', accent: '#ff4d3d' },
  { id: 'night', name: '나이트 문장', description: '반투명 띠 + 검정 문장 줄 (흰 글씨)', band: ['#000000', '#000000'], bandAlpha: 0.3, strip: '#111111', stripText: '#ffffff', accent: '#ffe14d' },
];

export const coverVariant = (id?: string): CoverVariant => COVER_VARIANTS.find((v) => v.id === id) ?? COVER_VARIANTS[0];
