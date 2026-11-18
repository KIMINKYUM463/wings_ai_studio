import fs from 'node:fs/promises';
import path from 'node:path';

import { BGM_MOODS } from './moods';
import { GEMINI_KEY_MISSING, geminiApiKey } from '../gemini-key';
export { BGM_MOODS, defaultMood, type BgmMood } from './moods';

const MODEL = () => process.env.LYRIA_MODEL || 'lyria-3.5';

export async function generateBgm(mood: string, outMp3: string): Promise<void> {
  const key = geminiApiKey();
  if (!key) throw new Error(GEMINI_KEY_MISSING);
  const m = BGM_MOODS.find((x) => x.id === mood) ?? BGM_MOODS[0];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${m.prompt}. Instrumental only, no vocals, steady energy that can sit under narration, about 60 seconds.` }] }] }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: { message: string };
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  };
  if (!res.ok || j.error) throw new Error(`배경음악 생성 오류 ${res.status}: ${j.error?.message?.slice(0, 160) ?? ''}`);
  const audio = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!audio) throw new Error('배경음악 생성 결과가 없습니다');
  await fs.mkdir(path.dirname(outMp3), { recursive: true });
  await fs.writeFile(outMp3, Buffer.from(audio.data, 'base64'));
}
