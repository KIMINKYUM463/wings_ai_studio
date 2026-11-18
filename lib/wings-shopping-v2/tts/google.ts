import fs from 'node:fs/promises';
import path from 'node:path';
import type { CharAlignment } from '../types';
import { probeDuration } from '../media/ffmpeg';
import type { Voice } from './elevenlabs';

const BASE = 'https://texttospeech.googleapis.com';
type Timepoint = { markName: string; timeSeconds: number };

function key(): string {
  const k = process.env.GOOGLE_TTS_API_KEY;
  if (!k) throw new Error('GOOGLE_TTS_API_KEY가 설정되지 않았습니다');
  return k;
}

const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** 단어마다 앞에 <mark>를 넣은 SSML. 마크 시각으로 자막 타이밍을 맞춘다. */
export function buildSsml(text: string): { ssml: string; words: string[] } {
  const words = text.split(/\s+/).filter(Boolean);
  const body = words.map((w, i) => `<mark name="w${i}"/>${escXml(w)}`).join(' ');
  return { ssml: `<speak>${body}<mark name="end"/></speak>`, words };
}

/**
 * 단어 마크 시각을 글자 단위 정렬로 바꾼다. 단어 안 글자는 균등 분배.
 * 마크가 없으면(Chirp3 보이스) 전체 길이를 글자 수로 균등 분배한다(근사).
 */
export function toAlignment(words: string[], timepoints: Timepoint[], totalDuration: number): CharAlignment {
  const marks = new Map(timepoints.map((t) => [t.markName, t.timeSeconds]));
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const hasMarks = words.length > 0 && words.every((_, i) => marks.has(`w${i}`));
  const totalLetters = words.reduce((a, w) => a + [...w].length, 0) || 1;
  let letterIdx = 0;

  words.forEach((w, i) => {
    if (i > 0) {
      const t = ends[ends.length - 1] ?? 0;
      chars.push(' '); starts.push(t); ends.push(t);
    }
    const letters = [...w];
    let ws: number;
    let we: number;
    if (hasMarks) {
      ws = marks.get(`w${i}`)!;
      we = marks.get(`w${i + 1}`) ?? marks.get('end') ?? totalDuration;
    } else {
      ws = (letterIdx / totalLetters) * totalDuration;
      we = ((letterIdx + letters.length) / totalLetters) * totalDuration;
    }
    const step = (we - ws) / letters.length;
    letters.forEach((c, k) => {
      chars.push(c);
      starts.push(ws + k * step);
      ends.push(ws + (k + 1) * step);
    });
    letterIdx += letters.length;
  });
  return { chars, starts, ends };
}

export async function googleTts(text: string, voiceName: string, speed: number, outMp3: string): Promise<{ duration: number; alignment: CharAlignment }> {
  const { ssml, words } = buildSsml(text.replace(/\s*\n\s*/g, ' '));
  const res = await fetch(`${BASE}/v1beta1/text:synthesize?key=${encodeURIComponent(key())}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { ssml },
      voice: { languageCode: 'ko-KR', name: voiceName },
      audioConfig: { audioEncoding: 'MP3', speakingRate: speed, sampleRateHertz: 44100 },
      enableTimePointing: ['SSML_MARK'],
    }),
  });
  if (!res.ok) throw new Error(`Google TTS 오류 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = (await res.json()) as { audioContent: string; timepoints?: Timepoint[] };
  await fs.mkdir(path.dirname(outMp3), { recursive: true });
  await fs.writeFile(outMp3, Buffer.from(data.audioContent, 'base64'));
  const fileDur = await probeDuration(outMp3).catch(() => 0);
  const tps = data.timepoints ?? [];
  const lastMark = tps.reduce((m, t) => Math.max(m, t.timeSeconds), 0);
  const duration = Math.max(fileDur, lastMark);
  // 마크가 없으면 끝의 무음을 빼고 분배하도록 파일 길이의 95%를 말하는 구간으로 본다
  const alignment = toAlignment(words, tps, tps.length ? duration : duration * 0.95);
  return { duration, alignment };
}

/** 한국어 보이스 목록. 단어 타이밍을 주는 보이스(Neural2·Wavenet·Standard)를 앞에, Chirp3는 '자막 근사'로 표시. */
export async function listGoogleVoices(): Promise<Voice[]> {
  const res = await fetch(`${BASE}/v1/voices?languageCode=ko-KR&key=${encodeURIComponent(key())}`);
  if (!res.ok) throw new Error(`Google TTS 오류 ${res.status}`);
  const data = (await res.json()) as { voices: { name: string; ssmlGender?: string }[] };
  const rank = (n: string) => (/Neural2/.test(n) ? 0 : /Wavenet/.test(n) ? 1 : /Standard/.test(n) ? 2 : 3);
  const gender = (g?: string) => (g === 'FEMALE' ? '여성' : g === 'MALE' ? '남성' : '');
  return data.voices
    .filter((v) => v.name.startsWith('ko-KR'))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map((v) => {
      const approx = rank(v.name) === 3;
      return { id: v.name, name: `${v.name.replace('ko-KR-', '')} (${gender(v.ssmlGender)})${approx ? ' · 고음질, 자막 근사' : ''}` };
    });
}
