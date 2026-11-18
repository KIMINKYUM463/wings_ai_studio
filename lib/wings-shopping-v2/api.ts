import { NextResponse } from 'next/server';
import { getProject } from './store';
import { isRunning } from './pipeline';
import type { Stage } from './types';

export type Ctx = { params: Promise<{ id: string }> };

export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** 작업을 백그라운드로 시작한다(기다리지 않음). 같은 단계가 이미 실행 중이면 409. */
export async function startJob(ctx: Ctx, stage: Stage, run: (id: string) => Promise<void>) {
  const { id } = await ctx.params;
  try {
    await getProject(id);
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (isRunning(id, stage)) return err('이미 실행 중입니다', 409);
  void run(id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
