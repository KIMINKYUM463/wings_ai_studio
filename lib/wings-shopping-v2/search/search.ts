import type { Analysis, Platform, SearchResult } from '../types';
import { normalizeYoutubeUrl } from '../media/ytdlp';
import { tikhubApiKey } from '../tikhub-key';
import { youtubeApiKey } from '../youtube-key';
import { searchTikhub } from './tikhub';

export const sameVideo = (a: string, b: string) => canonicalUrl(a) === canonicalUrl(b);

const PER_QUERY = 10;

export function classifyResult(url: string): Platform | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = u.hostname;
  if (/(^|\.)tiktok\.com$/.test(h) && /\/video\/\d+/.test(u.pathname)) return 'tiktok';
  if (/(^|\.)instagram\.com$/.test(h) && /^\/(reel|reels|p)\/[^/]+/.test(u.pathname)) return 'instagram';
  if (/(^|\.)youtube\.com$/.test(h) && /^\/(shorts\/|watch)/.test(u.pathname)) return 'youtube';
  if (/(^|\.)youtu\.be$/.test(h) && u.pathname.length > 1) return 'youtube';
  if (/(^|\.)xiaohongshu\.com$/.test(h) && /\/(explore|discovery\/item)\//i.test(u.pathname)) return 'xiaohongshu';
  return null;
}

/** 중복 판정을 위한 정규화: 유튜브는 shorts 형태로 통일, 그 외는 쿼리스트링/끝 슬래시 제거 */
export function canonicalUrl(url: string): string {
  const yt = normalizeYoutubeUrl(url);
  if (yt) return `https://youtube.com/shorts/${new URL(yt).searchParams.get('v')}`;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url.trim();
  }
  const v = u.searchParams.get('v');
  const p = u.pathname.replace(/\/+$/, '');
  return `https://${u.hostname.replace(/^(www\.|m\.)/, '')}${p}${v ? `?v=${v}` : ''}`;
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
  return res.json();
}

async function youtubeSearch(q: string): Promise<SearchResult[]> {
  const key = youtubeApiKey();
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    q,
    type: 'video',
    videoDuration: 'short',
    maxResults: String(PER_QUERY),
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    key,
  });
  const data = (await getJson(`https://www.googleapis.com/youtube/v3/search?${params}`)) as {
    items?: {
      id: { videoId?: string };
      snippet: {
        title: string;
        thumbnails?: { high?: { url: string }; medium?: { url: string } };
      };
    }[];
  };
  return (data.items ?? [])
    .filter((i) => i.id.videoId)
    .map((i) => ({
      platform: 'youtube' as const,
      url: `https://www.youtube.com/shorts/${i.id.videoId}`,
      title: decodeEntities(i.snippet.title),
      thumbnail: i.snippet.thumbnails?.high?.url ?? i.snippet.thumbnails?.medium?.url,
    }));
}

async function webSearch(q: string, domain: string): Promise<SearchResult[]> {
  const serper = process.env.SERPER_API_KEY;
  let rows: { title: string; url: string; image?: string }[] = [];
  if (serper) {
    const data = (await getJson('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serper, 'content-type': 'application/json' },
      body: JSON.stringify({ q: `site:${domain} ${q}`, num: PER_QUERY, gl: 'kr', hl: 'ko' }),
    })) as { organic?: { title: string; link: string; imageUrl?: string }[] };
    rows = (data.organic ?? []).map((o) => ({ title: o.title, url: o.link, image: o.imageUrl }));
  } else if (process.env.PERPLEXITY_API_KEY) {
    const data = (await getJson('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: q, max_results: PER_QUERY, search_domain_filter: [domain] }),
    })) as { results?: { title: string; url: string }[] };
    rows = (data.results ?? []).map((r) => ({ title: r.title, url: r.url }));
  }
  const out: SearchResult[] = [];
  for (const r of rows) {
    const platform = classifyResult(r.url);
    if (platform) out.push({ platform, url: r.url, title: r.title, thumbnail: r.image });
  }
  return out;
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

/**
 * AI 분석 검색어가 비어 있어도 상품명·키워드로 YouTube·TikTok 검색어를 채운다.
 * 썰 쇼핑숏폼에서 중국 플랫폼만 나오고 유튜브/틱톡이 비는 경우를 막는다.
 */
export function ensureSearchQueries(analysis: Analysis): Analysis['searchQueries'] {
  const q = analysis.searchQueries ?? {
    youtube: [],
    tiktok: [],
    instagram: [],
    douyin: [],
    xiaohongshu: [],
  };
  const name = (analysis.productName || '').trim();
  const brand = name.split(/\s+/).slice(0, 3).join(' ');
  const keywords = (analysis.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 4);
  const core = brand || keywords[0] || name || '쇼핑 꿀템';

  const ytFallback = uniq([
    core,
    `${core} 리뷰`,
    `${core} 쇼츠`,
    `${core} 추천`,
    ...keywords.map((k) => `${k} 쇼츠`),
  ]);
  const ttFallback = uniq([
    core,
    `${core} review`,
    `${core} 추천`,
    brand,
    ...keywords,
  ]);
  const igFallback = uniq([core, `${core} 추천`, ...keywords.slice(0, 2)]);
  const dyFallback = uniq([core, `${core} 测评`, `${core} 好物`]);
  const xhsFallback = uniq([core, `${core} 测评`, `${core} 推荐`]);

  return {
    youtube: q.youtube?.length ? uniq(q.youtube) : ytFallback,
    tiktok: q.tiktok?.length ? uniq(q.tiktok) : ttFallback,
    instagram: q.instagram?.length ? uniq(q.instagram) : igFallback,
    douyin: q.douyin?.length ? uniq(q.douyin) : dyFallback,
    xiaohongshu: q.xiaohongshu?.length ? uniq(q.xiaohongshu) : xhsFallback,
  };
}

/** 플랫폼별 검색어로 영상을 모은다. 실패한 검색은 건너뛰고 나머지 결과를 돌려준다. exclude(레퍼런스 등)는 빼고 돌려준다. */
export async function searchVideos(
  queries: Analysis['searchQueries'],
  exclude: string[] = [],
  onWarn?: (message: string) => void,
  limit = 4,
): Promise<SearchResult[]> {
  const ytKey = youtubeApiKey();
  const tikhub = !!tikhubApiKey();
  const hasWeb = Boolean(process.env.SERPER_API_KEY || process.env.PERPLEXITY_API_KEY);

  if (!ytKey) {
    onWarn?.(
      'YouTube: ShotForm 설정에 YouTube Data API 키를 저장한 뒤 다시 검색해 주세요. (없으면 유튜브 쇼츠 결과가 비어 있습니다)',
    );
  }
  if (!tikhub && !hasWeb) {
    onWarn?.(
      'TikTok: TikHub 키 또는 SERPER/Perplexity 키가 없어 틱톡 검색을 건너뜁니다. 설정에 TikHub 키를 저장하면 TikTok·더우인·샤오홍슈를 함께 가져옵니다.',
    );
  }

  const ytQueries = (queries.youtube ?? []).slice(0, limit);
  const ttQueries = (queries.tiktok ?? []).slice(0, limit);
  const igQueries = (queries.instagram ?? []).slice(0, limit);

  const jobs: Promise<SearchResult[]>[] = [
    // YouTube Data API
    ...ytQueries.map((q) => youtubeSearch(q)),
    // TikTok: TikHub 우선, 없으면(또는 키 없을 때) 웹 검색 폴백
    ...(tikhub
      ? []
      : ttQueries.map((q) => webSearch(q, 'tiktok.com'))),
    // Instagram 웹 검색
    ...igQueries.map((q) => webSearch(q, 'instagram.com')),
    // TikHub: 더우인·샤오홍슈 + (키가 있으면) TikTok
    searchTikhub(
      {
        douyin: queries.douyin ?? [],
        xiaohongshu: queries.xiaohongshu ?? [],
        tiktok: tikhub ? ttQueries : [],
      },
      onWarn,
    ),
  ];

  // TikHub TikTok이 비었을 때를 대비해, 키가 있어도 웹 검색을 보조로 한 번 더 (SERPER 있을 때만)
  if (tikhub && hasWeb && ttQueries.length) {
    jobs.push(...ttQueries.slice(0, 2).map((q) => webSearch(q, 'tiktok.com')));
  }

  const settled = await Promise.allSettled(jobs);
  const seen = new Set<string>(exclude.map(canonicalUrl));
  const out: SearchResult[] = [];
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const r of s.value) {
      const key = canonicalUrl(r.url);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }

  const byPlatform = (p: Platform) => out.filter((r) => r.platform === p).length;
  if (ytKey && byPlatform('youtube') === 0 && ytQueries.length) {
    onWarn?.('YouTube: 검색어로 쇼츠를 찾지 못했습니다. 검색어를 바꾸거나 다시 검색해 보세요.');
  }
  if ((tikhub || hasWeb) && byPlatform('tiktok') === 0 && ttQueries.length) {
    onWarn?.('TikTok: 검색 결과가 비었습니다. TikHub 키·잔액 또는 검색어를 확인해 주세요.');
  }

  return out;
}
