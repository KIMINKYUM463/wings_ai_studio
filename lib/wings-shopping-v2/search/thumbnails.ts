import type { SearchResult } from '../types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

function ogImage(html: string): string | undefined {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1].replace(/&amp;/g, '&') : undefined;
}

/** 썸네일 확보: 이미 있으면 그대로 → TikTok oEmbed → 페이지 og:image → 없음 */
export async function resolveThumbnail(r: SearchResult): Promise<string | undefined> {
  if (r.thumbnail) return r.thumbnail;
  try {
    if (r.platform === 'tiktok') {
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(r.url)}`);
      if (res.ok) {
        const d = (await res.json()) as { thumbnail_url?: string };
        if (d.thumbnail_url) return d.thumbnail_url;
      }
    }
    const res = await fetch(r.url, { headers: { 'user-agent': UA, 'accept-language': 'ko' } });
    if (!res.ok) return undefined;
    return ogImage(await res.text());
  } catch {
    return undefined;
  }
}
