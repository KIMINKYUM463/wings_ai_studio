import { headers } from 'next/headers';
import { requireStoryUser } from '@/lib/story-shopping-security';

/**
 * 클라우드 PC(여러 수강생 공용)에서 돌 때만 켠다 (WINGS_V2_MULTI_USER=1).
 * 내 PC(npm run dev)에서는 꺼져 있어 예전처럼 혼자 쓰는 방식 그대로다.
 */
export const MULTI_USER = process.env.WINGS_V2_MULTI_USER === '1';

/** 지금 처리 중인 요청의 헤더 값. 요청 밖(스크립트 등)이면 빈 문자열.
 *  뒤에서 계속 도는 작업도 시작한 요청의 문맥을 이어받으므로 같은 값을 읽는다. */
export function requestHeader(name: string): string {
  try {
    return headers().get(name)?.trim() ?? '';
  } catch {
    return '';
  }
}

/** 브라우저가 요청마다 실어 보내는 수강생 본인의 API 키 */
export const BROWSER_KEY_HEADERS = {
  gemini: 'x-wings-gemini-key',
  tikhub: 'x-wings-tikhub-key',
  youtube: 'x-wings-youtube-key',
  typecast: 'x-wings-typecast-key',
  elevenlabs: 'x-wings-elevenlabs-key',
} as const;

/** 공용 모드에서 지금 요청한 수강생 id (카카오 로그인 확인). 혼자 쓰는 모드면 null */
export async function currentOwnerId(): Promise<string | null> {
  if (!MULTI_USER) return null;
  return (await requireStoryUser()).userId;
}
