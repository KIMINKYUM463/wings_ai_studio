import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProject, projectDir } from '@/lib/wings-shopping-v2/store';
import { getThumbStyle } from '@/lib/wings-shopping-v2/thumbnails/catalog';
import { renderThumbnail } from '@/lib/wings-shopping-v2/thumbnails/render';
import { hiFrame } from '@/lib/wings-shopping-v2/thumbnails/frames';

export const runtime = 'nodejs';
const FONTS = process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');
const exists = (f: string) => fs.access(f).then(() => true, () => false);

/** 썸네일 스타일 미리보기 (폭 360, 같은 입력이면 캐시) */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = new URL(req.url);
  let p;
  try {
    p = await getProject(id);
  } catch {
    return new Response('not found', { status: 404 });
  }
  const style = getThumbStyle(u.searchParams.get('styleId') ?? undefined);
  const lines = (u.searchParams.get('lines') ?? '').split('|').filter(Boolean).slice(0, 4);
  const highlight = u.searchParams.get('highlight') ?? '';
  const clipId = u.searchParams.get('clipId') ?? undefined;
  const useLines = lines.length ? lines : ['썸네일 문구가', '여기에 들어가요'];
  try {
    const frame = await hiFrame(p, clipId);
    const key = crypto.createHash('sha1').update(JSON.stringify([style.id, useLines, highlight, frame])).digest('hex').slice(0, 12);
    const out = path.join(projectDir(id), 'previews', `th-${key}.jpg`);
    if (!(await exists(out))) await renderThumbnail(frame, style, useLines, highlight, FONTS, out, 360);
    return new Response(new Uint8Array(await fs.readFile(out)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' } });
  } catch {
    return new Response('render failed', { status: 500 });
  }
}
