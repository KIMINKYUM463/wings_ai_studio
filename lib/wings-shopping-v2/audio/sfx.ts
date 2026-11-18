import fs from 'node:fs/promises';
import path from 'node:path';
import { runFfmpeg } from '../media/ffmpeg';
import { VIRAL_SFX, type ViralSfxId } from '../../viral-sfx-catalog';

type BaseSfxKind = 'whoosh' | 'whoosh2' | 'whoosh3' | 'pop' | 'tick' | 'ding';
/** 기존 6종 + public/viral-sfx 바이럴 효과음(`viral:<id>`) */
export type SfxKind = BaseSfxKind | `viral:${ViralSfxId}`;
export type SfxEvent = { kind: SfxKind; t: number; gain?: number };
import type { SfxPreset } from '../fx-presets';
export type SfxFiles = Record<SfxKind, string>;

/** public/story-shopping-sfx 내 실제 윙스 스튜디오 단발 효과음 우선 매핑 */
export const PUBLIC_SFX_MAP: Record<BaseSfxKind, string> = {
  whoosh: 'story-shopping-sfx/sfx-213.wav',
  whoosh2: 'story-shopping-sfx/sfx-214.wav',
  whoosh3: 'story-shopping-sfx/sfx-215.wav',
  pop: 'story-shopping-sfx/sfx-279.mp3',
  tick: 'story-shopping-sfx/sfx-009.mp3',
  ding: 'story-shopping-sfx/sfx-007.mp3',
};

/** 스튜디오 파일이 없을 때만 쓰는 합성 폴백 */
const FALLBACK_SOURCES: Record<BaseSfxKind, string[]> = {
  whoosh: ['-f', 'lavfi', '-i', 'anoisesrc=d=0.42:c=pink:a=0.7', '-af', 'bandpass=f=1400:w=1600,afade=t=in:d=0.20,afade=t=out:st=0.20:d=0.22,volume=0.9'],
  whoosh2: ['-f', 'lavfi', '-i', 'anoisesrc=d=0.38:c=pink:a=0.7', '-af', 'bandpass=f=1750:w=1800,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.20,volume=0.9'],
  whoosh3: ['-f', 'lavfi', '-i', 'anoisesrc=d=0.34:c=pink:a=0.7', '-af', 'bandpass=f=1150:w=1400,afade=t=in:d=0.16,afade=t=out:st=0.16:d=0.18,volume=0.9'],
  pop: ['-f', 'lavfi', '-i', "aevalsrc='0.7*sin(2*PI*(950-2400*t)*t)*exp(-28*t)':d=0.16"],
  tick: ['-f', 'lavfi', '-i', "aevalsrc='0.65*sin(2*PI*1800*t)*exp(-45*t)':d=0.09"],
  ding: ['-f', 'lavfi', '-i', "aevalsrc='0.35*(sin(2*PI*1318*t)+0.6*sin(2*PI*1975*t)+0.3*sin(2*PI*2637*t))*exp(-4.5*t)':d=0.9"],
};

export async function ensureSfx(dir: string): Promise<SfxFiles> {
  await fs.mkdir(dir, { recursive: true });
  const publicRoot = path.join(process.cwd(), 'public');
  const files = {} as SfxFiles;

  for (const k of Object.keys(PUBLIC_SFX_MAP) as BaseSfxKind[]) {
    const bundled = path.join(publicRoot, PUBLIC_SFX_MAP[k]);
    const hasBundled = await fs.stat(bundled).then((s) => s.size > 500, () => false);
    if (hasBundled) {
      files[k] = bundled;
      continue;
    }
    const f = path.join(dir, `${k}.wav`);
    files[k] = f;
    const ok = await fs.stat(f).then((s) => s.size > 1000, () => false);
    if (!ok) await runFfmpeg(['-y', ...FALLBACK_SOURCES[k], '-ar', '44100', '-ac', '2', f]);
  }

  // 바이럴 효과음: 파일이 없으면 같은 성격의 기존 효과음으로 대체해 믹스가 깨지지 않게 한다
  for (const s of VIRAL_SFX) {
    const f = path.join(publicRoot, s.file);
    const has = await fs.stat(f).then((st) => st.size > 500, () => false);
    files[`viral:${s.id}`] = has ? f : files[s.category === 'transition' ? 'whoosh' : s.category === 'click' ? 'tick' : 'pop'];
  }
  return files;
}

type ViralPick = { pool: readonly ViralSfxId[]; gain: number; offset: number };
/** 문장 역할 → 바이럴 효과음 후보 (밈·큰 소리는 gain 낮게) */
const ROLE_VIRAL: Record<string, ViralPick> = {
  hook: { pool: ['vine-boom', 'dudung', 'tara', 'discover', 'dudung2', 'drum', 'ting', 'core'], gain: 0.55, offset: 0.02 },
  twist: { pool: ['dudung', 'discover', 'dudung2', 'simple-whoosh'], gain: 0.65, offset: 0.02 },
  reveal: { pool: ['discover', 'dudung2', 'tara', 'dudung'], gain: 0.65, offset: 0.02 },
  price: { pool: ['money-tiring', 'money-ching'], gain: 0.75, offset: 0.02 },
  proof: { pool: ['wow-c', 'yeah', 'wow-a'], gain: 0.55, offset: 0.05 },
  social_proof: { pool: ['yeah', 'wow-c', 'wow-b'], gain: 0.55, offset: 0.05 },
  conflict: { pool: ['nop', 'ding-ding-awkward', 'nope', 'absurd'], gain: 0.55, offset: 0.03 },
  problem: { pool: ['ding-ding-awkward', 'nop', 'absurd', 'nope'], gain: 0.55, offset: 0.03 },
  con: { pool: ['nope', 'nop', 'ding-ding-awkward'], gain: 0.55, offset: 0.03 },
  curiosity: { pool: ['question-ding', 'mwoji'], gain: 0.7, offset: 0.02 },
  product_intro: { pool: ['sparkle', 'ppok', 'ppok-clear'], gain: 0.75, offset: 0.02 },
  cta: { pool: ['ddalkkak', 'mouse-click', 'caption-ding-dong'], gain: 0.9, offset: 0.02 },
};
/** 장면 전환: 휙 계열 순환 */
const SWITCH_CYCLE: readonly SfxKind[] = ['whoosh', 'viral:transition-hook', 'viral:hwiik', 'whoosh2', 'viral:simple-whoosh', 'viral:swish', 'whoosh3', 'viral:transition-hook2'];
/** 문장 중간 포인트 (숫자·핵심 줄이 나올 때) */
const MID_CYCLE: readonly SfxKind[] = ['viral:ppok-1', 'viral:caption-point', 'viral:ppyong', 'pop', 'viral:ting', 'viral:ppok-clear', 'tick', 'viral:ddak'];
const MID_RE = /(\d+\s*(위|가지|초|분|배|%|원|만\s*원|개)|특가|핵심|포인트|진짜|완전|바로|딱|끝)/;
const NUMBER_OR_POINT_RE = /(첫\s*번째|두\s*번째|세\s*번째|네\s*번째|\d+\s*(위|가지|초|분|배|%|원|만\s*원)|특가|핵심|포인트)/;
const CTA_TEXT_RE = /(댓글|프로필|링크|고정|남겨|확인해|구매)/;

/**
 * 문장 시각·대사·원본 영상 전환을 보고 효과음을 자동 배치한다.
 * - 첫 문장: 오프닝 훅 (seed 마다 바인 붐·두둥·타라·발견… 중 하나)
 * - 문장(장면)이 바뀔 때마다: 휙 계열 전환음 (화면 전환 모션과 같은 자리)
 * - 역할(반전·가격·후기·문제·궁금증·제품 소개·CTA): 역할별 바이럴 효과음
 * - 문장 중간: 숫자·핵심 줄이 나오는 순간 뽁·띵 포인트 (긴 문장은 가운데 줄에도)
 * - 마지막 문장: 알림 띵동
 * seed 가 바뀌면('다시 만들기') 같은 자리라도 다른 소리 조합이 된다.
 */
export function planSfx(
  beats: { start: number; end?: number; role?: string; text?: string }[],
  streamSwitchTimes: number[] = [],
  preset: SfxPreset = 'viral',
  seed = 0,
): SfxEvent[] {
  if (!beats.length) return [];

  type Tag = 'open' | 'cut' | 'role' | 'mid' | 'end';
  type Candidate = SfxEvent & { priority: number; tag: Tag };
  const candidates: Candidate[] = [];
  const r2 = (n: number) => Math.round(Math.max(0, n) * 100) / 100;
  let lastViral: SfxKind | undefined;
  const pickViral = (p: ViralPick, i: number): SfxKind => {
    let kind: SfxKind = `viral:${p.pool[(i + seed) % p.pool.length]!}`;
    if (kind === lastViral && p.pool.length > 1) kind = `viral:${p.pool[(i + seed + 1) % p.pool.length]!}`;
    lastViral = kind;
    return kind;
  };
  const endOf = (i: number) => beats[i]!.end ?? beats[i + 1]?.start ?? beats[i]!.start + 3;

  // 1) 오프닝 훅
  candidates.push({ kind: pickViral(ROLE_VIRAL.hook!, 0), t: 0.02, gain: ROLE_VIRAL.hook!.gain, priority: 5, tag: 'open' });

  // 2) 장면 전환마다 휙 (원본 영상이 바뀌는 곳은 조금 크게)
  const switches = new Set(streamSwitchTimes.map((x) => r2(x)));
  beats.slice(1).forEach((b, k) => {
    if (b.start <= 0.3) return;
    const kind = SWITCH_CYCLE[(k + seed) % SWITCH_CYCLE.length]!;
    const big = switches.has(r2(b.start));
    candidates.push({ kind, t: r2(b.start - 0.12), gain: (kind.startsWith('viral:') ? 0.6 : 0.75) * (big ? 1.2 : 1), priority: 4, tag: 'cut' });
  });

  // 3) 문장 역할 / 4) 문장 중간 포인트
  let midIdx = seed;
  beats.forEach((b, i) => {
    const text = (b.text ?? '').replace(/\s+/g, ' ').trim();
    const isLast = i === beats.length - 1;
    const isCta = b.role === 'cta' || (isLast && beats.length >= 2) || CTA_TEXT_RE.test(text);
    if (isCta && i > 0) {
      candidates.push({ kind: isLast ? 'ding' : pickViral(ROLE_VIRAL.cta!, i), t: r2(b.start + 0.05), gain: isLast ? 0.95 : ROLE_VIRAL.cta!.gain, priority: 5, tag: isLast ? 'end' : 'role' });
    } else if (i > 0) {
      const viral = b.role ? ROLE_VIRAL[b.role] : undefined;
      if (viral && b.role !== 'hook') candidates.push({ kind: pickViral(viral, i), t: r2(b.start + 0.05), gain: viral.gain, priority: 3, tag: 'role' });
      else if (NUMBER_OR_POINT_RE.test(text)) candidates.push({ kind: i % 2 === 0 ? 'tick' : 'pop', t: r2(b.start + 0.05), gain: 0.85, priority: 3, tag: 'role' });
    }
    // 문장 중간: 숫자·핵심 단어가 든 줄이 나오는 순간, 없으면 긴 문장(2.6초+)의 가운데 줄
    const end = endOf(i);
    const lines = (b.text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2 || end - b.start < 1.8) return;
    const total = lines.reduce((a, l) => a + l.length, 0) || 1;
    let acc = 0;
    const at = lines.map((l) => { const t = b.start + ((end - b.start) * acc) / total; acc += l.length; return { t, l }; }).slice(1);
    const hit = at.find((x) => MID_RE.test(x.l)) ?? (end - b.start >= 2.6 ? at[Math.floor((at.length - 1) / 2)] : undefined);
    if (!hit || hit.t < b.start + 0.6 || hit.t > end - 0.35) return;
    candidates.push({ kind: MID_CYCLE[midIdx++ % MID_CYCLE.length]!, t: r2(hit.t), gain: 0.6, priority: 2, tag: 'mid' });
  });

  // 우선순위 순으로 채택: 전환 휙과 내용 소리는 0.1초만 떨어져도 같이 쓰고, 같은 종류끼리는 0.7초 간격
  const chosen: (SfxEvent & { tag: Tag })[] = [];
  for (const c of [...candidates].sort((a, b) => b.priority - a.priority || a.t - b.t)) {
    const clash = chosen.some((x) => {
      const dt = Math.abs(x.t - c.t);
      return (x.tag === 'cut') !== (c.tag === 'cut') ? dt < 0.1 : dt < 0.7;
    });
    if (!clash) chosen.push({ kind: c.kind, t: c.t, gain: c.gain, tag: c.tag });
  }
  const sorted = chosen.sort((a, b) => a.t - b.t);
  const keep = (tag: Tag) => preset === 'viral' || tag === 'open' || tag === 'end' || (preset === 'soft' && tag === 'cut');
  return sorted
    .filter((e) => keep(e.tag))
    .map(({ tag: _tag, ...e }) => (preset === 'soft' ? { ...e, gain: (e.gain ?? 1) * 0.6 } : e));
}
