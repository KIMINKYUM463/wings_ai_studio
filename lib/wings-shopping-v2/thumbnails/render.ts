import fs from 'node:fs/promises';
import path from 'node:path';
import { encArgs, probeVideoFps, runFfmpeg, shortAssWorkspace } from '../media/ffmpeg';
import { buildThumbAss } from './ass';
import type { ThumbStyle } from './catalog';

/** 장면 이미지 + 썸네일 글자 → 1080x1920 jpg (width를 주면 그 폭으로 축소) */
export async function renderThumbnail(
  frameImage: string, style: ThumbStyle, lines: string[], highlight: string, fontsDir: string, out: string, width = 1080,
): Promise<void> {
  await fs.mkdir(path.dirname(out), { recursive: true });
  const assFile = `${out}.ass`;
  await fs.writeFile(assFile, buildThumbAss(style, lines, highlight), 'utf8');
  const ws = await shortAssWorkspace(assFile, fontsDir);
  const scale = width === 1080 ? '' : `,scale=${width}:-2`;
  try {
    await runFfmpeg([
      '-y', '-i', path.resolve(frameImage), '-frames:v', '1',
      '-vf', `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,${ws.filter}${scale}`,
      '-q:v', '2', path.resolve(out),
    ], ws.cwd);
  } finally {
    await ws.cleanup();
    await fs.rm(assFile, { force: true });
  }
}

/** 영상 맨 앞에 썸네일 정지 화면을 seconds만큼 붙인다 (무음) */
export async function prependStill(video: string, image: string, seconds: number, out: string): Promise<void> {
  const fps = await probeVideoFps(video);
  // 영상은 1프레임보다 짧게 못 담는다 → 최소 1프레임
  seconds = Math.max(seconds, 1 / fps);
  const graph = [
    `[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${fps},format=yuv420p,trim=end_frame=${Math.max(1, Math.round(seconds * fps))},setpts=PTS-STARTPTS[iv]`,
    `[0:v]setsar=1,fps=${fps},format=yuv420p[mv]`,
    '[0:a]aresample=44100,aformat=channel_layouts=stereo[ma]',
    '[2:a]aformat=sample_rates=44100:channel_layouts=stereo[sa]',
    '[iv][sa][mv][ma]concat=n=2:v=1:a=1[v][a]',
  ].join(';');
  await runFfmpeg([
    '-y', '-i', path.resolve(video), '-loop', '1', '-t', (seconds + 0.2).toFixed(3), '-i', path.resolve(image),
    '-f', 'lavfi', '-t', (Math.max(1, Math.round(seconds * fps)) / fps).toFixed(4), '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', graph, '-map', '[v]', '-map', '[a]', ...encArgs(fps), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.resolve(out),
  ]);
}
