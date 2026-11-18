import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { geminiApiKey } from '../gemini-key';

/**
 * Veo 자동 생성 (Flow 화면을 거치지 않고 앱 안에서 바로 생성).
 * 2026-11-14 기준 이 프로젝트의 Gemini 키에는 Veo 모델이 열려 있지 않아 실사용 검증은 못 했다.
 * 키에 Veo 권한이 생기면 .env.local에 VEO_MODEL(예: veo-3.1-generate-preview)을 넣으면 켜진다.
 */
export const veoAvailable = () => !!process.env.VEO_MODEL && !!geminiApiKey();

export async function generateVeoClip(prompt: string, seconds: number, outMp4: string): Promise<void> {
  if (!veoAvailable()) throw new Error('Veo 모델을 쓸 수 없습니다. Gemini 키에 Veo 권한이 생기면 .env.local에 VEO_MODEL을 설정하세요. 그 전에는 Flow에서 만든 영상을 올려 주세요.');
  const ai = new GoogleGenAI({ apiKey: geminiApiKey(), httpOptions: { apiVersion: 'v1beta' } });
  let op = await ai.models.generateVideos({
    model: process.env.VEO_MODEL!,
    prompt,
    config: { aspectRatio: '9:16', durationSeconds: Math.round(Math.min(8, Math.max(4, seconds))), numberOfVideos: 1 },
  });
  for (let i = 0; !op.done && i < 60; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    op = await ai.operations.getVideosOperation({ operation: op });
  }
  const video = op.response?.generatedVideos?.[0]?.video;
  if (!op.done || !video) throw new Error('Veo 영상 생성이 끝나지 않았거나 결과가 없습니다');
  await fs.mkdir(path.dirname(outMp4), { recursive: true });
  await ai.files.download({ file: video, downloadPath: outMp4 });
}
