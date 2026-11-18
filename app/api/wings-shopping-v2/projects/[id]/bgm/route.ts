import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProject, projectDir } from '@/lib/wings-shopping-v2/store';
import { generateBgm } from '@/lib/wings-shopping-v2/audio/bgm';
import { BGM_MOODS } from '@/lib/wings-shopping-v2/audio/moods';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';

export const runtime = 'nodejs';

/** 배경음악 미리듣기/새로 만들기: 분위기별 bgm/{mood}.mp3 (Lyria) */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { mood?: string; regenerate?: boolean };
  try {
    await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  const mood = BGM_MOODS.find((m) => m.id === body.mood)?.id;
  if (!mood) return err('분위기를 선택하세요');
  const rel = `bgm/${mood}.mp3`;
  const file = path.join(projectDir(id), rel);
  const has = await fs.access(file).then(() => true, () => false);
  if (!has || body.regenerate) {
    try {
      await generateBgm(mood, file);
    } catch (e) {
      return err(e instanceof Error ? e.message : '배경음악 생성 실패', 500);
    }
  }
  return NextResponse.json({ file: rel, at: Date.now() });
}
