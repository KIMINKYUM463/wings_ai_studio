import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/wings-shopping-v2/store';
import { writeThumbCopy } from '@/lib/wings-shopping-v2/ai/gemini';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';
import type { ThumbOption } from '@/lib/wings-shopping-v2/types';

export const runtime = 'nodejs';

/** AI 썸네일 문구 4안 */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.analysis) return err('먼저 영상 분석을 끝내야 합니다');
  try {
    const options = await writeThumbCopy(p.analysis, p.script);
    await updateProject(id, (x) => {
      x.thumbnail = { styleId: 'top-white-yellow', lines: [], highlight: '', prepend: false, ...(x.thumbnail ?? {}), options: options as ThumbOption[] };
    });
    return NextResponse.json({ options });
  } catch (e) {
    return err(e instanceof Error ? e.message : '문구 생성 실패', 502);
  }
}
