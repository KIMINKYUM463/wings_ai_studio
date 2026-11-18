/**
 * 사진이 없는 목소리용 인물 사진: public/hq-avatars 의 한국인 인물 10장(10~50대 남녀) 중
 * 이름으로 성별을 짐작해 같은 성별에서 고른다 (같은 목소리는 늘 같은 사진).
 */
const FEMALE = ['kr-f-10s-sua', 'kr-f-20s-jiwoo', 'kr-f-30s-seoyeon', 'kr-f-40s-mikyeong', 'kr-f-50s-yeonghui'];
const MALE = ['kr-m-10s-minjun', 'kr-m-20s-hyunwoo', 'kr-m-30s-junho', 'kr-m-40s-seongmin', 'kr-m-50s-cheolho'];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function guessGender(name: string, gender?: string): 'male' | 'female' | 'unknown' {
  const g = `${gender ?? ''} ${name}`.toLowerCase();
  if (/female|여성|여자|woman|girl|언니|누나|엄마/.test(g)) return 'female';
  if (/(^|\W)male|남성|남자|\bman\b|boy|형|오빠|아빠/.test(g)) return 'male';
  return 'unknown';
}

export function voicePersonaPhoto(name: string, gender?: string): string {
  const h = hash(name);
  const g = guessGender(name, gender);
  const pool = g === 'female' ? FEMALE : g === 'male' ? MALE : h % 2 ? FEMALE : MALE;
  return `/hq-avatars/${pool[(h >>> 4) % pool.length]}.png`;
}
