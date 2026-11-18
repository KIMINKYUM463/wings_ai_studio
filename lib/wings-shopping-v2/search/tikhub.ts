import type { SearchResult } from '../types';
import { tikhubApiKey } from '../tikhub-key';

/**
 * TikHub (https://api.tikhub.io) — 더우인·샤오홍슈·TikTok 검색과 원본 영상 주소.
 * 응답 구조가 엔드포인트·버전마다 달라서, 응답 전체를 훑어 aweme(더우인/TikTok)·note(샤오홍슈) 객체를 찾는다.
 */
const BASE = 'https://api.tikhub.io';
const PER_PLATFORM_QUERIES = 2; // 검색어 수 × 플랫폼 = 요청 수(=비용)

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;

function walk(v: unknown, fn: (o: Obj) => boolean | void, seen = new Set<unknown>()): void {
  if (!isObj(v) || seen.has(v)) return;
  seen.add(v);
  if (!Array.isArray(v) && fn(v) === true) return; // true = 이 아래는 더 보지 않음
  for (const child of Array.isArray(v) ? v : Object.values(v)) walk(child, fn, seen);
}

const firstUrl = (v: unknown): string | undefined => {
  if (!isObj(v)) return undefined;
  const list = (v as { url_list?: unknown }).url_list;
  return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : undefined;
};

export type Aweme = { id: string; desc: string; author?: string; authorId?: string; cover?: string; duration?: number };

export function extractAwemes(res: unknown): Aweme[] {
  const out = new Map<string, Aweme>();
  walk(res, (o) => {
    const id = o.aweme_id;
    if ((typeof id === 'string' || typeof id === 'number') && (isObj(o.video) || typeof o.desc === 'string')) {
      const key = String(id);
      if (!out.has(key)) {
        const video = isObj(o.video) ? o.video : {};
        const author = isObj(o.author) ? o.author : {};
        const ms = typeof video.duration === 'number' ? video.duration : undefined;
        out.set(key, {
          id: key,
          desc: typeof o.desc === 'string' ? o.desc : '',
          author: typeof author.nickname === 'string' ? author.nickname : undefined,
          authorId: typeof author.unique_id === 'string' && author.unique_id ? author.unique_id : undefined,
          cover: firstUrl(video.cover) ?? firstUrl(video.origin_cover),
          duration: ms === undefined ? undefined : ms > 1000 ? Math.round(ms / 1000) : ms,
        });
      }
      return true;
    }
  });
  return [...out.values()];
}

export type XhsNote = { id: string; title: string; author?: string; cover?: string };

function isXhsVideoNote(o: Obj): boolean {
  const t = o.type ?? o.note_type ?? o.model_type;
  if (t === 'video' || t === '视频' || t === '视频笔记' || t === 1 || t === '1') return true;
  // 검색 응답에 type 없이 video 객체만 있는 경우
  if (isObj(o.video) || isObj(o.video_info) || typeof o.video_url === 'string') return true;
  return false;
}

export function extractXhsNotes(res: unknown): XhsNote[] {
  const out = new Map<string, XhsNote>();
  walk(res, (o) => {
    const rawId = o.id ?? o.note_id;
    const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
    const titleRaw = o.title ?? o.display_title ?? o.desc ?? o.desc_html;
    const title = typeof titleRaw === 'string' ? titleRaw : '';
    if (!id || id.length < 8 || !isXhsVideoNote(o)) return;
    if (out.has(id)) return true;
    const user = isObj(o.user) ? o.user : {};
    const images = Array.isArray(o.images_list) ? o.images_list : Array.isArray(o.images) ? o.images : [];
    const cover =
      (isObj(images[0]) && typeof (images[0] as Obj).url === 'string' ? String((images[0] as Obj).url) : undefined)
      ?? (isObj(o.cover) && typeof o.cover.url === 'string' ? o.cover.url : undefined)
      ?? (isObj(o.cover) && typeof o.cover.url_default === 'string' ? o.cover.url_default : undefined)
      ?? (typeof o.cover === 'string' ? o.cover : undefined)
      ?? (isObj(o.video) ? firstUrl((o.video as Obj).cover) : undefined);
    const author =
      typeof user.nickname === 'string' ? user.nickname
        : typeof user.nick_name === 'string' ? user.nick_name
          : undefined;
    out.set(id, { id, title: title || '샤오홍슈 영상', author, cover });
    return true;
  });
  return [...out.values()];
}

/** 더우인·TikTok 상세 응답에서 워터마크 없는 재생 주소(play_addr) */
export function findPlayUrl(res: unknown): string | undefined {
  let found: string | undefined;
  walk(res, (o) => {
    if (found) return true;
    const u = firstUrl(o.play_addr) ?? firstUrl(o.play_addr_h264);
    if (u) { found = u; return true; }
  });
  return found;
}

/** 샤오홍슈 영상 노트 상세 응답에서 mp4 주소 */
export function findXhsVideoUrl(res: unknown): string | undefined {
  let found: string | undefined;
  walk(res, (o) => {
    if (found) return true;
    if (typeof o.master_url === 'string' && o.master_url) { found = o.master_url; return true; }
  });
  if (!found) {
    walk(res, (o) => {
      if (found) return true;
      if (typeof o.url === 'string' && /\.mp4(\?|$)|sns-video/.test(o.url)) { found = o.url; return true; }
    });
  }
  return found;
}

export function parseContentId(url: string): { platform: 'douyin' | 'tiktok' | 'xiaohongshu'; id: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = u.hostname;
  if (/(^|\.)douyin\.com$/.test(h)) {
    const m = u.pathname.match(/\/(?:video|note|shipin)\/(\d+)/) ?? null;
    const q = u.searchParams.get('modal_id');
    return m ? { platform: 'douyin', id: m[1] } : q ? { platform: 'douyin', id: q } : null;
  }
  if (/(^|\.)tiktok\.com$/.test(h)) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    return m ? { platform: 'tiktok', id: m[1] } : null;
  }
  if (/(^|\.)xiaohongshu\.com$/.test(h)) {
    const m = u.pathname.match(/\/(?:explore|discovery\/item)\/([0-9a-f]{16,})/i);
    return m ? { platform: 'xiaohongshu', id: m[1] } : null;
  }
  return null;
}

function key(): string | undefined {
  return tikhubApiKey() || undefined;
}

export class TikhubError extends Error {
  constructor(public status: number, body: string) {
    super(`TikHub ${status}: ${body}`);
  }
}

const LABEL = { douyin: '더우인', xiaohongshu: '샤오홍슈', tiktok: 'TikTok' } as const;

function warningFor(platform: keyof typeof LABEL, e: unknown): string {
  const status = e instanceof TikhubError ? e.status : 0;
  const detail = e instanceof Error ? e.message : '';
  const why = status === 402 ? '잔액이 부족합니다 (유료 충전 필요)'
    : /expired|过期|만료/i.test(detail) ? 'API 키가 만료되었습니다. TikHub에서 새 키를 발급받아 설정에 다시 저장하세요'
    : status === 401 || status === 403 ? 'API 키를 거부했습니다. 설정의 TikHub 키를 다시 확인하고 저장한 뒤 다시 검색하세요'
    : status === 400 ? '일시 오류(400). TikHub 샤오홍슈 서버가 가끔 실패합니다. 다른 플랫폼 결과로 진행하거나 잠시 후 「다시 검색」하세요'
    : `요청 실패 (${status || (e instanceof Error ? e.message.slice(0, 60) : '알 수 없음')})`;
  return `${LABEL[platform]}: TikHub ${why}`;
}

async function call(pathAndQuery: string, init?: { body: unknown }): Promise<unknown> {
  const res = await fetch(`${BASE}${pathAndQuery}`, {
    method: init ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new TikhubError(res.status, (await res.text().catch(() => '')).slice(0, 200));
  return res.json();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** TikHub 샤오홍슈 검색. 400은 문서상 일시 장애가 많아 재시도 + note_type 폴백을 한다. */
async function searchXhsNotesOnce(keyword: string): Promise<SearchResult[]> {
  const attempts: Array<Record<string, string | number>> = [
    // 공식 가이드 기본값: source=explore_feed, note_type=不限
    { keyword, page: 1, sort_type: 'general', note_type: '不限', source: 'explore_feed', ai_mode: 0 },
    { keyword, page: 1, sort_type: 'general', note_type: '视频笔记', source: 'explore_feed', ai_mode: 0 },
    { keyword, page: 1, sort_type: 'popularity_descending', note_type: '不限', source: 'explore_feed' },
  ];
  let lastErr: unknown;
  for (const params of attempts) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const res = await call(`/api/v1/xiaohongshu/app_v2/search_notes?${qs(params)}`);
        const notes = extractXhsNotes(res);
        if (notes.length) {
          return notes.map((n) => ({
            platform: 'xiaohongshu' as const,
            url: `https://www.xiaohongshu.com/explore/${n.id}`,
            title: n.title || '샤오홍슈 영상',
            thumbnail: n.cover,
            author: n.author,
          }));
        }
        // 빈 결과면 다음 파라미터로
        break;
      } catch (e) {
        lastErr = e;
        const status = e instanceof TikhubError ? e.status : 0;
        // 400은 TikHub 문서대로 잠시 뒤 재시도
        if (status === 400 && retry === 0) {
          await sleep(600 + Math.floor(Math.random() * 400));
          continue;
        }
        break;
      }
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

const qs = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

export type CnQueries = { douyin: string[]; xiaohongshu: string[]; tiktok: string[] };

/** TikHub로 더우인·샤오홍슈·TikTok을 검색한다. 키가 없으면 빈 결과, 실패한 검색은 건너뛴다. */
export async function searchTikhub(q: CnQueries, onWarn?: (message: string) => void): Promise<SearchResult[]> {
  if (!key()) {
    onWarn?.('더우인·샤오홍슈·TikTok: 설정에 저장한 TikHub 키를 아직 못 받았습니다. 설정에서 한 번 더 저장한 뒤 다시 검색하세요.');
    return [];
  }
  const tag = <T>(platform: keyof typeof LABEL, p: Promise<T>) => p.catch((e) => { throw Object.assign(new Error(), { platform, cause: e }); });
  const jobs: Promise<SearchResult[]>[] = [
    ...q.douyin.slice(0, PER_PLATFORM_QUERIES).map((keyword) => tag('douyin', (async () => {
      const res = await call('/api/v1/douyin/search/fetch_video_search_v2', {
        body: { keyword, cursor: 0, sort_type: '0', publish_time: '0', filter_duration: '0-1', content_type: '1', search_id: '' },
      });
      return extractAwemes(res).map((a) => ({
        platform: 'douyin' as const, url: `https://www.douyin.com/video/${a.id}`, title: a.desc || '더우인 영상', thumbnail: a.cover, author: a.author,
      }));
    })())),
    ...q.xiaohongshu.slice(0, PER_PLATFORM_QUERIES).map((keyword) =>
      tag('xiaohongshu', searchXhsNotesOnce(keyword)),
    ),
    ...q.tiktok.slice(0, PER_PLATFORM_QUERIES).map((keyword) => tag('tiktok', (async () => {
      const res = await call(`/api/v1/tiktok/app/v3/fetch_video_search_result?${qs({ keyword, offset: 0, count: 20, sort_type: 0, publish_time: 0 })}`);
      return extractAwemes(res).map((a) => ({
        platform: 'tiktok' as const, url: `https://www.tiktok.com/@${a.authorId ?? 'user'}/video/${a.id}`, title: a.desc || 'TikTok 영상', thumbnail: a.cover, author: a.author,
      }));
    })())),
  ];
  const settled = await Promise.allSettled(jobs);
  const warned = new Set<string>();
  return settled.flatMap((s) => {
    if (s.status === 'rejected') {
      const { platform, cause } = s.reason as { platform: keyof typeof LABEL; cause: unknown };
      const w = warningFor(platform, cause);
      if (!warned.has(w)) { warned.add(w); onWarn?.(w); console.error('[tikhub search]', w); }
      return [];
    }
    return s.value;
  });
}

/** 더우인·TikTok·샤오홍슈 URL → 내려받을 수 있는 원본 mp4 주소 (+ CDN이 요구하는 Referer) */
export async function resolveDirectVideoUrl(url: string): Promise<{ url: string; referer: string } | null> {
  const c = parseContentId(url);
  if (!c || !key()) return null;
  if (c.platform === 'douyin') {
    let u = findPlayUrl(await call(`/api/v1/douyin/app/v3/fetch_one_video?${qs({ aweme_id: c.id })}`).catch(() => null));
    u ??= findPlayUrl(await call(`/api/v1/douyin/web/fetch_one_video?${qs({ aweme_id: c.id })}`));
    return u ? { url: u, referer: 'https://www.douyin.com/' } : null;
  }
  if (c.platform === 'tiktok') {
    const u = findPlayUrl(await call(`/api/v1/tiktok/app/v3/fetch_one_video?${qs({ aweme_id: c.id })}`));
    return u ? { url: u, referer: 'https://www.tiktok.com/' } : null;
  }
  const u = findXhsVideoUrl(await call(`/api/v1/xiaohongshu/app_v2/get_video_note_detail?${qs({ note_id: c.id })}`));
  return u ? { url: u, referer: 'https://www.xiaohongshu.com/' } : null;
}
