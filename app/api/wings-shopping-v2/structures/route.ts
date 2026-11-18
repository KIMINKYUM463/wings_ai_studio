import { NextResponse } from 'next/server';
import { getProject } from '@/lib/wings-shopping-v2/store';
import { deleteCustomStructure, listCustomStructures, saveStructureFromAnalysis } from '@/lib/wings-shopping-v2/ssul/custom-structures';

export const runtime = 'nodejs';
export const maxDuration = 60;

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** 구조 복제 템플릿 보관함 */
export async function GET() {
  return NextResponse.json({ structures: await listCustomStructures() });
}

/** 프로젝트의 벤치마크 분석에서 구조를 뽑아 저장 (AI 호출 1회) */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { projectId?: unknown; name?: unknown };
  if (typeof body.projectId !== 'string') return err('projectId가 필요합니다', 400);
  let p;
  try {
    p = await getProject(body.projectId);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (!p.analysis) return err('먼저 영상 분석을 끝내야 합니다', 400);
  try {
    const structure = await saveStructureFromAnalysis(p.analysis, {
      projectId: p.id,
      name: typeof body.name === 'string' ? body.name : undefined,
      sourceTitle: p.name,
    });
    return NextResponse.json({ structure });
  } catch (e) {
    return err(`구조를 뽑지 못했어요: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  return (await deleteCustomStructure(id)) ? NextResponse.json({ ok: true }) : err('없는 구조입니다', 404);
}
