/**
 * 썰쇼핑숏폼 자막·템플릿 글꼴 (public/fonts 번들, 라이선스는 public/fonts/README.md).
 * family = 폰트 파일 내부 패밀리명 (libass 가 이 이름으로 찾는다 — 표시 이름과 다를 수 있음)
 */
export type SsulFont = { id: string; label: string; group: '강조형' | '깔끔형' | '손글씨·감성형'; family: string; file: string };

export const SSUL_FONTS: SsulFont[] = [
  { id: 'pretendard', label: '프리텐다드', group: '강조형', family: 'Pretendard', file: 'Pretendard-Bold.otf' },
  { id: 'gmarket-sans', label: 'G마켓 산스', group: '강조형', family: 'Gmarket Sans TTF', file: 'gmarket-sans-bold.ttf' },
  { id: 'do-hyeon', label: '배민 도현체', group: '강조형', family: 'Do Hyeon', file: 'do-hyeon-regular.ttf' },
  { id: 'sb-aggro', label: 'SB 어그로', group: '강조형', family: 'SB Aggro Bold', file: 'sb-aggro-bold.ttf' },
  { id: 'tmon-monsori', label: '티몬 몬소리', group: '강조형', family: 'TmonMonsori Black', file: 'tmon-monsori-black.ttf' },
  { id: 'gangwon-tuntun', label: '강원교육 튼튼', group: '강조형', family: 'GangwonEduPower', file: 'gangwon-tuntun.ttf' },
  { id: 'nanum-barun', label: '나눔바른고딕', group: '깔끔형', family: 'NanumBarunGothic', file: 'nanum-barun-gothic-bold.ttf' },
  { id: 'gowun-dodum', label: '고운돋움', group: '깔끔형', family: 'Gowun Dodum', file: 'gowun-dodum-regular.ttf' },
  { id: 'gangwon-modu', label: '강원교육 모두', group: '깔끔형', family: 'GangwonEduAll Bold', file: 'gangwon-modu-bold.ttf' },
  { id: 'cafe24-slim', label: '카페24 슬림', group: '깔끔형', family: 'Cafe24 PRO Slim Max', file: 'cafe24-pro-slim-max.ttf' },
  { id: 'hs-santokki', label: 'HS 산토끼', group: '손글씨·감성형', family: 'HS산토끼체', file: 'hs-santokki-regular.ttf' },
  { id: 'gangwon-saeeum', label: '강원교육 새음', group: '손글씨·감성형', family: 'GangwonEduSaeeum Medium', file: 'gangwon-saeeum.ttf' },
  { id: 'gangwon-hyeonok', label: '강원교육 현옥', group: '손글씨·감성형', family: 'GangwonEduHyeonokT Medium', file: 'gangwon-hyeonok.ttf' },
  { id: 'nanum-galmaetgeul', label: '나눔손글씨 갈맷글', group: '손글씨·감성형', family: 'Nanum GarMaesGeur', file: 'nanum-handwriting-galmaetgeul.ttf' },
  { id: 'nanum-gangbujang', label: '나눔손글씨 강부장님', group: '손글씨·감성형', family: 'Nanum GangBuJangNimCe', file: 'nanum-handwriting-gangbujang.ttf' },
];

/** 글꼴 id → ASS 패밀리명 (모르는 id·기본값이면 undefined = Pretendard) */
export const ssulFontFamily = (id?: string) => (id && id !== 'pretendard' ? SSUL_FONTS.find((f) => f.id === id)?.family : undefined);
