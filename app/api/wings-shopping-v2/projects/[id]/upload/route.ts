import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { projectDir, updateProject } from '@/lib/wings-shopping-v2/store';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

const MAX_BYTES = 500 * 1024 * 1024;

/** 영상 파일 업로드. sourceId가 있으면 그 소스(다운로드 실패분)를 대체하고, 없으면 새 소스로 추가한다. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const sourceId = (form?.get('sourceId') as string | null) || null;
  if (!(file instanceof File)) return err('파일이 없습니다');
  if (file.size > MAX_BYTES) return err('500MB 이하 파일만 올릴 수 있습니다');
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) return err('영상 파일만 올릴 수 있습니다');

  const sid = sourceId && /^[A-Za-z0-9_-]+$/.test(sourceId) ? sourceId : `up${nanoid(6).replace(/[^A-Za-z0-9]/g, 'x')}`;
  const rel = `sources/${sid}.mp4`;
  const abs = path.join(projectDir(id), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const p = await updateProject(id, (x) => {
    const s = x.sources.find((y) => y.id === sid);
    if (s) Object.assign(s, { file: rel, status: 'pending', error: undefined, duration: undefined });
    else x.sources.push({ id: sid, platform: 'upload', title: file.name, file: rel, status: 'pending' });
    x.clips = x.clips.filter((c) => c.sourceId !== sid);
  });
  return NextResponse.json(p);
}
