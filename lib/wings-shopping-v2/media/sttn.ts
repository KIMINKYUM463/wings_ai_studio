/**
 * 무료 자막 지우기 (video-subtitle-remover · STTN, 로컬 GPU).
 * 소스 영상마다 클립 시간대별 글자 박스만 지우고 결과를 캐시한다(같은 박스면 다시 돌리지 않음).
 * 설치 위치: VSR_DIR(기본 .tmp/vsr), VSR_PYTHON(기본 .tmp/vsr-venv 의 python).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import type { Clip } from '../types';
import { FFMPEG, probeSize } from './ffmpeg';
import { boxesToPixels } from './mosaic';

const VSR_DIR = process.env.VSR_DIR || path.join(process.cwd(), '.tmp', 'vsr');
const VSR_PYTHON =
  process.env.VSR_PYTHON ||
  path.join(process.cwd(), '.tmp', 'vsr-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const SCRIPT = path.join(process.cwd(), 'scripts', 'vsr-sttn-segments.py');
const TIMEOUT_MS = 30 * 60 * 1000;

const exists = (f: string) => fs.access(f).then(() => true, () => false);

export const STTN_NOT_INSTALLED =
  '무료 자막 지우기(STTN)가 이 컴퓨터에 설치되어 있지 않아요. NVIDIA GPU가 있는 PC에서 video-subtitle-remover를 설치하거나, 「모자이크」·「유료 모자이크 지우기」를 선택해 주세요.';

export async function sttnAvailable(): Promise<boolean> {
  return (await exists(VSR_PYTHON)) && (await exists(path.join(VSR_DIR, 'backend', 'main.py'))) && (await exists(SCRIPT));
}

type Segment = { start: number; end: number; rects: [number, number, number, number][] };

/**
 * srcFile 의 글자를 clips(같은 소스) 시간대별 박스로 지운 영상 경로를 돌려준다.
 * 지울 글자가 없으면 원본 경로를 그대로 돌려준다.
 */
export async function cleanSourceWithSttn(
  srcFile: string,
  clips: Clip[],
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { width, height } = await probeSize(srcFile);
  const segments: Segment[] = clips
    .filter((c) => c.textBoxes?.length && c.end > c.start)
    .map((c) => ({
      start: c.start,
      end: c.end,
      rects: boxesToPixels(c.textBoxes!, width, height).map((r) => [r.x, r.y, r.w, r.h] as [number, number, number, number]),
    }))
    .filter((s) => s.rects.length);
  if (!segments.length) return srcFile;

  const key = crypto.createHash('sha1').update(JSON.stringify(segments)).digest('hex').slice(0, 10);
  const out = srcFile.replace(/\.mp4$/i, '') + `.sttn-${key}.mp4`;
  if (await exists(out)) return out;
  if (!(await sttnAvailable())) throw new Error(STTN_NOT_INSTALLED);

  const jobs = `${out}.jobs.json`;
  const tmpOut = `${out}.part.mp4`;
  await fs.writeFile(jobs, JSON.stringify({ segments }), 'utf8');
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        VSR_PYTHON,
        [SCRIPT, '--vsr-dir', VSR_DIR, '--input', path.resolve(srcFile), '--output', path.resolve(tmpOut), '--jobs', path.resolve(jobs), '--ffmpeg', FFMPEG],
        { cwd: VSR_DIR, windowsHide: true },
      );
      let stderr = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('무료 자막 지우기(STTN) 시간이 초과되었어요 (30분).')); }, TIMEOUT_MS);
      child.stdout.on('data', (buf: Buffer) => {
        for (const line of buf.toString().split(/\r?\n/)) {
          const m = line.match(/^PROGRESS ([\d.]+)/);
          if (m) onProgress?.(Number(m[1]));
        }
      });
      child.stderr.on('data', (buf: Buffer) => { stderr = (stderr + buf.toString()).slice(-2000); });
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`무료 자막 지우기(STTN) 실패 (코드 ${code}): ${stderr.split('\n').filter(Boolean).slice(-2).join(' ')}`));
      });
    });
    await fs.rename(tmpOut, out);
    return out;
  } finally {
    await fs.rm(jobs, { force: true });
    await fs.rm(tmpOut, { force: true });
  }
}
