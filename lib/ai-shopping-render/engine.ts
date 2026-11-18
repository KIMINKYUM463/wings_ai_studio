import fs from 'node:fs/promises';
import path from 'node:path';
import {
  applyPunchZooms,
  concatAudios,
  concatVideos,
  encArgs,
  FPS,
  mux,
  OUT_H,
  OUT_W,
  probeDuration,
  runFfmpeg,
} from '@/lib/wings-shopping-v2/media/ffmpeg';
import { motionExtras, punchZoomWindows, transitionZoomWindows, type MotionBeatInfo } from '@/lib/wings-shopping-v2/motion/ass';
import { buildAss, type Cue } from '@/lib/wings-shopping-v2/subtitles';
import { ensureSfx, planSfx } from '@/lib/wings-shopping-v2/audio/sfx';
import { mixAudio } from '@/lib/wings-shopping-v2/audio/mix';
import { disclosureLines, withDisclosure } from '@/lib/wings-shopping-v2/publish/disclosure';
import { prependStill } from '@/lib/wings-shopping-v2/thumbnails/render';
import { pieceFrameCounts } from '@/lib/wings-shopping-v2/sync';
import type { MotionPreset, SfxPreset } from '@/lib/wings-shopping-v2/fx-presets';

export type AiShoppingRenderInput = {
  scenes: { url: string; duration: number; kind?: 'video' | 'image' }[];
  /** 전체 나레이션 1개 (url) 또는 장면별 나레이션 (perScene[i] = scenes[i]의 음성, 슬롯 길이로 패딩) */
  narration: { url: string } | { perScene: string[] };
  /** 나레이션 기준 초 단위 자막 */
  cues: Cue[];
  headcopy?: [string, string];
  bgm?: { url: string; volume: number };
  sfx: { enabled: boolean; preset: SfxPreset };
  motion: { enabled: boolean; preset: MotionPreset };
  seed?: number;
  affiliate?: 'coupang' | 'none';
  aiUsed?: boolean;
  thumbnailUrl?: string;
  font?: string;
};

export type Progress = (message: string, fraction: number) => void | Promise<void>;

const FONTS_DIR = process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');
export const RENDER_ROOT = path.join(process.cwd(), 'data', 'ai-shopping-renders');
const MAX_ASSET_BYTES = 400 * 1024 * 1024;
const XFADE = 0.4;

/** 서버에서 읽을 수 있는 로컬 폴더 (그 밖의 로컬 경로는 거부) */
const LOCAL_ROOTS = [path.join(process.cwd(), 'public'), path.join(process.cwd(), 'data')];

async function fetchAsset(src: string, baseUrl: string | undefined, out: string): Promise<string> {
  if (src.startsWith('data:')) {
    const m = src.match(/^data:[^;,]*(;base64)?,(.*)$/s);
    if (!m) throw new Error('잘못된 data URL');
    await fs.writeFile(out, m[1] ? Buffer.from(m[2]!, 'base64') : Buffer.from(decodeURIComponent(m[2]!)));
    return out;
  }
  if (!/^https?:\/\//i.test(src) && !src.startsWith('/')) {
    const local = path.resolve(process.cwd(), src);
    if (LOCAL_ROOTS.some((r) => local.startsWith(r + path.sep)) && !/(\.env|-key\.(json|txt))$/i.test(local)) {
      await fs.copyFile(local, out);
      return out;
    }
    throw new Error(`읽을 수 없는 경로: ${src}`);
  }
  if (src.startsWith('/') && !src.startsWith('//')) {
    // 같은 서버의 public 파일이면 바로 읽는다
    const pub = path.join(process.cwd(), 'public', decodeURIComponent(src.split('?')[0]!));
    if (pub.startsWith(LOCAL_ROOTS[0]! + path.sep) && (await fs.stat(pub).then((s) => s.isFile(), () => false))) {
      await fs.copyFile(pub, out);
      return out;
    }
    if (!baseUrl) throw new Error(`상대 경로를 풀 수 없습니다: ${src}`);
  }
  const url = new URL(src, baseUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error(`지원하지 않는 주소: ${url.protocol}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`파일을 받지 못했습니다 (${res.status}): ${url.pathname}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ASSET_BYTES) throw new Error('파일이 너무 큽니다');
  await fs.writeFile(out, buf);
  return out;
}

/** MediaRecorder webm처럼 길이 메타데이터가 없는 파일은 끝까지 디코딩해서 잰다 */
async function mediaDuration(file: string): Promise<number> {
  try {
    return await probeDuration(file);
  } catch {
    const err = await runFfmpeg(['-i', file, '-map', '0:v:0?', '-map', '0:a:0?', '-f', 'null', '-']);
    const all = [...err.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
    const last = all[all.length - 1];
    if (!last) throw new Error(`길이를 읽을 수 없음: ${path.basename(file)}`);
    return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  }
}

const isImage = (file: string, kind?: string) => kind === 'image' || (!kind && /\.(png|jpe?g|webp|gif|bmp)$/i.test(file));
const cover = `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},setsar=1`;

/** 정지 이미지 → 느린 켄번스 (번갈아 확대/축소) */
async function renderImageSlot(src: string, frames: number, i: number, out: string) {
  const T = frames / FPS;
  const z = i % 2 === 0 ? `(1+0.10*t/${T.toFixed(3)})` : `(1.10-0.10*t/${T.toFixed(3)})`;
  // 미리 2배로 키워 두고 확대 → 서브픽셀 떨림 줄이기
  const vf = [
    `scale=${OUT_W * 2}:${OUT_H * 2}:force_original_aspect_ratio=increase,crop=${OUT_W * 2}:${OUT_H * 2},setsar=1`,
    `fps=${FPS}`,
    `scale=w='${OUT_W}*${z}':h='${OUT_H}*${z}':eval=frame`,
    `crop=${OUT_W}:${OUT_H}`,
    'format=yuv420p',
  ].join(',');
  await runFfmpeg(['-y', '-loop', '1', '-t', (T + 0.2).toFixed(3), '-i', src, '-vf', vf, '-frames:v', String(frames), ...encArgs(FPS), out]);
}

/**
 * 영상 → 슬롯을 정확히 채운다. 짧으면 살짝 느리게(최대 1.25배) 늘리고,
 * 그래도 모자라면 같은 클립을 0.4초 크로스페이드로 이어 붙인다 (마지막 프레임 정지 없음).
 */
async function renderVideoSlot(src: string, frames: number, out: string) {
  const slot = frames / FPS;
  const d = await mediaDuration(src);
  const slow = Math.min(1.25, Math.max(1, slot / Math.max(0.1, d)));
  const len = d * slow;
  const base = `${cover},setpts=${slow.toFixed(4)}*(PTS-STARTPTS),fps=${FPS},format=yuv420p`;
  // 이어 붙일 횟수: 첫 클립 + (len - XFADE)씩 늘어나는 반복분
  const copies = len >= slot || len <= XFADE + 0.1 ? 1 : 1 + Math.ceil((slot - len) / (len - XFADE));
  const parts: string[] = [];
  for (let k = 0; k < copies; k++) parts.push(`[${k}:v]${base}[c${k}]`);
  let last = 'c0';
  for (let k = 1; k < copies; k++) {
    const offset = k * (len - XFADE);
    parts.push(`[${last}][c${k}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(4)}[x${k}]`);
    last = `x${k}`;
  }
  // 아주 짧은 클립(≤0.5초)만 마지막 프레임 연장 (그 밖엔 위에서 이미 다 채워짐)
  parts.push(`[${last}]tpad=stop_mode=clone:stop_duration=${copies === 1 && len < slot ? (slot - len + 0.1).toFixed(3) : '0.1'}[v]`);
  const inputs = Array.from({ length: copies }, () => ['-i', src]).flat();
  await runFfmpeg(['-y', ...inputs, '-an', '-filter_complex', parts.join(';'), '-map', '[v]', '-frames:v', String(frames), ...encArgs(FPS), out]);
}

export async function renderAiShopping(
  input: AiShoppingRenderInput,
  workDir: string,
  onProgress: Progress = () => {},
  baseUrl?: string,
): Promise<string> {
  if (!input.scenes.length) throw new Error('장면이 없습니다');
  await fs.mkdir(workDir, { recursive: true });
  const w = (n: string) => path.join(workDir, n);

  await onProgress('소재를 내려받는 중...', 0.02);
  const sceneFiles: string[] = [];
  for (const [i, s] of input.scenes.entries()) {
    const ext = path.extname(new URL(s.url.startsWith('data:') ? 'http://x/a' : s.url, 'http://x').pathname).slice(0, 6) || (s.kind === 'image' ? '.png' : '.mp4');
    const kindExt = s.url.startsWith('data:image/') ? '.png' : ext;
    sceneFiles.push(await fetchAsset(s.url, baseUrl, w(`src_${i}${kindExt}`)));
  }

  // 나레이션 → 하나의 오디오. 전체 길이 = 나레이션 길이
  let narration: string;
  let slots = input.scenes.map((s) => Math.max(0.2, s.duration));
  if ('perScene' in input.narration) {
    const files: string[] = [];
    for (const [i, u] of input.narration.perScene.entries()) files.push(await fetchAsset(u, baseUrl, w(`nar_${i}.audio`)));
    if (files.length !== slots.length) throw new Error('장면 수와 장면별 나레이션 수가 다릅니다');
    narration = w('narration.m4a');
    await concatAudios(files, slots, narration);
  } else {
    narration = await fetchAsset(input.narration.url, baseUrl, w('narration.audio'));
  }
  const total = await mediaDuration(narration);
  // 슬롯 합계를 나레이션 길이에 맞춘다 (비율 유지)
  const sum = slots.reduce((a, b) => a + b, 0);
  slots = slots.map((d) => (d * total) / sum);
  const starts = slots.map((_, i) => slots.slice(0, i).reduce((a, b) => a + b, 0));
  const frames = pieceFrameCounts(slots, FPS);

  const pieces: string[] = [];
  for (const [i, f] of sceneFiles.entries()) {
    await onProgress(`장면 맞추는 중... (${i + 1}/${sceneFiles.length})`, 0.05 + (0.45 * i) / sceneFiles.length);
    const out = w(`piece_${String(i).padStart(3, '0')}.mp4`);
    if (isImage(f, input.scenes[i]!.kind)) await renderImageSlot(f, frames[i]!, i, out);
    else await renderVideoSlot(f, frames[i]!, out);
    pieces.push(out);
  }
  const video = w('video.mp4');
  await concatVideos(pieces, video);

  // 장면별 비트: 해당 장면 안에서 시작하는 자막 줄들
  const beats: MotionBeatInfo[] = slots.map((d, i) => {
    const s = starts[i]!;
    const e = s + d;
    const text = input.cues.filter((c) => c.start >= s - 0.01 && c.start < e - 0.01).map((c) => c.text).join('\n');
    return { start: s, end: e, text: text || ' ' };
  });
  const switchTimes = starts.slice(1);
  const { motion } = input;

  if (motion.enabled && motion.preset !== 'badge') {
    const wins = [...punchZoomWindows(beats), ...(motion.preset === 'full' ? transitionZoomWindows(motionExtras(beats, input.seed ?? 0), beats) : [])];
    if (wins.length) {
      await onProgress('확대 모션을 넣는 중...', 0.55);
      await applyPunchZooms(video, w('video_zoom.mp4'), wins, FPS);
      await fs.rename(w('video_zoom.mp4'), video);
    }
  }

  await onProgress('나레이션·배경음악·효과음을 섞는 중...', 0.7);
  const bgm = input.bgm?.url ? await fetchAsset(input.bgm.url, baseUrl, w('bgm.audio')).catch(() => undefined) : undefined;
  await mixAudio({
    narration,
    duration: total,
    bgm,
    bgmVolume: Math.min(0.5, Math.max(0.03, input.bgm?.volume ?? 0.18)),
    sfx: input.sfx.enabled ? planSfx(beats, switchTimes, input.sfx.preset, input.seed ?? 0) : [],
    sfxFiles: await ensureSfx(w('sfx')),
  }, w('audio.m4a'));

  await onProgress('자막·모션그래픽을 입히는 중...', 0.8);
  const ass = buildAss(input.cues, input.headcopy ?? ['', ''], {
    font: input.font || 'Pretendard',
    width: OUT_W,
    height: OUT_H,
    totalDuration: total,
    motion: motion.enabled
      ? { beatStarts: starts, beats, streamSwitchTimes: switchTimes, preset: motion.preset, lang: 'ko', seed: input.seed ?? 0 }
      : undefined,
  });
  const affiliate = input.affiliate ?? 'none';
  // disclosureLines는 제휴가 없어도 우측 상단 [광고] 태그(\an9)를 넣으므로 그땐 뺀다
  const disclosure = disclosureLines({ affiliate, aiUsed: input.aiUsed ?? true, total })
    .filter((l) => affiliate !== 'none' || !l.includes('\\an9'));
  await fs.writeFile(w('subs.ass'), withDisclosure(ass, disclosure), 'utf8');
  const outFile = w('out.mp4');
  await mux(video, w('audio.m4a'), w('subs.ass'), FONTS_DIR, outFile);

  if (input.thumbnailUrl) {
    await onProgress('썸네일을 앞에 붙이는 중...', 0.95);
    const thumb = await fetchAsset(input.thumbnailUrl, baseUrl, w('thumb.img')).catch(() => null);
    if (thumb) {
      await prependStill(outFile, thumb, 0.01, w('with-thumb.mp4'));
      await fs.rename(w('with-thumb.mp4'), outFile);
    }
  }
  await onProgress('완료', 1);
  return outFile;
}
