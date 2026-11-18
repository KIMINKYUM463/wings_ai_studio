import { NextResponse } from 'next/server';
import { runLocalize, withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { listProjects } from '@/lib/wings-shopping-v2/store';
import { LANGS } from '@/lib/wings-shopping-v2/i18n/languages';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

/** 이 프로젝트에서 만든 해외판 목록 + 지원 언어 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const list = (await listProjects()).filter((p) => p.localizedFrom === id).map((p) => ({ id: p.id, lang: p.lang, name: p.name, hasOutput: !!p.output && !p.output.stale, jobs: withLiveJobs(p).jobs }));
  return NextResponse.json({ langs: LANGS.map(({ id: l, name, market }) => ({ id: l, name, market })), versions: list });
}

/** 해외판 만들기: { lang } → 복제·번역 후 음성·렌더를 자동으로 시작 */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { lang?: string; vmakeApiKey?: string; vmakeSecretAccessKey?: string };
  try {
    // 유료 자막 지우기를 쓰는 프로젝트면 해외판 자동 렌더도 같은 키로 지운다 (원본에서 지운 결과는 그대로 재사용)
    const p = await runLocalize(id, String(body.lang ?? ''), { vmakeApiKey: body.vmakeApiKey, vmakeSecretAccessKey: body.vmakeSecretAccessKey });
    return NextResponse.json({ id: p.id, name: p.name });
  } catch (e) {
    return err(e instanceof Error ? e.message : '해외판 생성 실패', 500);
  }
}
