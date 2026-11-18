import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { Beat } from '../types';

export const MAX_LINE = 14;

const strArr = z.array(z.string()).default([]);

export const AnalysisSchema = z.object({
  productName: z.string(),
  category: z.string().default(''),
  keywords: strArr,
  searchQueries: z.object({ youtube: strArr, tiktok: strArr, instagram: strArr, douyin: strArr, xiaohongshu: strArr }),
  structure: z.object({ hook: z.string().default(''), body: z.string().default(''), cta: z.string().default('') }),
  scenes: z.array(z.object({
    start: z.number(), end: z.number(), description: z.string(), onScreenText: z.string().optional(),
  })).default([]),
  narrationTone: z.string().default(''),
});

export const ClipDescSchema = z.array(z.object({
  id: z.string(),
  description: z.string(),
  shotType: z.string().default(''),
  hasBurnedText: z.boolean().default(false),
  quality: z.number().min(1).max(5).default(3),
  textBoxes: z.array(z.array(z.number()).length(4)).default([]),
}));

export const ScriptSchema = z.object({
  headcopy: z.array(z.string()).min(1),
  beats: z.array(z.object({ text: z.string(), clipId: z.string().nullable().optional() })).min(1),
});

/** 어절 단위로 줄을 나눠 각 줄을 MAX_LINE 이하로 만든다. 한 어절이 너무 길면 강제로 자른다. */
export function wrapLine(line: string, max = MAX_LINE): string[] {
  const out: string[] = [];
  let cur = '';
  const flush = () => { if (cur) out.push(cur); cur = ''; };
  for (const word of line.trim().split(/\s+/).filter(Boolean)) {
    const chars = [...word];
    if (chars.length > max) {
      flush();
      for (let i = 0; i < chars.length; i += max) out.push(chars.slice(i, i + max).join(''));
      cur = out.pop() ?? '';
      continue;
    }
    const cand = cur ? `${cur} ${word}` : word;
    if ([...cand].length <= max) cur = cand;
    else { flush(); cur = word; }
  }
  flush();
  return out;
}

/** ㄷㄷ, ㅋㅋ 같은 자모만으로 된 토큰은 TTS가 이상하게 읽으므로 뺀다. */
export const stripJamoTokens = (line: string) =>
  line.split(/\s+/).filter((w) => w && !/^[ㄱ-ㅎㅏ-ㅣ]+[!?.~]*$/.test(w)).join(' ');

export function sanitizeBeats(raw: { text: string; clipId?: string | null }[], clipIds: Set<string>): Beat[] {
  return raw
    .map((b) => {
      const lines = b.text.split('\n').map(stripJamoTokens).flatMap((l) => wrapLine(l));
      return { id: nanoid(8), text: lines.join('\n'), clipId: b.clipId && clipIds.has(b.clipId) ? b.clipId : null };
    })
    .filter((b) => b.text.trim().length > 0);
}

/** LLM 응답에서 JSON 본문만 꺼낸다 (```json 펜스 제거). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  return JSON.parse(body);
}

/** 한국어 TTS 낭독 속도 근사치 (공백 제외 글자/초, 속도 1.1 기준 실측) */
export const CHARS_PER_SEC = 6.5;

export function estimateSeconds(beats: { text: string }[]): number {
  const n = beats.reduce((a, b) => a + [...b.text].filter((c) => !/\s/.test(c)).length, 0);
  return n / CHARS_PER_SEC;
}

/** 목표 길이의 80%에 못 미치면 너무 짧은 대본 */
export const isTooShort = (beats: { text: string }[], targetSeconds: number) => estimateSeconds(beats) < targetSeconds * 0.8;

/** 이미지별 글자 박스 응답: { 키: [[ymin,xmin,ymax,xmax], ...] } — 형식이 틀린 박스는 버린다 */
export const TextBoxMapSchema = z.record(
  z.string(),
  z.array(z.unknown()).transform((arr) =>
    arr.filter((b): b is number[] => Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number')),
  ),
);

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
