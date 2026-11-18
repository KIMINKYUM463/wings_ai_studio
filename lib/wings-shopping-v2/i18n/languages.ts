/**
 * 해외판 언어 (틱톡샵·아마존·라쿠텐·쇼피 등 주요 쇼핑 숏폼 시장 기준)
 * maxLine: 자막 한 줄 최대 글자 수 (라틴 문자는 한글보다 폭이 좁아 더 길게)
 */
export type Lang = { id: string; name: string; english: string; market: string; maxLine: number; font?: { family: string; files: string[] } };

export const LANGS: Lang[] = [
  { id: 'en', name: '영어', english: 'English (US)', market: '미국·영국 틱톡샵, 아마존 인플루언서, 유튜브 쇼츠', maxLine: 26 },
  { id: 'ja', name: '일본어', english: 'Japanese', market: '일본 틱톡샵·라쿠텐·Qoo10', maxLine: 14, font: { family: 'Yu Gothic', files: ['YuGothB.ttc', 'YuGothM.ttc'] } },
  { id: 'zh-TW', name: '중국어(번체)', english: 'Traditional Chinese (Taiwan)', market: '대만·홍콩 쇼피·모모', maxLine: 14, font: { family: 'Microsoft JhengHei', files: ['msjhbd.ttc', 'msjh.ttc'] } },
  { id: 'es', name: '스페인어', english: 'Spanish (Latin America)', market: '미국 히스패닉·멕시코 틱톡샵', maxLine: 26 },
  { id: 'id', name: '인도네시아어', english: 'Indonesian', market: '인도네시아 틱톡샵·쇼피 (동남아 최대)', maxLine: 26 },
  { id: 'vi', name: '베트남어', english: 'Vietnamese', market: '베트남 틱톡샵·쇼피', maxLine: 24 },
  { id: 'th', name: '태국어', english: 'Thai', market: '태국 틱톡샵·쇼피', maxLine: 22, font: { family: 'Leelawadee', files: ['LEELAWDB.TTF', 'LEELAWAD.TTF'] } },
];

export const getLang = (id?: string) => LANGS.find((l) => l.id === id);
