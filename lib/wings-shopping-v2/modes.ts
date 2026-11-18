import { getLang } from './i18n/languages';

/** 화면에 보이는 모드 이름 (클라이언트에서도 씀) */
export const MODES = [
  { id: 'remix', name: '리믹스 쇼핑숏폼', short: '리믹스', description: '레퍼런스 쇼츠의 흐름을 따라 다른 영상 장면으로 재구성' },
  { id: 'ssul', name: '썰 쇼핑숏폼', short: '썰', description: '썰(이야기)을 풀면서 상품을 소개 · 상위 117개 영상 구조' },
  { id: 'travel', name: '여행 쇼핑숏폼', short: '여행', description: '숙소·투어·입장권·여행템·항공 · 여행 쇼츠 80개 구조 + Google Flow 연동' },
  { id: 'review', name: '리뷰·랭킹 쇼핑숏폼', short: '리뷰·랭킹', description: 'TOP N 랭킹·A vs B·비포애프터·솔직후기 · 국내외 상위 56개 실측 + 순위 배지' },
] as const;

export type ModeId = (typeof MODES)[number]['id'];

export function modeLabel(mode?: string, lang?: string, short = false): string {
  const m = MODES.find((x) => x.id === (mode ?? 'remix')) ?? MODES[0];
  const l = lang && lang !== 'ko' ? getLang(lang) : undefined;
  return `${short ? m.short : m.name}${l ? ` · ${l.name}판` : ''}`;
}
