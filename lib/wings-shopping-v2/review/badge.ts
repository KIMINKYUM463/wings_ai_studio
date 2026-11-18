import type { BadgeStyle, Template } from '../templates/types';
import { assColor, fitSize } from '../templates/ass';

/** 대본 비트의 item 라벨 → 화면 표시 구간 (다음 상품 라벨이 나오거나 CTA가 시작되면 바뀜) */
export type ItemSpan = { rank?: string; name: string; start: number; end: number };

/** '3위 · 상품명', 'TOP 3 상품명', 'A · 상품명', '1. 상품명' → 순위/이름 */
export function parseItem(label: string): { rank?: string; name: string } {
  const s = label.trim();
  const m = s.match(/^(?:TOP\s*)?(\d{1,2})\s*(?:위|등|번|st|nd|rd|th|\.)?\s*[·:|\-–]?\s*(.*)$/i);
  if (m && m[2]) return { rank: /^TOP/i.test(s) ? `TOP ${m[1]}` : `${m[1]}위`, name: m[2].trim() };
  const ab = s.match(/^([A-Z]|VS)\s*[·:|\-–]\s*(.+)$/);
  if (ab) return { rank: ab[1], name: ab[2].trim() };
  return { name: s };
}

export function itemSpans(beats: { item?: string; role?: string }[], starts: number[], durations: number[]): ItemSpan[] {
  const spans: ItemSpan[] = [];
  let cur: ItemSpan | null = null;
  beats.forEach((b, i) => {
    const start = starts[i];
    const end = start + durations[i];
    if (b.role === 'cta' || b.role === 'closing') { cur = null; return; }
    if (b.item?.trim()) {
      cur = { ...parseItem(b.item), start, end };
      spans.push(cur);
    } else if (cur) {
      cur.end = end;
    }
  });
  return spans;
}

function t2(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${p(Math.floor((cs % 360000) / 6000))}:${p(Math.floor((cs % 6000) / 100))}.${p(cs % 100)}`;
}

const esc = (s: string) => s.replace(/[{}\\]/g, '');
const rect = (w: number, h: number) => `m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}`;

/** 템플릿에 배지 위치가 없으면 영상 영역 기준으로 */
export function badgeStyle(t: Template): BadgeStyle {
  if (t.badge) return t.badge;
  const v = t.video;
  return {
    rank: { x: v.x + v.w - 40, y: v.y + 40, size: 64, color: '#ffe500', textColor: '#111111' },
    card: { x: v.x + 40, y: v.y + v.h - 160, w: v.w - 80, size: 42, color: '#111111', textColor: '#ffffff', alpha: 0.2 },
  };
}

/** ASS 이벤트: 상품이 바뀔 때마다 순위 배지(우상단)와 상품명 카드가 튀어나온다 */
export function badgeLines(s: BadgeStyle, spans: ItemSpan[], animate = true): string[] {
  const out: string[] = [];
  const pop = animate ? '\\fscx60\\fscy60\\t(0,140,\\fscx110\\fscy110)\\t(140,220,\\fscx100\\fscy100)' : '';
  const fade = animate ? '\\fad(120,0)' : '';
  for (const sp of spans) {
    const a = t2(sp.start);
    const b = t2(sp.end);
    if (sp.rank) {
      const r = s.rank;
      const w = Math.round(r.size * (0.62 * [...sp.rank].length + 0.9));
      const h = Math.round(r.size * 1.45);
      out.push(`Dialogue: 6,${a},${b},Default,,0,0,0,,{\\an9\\pos(${r.x},${r.y})\\bord0\\shad0\\1c${assColor(r.color)}&\\org(${r.x},${r.y})${pop}\\p1}${rect(w, h)}{\\p0}`);
      out.push(`Dialogue: 7,${a},${b},Default,,0,0,0,,{\\an5\\pos(${r.x - w / 2},${r.y + h / 2})\\fs${r.size}\\b1\\bord0\\shad0\\1c${assColor(r.textColor)}&\\org(${r.x},${r.y})${pop}}${esc(sp.rank)}`);
    }
    if (sp.name) {
      const c = s.card;
      const size = fitSize(sp.name, c.size, c.w - 60);
      const h = Math.round(c.size * 1.9);
      out.push(`Dialogue: 6,${a},${b},Default,,0,0,0,,{\\an7\\pos(${c.x},${c.y})\\bord0\\shad0\\1c${assColor(c.color)}&\\1a&H${Math.round((c.alpha ?? 0) * 255).toString(16).padStart(2, '0').toUpperCase()}&${fade}\\p1}${rect(c.w, h)}{\\p0}`);
      out.push(`Dialogue: 7,${a},${b},Default,,0,0,0,,{\\an4\\pos(${c.x + 30},${c.y + h / 2})\\fs${size}\\b1\\bord0\\shad0\\1c${assColor(c.textColor)}&${fade}}${esc(sp.name)}`);
    }
  }
  return out;
}
