import path from 'node:path';
import { runFfmpeg } from '../media/ffmpeg';
import type { SfxEvent, SfxFiles } from './sfx';

export type MixInput = {
  narration: string;
  duration: number;
  bgm?: string;
  /** 0~1, 나레이션이 없을 때 BGM 크기 (기본 0.18) */
  bgmVolume?: number;
  sfx: SfxEvent[];
  sfxFiles: SfxFiles;
  sfxVolume?: number;
};

/**
 * 나레이션 + 배경음악(반복·페이드·나레이션 나올 때 자동으로 줄어듦) + 효과음 → 스테레오 AAC
 * 결과 길이 = 나레이션 길이 (영상과 싱크 유지)
 */
export async function mixAudio(m: MixInput, out: string): Promise<void> {
  const D = m.duration;
  const inputs: string[] = ['-i', path.resolve(m.narration)];
  const parts: string[] = [];
  const mixIn: string[] = [];
  let idx = 1;
  const norm = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
  // 나레이션(모노)을 그냥 스테레오로 바꾸면 ffmpeg가 -3dB 낮춘다 → 왼쪽 채널을 양쪽에 그대로 복사
  const narNorm = 'aresample=44100,pan=stereo|c0=c0|c1=c0,aformat=sample_fmts=fltp:channel_layouts=stereo';

  if (m.bgm) {
    inputs.push('-stream_loop', '-1', '-i', path.resolve(m.bgm));
    parts.push(`[0:a]${narNorm},asplit=2[nar][sc]`);
    const fadeOut = Math.max(0, D - 1.5);
    parts.push(`[${idx}:a]${norm},atrim=0:${D.toFixed(3)},volume=${(m.bgmVolume ?? 0.18).toFixed(3)},afade=t=in:d=0.6,afade=t=out:st=${fadeOut.toFixed(3)}:d=1.5[bgr]`);
    parts.push('[bgr][sc]sidechaincompress=threshold=0.035:ratio=7:attack=15:release=380:makeup=1[bgd]');
    mixIn.push('[nar]', '[bgd]');
    idx++;
  } else {
    parts.push(`[0:a]${narNorm}[nar]`);
    mixIn.push('[nar]');
  }

  for (const e of m.sfx) {
    if (e.t >= D) continue;
    inputs.push('-i', path.resolve(m.sfxFiles[e.kind]));
    const ms = Math.max(0, Math.round(e.t * 1000));
    const vol = (m.sfxVolume ?? 0.62) * (e.gain ?? 1);
    // 바이럴 효과음(와우·띠링 등)은 꼬리가 길어 2.2초까지 두고 끝을 페이드로 자른다
    const trim = e.kind.startsWith('viral:') ? 'atrim=0:2.2,afade=t=out:st=1.9:d=0.3' : 'atrim=0:1.35';
    parts.push(`[${idx}:a]${norm},${trim},adelay=${ms}:all=1,volume=${vol.toFixed(3)}[s${idx}]`);
    mixIn.push(`[s${idx}]`);
    idx++;
  }

  const graph = mixIn.length === 1
    ? `${parts.join(';')};[nar]atrim=0:${D.toFixed(3)},alimiter=limit=0.95[out]`
    : `${parts.join(';')};${mixIn.join('')}amix=inputs=${mixIn.length}:normalize=0:duration=first,atrim=0:${D.toFixed(3)},alimiter=limit=0.95[out]`;
  await runFfmpeg(['-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', path.resolve(out)]);
}
