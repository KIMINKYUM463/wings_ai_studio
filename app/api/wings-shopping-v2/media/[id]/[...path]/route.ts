import fs from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from '@/lib/wings-shopping-v2/store';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

/** 한 번의 Range 요청에 읽는 최대 바이트 (16MB — 일반적인 쇼츠 MP4는 한두 번 요청으로 전체 버퍼링 완료) */
const MAX_RANGE_CHUNK = 16 * 1024 * 1024;

/**
 * 프로젝트 폴더 안의 미디어 파일을 안전하고 빠르게 제공한다.
 * Node 24 Readable.toWeb(fs.createReadStream) 사용 시 브라우저가 시크/연결 전환할 때
 * ERR_INVALID_STATE(Controller is already closed) 크래시와 20초 지연이 발생하는 문제를 원천 차단한다.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; path: string[] }> }) {
  const { id, path: parts } = await ctx.params;
  let root: string;
  try {
    root = path.resolve(projectDir(id));
  } catch {
    return new Response('bad id', { status: 400 });
  }

  const ext = path.extname(parts[parts.length - 1] ?? '').toLowerCase();
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep) || !TYPES[ext]) {
    return new Response('forbidden', { status: 403 });
  }

  let size = 0;
  try {
    const stat = await fs.stat(file);
    size = stat.size;
  } catch {
    return new Response('not found', { status: 404 });
  }

  const url = new URL(req.url);
  const download = url.searchParams.has('download');
  const hasVersion = url.searchParams.has('v') || url.searchParams.has('h');
  const headers: Record<string, string> = {
    'content-type': TYPES[ext]!,
    'accept-ranges': 'bytes',
    'cache-control': hasVersion && !download ? 'private, max-age=3600' : 'no-cache',
  };
  if (download) {
    headers['content-disposition'] = `attachment; filename="${encodeURIComponent(path.basename(file))}"`;
  }

  const rangeMatch = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  if (rangeMatch && !download) {
    const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
    const requestedEnd = rangeMatch[2]
      ? Math.min(parseInt(rangeMatch[2], 10), size - 1)
      : Math.min(start + MAX_RANGE_CHUNK - 1, size - 1);

    if (start > requestedEnd || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${size}` },
      });
    }

    const chunkLen = requestedEnd - start + 1;
    const fh = await fs.open(file, 'r');
    try {
      const buf = Buffer.allocUnsafe(chunkLen);
      const { bytesRead } = await fh.read(buf, 0, chunkLen, start);
      const slice = bytesRead === chunkLen ? buf : buf.subarray(0, bytesRead);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...headers,
          'content-range': `bytes ${start}-${start + slice.length - 1}/${size}`,
          'content-length': String(slice.length),
        },
      });
    } finally {
      await fh.close();
    }
  }

  const buf = await fs.readFile(file);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      ...headers,
      'content-length': String(buf.length),
    },
  });
}
