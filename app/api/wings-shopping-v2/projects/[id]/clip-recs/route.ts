import { NextResponse } from 'next/server';
import { getProject, updateProject } from '@/lib/wings-shopping-v2/store';
import { withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { clipRecommendations } from '@/lib/wings-shopping-v2/ssul/clip-recs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 문장별 추천 장면 (대본이 바뀔 때만 AI로 다시 계산) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ recs: await clipRecommendations(await getProject(id)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * 장면이 빠진 문장 채우기 (원본 영상을 빼거나 다시 처리해 장면이 사라졌을 때).
 * AI 추천 순서대로 고르되 바로 앞 문장과 같은 장면·큰 글자가 박힌 장면은 뒤로 미룬다. 이미 고른 문장은 그대로.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const p = await getProject(id);
    const usable = p.clips.filter((c) => !c.excluded);
    if (!usable.length || !p.script?.beats.some((b) => !b.clipId)) return NextResponse.json(withLiveJobs(p));
    const recs = await clipRecommendations(p);
    const bigText = (c: (typeof usable)[number]) => (c.textBoxes ?? []).some(([y0, , y1]) => (y1 ?? 0) - (y0 ?? 0) >= 95);
    const next = await updateProject(id, (x) => {
      const valid = new Map(x.clips.filter((c) => !c.excluded).map((c) => [c.id, c]));
      const used = new Map<string, number>();
      for (const b of x.script?.beats ?? []) if (b.clipId) used.set(b.clipId, (used.get(b.clipId) ?? 0) + 1);
      let prev: string | null = null;
      for (const b of x.script?.beats ?? []) {
        if (b.clipId && valid.has(b.clipId)) { prev = b.clipId; continue; }
        const recIds = (recs[b.id] ?? []).map((r) => r.clipId).filter((cid) => valid.has(cid));
        const order = [...recIds, ...usable.map((c) => c.id).filter((cid) => !recIds.includes(cid))];
        const score = (cid: string) => (cid === prev ? 100 : 0) + (bigText(valid.get(cid)!) ? 10 : 0) + (used.get(cid) ?? 0) * 3 + order.indexOf(cid) * 0.1;
        const pick = [...order].sort((a, b) => score(a) - score(b))[0];
        if (!pick) continue;
        b.clipId = pick;
        used.set(pick, (used.get(pick) ?? 0) + 1);
        prev = pick;
      }
      if (x.output) x.output.stale = true;
    });
    return NextResponse.json(withLiveJobs(next));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
