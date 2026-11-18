import { NextResponse } from 'next/server';
import path from 'node:path';
import { getProject, projectDir, updateProject } from '@/lib/wings-shopping-v2/store';
import { getThumbStyle } from '@/lib/wings-shopping-v2/thumbnails/catalog';
import { renderThumbnail } from '@/lib/wings-shopping-v2/thumbnails/render';
import { hiFrame } from '@/lib/wings-shopping-v2/thumbnails/frames';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';
const FONTS = process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');

/** 썸네일 만들기: 장면·스타일·문구로 thumbnail.jpg 생성 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { clipId?: string; styleId?: string; lines?: string[]; highlight?: string; prepend?: boolean };
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  const lines = (body.lines ?? []).map((l) => String(l).slice(0, 30)).filter((l) => l.trim()).slice(0, 4);
  if (!lines.length) return err('썸네일 문구를 입력하세요');
  const style = getThumbStyle(body.styleId);
  try {
    const frame = await hiFrame(p, body.clipId);
    await renderThumbnail(frame, style, lines, body.highlight ?? '', FONTS, path.join(projectDir(id), 'thumbnail.jpg'));
  } catch (e) {
    return err(e instanceof Error ? e.message : '썸네일 생성 실패', 500);
  }
  const next = await updateProject(id, (x) => {
    x.thumbnail = {
      ...(x.thumbnail ?? { options: [] }),
      clipId: body.clipId, styleId: style.id, lines, highlight: body.highlight ?? '', prepend: !!body.prepend,
      file: 'thumbnail.jpg', at: Date.now(),
    };
    if (x.output) x.output.stale = true;
  });
  return NextResponse.json(withLiveJobs(next));
}
