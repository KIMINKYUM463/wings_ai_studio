'use client';
/**
 * v2 엔진 요청(/api/wings-shopping-v2/...)마다 수강생 브라우저에 저장된 본인 API 키를 헤더로 싣는다.
 * 배포판에서는 v2 엔진이 여러 수강생이 함께 쓰는 클라우드 PC에서 돌기 때문에,
 * 서버 파일에 키를 저장하지 않고 요청마다 각자 키를 보낸다 (헤더 이름은 request-ctx.ts 와 같음).
 * 이 파일을 import 하기만 하면 window.fetch 에 한 번 적용된다.
 */
const KEYS: Array<[header: string, storageKey: string]> = [
  ['x-wings-gemini-key', 'shotform_gemini_api_key'],
  ['x-wings-tikhub-key', 'shotform_tikhub_api_key'],
  ['x-wings-youtube-key', 'shotform_youtube_data_api_key'],
  // 같은 헤더가 여러 번이면 먼저 찾은 값을 쓴다 (예전 설정은 typecast_api_key 에만 저장됨)
  ['x-wings-typecast-key', 'shotform_typecast_api_key'],
  ['x-wings-typecast-key', 'typecast_api_key'],
  ['x-wings-elevenlabs-key', 'shotform_elevenlabs_api_key'],
];

function isV2Url(input: RequestInfo | URL): boolean {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    const u = new URL(raw, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/wings-shopping-v2/');
  } catch {
    return false;
  }
}

const w = typeof window !== 'undefined' ? (window as Window & { __wingsV2KeyFetch?: boolean }) : null;
if (w && !w.__wingsV2KeyFetch) {
  w.__wingsV2KeyFetch = true;
  const original = w.fetch.bind(w);
  w.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isV2Url(input)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    for (const [header, storageKey] of KEYS) {
      let value = '';
      try {
        value = localStorage.getItem(storageKey)?.trim() ?? '';
      } catch {
        /* 저장소 접근 불가 */
      }
      // 헤더에는 ASCII만 실을 수 있다 (API 키는 원래 ASCII)
      if (value && !headers.has(header) && /^[\x21-\x7e]+$/.test(value)) headers.set(header, value);
    }
    return original(input, { ...init, headers });
  };
}

/** <audio src>·new Audio(url)은 fetch를 거치지 않아 키 헤더가 안 실린다 → fetch로 받아서 재생할 오디오를 만든다 */
export async function fetchAudio(url: string): Promise<HTMLAudioElement> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || `미리듣기를 만들지 못했어요 (${r.status})`);
  const src = URL.createObjectURL(await r.blob());
  const a = new Audio(src);
  a.addEventListener('ended', () => URL.revokeObjectURL(src));
  return a;
}

/** 배포 사이트(내 PC가 아닌 곳)에서 열었는지. 수퍼토닉·아담처럼 내 PC 로컬 서버가 필요한 기능을 가린다 */
export function isDeployedSite(): boolean {
  return typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}
