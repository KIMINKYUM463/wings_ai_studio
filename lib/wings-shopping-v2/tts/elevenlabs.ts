import fs from 'node:fs/promises';
import path from 'node:path';
import type { CharAlignment } from '../types';
import { probeDuration } from '../media/ffmpeg';

const BASE = 'https://api.elevenlabs.io';
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY가 설정되지 않았습니다');
  return k;
}

async function failText(res: Response): Promise<string> {
  const t = await res.text().catch(() => '');
  return `ElevenLabs 오류 ${res.status}: ${t.slice(0, 300)}`;
}

export async function tts(
  text: string,
  voiceId: string,
  speed: number,
  ctx: { prev?: string; next?: string },
  outMp3: string,
): Promise<{ duration: number; alignment: CharAlignment }> {
  const res = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json' },
    body: JSON.stringify({
      text: text.replace(/\s*\n\s*/g, ' ').trim(),
      model_id: TTS_MODEL,
      previous_text: ctx.prev?.replace(/\n/g, ' '),
      next_text: ctx.next?.replace(/\n/g, ' '),
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed },
    }),
  });
  if (!res.ok) throw new Error(await failText(res));
  const data = (await res.json()) as {
    audio_base64: string;
    alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
  };
  await fs.mkdir(path.dirname(outMp3), { recursive: true });
  await fs.writeFile(outMp3, Buffer.from(data.audio_base64, 'base64'));
  const a = data.alignment;
  const alignment: CharAlignment = { chars: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds };
  // 마지막 글자 끝 이후에도 소리 꼬리가 남을 수 있으므로 실제 파일 길이와 비교해 긴 쪽을 쓴다
  const lastEnd = alignment.ends[alignment.ends.length - 1] ?? 0;
  const fileDur = await probeDuration(outMp3).catch(() => 0);
  return { duration: Math.max(lastEnd, fileDur), alignment };
}

export type Voice = { id: string; name: string; description?: string; previewUrl?: string };

/** 계정에서 쓸 수 있는 보이스 목록. 다국어 모델이라 한국어로 읽을 수 있다. 한국어 라벨이 있는 보이스를 앞에 둔다. */
export async function listVoices(): Promise<Voice[]> {
  const res = await fetch(`${BASE}/v2/voices?page_size=100`, { headers: { 'xi-api-key': key() } });
  if (!res.ok) throw new Error(await failText(res));
  const data = (await res.json()) as {
    voices: { voice_id: string; name: string; description?: string; preview_url?: string; labels?: Record<string, string> }[];
  };
  const isKo = (v: { labels?: Record<string, string>; name: string }) =>
    Object.values(v.labels ?? {}).some((x) => /korean|ko\b/i.test(x)) || /[가-힣]/.test(v.name);
  return data.voices
    .map((v) => ({ id: v.voice_id, name: v.name, description: v.description, previewUrl: v.preview_url, ko: isKo(v) }))
    .sort((a, b) => Number(b.ko) - Number(a.ko))
    .map(({ ko: _ko, ...v }) => v);
}
