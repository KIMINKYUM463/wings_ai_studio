import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { CharAlignment } from '../types';
import { probeDuration, runFfmpeg } from '../media/ffmpeg';
import { GEMINI_KEY_MISSING, geminiApiKey } from '../gemini-key';
import { GEMINI_VOICES } from './gemini-voices';

/**
 * Gemini TTS (gemini-3.8-flash-tts). 말투·속도를 지시문으로 조절할 수 있어 쇼츠 톤이 자연스럽다.
 * 단어 타이밍을 주지 않으므로, 실제 음성의 쉼(무음) 구간을 찾아 그 사이 말하는 시간에 글자를 나눠 자막 시각을 정한다.
 */
const MODEL = () => process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

export { GEMINI_VOICES };

export const listGeminiVoices = async () => GEMINI_VOICES;

/** ffmpeg silencedetect 출력 → 쉼 구간 */
export function parseSilences(stderr: string, total: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start:\s*([\d.]+)/);
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (s) open = parseFloat(s[1]);
    if (e && open !== null) { out.push({ start: open, end: parseFloat(e[1]) }); open = null; }
  }
  if (open !== null) out.push({ start: open, end: total });
  return out;
}

/** 쉼을 뺀 '말하는 시간'에 글자를 고르게 나눠 글자별 시각을 만든다 */
export function pauseAlignment(text: string, duration: number, pauses: { start: number; end: number }[]): CharAlignment {
  const chars = [...text];
  const speech: [number, number][] = [];
  let t = 0;
  for (const p of [...pauses].sort((a, b) => a.start - b.start)) {
    if (p.start > t) speech.push([t, Math.min(p.start, duration)]);
    t = Math.max(t, p.end);
  }
  if (t < duration) speech.push([t, duration]);
  if (!speech.length) speech.push([0, duration]);
  const speechTotal = speech.reduce((a, [s, e]) => a + (e - s), 0);
  const letters = chars.filter((c) => !/\s/.test(c)).length || 1;
  const per = speechTotal / letters;
  // 말하는 시간 위치 → 실제 시각 (쉼 경계에 정확히 걸리면 다음 구간 시작으로)
  const toReal = (off: number, preferNext: boolean): number => {
    let acc = 0;
    for (let i = 0; i < speech.length; i++) {
      const [s, e] = speech[i];
      const len = e - s;
      if (off < acc + len - 1e-9 || (off <= acc + len + 1e-9 && (!preferNext || i === speech.length - 1))) return s + (off - acc);
      acc += len;
    }
    return duration;
  };
  const starts: number[] = [];
  const ends: number[] = [];
  let k = 0;
  for (const c of chars) {
    if (/\s/.test(c)) {
      const prev = ends.length ? ends[ends.length - 1] : 0;
      starts.push(prev); ends.push(prev);
      continue;
    }
    starts.push(+toReal(k * per, true).toFixed(4));
    ends.push(+toReal((k + 1) * per, false).toFixed(4));
    k++;
  }
  return { chars, starts, ends };
}

/** 공백 뺀 글자 수/길이가 6.5자/초보다 느리면 그만큼 빠르게 (최대 1.35배) */
export function tempoBoost(chars: number, seconds: number): number {
  if (seconds <= 0 || chars <= 0) return 1;
  const rate = chars / seconds;
  return rate >= 6.5 ? 1 : Math.min(1.35, 6.5 / rate);
}

/** atempo는 0.5~2.0만 받으므로 넘으면 나눠서 이어 붙인다 */
export function atempoChain(t: number): string {
  const parts: number[] = [];
  let r = t;
  while (r > 2) { parts.push(2); r /= 2; }
  while (r < 0.5) { parts.push(0.5); r /= 0.5; }
  parts.push(r);
  return parts.map((x) => `atempo=${x.toFixed(4)}`).join(',');
}

export async function geminiTts(text: string, voice: string, speed: number, style: string, outMp3: string, lang = 'ko'): Promise<{ duration: number; alignment: CharAlignment }> {
  const key = geminiApiKey();
  if (!key) throw new Error(GEMINI_KEY_MISSING);
  const spoken = text.replace(/\s*\n\s*/g, ' ').trim();
  // 실측: 지시문을 붙이면 2~4배 느리게 읽는다(25자에 13초). 문장만 보내면 쇼츠 속도(약 6.7자/초)로 읽는다.
  // 그래서 말투(style)는 프롬프트에 넣지 않고, 속도는 아래 atempo로 맞춘다.
  void style;
  const prompt = spoken;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: { message: string };
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  };
  if (!res.ok || j.error) throw new Error(`Gemini TTS 오류 ${res.status}: ${j.error?.message?.slice(0, 200) ?? ''}`);
  const audio = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!audio) throw new Error('Gemini TTS가 음성을 돌려주지 않았습니다');

  const tmp = path.join(os.tmpdir(), `gtts-${nanoid(6)}`);
  const pcm = /L16|pcm/i.test(audio.mimeType);
  const rate = audio.mimeType.match(/rate=(\d+)/)?.[1] ?? '24000';
  await fs.writeFile(tmp, Buffer.from(audio.data, 'base64'));
  await fs.mkdir(path.dirname(outMp3), { recursive: true });
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04';
  const trimmed = `${tmp}.wav`;
  try {
    // 1) 앞뒤 무음 제거 + 문장 중간의 긴 쉼(0.3초 넘는)은 0.3초로 줄임
    await runFfmpeg(['-y', ...(pcm ? ['-f', 's16le', '-ar', rate, '-ac', '1'] : []), '-i', tmp, '-af',
      [trim, 'areverse', trim, 'areverse', 'silenceremove=stop_periods=-1:stop_threshold=-40dB:stop_duration=0.3:stop_silence=0.3'].join(','),
      '-ar', '44100', '-ac', '1', trimmed]);
    // 2) 그래도 느리면(6.5자/초 미만) 최대 1.35배까지 추가로 빠르게
    const raw = await probeDuration(trimmed);
    // 6.5자/초 기준은 한국어 실측값 → 다른 언어는 사용자 속도만 적용
    const tempo = speed * (lang === 'ko' ? tempoBoost([...spoken.replace(/\s/g, '')].length, raw) : 1);
    await runFfmpeg(['-y', '-i', trimmed, ...(Math.abs(tempo - 1) > 0.01 ? ['-af', atempoChain(tempo)] : []), '-ar', '44100', '-ac', '1', '-b:a', '128k', outMp3]);
  } finally {
    await fs.rm(tmp, { force: true });
    await fs.rm(trimmed, { force: true });
  }
  const duration = await probeDuration(outMp3);
  const stderr = await runFfmpeg(['-i', outMp3, '-af', 'silencedetect=n=-35dB:d=0.15', '-f', 'null', '-']);
  const pauses = parseSilences(stderr, duration).filter((p) => p.start > 0.05 && p.end < duration - 0.05);
  return { duration, alignment: pauseAlignment(spoken, duration, pauses) };
}
