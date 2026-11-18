import { assColor, fitSize } from '../templates/ass';
import type { ThumbStyle } from './catalog';

const FONT = 'Pretendard';
const esc = (s: string) => s.replace(/[{}\\]/g, '');

/** 강조어를 강조색으로 감싼다 (첫 등장 한 번) */
function colorize(text: string, highlight: string, base: string, accent: string): string {
  const t = esc(text);
  const h = esc(highlight.trim());
  if (!h || !t.includes(h)) return t;
  const i = t.indexOf(h);
  return `${t.slice(0, i)}{\\c${assColor(accent)}&}${h}{\\c${assColor(base)}&}${t.slice(i + h.length)}`;
}

/** 썸네일 글자 ASS (줄마다 아래로 쌓고, 강조어는 강조색) */
export function buildThumbAss(s: ThumbStyle, lines: string[], highlight: string): string {
  const rows = lines.map((l) => l.trim()).filter(Boolean).slice(0, 4);
  const hex = (a: number) => `&H${Math.round(a * 255).toString(16).padStart(2, '0')}&`;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Thumb,${FONT},100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,${s.box ? 3 : 1},0,0,5,0,0,0,1
Style: Band,${FONT},40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const out: string[] = [];
  if (s.band) {
    const b = s.band;
    out.push(`Dialogue: 0,0:00:00.00,0:00:05.00,Band,,0,0,0,,{\\an7\\pos(0,${b.y})\\bord0\\shad0\\1c${assColor(b.color, b.alpha ?? 0)}\\p1}m 0 0 l 1080 0 l 1080 ${b.h} l 0 ${b.h}{\\p0}`);
  }
  let y = s.y;
  rows.forEach((row, i) => {
    const scale = i === 0 && s.firstLineScale ? s.firstLineScale : 1;
    const size = fitSize(row, Math.round(s.size * scale), 1000);
    const color = i === 0 && s.firstLineScale ? s.accent : s.color;
    const border = s.box
      ? `\\bord${s.box.pad ?? 18}\\3c${assColor(s.box.color)}\\3a${hex(s.box.alpha ?? 0)}`
      : `\\bord${s.outline}\\3c${assColor(s.outlineColor)}`;
    const tags = `{\\an5\\pos(540,${Math.round(y)})\\fn${FONT}\\fs${size}\\b1\\1c${assColor(color)}${border}\\shad${s.shadow ?? 0}}`;
    const body = colorize(row, highlight, color, s.accent);
    const text = s.quotes && i === 0 ? `“${body}` : s.quotes && i === rows.length - 1 ? `${body}”` : body;
    out.push(`Dialogue: 1,0:00:00.00,0:00:05.00,Thumb,,0,0,0,,${tags}${text}`);
    const next = rows[i + 1];
    if (next !== undefined) y += size * 0.6 + fitSize(next, s.size, 1000) * 0.6 + size * ((s.lineGap ?? 1.22) - 1) + (s.box ? (s.box.pad ?? 18) * 2 : 0);
  });
  return header + out.join('\n') + '\n';
}
