import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { RENDER_ROOT, renderAiShopping, type AiShoppingRenderInput } from '@/lib/ai-shopping-render/engine';

export const runtime = 'nodejs';
// 배포판은 next.config rewrite 로 클라우드 PC(상시 켜진 Node 서버)에서 돈다. 렌더는 뒤에서 돌리고 바로 id 를 돌려준다 → 화면은 ?status 로 확인
export const maxDuration = 300;

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
// 요청으로는 서버 로컬 파일 경로를 받지 않는다 (http(s)·data:·같은 서버 / 경로만)
const okUrl = (v: unknown) => str(v) && /^(https?:\/\/|data:|\/(?!\/))/i.test(v as string);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validate(b: any): AiShoppingRenderInput {
  if (!b || !Array.isArray(b.scenes) || !b.scenes.length || b.scenes.length > 60) throw new Error('장면 목록이 필요합니다 (1~60개)');
  for (const s of b.scenes) {
    if (!okUrl(s?.url) || !num(s?.duration) || s.duration <= 0 || s.duration > 120) throw new Error('장면 url/duration이 올바르지 않습니다');
    if (s.kind !== undefined && s.kind !== 'video' && s.kind !== 'image') throw new Error('장면 kind가 올바르지 않습니다');
  }
  const n = b.narration;
  const okNarration = okUrl(n?.url) || (Array.isArray(n?.perScene) && n.perScene.length === b.scenes.length && n.perScene.every(okUrl));
  if (!okNarration) throw new Error('나레이션이 필요합니다');
  if (!Array.isArray(b.cues) || b.cues.length > 500 || !b.cues.every((c: any) => typeof c?.text === 'string' && num(c.start) && num(c.end))) {
    throw new Error('자막(cues) 형식이 올바르지 않습니다');
  }
  const sfxPreset = ['viral', 'soft', 'minimal'].includes(b.sfx?.preset) ? b.sfx.preset : 'viral';
  const motionPreset = ['full', 'clean', 'badge'].includes(b.motion?.preset) ? b.motion.preset : 'full';
  return {
    scenes: b.scenes.map((s: any) => ({ url: s.url, duration: s.duration, kind: s.kind })),
    narration: str(n.url) ? { url: n.url } : { perScene: n.perScene },
    cues: b.cues.map((c: any) => ({ text: String(c.text).slice(0, 200), start: c.start, end: Math.max(c.start, c.end) })),
    headcopy: Array.isArray(b.headcopy) ? [String(b.headcopy[0] ?? '').slice(0, 40), String(b.headcopy[1] ?? '').slice(0, 40)] : undefined,
    bgm: okUrl(b.bgm?.url) ? { url: b.bgm.url, volume: num(b.bgm.volume) ? b.bgm.volume : 0.18 } : undefined,
    sfx: { enabled: b.sfx?.enabled !== false, preset: sfxPreset },
    motion: { enabled: b.motion?.enabled !== false, preset: motionPreset },
    seed: num(b.seed) ? Math.abs(Math.floor(b.seed)) % 100000 : 0,
    affiliate: b.affiliate === 'none' ? 'none' : 'coupang',
    aiUsed: b.aiUsed !== false,
    thumbnailUrl: okUrl(b.thumbnailUrl) ? b.thumbnailUrl : undefined,
  };
}

export async function POST(req: Request) {
  let input: AiShoppingRenderInput;
  try {
    input = validate(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '잘못된 요청' }, { status: 400 });
  }
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(RENDER_ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  const status = (s: { state: 'running' | 'done' | 'error'; error?: string }) => fs.writeFile(path.join(dir, 'status.json'), JSON.stringify(s));
  await status({ state: 'running' });
  const origin = new URL(req.url).origin;
  void (async () => {
    try {
      const out = await renderAiShopping(input, path.join(dir, 'work'), () => {}, origin);
      await fs.rename(out, path.join(dir, 'out.mp4'));
      await status({ state: 'done' });
    } catch (e) {
      console.error('[render-pro] 실패:', e);
      await status({ state: 'error', error: e instanceof Error ? e.message : '렌더링 실패' }).catch(() => {});
    } finally {
      await fs.rm(path.join(dir, 'work'), { recursive: true, force: true }).catch(() => {});
    }
  })();
  return NextResponse.json({ id, url: `/api/ai-shopping/render-pro/${id}` }, { status: 202 });
}
