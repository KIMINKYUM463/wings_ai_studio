import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { projectDir, updateProject } from '../store';
import { extractFrame, probeDuration } from '../media/ffmpeg';
import { markStale } from '../pipeline';
import type { Project } from '../types';

/**
 * Flow/Veo로 만든 영상 하나를 문장(beat)에 붙인다:
 * 소스로 저장 → 영상 전체를 클립 하나로 → 해당 문장의 장면으로 지정.
 * 싱크 엔진이 음성 길이에 맞춰 자르거나 늦춘다.
 */
export async function attachBeatClip(projectId: string, beatId: string, data: Buffer, prompt: string): Promise<Project> {
  const sid = `flow${nanoid(6).replace(/[^A-Za-z0-9]/g, 'x')}`;
  const rel = `sources/${sid}.mp4`;
  const abs = path.join(projectDir(projectId), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  const duration = await probeDuration(abs);
  const clipId = `${sid}-0`;
  await fs.mkdir(path.join(projectDir(projectId), 'frames'), { recursive: true });
  await extractFrame(abs, duration / 2, path.join(projectDir(projectId), 'frames', `${clipId}.jpg`)).catch(() => {});
  return updateProject(projectId, (x) => {
    x.sources.push({ id: sid, platform: 'flow', title: 'Flow AI 클립', file: rel, duration, status: 'ready' });
    x.clips.push({
      id: clipId, sourceId: sid, start: 0, end: Math.round(duration * 1000) / 1000,
      description: `[AI 생성] ${prompt}`.slice(0, 300), shotType: 'AI', hasBurnedText: false, quality: 4, aiGenerated: true, textBoxes: [],
    });
    const b = x.script?.beats.find((y) => y.id === beatId);
    if (b) b.clipId = clipId;
    markStale(x);
  });
}
