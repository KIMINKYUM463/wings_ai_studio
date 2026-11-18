import fs from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from '../store';
import { extractFrameHi, runFfmpeg } from '../media/ffmpeg';
import type { Project } from '../types';

const exists = (f: string) => fs.access(f).then(() => true, () => false);

/** 썸네일용 고해상도 장면 이미지 (없으면 만들고 경로를 돌려준다) */
export async function hiFrame(p: Project, clipId?: string): Promise<string> {
  const clip = p.clips.find((c) => c.id === clipId)
    ?? p.clips.find((c) => c.id === p.script?.beats[0]?.clipId)
    ?? p.clips.find((c) => !c.excluded);
  const dir = path.join(projectDir(p.id), 'frames', 'hi');
  if (!clip) {
    const blank = path.join(dir, 'blank.jpg');
    await fs.mkdir(dir, { recursive: true });
    if (!(await exists(blank))) await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=0x666666:s=1080x1920', '-frames:v', '1', blank]);
    return blank;
  }
  const out = path.join(dir, `${clip.id}.jpg`);
  if (!(await exists(out))) {
    const src = p.sources.find((s) => s.id === clip.sourceId);
    if (!src?.file) throw new Error('장면의 원본 영상이 없습니다');
    await extractFrameHi(path.join(projectDir(p.id), src.file), (clip.start + clip.end) / 2, out, src.contentBox);
  }
  return out;
}
