import { NextResponse } from 'next/server';
import { createProject, listProjects } from '@/lib/wings-shopping-v2/store';
import { runAnalyze } from '@/lib/wings-shopping-v2/pipeline';
import { err } from '@/lib/wings-shopping-v2/api';
import { isStoryMode } from '@/lib/wings-shopping-v2/types';

export const runtime = 'nodejs';

export async function GET() {
  const list = await listProjects();
  // cover: 목록 카드에 보일 장면 그림 (첫 사용 장면), stage: 어디까지 만들었는지
  return NextResponse.json(list.map((p) => ({
    id: p.id, name: p.name, createdAt: p.createdAt, hasOutput: !!p.output, mode: p.mode ?? 'remix', lang: p.lang,
    cover: (p.clips.find((c) => !c.excluded) ?? p.clips[0])?.id,
    stage: p.output ? 'done' : p.script?.beats.length ? 'script' : p.clips.length ? 'clips' : p.analysis ? 'analysis' : 'new',
  })));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string; mode?: string };
  const url = body.url?.trim();
  if (!url || !/^https?:\/\//.test(url)) return err('영상 URL을 입력하세요');
  const p = await createProject(url, isStoryMode(body.mode) ? body.mode : 'remix');
  void runAnalyze(p.id);
  return NextResponse.json(p, { status: 201 });
}
