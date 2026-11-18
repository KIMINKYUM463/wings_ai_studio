import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getProject } from '@/lib/wings-shopping-v2/store';
import { attachBeatClip } from '@/lib/wings-shopping-v2/flow/attach';
import { generateVeoClip, veoAvailable } from '@/lib/wings-shopping-v2/flow/veo';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

/** Veo로 문장 장면을 바로 생성 (키에 Veo 권한이 있을 때만) */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { beatId } = (await req.json().catch(() => ({}))) as { beatId?: string };
  if (!veoAvailable()) return err('이 키로는 Veo를 쓸 수 없습니다. Flow에서 만든 영상을 올려 주세요.', 400);
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  const fp = beatId ? p.flow?.prompts[beatId] : undefined;
  if (!fp) return err('먼저 Flow 프롬프트를 만들어 주세요');
  if (!fp.safe) return err('이 문장은 실제 상품 영상이 필요해서 AI로 만들지 않습니다');
  const tmp = path.join(os.tmpdir(), `veo-${id}-${beatId}.mp4`);
  try {
    await generateVeoClip(fp.text, fp.seconds, tmp);
    const next = await attachBeatClip(id, beatId!, await fs.readFile(tmp), fp.text);
    return NextResponse.json(withLiveJobs(next));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Veo 생성 실패', 502);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
