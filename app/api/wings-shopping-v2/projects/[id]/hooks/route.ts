import { NextResponse } from 'next/server';
import { getProject } from '@/lib/wings-shopping-v2/store';
import { generateJson } from '@/lib/wings-shopping-v2/ai/gemini';
import { HooksSchema, hooksPrompt } from '@/lib/wings-shopping-v2/ai/hooks';
import { wrapLine } from '@/lib/wings-shopping-v2/ai/schemas';
import { getLang } from '@/lib/wings-shopping-v2/i18n/languages';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

/** 첫 문장 후킹 후보 5개 */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let p;
  try {
    p = await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.script?.beats.length) return err('대본을 먼저 만들어 주세요');
  try {
    const r = await generateJson(HooksSchema, hooksPrompt(p), undefined, [], 1.0);
    const max = getLang(p.lang)?.maxLine;
    const hooks = r.hooks.slice(0, 6).map((h) => ({ ...h, text: h.text.split('\n').flatMap((l) => wrapLine(l, max)).join('\n') })).filter((h) => h.text.trim());
    return NextResponse.json({ hooks });
  } catch (e) {
    return err(e instanceof Error ? e.message : '후킹 생성 실패', 500);
  }
}
