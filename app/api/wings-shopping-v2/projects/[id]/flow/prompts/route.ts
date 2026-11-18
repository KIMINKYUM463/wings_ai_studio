import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/wings-shopping-v2/store';
import { writeFlowPrompts } from '@/lib/wings-shopping-v2/ai/gemini';
import { veoAvailable } from '@/lib/wings-shopping-v2/flow/veo';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';
import type { FlowSettings } from '@/lib/wings-shopping-v2/types';

export const runtime = 'nodejs';

/** 문장별 Flow 프롬프트 생성 (대본 기준) */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { style?: string };
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.analysis || !p.script?.beats.length) return err('먼저 대본을 만들어야 합니다');
  try {
    const flow = await writeFlowPrompts(p.analysis, p.script.beats, body.style?.slice(0, 120));
    const next = await updateProject(id, (x) => { x.flow = flow as FlowSettings; });
    return NextResponse.json({ ...withLiveJobs(next), veoAvailable: veoAvailable() });
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Flow 프롬프트 생성 실패', 502);
  }
}

export async function GET() {
  return NextResponse.json({ veoAvailable: veoAvailable() });
}
