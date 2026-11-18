import { NextResponse } from 'next/server';
import { getProject } from '@/lib/wings-shopping-v2/store';
import { attachBeatClip } from '@/lib/wings-shopping-v2/flow/attach';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';
const MAX_BYTES = 300 * 1024 * 1024;

/** Flow에서 만든 영상 파일을 문장에 붙인다 (multipart: beatId, file) */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const beatId = String(form?.get('beatId') ?? '');
  if (!(file instanceof File)) return err('파일이 없습니다');
  if (file.size > MAX_BYTES) return err('300MB 이하 파일만 올릴 수 있습니다');
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.script?.beats.some((b) => b.id === beatId)) return err('문장을 찾을 수 없습니다');
  try {
    const next = await attachBeatClip(id, beatId, Buffer.from(await file.arrayBuffer()), p.flow?.prompts[beatId]?.text ?? file.name);
    return NextResponse.json(withLiveJobs(next));
  } catch (e) {
    return err(e instanceof Error ? `영상을 읽을 수 없습니다: ${e.message.slice(0, 120)}` : '업로드 실패', 400);
  }
}
