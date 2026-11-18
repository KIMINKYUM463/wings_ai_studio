import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProject, projectDir, updateProject } from '@/lib/wings-shopping-v2/store';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { generateJson } from '@/lib/wings-shopping-v2/ai/gemini';
import { PackSchema, finalizePack, packPrompt, packText } from '@/lib/wings-shopping-v2/publish/pack';
import { AFFILIATES, type Affiliate } from '@/lib/wings-shopping-v2/publish/disclosure';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

/** 업로드 문구 만들기 (YouTube·Instagram·TikTok + 고정댓글, 광고 표기 자동) */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.script?.beats.length) return err('대본을 먼저 만들어 주세요');
  const affiliate = (AFFILIATES.some((a) => a.id === p.publish?.affiliate) ? p.publish!.affiliate : 'none') as Affiliate;
  let pack;
  try {
    pack = finalizePack(await generateJson<Parameters<typeof finalizePack>[0]>(PackSchema, packPrompt(p), undefined, [], 0.8), affiliate, p.publish?.link, p.lang);
  } catch (e) {
    return err(e instanceof Error ? e.message : '업로드 문구 생성 실패', 500);
  }
  await fs.writeFile(path.join(projectDir(id), 'upload.txt'), packText(pack), 'utf8');
  const next = await updateProject(id, (x) => { x.publish = { ...(x.publish ?? { affiliate: 'none' }), pack }; });
  return NextResponse.json(withLiveJobs(next));
}
