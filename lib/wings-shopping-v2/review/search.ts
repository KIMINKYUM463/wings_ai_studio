import type { Analysis, ReviewInfo } from '../types';

/** 상품 목록에서 상품명만 (한 줄에 하나, '상품명 | 가격 | 특징') */
export function itemNames(r?: ReviewInfo): string[] {
  return (r?.items ?? '').split(/\r?\n/).map((l) => l.split('|')[0].trim()).filter(Boolean).slice(0, 10);
}

/**
 * 리뷰·랭킹 모드: 사용자가 적은 상품마다 검색어를 앞에 붙인다.
 * 레퍼런스가 한 상품만 다뤄도 비교·랭킹에 나오는 다른 상품 장면을 찾을 수 있게.
 * 한국어 상품명은 더우인·샤오홍슈에서 잘 안 잡혀서 YouTube·TikTok·Instagram만.
 */
export function reviewQueries(q: Analysis['searchQueries'], r?: ReviewInfo): Analysis['searchQueries'] {
  const names = itemNames(r);
  if (!names.length) return q;
  const merge = (items: string[], base: string[]) => [...new Set([...items, ...base])];
  return {
    ...q,
    youtube: merge(names.map((n) => `${n} 리뷰`), q.youtube),
    tiktok: merge(names, q.tiktok),
    instagram: merge(names, q.instagram),
  };
}
