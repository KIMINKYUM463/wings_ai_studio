import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProject, projectDir, updateProject } from '@/lib/wings-shopping-v2/store';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_DESIGN = 3 * 1024 * 1024;

/**
 * 썸네일 스튜디오 결과 저장: 스튜디오가 만든 PNG(data URL)를 thumbnail.png 로 저장하고, 다시 열 때 쓸 디자인도 같이 둔다.
 * image 없이 prepend 만 보내면 '영상 맨 앞에 넣기' 설정만 바꾼다.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { image?: string; lines?: string[]; clipId?: string; prepend?: boolean; design?: unknown };
  try {
    await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  let file: string | undefined;
  if (body.image !== undefined) {
    const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image));
    if (!m) return err('썸네일 이미지 형식이 올바르지 않습니다');
    const buf = Buffer.from(m[2]!, 'base64');
    if (!buf.length || buf.length > MAX_IMAGE) return err('썸네일 이미지가 너무 큽니다');
    file = m[1] === 'png' ? 'thumbnail.png' : 'thumbnail.jpg';
    await fs.writeFile(path.join(projectDir(id), file), buf);
  }
  const design = body.design !== undefined && JSON.stringify(body.design).length <= MAX_DESIGN ? body.design : undefined;
  const next = await updateProject(id, (x) => {
    const cur = x.thumbnail ?? { styleId: 'top-white-yellow', lines: [], highlight: '', prepend: false, options: [] };
    x.thumbnail = {
      ...cur,
      ...(typeof body.prepend === 'boolean' ? { prepend: body.prepend } : {}),
      ...(file ? {
        file, at: Date.now(),
        lines: (body.lines ?? cur.lines).map((l) => String(l).slice(0, 30)).filter((l) => l.trim()).slice(0, 4),
        clipId: typeof body.clipId === 'string' ? body.clipId : cur.clipId,
        ...(design !== undefined ? { studioDesign: design } : {}),
      } : {}),
    };
    if (x.output && (file || typeof body.prepend === 'boolean')) x.output.stale = true;
  });
  return NextResponse.json(withLiveJobs(next));
}
