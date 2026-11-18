import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir } from '@/lib/wings-shopping-v2/store';
import { defaultVoice, synthesize, voiceStyle } from '@/lib/wings-shopping-v2/tts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SAMPLE = '이거 진짜 써 보면 못 돌아가요. 오늘 소개할 꿀템, 지금부터 보여 드릴게요.';

/** 목소리 미리듣기: 짧은 예시 문장을 그 목소리·속도로 읽어 준다 (한 번 만든 건 저장해 두고 다시 씀) */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const mode = q.get('mode') ?? undefined;
  const fallback = defaultVoice(mode);
  const voiceId = (q.get('voiceId') || fallback.voiceId).slice(0, 60);
  const speed = Math.min(1.5, Math.max(0.7, Number(q.get('speed')) || fallback.speed));
  const style = voiceStyle(mode);
  const key = crypto.createHash('sha1').update(JSON.stringify([voiceId, speed, style, SAMPLE])).digest('hex').slice(0, 16);
  const file = path.join(dataDir(), 'voice-previews', `${key}.mp3`);
  try {
    await fs.access(file);
  } catch {
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await synthesize(SAMPLE, voiceId, speed, { style }, file);
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 502, headers: { 'content-type': 'application/json' } });
    }
  }
  const buf = await fs.readFile(file);
  const type = buf.subarray(0, 4).toString() === 'RIFF' ? 'audio/wav' : 'audio/mpeg';
  return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'max-age=86400' } });
}
