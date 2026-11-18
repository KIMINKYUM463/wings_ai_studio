import { NextResponse } from 'next/server';
import { resolveDirectVideoUrl } from '@/lib/wings-shopping-v2/search/tikhub';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 같은 URL 은 서버가 켜져 있는 동안 다시 TikHub 를 부르지 않는다 (CDN 주소는 몇 시간 유효) */
const cache = new Map<string, { src: string; at: number }>();
const TTL = 60 * 60 * 1000;

/** 더우인·샤오홍슈(·TikTok) 영상 미리보기: TikHub 로 원본 mp4 주소를 받아 프록시 주소로 돌려준다 (요청 1건) */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') ?? '';
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: '영상 주소가 필요해요' }, { status: 400 });
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ src: hit.src });
  try {
    const r = await resolveDirectVideoUrl(url);
    if (!r) return NextResponse.json({ error: '이 영상은 여기서 재생할 수 없어요' }, { status: 404 });
    const src = `/api/proxy-video?url=${encodeURIComponent(r.url.replace(/^http:\/\//, 'https://'))}`;
    cache.set(url, { src, at: Date.now() });
    return NextResponse.json({ src });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
