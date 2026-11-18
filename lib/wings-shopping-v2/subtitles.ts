import {
  DEFAULT_STYLE,
  buildMotionGraphicsLines,
  emphasize,
  popTags,
  titlePopTags,
  type MotionOpts,
} from './motion/ass';
import type { CharAlignment } from './types';

export type Cue = { text: string; start: number; end: number };

export function splitLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

const isWs = (c: string) => /\s/.test(c);
const hasWord = (s: string) => /[\p{L}\p{N}]/u.test(s);

/**
 * 자막 줄마다 시작/끝 시각을 구한다.
 * 공백을 뺀 글자 수 누적으로 줄의 첫 글자를 정렬 데이터의 글자에 대응시킨다.
 * 정렬 데이터가 모자라면 마지막 글자로 고정해 시간이 거꾸로 가지 않게 한다.
 */
export function lineTimings(lines: string[], alignment: CharAlignment, offset: number): Cue[] {
  const idx: number[] = [];
  alignment.chars.forEach((c, i) => { if (!isWs(c)) idx.push(i); });
  if (idx.length === 0) return [];
  const last = idx[idx.length - 1];
  const at = (k: number) => idx[Math.min(k, idx.length - 1)];

  const starts: { text: string; start: number }[] = [];
  let count = 0;
  for (const raw of lines) {
    const line = raw.trim();
    const n = [...line].filter((c) => !isWs(c)).length;
    if (hasWord(line)) starts.push({ text: line, start: alignment.starts[at(count)] + offset });
    count += n;
  }
  const endAll = alignment.ends[last] + offset;
  return starts.map((s, i) => {
    const start = Math.min(s.start, endAll);
    const end = i + 1 < starts.length ? Math.min(Math.max(starts[i + 1].start, start), endAll) : endAll;
    return { text: s.text, start, end: Math.max(end, start) };
  });
}

function assTime(t: number): string {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${h}:${p(m)}:${p(s)}.${p(c)}`;
}

const esc = (s: string) => s.replace(/[{}]/g, '').replace(/\n/g, '\\N');

export function buildAss(
  cues: Cue[],
  headcopy: [string, string],
  opts: { font: string; width: number; height: number; totalDuration: number; motion?: MotionOpts },
): string {
  const { font, width, height, totalDuration, motion } = opts;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,${font},86,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,2,5,60,60,0,1
${DEFAULT_STYLE}
Style: Head,${font},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,8,2,8,60,60,170,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  if (motion) {
    lines.push(...buildMotionGraphicsLines({ headcopy, totalDuration, motion }));
  }
  const head = headcopy.map((h) => h.trim()).filter(Boolean);
  if (head.length) {
    const [a, b] = head;
    const text = b ? `${esc(a)}\\N{\\c&H00E5FF&}${esc(b)}` : esc(a);
    lines.push(`Dialogue: 3,${assTime(0)},${assTime(totalDuration)},Head,,0,0,0,,${motion ? `{${titlePopTags()}}` : ''}${text}`);
  }
  cues.forEach((c, idx) => {
    lines.push(motion
      ? `Dialogue: 4,${assTime(c.start)},${assTime(c.end)},Sub,,0,0,0,,{${popTags(idx)}}${emphasize(esc(c.text), '&H0000E5FF', '&H00FFFFFF')}`
      : `Dialogue: 4,${assTime(c.start)},${assTime(c.end)},Sub,,0,0,0,,${esc(c.text)}`);
  });
  return header + lines.join('\n') + '\n';
}
