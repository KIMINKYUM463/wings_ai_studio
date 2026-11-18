import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getProject, projectDir } from '@/lib/wings-shopping-v2/store';
import { fxSettings } from '@/lib/wings-shopping-v2/audio/settings';
import { PUBLIC_SFX_MAP, planSfx, type SfxKind } from '@/lib/wings-shopping-v2/audio/sfx';
import { VIRAL_SFX } from '@/lib/viral-sfx-catalog';
import { mvpAudioCatalogItem } from '@/lib/mvp-studio-audio-catalog';
import { cleanKey } from '@/lib/wings-shopping-v2/pipeline';

export const runtime = 'nodejs';

const exists = (f: string) => fs.access(f).then(() => true, () => false);

const BASE_NAME: Record<string, string> = { whoosh: '휙', whoosh2: '휙', whoosh3: '휙', pop: '팝', tick: '딱', ding: '띵동' };
/** 타임라인에 보일 효과음 이름 */
const sfxName = (kind: SfxKind) => (kind.startsWith('viral:') ? VIRAL_SFX.find((v) => `viral:${v.id}` === kind)?.label ?? kind.slice(6) : BASE_NAME[kind] ?? kind);

/** 효과음 종류 → 브라우저에서 재생할 주소 */
function sfxUrl(kind: SfxKind): string | null {
  if (kind.startsWith('viral:')) return VIRAL_SFX.find((v) => `viral:${v.id}` === kind)?.file ?? null;
  const rel = PUBLIC_SFX_MAP[kind as keyof typeof PUBLIC_SFX_MAP];
  return rel ? `/${rel}` : null;
}

/**
 * 편집기 실시간 미리보기용 소리 계획: 렌더와 같은 규칙(planSfx)으로 효과음 시각을 정하고,
 * 고른 배경음악 주소·크기를 돌려준다. 문장 시작 시각은 편집기와 같이 음성 길이로 계산한다.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let p;
  try {
    p = await getProject(id);
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const fx = fxSettings(p);
  const beats = p.script?.beats ?? [];
  const clips = new Map(p.clips.map((c) => [c.id, c]));
  const clean = p.clean && p.clean.key === cleanKey(p) && p.clean.durations.length === beats.length ? p.clean : null;
  const starts: number[] = [];
  let acc = 0;
  for (const [i, b] of beats.entries()) {
    starts.push(acc);
    const c = b.clipId ? clips.get(b.clipId) : undefined;
    acc += clean ? clean.durations[i]! : b.tts?.duration ?? (c ? Math.max(0.5, c.end - c.start) : 2);
  }
  // 원본 영상이 바뀌는 경계 = 전환 효과음 자리 (자막 지운 영상이 있으면 렌더와 같은 시각)
  const switches: number[] = clean ? clean.switchTimes : [];
  if (!clean) {
    for (let i = 1; i < beats.length; i++) {
      const a = beats[i - 1]?.clipId ? clips.get(beats[i - 1]!.clipId!)?.sourceId : undefined;
      const b = beats[i]?.clipId ? clips.get(beats[i]!.clipId!)?.sourceId : undefined;
      if (a && b && a !== b) switches.push(starts[i]!);
    }
  }
  const sfx = fx.sfx
    ? planSfx(beats.map((b, i) => ({ start: starts[i]!, end: starts[i + 1] ?? acc, role: b.role, text: b.text })), switches, fx.sfxPreset, fx.seed)
        .map((e) => ({ t: e.t, gain: e.gain ?? 1, url: sfxUrl(e.kind), name: sfxName(e.kind) }))
        .filter((e) => e.url)
    : [];

  let bgm: { url: string; volume: number } | null = null;
  if (fx.bgm) {
    const track = fx.bgmTrackId ? mvpAudioCatalogItem(fx.bgmTrackId) : null;
    if (track?.src) bgm = { url: track.src, volume: fx.bgmVolume };
    else if (await exists(path.join(projectDir(id), 'bgm', `${fx.mood}.mp3`))) {
      bgm = { url: `/api/wings-shopping-v2/media/${id}/bgm/${fx.mood}.mp3`, volume: fx.bgmVolume };
    }
  }
  return NextResponse.json({ sfx, bgm }, { headers: { 'cache-control': 'no-store' } });
}
