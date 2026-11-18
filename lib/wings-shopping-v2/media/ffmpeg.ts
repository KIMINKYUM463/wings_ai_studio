import fs from 'node:fs/promises';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { exec } from './exec';
import type { Clip } from '../types';
import type { SegmentPiece } from '../sync';
import { pieceOutputDuration } from '../sync';
import {
  boxesToPixels,
  mosaicFilter,
  timedBoxesToPixels,
  type NormBox,
  type TimedNormBox,
  type TimedRect,
} from './mosaic';
import { contentCrop, type ContentBox } from './crop';
import type { Template, TemplateData } from '../templates/types';
import { buildTemplateAss } from '../templates/ass';

/* eslint-disable @typescript-eslint/no-require-imports */
export const FFMPEG: string = process.env.FFMPEG_PATH || (require('ffmpeg-static') as string);
export const FFPROBE: string = process.env.FFPROBE_PATH || (require('ffprobe-static') as { path: string }).path;
/* eslint-enable @typescript-eslint/no-require-imports */

export const OUT_W = 1080;
export const OUT_H = 1920;
export const FPS = 30;
export const MIN_CLIP = 1.0;
export const SCENE_THRESHOLD = 0.3;

export function encArgs(fps = FPS): string[] {
  return [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-fps_mode', 'cfr',
    '-r', String(fps),
    '-video_track_timescale', '90000',
  ];
}

export async function runFfmpeg(args: string[], cwd?: string): Promise<string> {
  const { stderr } = await exec(FFMPEG, ['-hide_banner', ...args], { cwd });
  return stderr;
}

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await exec(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`길이를 읽을 수 없음: ${file}`);
  return d;
}

function parseRate(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed.includes('/')) {
    const [num, den] = trimmed.split('/').map(Number);
    return den > 0 && Number.isFinite(num) ? num / den : 0;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

export async function probeRawFps(file: string): Promise<number> {
  try {
    const { stdout } = await exec(FFPROBE, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=avg_frame_rate,r_frame_rate',
      '-of', 'csv=p=0', file,
    ]);
    const parts = stdout.trim().split(',');
    const avg = parseRate(parts[0] ?? '');
    const r = parseRate(parts[1] ?? '');
    return avg > 10 && avg <= 120 ? avg : r > 0 ? r : FPS;
  } catch {
    return FPS;
  }
}

export async function probeVideoFps(file: string): Promise<number> {
  const best = await probeRawFps(file);
  return best >= 48 ? 60 : 30;
}

/**
 * 모든 원본 소스가 48fps 이상일 때만 60fps로 뽑고,
 * 24~30fps 원본이 하나라도 섞여 있으면 표준 30fps로 통일한다 (25fps→60fps 2:3 풀다운 복제 끊김 방지).
 */
export async function probeTargetFps(files: string[]): Promise<number> {
  if (!files.length) return FPS;
  const rates = await Promise.all(files.map((f) => probeRawFps(f)));
  return rates.every((r) => r >= 48) ? 60 : 30;
}

export function parseSceneCuts(stderr: string): number[] {
  const out: number[] = [];
  for (const m of stderr.matchAll(/showinfo.*?pts_time:\s*([\d.]+)/g)) out.push(parseFloat(m[1]));
  return out;
}

export function cutsToClips(cuts: number[], duration: number, sourceId: string): Pick<Clip, 'id' | 'sourceId' | 'start' | 'end'>[] {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < duration).sort((a, b) => a - b), duration];
  const segs: { start: number; end: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    if (segs.length && end - start < MIN_CLIP) segs[segs.length - 1].end = end;
    else if (!segs.length && end - start < MIN_CLIP && i < bounds.length - 2) bounds[i + 1] = start; // 첫 컷이 짧으면 다음과 합침
    else segs.push({ start, end });
  }
  // 첫 구간이 짧았던 경우 처리
  if (!segs.length) segs.push({ start: 0, end: duration });
  if (segs[0].start !== 0) segs[0].start = 0;
  return segs.map((s, i) => ({ id: `${sourceId}-${i}`, sourceId, start: round(s.start), end: round(s.end) }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function detectScenes(file: string): Promise<number[]> {
  const stderr = await runFfmpeg(['-i', file, '-an', '-vf', `scale=320:-2,select='gt(scene,${SCENE_THRESHOLD})',showinfo`, '-f', 'null', '-']);
  return parseSceneCuts(stderr);
}

export async function extractFrame(file: string, t: number, outJpg: string, width = 360): Promise<void> {
  await runFfmpeg(['-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '4', outJpg]);
}

export async function probeSize(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await exec(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]);
  const [width, height] = stdout.trim().split('x').map((n) => parseInt(n, 10));
  if (!width || !height) throw new Error(`해상도를 읽을 수 없음: ${file}`);
  return { width, height };
}

/**
 * 소스 구간 하나를 9:16(가운데 크롭), 원본 프레임레이트(30/60fps), 무음 영상으로 만든다.
 * 인위적인 확대 좌우 팬(정수 픽셀 떨림) 없이 원본 움직임을 그대로 유지한다.
 */
export async function renderPiece(
  srcFile: string,
  piece: SegmentPiece,
  outFile: string,
  frames?: number,
  masks: NormBox[] = [],
  size: { w: number; h: number } = { w: OUT_W, h: OUT_H },
  content?: ContentBox,
  _pan?: 1 | -1,
  opts?: { timedMasks?: TimedNormBox[]; fps?: number; flipRanges?: [number, number][] },
): Promise<void> {
  const targetFps = opts?.fps ?? FPS;
  const len = Math.max(0.05, piece.end - piece.start);
  const outDur = pieceOutputDuration(piece);

  let rects: TimedRect[] = [];
  let crop: ReturnType<typeof contentCrop> = null;
  const hasTimed = Boolean(opts?.timedMasks?.length);
  if (hasTimed || masks.length || content) {
    const { width, height } = await probeSize(srcFile);
    rects = hasTimed
      ? timedBoxesToPixels(opts!.timedMasks!, width, height)
      : boxesToPixels(masks, width, height);
    crop = contentCrop(content, width, height);
  }

  const rawFps = await probeRawFps(srcFile);
  // 24~26fps 원본을 30fps로 맞출 때는 단순 프레임 복제(계단 멈춤) 대신 모션 블렌딩 보간을 적용한다
  const fpsFilter =
    targetFps === 30 && rawFps >= 23 && rawFps <= 27.5
      ? `framerate=fps=30:interp_start=0:interp_end=255:scene=8.2`
      : `fps=${targetFps}`;

  const speedExpr =
    Math.abs(piece.speed - 1) < 1e-4
      ? 'setpts=PTS-STARTPTS'
      : `setpts=(PTS-STARTPTS)/${piece.speed.toFixed(6)}`;

  // 빠른 입력 시크 + 정밀 디코딩 시크 결합: 시작 지점 키프레임 오차 없이 정확히 자른다
  const fastSeek = piece.start > 2.0 ? Math.max(0, piece.start - 1.5) : 0;
  const fineSeek = piece.start - fastSeek;
  // 좌우반전 장면 구간 (원본 초 → 필터 시각: fastSeek 기준, 배속 반영)
  const flips = (opts?.flipRanges ?? [])
    .map(([a, b]) => [Math.max(0, (a - fastSeek) / piece.speed), Math.max(0, (b - fastSeek) / piece.speed)] as const)
    .filter(([a, b]) => b - a > 0.01);
  const flipFilter = flips.length
    ? `split[fa][fb];[fb]hflip[ff];[fa][ff]overlay=enable='${flips.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+')}'`
    : null;

  const chain = [
    // 원본이 템플릿 영상이면 실제 푸티지 영역만 남긴다 (모자이크는 원본 좌표에서 먼저 적용)
    ...(crop ? [`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`] : []),
    speedExpr,
    // 좌우반전한 장면 구간만 뒤집기 (글자 지우기·모자이크는 원본 좌표에서 먼저 적용된 뒤)
    ...(flipFilter ? [flipFilter] : []),
    `scale=${size.w}:${size.h}:force_original_aspect_ratio=increase`,
    `crop=${size.w}:${size.h}`,
    'setsar=1',
    fpsFilter,
    // 요청 프레임 수를 안전하게 채울 아주 짧은 여유만 두고 강제 정지는 쓰지 않는다
    `tpad=stop_mode=clone:stop_duration=${(Math.max(0, piece.freezeAfter) + 0.12).toFixed(3)}`,
  ].join(',');

  const inputDecodeLen = fineSeek + len + 0.25;

  const graph = `${mosaicFilter(rects, 'mz')};[mz]${chain}[v]`;
  await runFfmpeg([
    '-y',
    ...(fastSeek > 0 ? ['-ss', fastSeek.toFixed(3)] : []),
    '-i', srcFile,
    ...(fineSeek > 0.0005 ? ['-ss', fineSeek.toFixed(3)] : []),
    '-t', inputDecodeLen.toFixed(3),
    '-an', '-filter_complex', graph, '-map', '[v]',
    ...(frames ? ['-frames:v', String(frames)] : ['-t', outDur.toFixed(3)]),
    ...encArgs(targetFps),
    outFile,
  ]);
}

function listFile(files: string[]): string {
  return files.map((f) => `file '${path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
}

export async function concatVideos(files: string[], out: string): Promise<void> {
  if (files.length === 1) {
    await fs.copyFile(files[0]!, out);
    return;
  }
  const list = `${out}.txt`;
  await fs.writeFile(list, listFile(files), 'utf8');
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
}

/**
 * 핵심 문장 구간에만 부드러운 펀치 줌(최대 ~1.16배)을 넣는다.
 * 원본 타임라인은 그대로 두고, 가운데를 살짝 확대해 시선이 모이게 한다. (끊김·슬로모션 없음)
 */
export async function applyPunchZooms(
  inFile: string,
  outFile: string,
  windows: { start: number; end: number; amp?: number; snap?: boolean }[],
  fps = FPS,
): Promise<void> {
  const usable = windows
    .map((w) => ({
      start: Math.max(0, w.start),
      end: Math.max(w.start + 0.35, w.end),
      amp: w.amp ?? 0.16,
      snap: !!w.snap,
    }))
    .filter((w) => w.end - w.start >= 0.35)
    .slice(0, 40);
  if (!usable.length) {
    await fs.copyFile(inFile, outFile);
    return;
  }

  const { width, height } = await probeSize(inFile);

  // z(t) = 1 + 0.16 * max(각 구간의 sin 엔벨로프). 구간 밖에서는 1.0
  // ffmpeg max()는 인자 2개만 받으므로 중첩한다
  const parts = usable.map((w) => {
    const dur = (w.end - w.start).toFixed(4);
    const s = w.start.toFixed(4);
    const e = w.end.toFixed(4);
    const env = `sin(PI*(t-${s})/${dur})`;
    return `if(between(t\\,${s}\\,${e})\\,${w.amp.toFixed(3)}*${w.snap ? `min(1\\,4*${env})` : env}\\,0)`;
  });
  const envelope = parts.reduce((acc, p) => (acc ? `max(${acc}\\,${p})` : p));
  const zExpr = `1+(${envelope})`;

  // 확대 후 중앙 크롭으로 출력 크기를 고정한다 (템플릿 영상 영역 크기도 지원)
  const vf = [
    `scale=w='iw*(${zExpr})':h='ih*(${zExpr})':eval=frame`,
    `crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`,
    `fps=${fps}`,
    'setsar=1',
    'format=yuv420p',
  ].join(',');

  await runFfmpeg([
    '-y', '-i', path.resolve(inFile),
    '-an', '-vf', vf,
    ...encArgs(fps),
    path.resolve(outFile),
  ]);
}

/** 음성 파일들을 각각 지정 길이로 패딩해서 하나의 오디오로 잇는다. */
export async function concatAudios(files: string[], durations: number[], out: string): Promise<void> {
  const inputs = files.flatMap((f) => ['-i', f]);
  const parts = files.map((_, i) => `[${i}:a]aresample=44100,apad=whole_dur=${durations[i].toFixed(3)},atrim=0:${durations[i].toFixed(3)}[a${i}]`);
  const filter = `${parts.join(';')};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`;
  await runFfmpeg(['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', out]);
}

/**
 * 문장 음성의 앞뒤 무음 구간을 완전히 잘라내고, 문장 중간의 과도한 침묵(>0.2s)도 0.1s로 조여
 * 문장과 문장 사이에 빈 무음 구간이 생기지 않게 한다.
 */
export async function trimSpeechSilence(inFile: string, outFile: string): Promise<number> {
  const edgeTrim = 'silenceremove=start_periods=1:start_threshold=-35dB:start_silence=0.005';
  // 중간 쉼 줄이기: 사그라드는 끝 음절을 쉼으로 오인하지 않게 -45dB 기준
  const midTrim = 'silenceremove=stop_periods=-1:stop_threshold=-45dB:stop_duration=0.14:stop_silence=0.05';
  // 끝부분은 사그라드는 마지막 음절(~다면, ~거임)을 무음으로 오인하지 않게 더 낮은 기준(-48dB)으로 자르고 0.12초 여유를 남긴다
  const tailTrim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12';
  const af = [
    edgeTrim,
    'areverse',
    tailTrim,
    'areverse',
    midTrim,
    'afade=t=in:st=0:d=0.006',
    // 문장 끝 숨 고르기 여유 (다음 문장이 끝 음절을 덮지 않게)
    'apad=pad_dur=0.1',
  ].join(',');

  const isMp3 = /\.mp3$/i.test(outFile);
  const tmpOut = inFile === outFile ? `${outFile}.trim${path.extname(outFile) || '.wav'}` : outFile;
  await fs.mkdir(path.dirname(tmpOut), { recursive: true });

  await runFfmpeg([
    '-y', '-i', path.resolve(inFile),
    '-af', af,
    '-ar', '44100', '-ac', '1',
    ...(isMp3 ? ['-c:a', 'libmp3lame', '-b:a', '128k'] : ['-c:a', 'pcm_s16le']),
    path.resolve(tmpOut),
  ]);

  let dur = await probeDuration(tmpOut).catch(() => 0);
  if (dur < 0.12) {
    // 무음 제거 후 너무 짧아진 예외 상황에서는 원본을 그대로 복사해 유실을 막는다
    if (tmpOut !== inFile) await fs.copyFile(inFile, tmpOut);
    dur = await probeDuration(tmpOut);
  }
  if (tmpOut !== outFile) {
    await fs.rename(tmpOut, outFile);
  }
  return dur;
}

/**
 * libass는 Windows에서 260자가 넘는 경로를 열지 못한다.
 * 자막 파일과 글꼴을 짧은 임시 폴더로 복사하고, 그 폴더를 작업 폴더로 해서 상대 경로로 읽게 한다.
 */
export async function shortAssWorkspace(assFile: string, fontsDir: string): Promise<{ cwd: string; filter: string; cleanup: () => Promise<void> }> {
  const base = path.join(os.tmpdir(), 'smass');
  const fonts = path.join(base, 'fonts');
  await fs.mkdir(fonts, { recursive: true });
  for (const name of await fs.readdir(fontsDir)) {
    const src = path.join(fontsDir, name);
    const dst = path.join(fonts, name);
    const [a, b] = await Promise.all([fs.stat(src), fs.stat(dst).catch(() => null)]);
    if (!b || b.size !== a.size) await fs.copyFile(src, dst);
  }
  const name = `${crypto.randomBytes(5).toString('hex')}.ass`;
  await fs.copyFile(assFile, path.join(base, name));
  return { cwd: base, filter: `ass=${name}:fontsdir=fonts`, cleanup: () => fs.rm(path.join(base, name), { force: true }) };
}

/** 영상 + 오디오 + ASS 자막(burn-in) */
export async function mux(video: string, audio: string, assFile: string, fontsDir: string, out: string): Promise<void> {
  const videoFps = await probeVideoFps(video);
  const ws = await shortAssWorkspace(assFile, fontsDir);
  try {
    await runFfmpeg([
      '-y', '-i', path.resolve(video), '-i', path.resolve(audio),
      '-vf', `fps=${videoFps},${ws.filter}`,
      '-map', '0:v', '-map', '1:a', ...encArgs(videoFps), '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.resolve(out),
    ], ws.cwd);
  } finally {
    await ws.cleanup();
  }
}

/**
 * 템플릿 합성: 배경색 캔버스 위에 영상(템플릿 영상 영역 크기)을 올리고, 템플릿 ASS(레이어 + 자막)를 입힌다.
 */
export async function composeTemplate(video: string, audio: string, assFile: string, fontsDir: string, t: Template, out: string): Promise<void> {
  const dur = await probeDuration(video);
  const videoFps = await probeVideoFps(video);
  const ws = await shortAssWorkspace(assFile, fontsDir);
  const graph = [
    `color=c=${t.canvas.replace('#', '0x')}:s=${OUT_W}x${OUT_H}:r=${videoFps}:d=${dur.toFixed(3)}[bg]`,
    `[0:v]fps=${videoFps},scale=${t.video.w}:${t.video.h}:force_original_aspect_ratio=increase,crop=${t.video.w}:${t.video.h},setsar=1[fg]`,
    `[bg][fg]overlay=${t.video.x}:${t.video.y}:shortest=1,${ws.filter},format=yuv420p[v]`,
  ].join(';');
  try {
    await runFfmpeg([
      '-y', '-i', path.resolve(video), '-i', path.resolve(audio), '-filter_complex', graph,
      '-map', '[v]', '-map', '1:a', ...encArgs(videoFps), '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.resolve(out),
    ], ws.cwd);
  } finally {
    await ws.cleanup();
  }
}

/** 템플릿 미리보기 정지 화면 (540x960 jpg): 장면 이미지 + 템플릿 레이어 + 자막 한 줄 */
export async function renderTemplatePreview(t: Template, d: TemplateData, caption: string, frameImage: string, fontsDir: string, out: string, extraLines: string[] = [], outSize: { w: number; h: number } = { w: 540, h: 960 }, transparent = false): Promise<void> {
  const dir = path.dirname(out);
  await fs.mkdir(dir, { recursive: true });
  const assFile = path.join(dir, `${path.basename(out, path.extname(out))}.ass`);
  // 포스터 인트로 템플릿은 첫 화면(큰 제목)을 미리보기로 보여준다
  const base = buildTemplateAss(t, d, [{ text: caption, start: 0, end: 5 }], 5);
  await fs.writeFile(assFile, extraLines.length ? `${base.replace(/\n*$/, '\n')}${extraLines.join('\n')}\n` : base, 'utf8');
  const ws = await shortAssWorkspace(assFile, fontsDir);
  const v = t.video;
  if (transparent) {
    // 영상 위에 겹치는 템플릿 요소만 투명 배경 PNG 로 (편집기 미리보기에서 영상 위에 올림)
    try {
      await runFfmpeg(['-y', '-f', 'lavfi', '-i', `color=c=black@0.0:s=${OUT_W}x${OUT_H}:d=1,format=rgba`, '-vf', `${ws.filter}:alpha=1,scale=${outSize.w}:${outSize.h}`, '-frames:v', '1', path.resolve(out)], ws.cwd);
    } finally {
      await ws.cleanup();
      await fs.rm(assFile, { force: true });
    }
    return;
  }
  const graph = [
    `color=c=${t.canvas.replace('#', '0x')}:s=${OUT_W}x${OUT_H}:d=1[bg]`,
    `[0:v]scale=${v.w}:${v.h}:force_original_aspect_ratio=increase,crop=${v.w}:${v.h},setsar=1[fg]`,
    `[bg][fg]overlay=${v.x}:${v.y},${ws.filter},scale=${outSize.w}:${outSize.h}[v]`,
  ].join(';');
  try {
    await runFfmpeg(['-y', '-loop', '1', '-t', '1', '-i', path.resolve(frameImage), '-filter_complex', graph, '-map', '[v]', '-frames:v', '1', '-q:v', '3', path.resolve(out)], ws.cwd);
  } finally {
    await ws.cleanup();
    await fs.rm(assFile, { force: true });
  }
}

/** 고해상도 장면 정지 화면 (템플릿 영상이면 실제 푸티지 영역만 잘라서) */
export async function extractFrameHi(file: string, t: number, outJpg: string, content?: number[]): Promise<void> {
  const { width, height } = await probeSize(file);
  const c = contentCrop(content, width, height);
  await fs.mkdir(path.dirname(outJpg), { recursive: true });
  await runFfmpeg(['-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', ...(c ? ['-vf', `crop=${c.w}:${c.h}:${c.x}:${c.y}`] : []), '-q:v', '2', path.resolve(outJpg)]);
}
