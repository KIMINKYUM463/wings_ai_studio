import { NextResponse } from 'next/server';
import { getProject } from '@/lib/wings-shopping-v2/store';
import { scriptSample } from '@/lib/wings-shopping-v2/ssul/sample-script';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 대본 구조 상세보기용 샘플 대본 (처음 한 번만 AI로 만들고 저장) */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const structureId = url.searchParams.get('structureId') ?? '';
  if (!structureId || structureId === 'auto') return NextResponse.json({ error: '대본 구조를 골라 주세요' }, { status: 400 });
  try {
    const p = await getProject(id);
    return NextResponse.json(await scriptSample(p, structureId, url.searchParams.get('force') === '1'));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
