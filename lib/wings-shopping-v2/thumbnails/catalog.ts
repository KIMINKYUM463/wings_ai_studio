/**
 * 쇼츠 썸네일 스타일 (1080x1920).
 * 36개 채널 조회수 상위 썸네일 281개 분석 기반 (lib/thumbnails/playbook.json):
 * 2~3줄·약 18자, 위쪽·상단 배치 52%, 두꺼운 검정 외곽선 66%, 굵은 고딕 80%, 흰 글자 + 노랑/민트/빨강 강조.
 */
export type ThumbStyle = {
  id: string;
  name: string;
  description: string;
  y: number; // 첫 줄 중심 y
  size: number; // 글자 크기
  lineGap?: number; // 줄 간격 배수 (기본 1.22)
  color: string;
  accent: string;
  outline: number;
  outlineColor: string;
  shadow?: number;
  /** 글자 뒤 박스 (ASS BorderStyle 3) */
  box?: { color: string; alpha?: number; pad?: number };
  /** 가로 띠 (화면 전체 폭) */
  band?: { y: number; h: number; color: string; alpha?: number };
  quotes?: boolean;
  /** 첫 줄만 더 크게 (숫자·핵심어 강조) */
  firstLineScale?: number;
};

export const THUMB_STYLES: ThumbStyle[] = [
  { id: 'top-white-yellow', name: '상단 흰+노랑', description: '가장 흔한 형태: 위쪽 흰 글자, 강조어 노랑, 두꺼운 검정 외곽선', y: 330, size: 104, color: '#ffffff', accent: '#ffe500', outline: 9, outlineColor: '#000000' },
  { id: 'top-white-mint', name: '상단 흰+민트', description: '위쪽 흰 글자, 강조어 민트', y: 330, size: 104, color: '#ffffff', accent: '#7eebff', outline: 9, outlineColor: '#000000' },
  { id: 'top-yellow-red', name: '상단 노랑+빨강', description: '노랑 글자, 강조어 빨강, 검정 외곽선', y: 330, size: 104, color: '#ffe500', accent: '#ff3b3b', outline: 9, outlineColor: '#000000' },
  { id: 'center-white-yellow', name: '가운데 흰+노랑', description: '화면 가운데 큰 글자', y: 860, size: 112, color: '#ffffff', accent: '#ffe500', outline: 10, outlineColor: '#000000' },
  { id: 'black-band-top', name: '상단 검정 띠', description: '위쪽 검정 띠 + 흰 글자, 강조어 노랑 (외곽선 없음)', y: 200, size: 96, color: '#ffffff', accent: '#ffe500', outline: 0, outlineColor: '#000000', band: { y: 0, h: 560, color: '#000000' } },
  { id: 'white-band-bottom', name: '하단 흰 띠', description: '아래쪽 흰 띠 + 검정 글자, 강조어 빨강', y: 1500, size: 92, color: '#111111', accent: '#e02424', outline: 0, outlineColor: '#ffffff', band: { y: 1380, h: 420, color: '#ffffff' } },
  { id: 'red-box', name: '빨강 박스', description: '빨강 박스 위 흰 글자 (강조어 노랑)', y: 360, size: 92, color: '#ffffff', accent: '#ffe500', outline: 0, outlineColor: '#000000', box: { color: '#e02424', pad: 18 } },
  { id: 'dark-box-center', name: '반투명 검정 박스', description: '가운데 반투명 검정 박스 + 흰 글자', y: 860, size: 96, color: '#ffffff', accent: '#ffe500', outline: 0, outlineColor: '#000000', box: { color: '#000000', alpha: 0.35, pad: 24 } },
  { id: 'quote-yellow', name: '인용구', description: '“ ” 따옴표 인용 + 노랑 강조', y: 360, size: 96, color: '#ffffff', accent: '#ffe500', outline: 8, outlineColor: '#000000', quotes: true },
  { id: 'number-big', name: '숫자·핵심어 크게', description: '첫 줄(예: TOP3, 5가지)을 크게, 노랑', y: 330, size: 100, color: '#ffffff', accent: '#ffe500', outline: 9, outlineColor: '#000000', firstLineScale: 1.45 },
  { id: 'soft-shadow', name: '외곽선 없이 그림자', description: '얇은 그림자만 있는 깔끔한 흰 글자', y: 380, size: 100, color: '#ffffff', accent: '#ffe500', outline: 2, outlineColor: '#333333', shadow: 5 },
];

export const getThumbStyle = (id?: string) => THUMB_STYLES.find((s) => s.id === id) ?? THUMB_STYLES[0];
