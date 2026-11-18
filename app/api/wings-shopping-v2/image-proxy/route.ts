export const runtime = 'nodejs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

/** 외부 썸네일(틱톡·인스타 CDN 핫링크 차단 회피)을 서버가 대신 받아 전달한다. https 이미지만 허용. */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get('url');
  let u: URL;
  try {
    u = new URL(target ?? '');
  } catch {
    return new Response('bad url', { status: 400 });
  }
  if (u.protocol !== 'https:') return new Response('https only', { status: 400 });
  try {
    const res = await fetch(u, { headers: { 'user-agent': UA, referer: `${u.protocol}//${u.hostname}/` } });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return new Response('not an image', { status: 502 });
    return new Response(res.body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400' } });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
