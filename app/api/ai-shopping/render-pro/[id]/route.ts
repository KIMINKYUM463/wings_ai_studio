import fs from 'node:fs/promises';
import path from 'node:path';
import { RENDER_ROOT } from '@/lib/ai-shopping-render/engine';

export const runtime = 'nodejs';

const MAX_RANGE_CHUNK = 16 * 1024 * 1024;

/** 고품질 렌더 결과 mp4 (Range 지원, ?download 이면 첨부 파일로) */
export async function GET(req: Request, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response('bad id', { status: 400 });
  // ?status: 렌더 진행 상태만 (running | done | error)
  if (new URL(req.url).searchParams.has('status')) {
    const raw = await fs.readFile(path.join(RENDER_ROOT, id, 'status.json'), 'utf8').catch(() => '');
    return Response.json(raw ? JSON.parse(raw) : { state: 'error', error: '렌더 작업을 찾을 수 없어요 (서버가 다시 시작됐을 수 있어요). 다시 눌러 주세요.' }, { headers: { 'cache-control': 'no-store' } });
  }
  const file = path.join(RENDER_ROOT, id, 'out.mp4');
  const size = await fs.stat(file).then((s) => s.size, () => -1);
  if (size < 0) return new Response('not found', { status: 404 });

  const download = new URL(req.url).searchParams.has('download');
  const headers: Record<string, string> = {
    'content-type': 'video/mp4',
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  };
  if (download) headers['content-disposition'] = `attachment; filename="ai-shopping-${id}.mp4"`;

  const m = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  if (m && !download) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : Math.min(start + MAX_RANGE_CHUNK - 1, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    const fh = await fs.open(file, 'r');
    try {
      const buf = Buffer.allocUnsafe(end - start + 1);
      const { bytesRead } = await fh.read(buf, 0, buf.length, start);
      const slice = buf.subarray(0, bytesRead);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${start}-${start + slice.length - 1}/${size}`, 'content-length': String(slice.length) },
      });
    } finally {
      await fh.close();
    }
  }
  const buf = await fs.readFile(file);
  return new Response(new Uint8Array(buf), { status: 200, headers: { ...headers, 'content-length': String(buf.length) } });
}
