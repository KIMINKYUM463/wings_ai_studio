import type { Cue } from '../subtitles';
import {
  DEFAULT_STYLE,
  beatCalloutMotionLines,
  emphasize,
  popTags,
  extraMotionLines,
  type MotionOpts,
} from '../motion/ass';
import type { Layer, Template, TemplateData, TextSlot, TextStyle } from './types';
import { coverVariant } from './cover-variants';

const FONT = 'Pretendard';
const POSTER_SECONDS = 1.8;

/** #RRGGBB (+투명도 0~1) → ASS &HAABBGGRR */
export function assColor(hex: string, transparency = 0): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  const a = Math.round(Math.min(1, Math.max(0, transparency)) * 255).toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase().replace('&H', '&H');
}

/** 한글은 글자 폭이 대략 글자크기와 같다고 보고, 폭을 넘으면 글자크기를 줄인다 (최소 36) */
export function fitSize(text: string, size: number, maxWidth: number): number {
  const units = [...text].reduce((a, c) => a + (/\s/.test(c) ? 0.35 : /[\x20-\x7e]/.test(c) ? 0.55 : 0.98), 0);
  if (units * size <= maxWidth) return size;
  return Math.max(36, Math.floor(maxWidth / units));
}

function t2(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(cs / 360000)}:${p(Math.floor((cs % 360000) / 6000))}:${p(Math.floor((cs % 6000) / 100))}.${p(cs % 100)}`;
}

const esc = (s: string) => s.replace(/[{}\\]/g, '').replace(/\n/g, '\\N');

/** 제목에서 정해지는 게시글 숫자 (같은 제목이면 늘 같은 값) */
export function postStats(title: [string, string]): { views: string; likes: string; comments: string } {
  let h = 2166136261;
  for (const c of title.join(' ')) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return { views: `${12 + (h % 288)}만`, likes: `${100 + ((h >>> 9) % 900)}`, comments: `${30 + ((h >>> 19) % 470)}` };
}

function slotText(slot: TextSlot, d: TemplateData): string {
  if (typeof slot === 'object') {
    if ('stats' in slot) {
      const st = postStats(d.title);
      return (d.statics?.[slot.stats] ?? slot.stats).replace(/\{(views|likes|comments)\}/g, (_, k: keyof typeof st) => st[k]);
    }
    return d.statics?.[slot.static] ?? slot.static;
  }
  switch (slot) {
    case 'channel': return d.channel;
    case 'handle': return d.channel ? `@${d.channel.replace(/\s+/g, '')}` : '';
    case 'footer': return d.footer ?? '';
    case 'location': return d.location ?? '';
    case 'price': return d.price ?? '';
    case 'period': return d.period ?? '';
    case 'title': return [d.title[0], d.title[1]].map((s) => s.trim()).filter(Boolean).join(' ');
    case 'title1': return d.title[0];
    case 'title2': return d.title[1];
    case 'meta': return d.meta;
    case 'comment': return d.comment;
  }
}

function styleTags(s: TextStyle, size: number, alpha = 0): string {
  const hex = (a: number) => `&H${Math.round(a * 255).toString(16).padStart(2, '0')}&`;
  return [
    `\\fn${s.font ?? FONT}`, `\\fs${size}`, `\\b${s.bold ? 1 : 0}`, `\\i${s.italic ? 1 : 0}`,
    `\\1c${assColor(s.color)}`, `\\1a${hex(alpha)}`,
    // 박스가 있으면 외곽선 색·두께가 박스 색·여백이 된다 (BorderStyle 3 스타일과 함께 씀)
    ...(s.box
      ? [`\\bord${s.box.pad ?? 14}`, `\\3c${assColor(s.box.color)}`, `\\3a${hex(s.box.alpha ?? 0)}`]
      : [`\\bord${s.outline ?? 0}`, `\\3c${assColor(s.outlineColor ?? '#000000')}`]),
    `\\shad${s.shadow ?? 0}`, `\\4c${assColor('#000000', 0.5)}`,
    `\\fsp${s.spacing ?? 0}`,
  ].join('');
}

/** 아이콘을 ASS 벡터 드로잉으로 (중심 x,y, 크기 size) */
function iconDrawing(name: string, size: number): string {
  const s = size;
  const h = s / 2;
  switch (name) {
    case 'back': // ‹
      return `m ${h * 0.55} 0 l ${h * 0.75} ${s * 0.12} l ${h * 0.25} ${h} l ${h * 0.75} ${s * 0.88} l ${h * 0.55} ${s} l ${0} ${h}`;
    case 'menu': {
      const t = Math.max(4, s * 0.1);
      return [0, h - t / 2, s - t].map((y) => `m 0 ${y} l ${s} ${y} l ${s} ${y + t} l 0 ${y + t}`).join(' ');
    }
    case 'chevrons': { // »
      const c = (o: number) => `m ${o} 0 l ${o + s * 0.18} 0 l ${o + s * 0.5} ${h} l ${o + s * 0.18} ${s} l ${o} ${s} l ${o + s * 0.32} ${h}`;
      return `${c(0)} ${c(s * 0.45)}`;
    }
    case 'like': // 엄지 모양 근사 (손바닥 + 엄지)
      return `m 0 ${s * 0.42} l ${s * 0.22} ${s * 0.42} l ${s * 0.22} ${s} l 0 ${s} m ${s * 0.3} ${s * 0.42} l ${s * 0.52} 0 l ${s * 0.62} ${s * 0.08} l ${s * 0.56} ${s * 0.36} l ${s} ${s * 0.36} l ${s} ${s * 0.56} l ${s * 0.86} ${s} l ${s * 0.3} ${s}`;
    case 'pin': { // 위치 핀 (둥근 머리 + 뾰족한 끝)
      const k = 0.5523 * h;
      return `m ${h} ${s} l ${s * 0.12} ${h * 1.1} b 0 ${h * 0.85} 0 ${h - k} 0 ${h * 0.62} b 0 ${h * 0.25} ${h - k} 0 ${h} 0 b ${h + k} 0 ${s} ${h * 0.25} ${s} ${h * 0.62} b ${s} ${h - k} ${s} ${h * 0.85} ${s * 0.88} ${h * 1.1}`;
    }
    case 'search':
      return `m 0 0 l ${s} 0 l ${s} ${s} l 0 ${s}`;
    case 'avatar': { // 원 (베지어 근사)
      const k = 0.5523 * h;
      return `m ${h} 0 b ${h + k} 0 ${s} ${h - k} ${s} ${h} b ${s} ${h + k} ${h + k} ${s} ${h} ${s} b ${h - k} ${s} 0 ${h + k} 0 ${h} b 0 ${h - k} ${h - k} 0 ${h} 0`;
    }
    default:
      return `m 0 0 l ${s} 0 l ${s} ${s} l 0 ${s}`;
  }
}

/**
 * lucide 아이콘(24칸 좌표) 근사. 열린 선은 libass 가 닫으면서 엉뚱한 선을 긋지 않게 왔던 길을 되짚어(면적 0) 그리고,
 * 테두리(\bord)로 선 굵기를 낸다. f: 속을 채울 수 있는 닫힌 모양.
 */
const LUCIDE: Record<string, { d: string; f?: boolean }> = {
  magnifier: { d: `${circ(11, 11, 7.5)} m 16.5 16.5 l 21 21` },
  arrowLeft: { d: 'm 19 12 l 5 12 m 12 19 l 5 12 l 12 5' },
  arrowRight: { d: 'm 5 12 l 19 12 m 12 5 l 19 12 l 12 19' },
  menu: { d: 'm 4 6 l 20 6 m 4 12 l 20 12 m 4 18 l 20 18' },
  ellipsis: { d: 'm 12 4.5 l 12 5.5 m 12 11.5 l 12 12.5 m 12 18.5 l 12 19.5' },
  star: { d: 'm 12 2 l 15.09 8.26 l 22 9.27 l 17 14.14 l 18.18 21.02 l 12 17.77 l 5.82 21.02 l 7 14.14 l 2 9.27 l 8.91 8.26 l 12 2', f: true },
  heart: { d: 'm 12 20.5 l 3.8 12.6 b 1.2 10 1.4 5.6 4.6 4.2 b 7.6 2.9 10.5 4.2 12 6.8 b 13.5 4.2 16.4 2.9 19.4 4.2 b 22.6 5.6 22.8 10 20.2 12.6 l 12 20.5', f: true },
  user: { d: `${circ(12, 8, 4.5)} m 4 21 b 4 16.6 7.6 13.5 12 13.5 b 16.4 13.5 20 16.6 20 21` },
  users: { d: `${circ(9, 7.5, 4)} m 2 21 b 2 17.1 5.1 14 9 14 b 12.9 14 16 17.1 16 21 m 16 3.6 b 19.5 4.6 19.5 10.4 16 11.4 m 22 21 b 22 18.2 20.6 15.8 18.5 14.8` },
  home: { d: 'm 3 10 l 12 3 l 21 10 l 21 21 l 15 21 l 15 14 l 9 14 l 9 21 l 3 21 l 3 10' },
  cart: { d: `m 2 3 l 5 3 l 7.6 15 l 18.6 15 l 21 7 l 5.9 7 ${circ(8.5, 20, 1.2)} ${circ(18, 20, 1.2)}` },
  bell: { d: 'm 6 8 b 6 4.7 8.7 2 12 2 b 15.3 2 18 4.7 18 8 b 18 14 21 16.5 21 16.5 l 3 16.5 b 3 16.5 6 14 6 8 m 10.2 20.5 b 11 21.6 13 21.6 13.8 20.5' },
  sparkles: { d: 'm 11 3 b 11.6 8 14 10.4 19 11 b 14 11.6 11.6 14 11 19 b 10.4 14 8 11.6 3 11 b 8 10.4 10.4 8 11 3 m 20 2.5 l 20 7.5 m 17.5 5 l 22.5 5 m 5 17 l 5 21 m 3 19 l 7 19' },
  bookmark: { d: 'm 19 21 l 12 17 l 5 21 l 5 5 b 5 3.9 5.9 3 7 3 l 17 3 b 18.1 3 19 3.9 19 5 l 19 21', f: true },
  chat: { d: 'm 7.9 20 b 13.3 22.7 19.8 20.4 21.4 14.8 b 23 9.2 19.3 3.3 13.5 2.6 b 7.7 1.9 2.6 6.2 2.6 12 b 2.6 13.7 3 15.3 3.7 16.7 l 2.6 21 l 7.9 20', f: true },
  send: { d: 'm 22 2 l 11 13 m 22 2 l 15 22 l 11 13 l 2 9 l 22 2' },
  briefcase: { d: 'm 3 7 l 21 7 l 21 20 l 3 20 l 3 7 m 8 7 l 8 5 b 8 3.9 8.9 3 10 3 l 14 3 b 15.1 3 16 3.9 16 5 l 16 7 m 3 13 l 21 13' },
  newspaper: { d: 'm 4 3 l 20 3 l 20 21 l 4 21 l 4 3 m 8 7.5 l 16 7.5 m 8 12 l 16 12 m 8 16.5 l 13 16.5' },
  pen: { d: 'm 12 20 l 21 20 m 16.5 3.5 b 17.3 2.7 18.7 2.7 19.5 3.5 l 20.5 4.5 b 21.3 5.3 21.3 6.7 20.5 7.5 l 7 21 l 3 21 l 3 17 l 16.5 3.5' },
  flame: { d: 'm 12 22 b 8 22 5 19.3 5 15.6 b 5 11.6 8.2 9.6 8.6 5.6 b 10.4 6.8 11.2 8.6 11.1 10.6 b 13.3 8.6 13.9 5.2 13.2 2 b 17.2 4.4 19 9.4 19 14.6 b 19 19 16.2 22 12 22', f: true },
  trophy: { d: 'm 7 3 l 17 3 l 17 9.5 b 17 12.5 14.8 15 12 15 b 9.2 15 7 12.5 7 9.5 l 7 3 m 7 5 l 3.5 5 b 3.5 8 5 10 7 10 m 17 5 l 20.5 5 b 20.5 8 19 10 17 10 m 12 15 l 12 19 m 7.5 21 l 16.5 21' },
  zap: { d: 'm 13 2 l 3.5 14 l 12 14 l 11 22 l 20.5 10 l 12 10 l 13 2', f: true },
  smile: { d: `${circ(12, 12, 10)} m 8 14 b 9.3 16.5 14.7 16.5 16 14 m 9 9 l 9.05 9 m 15 9 l 15.05 9` },
  store: { d: 'm 3 9 l 4.5 3 l 19.5 3 l 21 9 l 3 9 m 4.5 9 l 4.5 21 l 19.5 21 l 19.5 9 m 9.5 21 l 9.5 15 l 14.5 15 l 14.5 21' },
  cookie: { d: `${circ(12, 12, 10)} m 8.5 8.5 l 8.55 8.5 m 16 15.5 l 16.05 15.5 m 12 12 l 12.05 12 m 11 17 l 11.05 17 m 15.5 7.5 l 15.55 7.5` },
  crown: { d: 'm 2.5 18 l 4 7 l 8.5 11.5 l 12 4 l 15.5 11.5 l 20 7 l 21.5 18 l 2.5 18 m 5 21.5 l 19 21.5' },
};

/** 원 (베지어 4개, 24칸 좌표 문자열) */
function circ(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  const n = (v: number) => +v.toFixed(2);
  return `m ${cx} ${n(cy - r)} b ${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${cy} b ${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${cx} ${n(cy + r)} b ${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${cy} b ${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${cx} ${n(cy - r)}`;
}

/** 'm x y l x y … b …' 를 size/24 배로 늘리고, retrace 면 각 선을 되짚어 면적 0 으로 만든다 */
export function scalePath(d: string, size: number, retrace: boolean): string {
  const k = size / 24;
  const f = (v: number) => +(v * k).toFixed(1);
  const out: string[] = [];
  for (const sub of d.split(/(?=m )/).map((x) => x.trim()).filter(Boolean)) {
    const tok = sub.split(/\s+/);
    const start = [Number(tok[1]), Number(tok[2])];
    const segs: { c: 'l' | 'b'; p: number[] }[] = [];
    let c: 'l' | 'b' = 'l';
    let nums: number[] = [];
    const flush = () => {
      const n = c === 'l' ? 2 : 6;
      for (let i = 0; i + n <= nums.length; i += n) segs.push({ c, p: nums.slice(i, i + n) });
      nums = [];
    };
    for (const t of tok.slice(3)) {
      if (t === 'l' || t === 'b') {
        flush();
        c = t;
      } else nums.push(Number(t));
    }
    flush();
    const pts = [start, ...segs.map((s) => s.p.slice(-2))];
    let str = `m ${f(start[0])} ${f(start[1])} ${segs.map((s) => `${s.c} ${s.p.map(f).join(' ')}`).join(' ')}`;
    if (retrace) {
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        const back = pts[i];
        str += s.c === 'l' ? ` l ${f(back[0])} ${f(back[1])}` : ` b ${f(s.p[2])} ${f(s.p[3])} ${f(s.p[0])} ${f(s.p[1])} ${f(back[0])} ${f(back[1])}`;
      }
    }
    out.push(str);
  }
  return out.join(' ');
}

/** 둥근 사각형 드로잉 (원점 0,0) */
function rrectPath(w: number, h: number, r0: number): string {
  const n = (v: number) => +v.toFixed(1);
  const r = Math.max(0, Math.min(r0, w / 2, h / 2));
  if (!r) return `m 0 0 l ${n(w)} 0 l ${n(w)} ${n(h)} l 0 ${n(h)}`;
  const c = n(r * (1 - 0.5523));
  return `m ${n(r)} 0 l ${n(w - r)} 0 b ${n(w - c)} 0 ${n(w)} ${c} ${n(w)} ${n(r)} l ${n(w)} ${n(h - r)} b ${n(w)} ${n(h - c)} ${n(w - c)} ${n(h)} ${n(w - r)} ${n(h)} l ${n(r)} ${n(h)} b ${c} ${n(h)} 0 ${n(h - c)} 0 ${n(h - r)} l 0 ${n(r)} b 0 ${c} ${c} 0 ${n(r)} 0`;
}

const TITLE_SLOTS = new Set(['title', 'title1', 'title2']);

/**
 * 글꼴별 실제 글자 폭 (글자 크기 대비, 굵게): [한글, 영문·숫자, 띄어쓰기].
 * public/fonts 글꼴을 libass(렌더와 같은 엔진)로 \fs100 \b1 렌더해 잰 값 (2026-11-16).
 */
const GLYPH_WIDTH: Record<string, [number, number, number]> = {
  'Pretendard': [0.719, 0.435, 0.19], 'Gmarket Sans TTF': [0.744, 0.465, 0.25], 'Do Hyeon': [0.765, 0.441, 0.3],
  'SB Aggro Bold': [0.801, 0.578, 0.23], 'TmonMonsori Black': [0.723, 0.438, 0.2], 'GangwonEduPower': [0.89, 0.525, 0.24],
  'NanumBarunGothic': [0.772, 0.438, 0.19], 'Gowun Dodum': [0.631, 0.312, 0.22], 'GangwonEduAll Bold': [0.69, 0.369, 0.22],
  'Cafe24 PRO Slim Max': [0.498, 0.351, 0.15], 'HS산토끼체': [0.685, 0.391, 0.17], 'GangwonEduSaeeum Medium': [0.554, 0.307, 0.2],
  'GangwonEduHyeonokT Medium': [0.509, 0.289, 0.28], 'Nanum GarMaesGeur': [0.675, 0.304, 0.26], 'Nanum GangBuJangNimCe': [0.731, 0.297, 0.26],
};
/** 실제 글꼴 폭으로 maxWidth 에 딱 들어가는 가장 큰 글자 크기 (모르는 글꼴은 넉넉한 추정치) */
export function measuredFit(text: string, maxWidth: number, family: string): number {
  const [h, a, sp] = GLYPH_WIDTH[family] ?? [0.9, 0.55, 0.3];
  const units = [...text].reduce((s, c) => s + (/\s/.test(c) ? sp : /[\x20-\x7e]/.test(c) ? a : h), 0);
  return units > 0 ? Math.floor(maxWidth / units) : 400;
}

function layerLines(layer: Layer, d: TemplateData, end: string, titleStart = 0): string[] {
  const isTitle = layer.kind === 'text' && typeof layer.slot === 'string' && TITLE_SLOTS.has(layer.slot);
  const start = t2(isTitle ? titleStart : 0);
  switch (layer.kind) {
    case 'rect': {
      const tags = `{\\an7\\pos(${layer.x},${layer.y})\\bord0\\shad0\\1c${assColor(layer.color, layer.alpha ?? 0)}\\p1}`;
      return [`Dialogue: 0,${start},${end},Layer,,0,0,0,,${tags}m 0 0 l ${layer.w} 0 l ${layer.w} ${layer.h} l 0 ${layer.h}{\\p0}`];
    }
    case 'rrect': {
      // 테두리는 상자 안쪽: 모양을 b 만큼 줄여 그리고 \bord b 로 바깥을 채운다 (libass 가 채움 밑 테두리를 빼므로 반투명 채움도 깔끔)
      const b = layer.border ?? 0;
      const tags = `{\\an7\\pos(${layer.x + b},${layer.y + b})\\bord${b}\\shad0\\1c${assColor(layer.color)}\\1a&H${Math.round((layer.alpha ?? 0) * 255).toString(16).padStart(2, '0')}&\\3c${assColor(layer.borderColor ?? '#000000')}\\p1}`;
      return [`Dialogue: 0,${start},${end},Layer,,0,0,0,,${tags}${rrectPath(layer.w - 2 * b, layer.h - 2 * b, layer.r - b)}{\\p0}`];
    }
    case 'icon': {
      const lu = LUCIDE[layer.name];
      if ((layer.stroke || layer.fill) && lu) {
        // 선 굵기: lucide strokeWidth(24칸) → 픽셀 반지름
        const bord = +(((layer.stroke ?? 2) * layer.size) / 48).toFixed(1);
        const filled = !!layer.fill && !!lu.f;
        const tags = `{\\an5\\pos(${layer.x},${layer.y})\\bord${bord}\\shad0\\1c${assColor(layer.color)}\\1a&H${filled ? '00' : 'FF'}&\\3c${assColor(layer.color)}\\p1}`;
        return [`Dialogue: 1,${start},${end},Layer,,0,0,0,,${tags}${scalePath(lu.d, layer.size, !filled)}{\\p0}`];
      }
      const tags = `{\\an5\\pos(${layer.x},${layer.y})\\bord0\\shad0\\1c${assColor(layer.color)}\\p1}`;
      return [`Dialogue: 1,${start},${end},Layer,,0,0,0,,${tags}${iconDrawing(layer.name, layer.size)}{\\p0}`];
    }
    case 'text': {
      const text = slotText(layer.slot, d).trim();
      if (!text) return [];
      // 사용자가 정한 제목·채널명 크기 배율 (폭을 넘으면 fitSize 가 다시 줄인다)
      const scale = typeof layer.slot !== 'string' ? 1 : TITLE_SLOTS.has(layer.slot) ? d.titleScale ?? 1 : layer.slot === 'channel' || layer.slot === 'handle' ? d.channelScale ?? 1 : 1;
      const base = Math.round(layer.style.size * scale);
      let size = layer.maxWidth ? fitSize(text, base, layer.maxWidth) : base;
      if (scale > 1 && layer.maxWidth && typeof layer.slot === 'string' && TITLE_SLOTS.has(layer.slot)) {
        // 제목 키우기: 100% = 템플릿 원래 크기, 1%마다 그만큼 커진다. 폭은 실제 글꼴을 libass 로 잰 값(measuredFit)으로 계산한다.
        const fam = d.font || 'Pretendard';
        const W = Math.min(layer.maxWidth, 1080 - 96);
        const orig = fitSize(text, layer.style.size, layer.maxWidth);
        // 소수점 한 자리까지 (1%만 올려도 바로 커지게)
        const target = Math.round(orig * scale * 10) / 10;
        // 최대 = 한 줄이 좌우 끝에서 살짝 떨어진 크기 (두 줄로 나누면 제목 칸 위아래를 넘어가서 한 줄로 둔다)
        size = Math.max(orig, Math.min(target, measuredFit(text, W, fam)));
      }
      const tags = `{\\an${layer.align}\\pos(${layer.x},${layer.y})${layer.rotate ? `\\frz${layer.rotate}` : ''}${styleTags(layer.style, size, layer.alpha)}}`;
      return [`Dialogue: 2,${start},${end},${layer.style.box ? 'LayerBox' : 'Layer'},,0,0,0,,${tags}${esc(text)}`];
    }
    case 'watermark': {
      const text = slotText(layer.slot, d).trim();
      if (!text) return [];
      const out: string[] = [];
      for (let y = 420; y < 1920; y += 260) {
        for (let x = 120; x < 1080; x += 360) {
          const tags = `{\\an5\\pos(${x + ((y / 260) % 2) * 180},${y})\\frz30${styleTags({ size: layer.size, color: layer.color }, layer.size, 1 - layer.alpha)}}`;
          out.push(`Dialogue: 0,${start},${end},Layer,,0,0,0,,${tags}${esc(text)}`);
        }
      }
      return out;
    }
  }
}

/** 템플릿 레이어(헤더·제목·아이콘 등) + 나레이션 자막 + (선택) 포스터 인트로 → ASS 전체 */
export function buildTemplateAss(t: Template, d: TemplateData, cues: Cue[], totalDuration: number, motion?: MotionOpts): string {
  const end = t2(totalDuration);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Layer,${FONT},40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Caption,${FONT},50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: CaptionBox,${FONT},50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,3,12,0,5,0,0,0,1
Style: LayerBox,${FONT},40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,3,12,0,7,0,0,0,1
${DEFAULT_STYLE}
Style: Poster,${FONT},96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,10,0,8,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  // 포스터 인트로가 있으면 고정 제목은 인트로가 끝난 뒤에 나타난다 (겹침 방지)
  const titleStart = t.introPoster ? Math.min(POSTER_SECONDS, totalDuration) : 0;
  const lines: string[] = t.layers.flatMap((l) => layerLines(l, d, end, titleStart));

  const c = t.caption;
  cues.forEach((cue, i) => {
    const color = c.alternateColors?.length ? c.alternateColors[i % c.alternateColors.length] : c.color;
    const size = fitSize(cue.text, Math.round(c.size * (d.captionScale ?? 1)), c.maxWidth);
    const tags = `{\\pos(${c.x},${c.y})\\an${c.align}${styleTags({ ...c, color }, size)}${motion ? popTags(i) : ''}}`;
    const body = motion ? emphasize(esc(cue.text), assColor(emphasisColor(color)), assColor(color)) : esc(cue.text);
    lines.push(`Dialogue: 3,${t2(cue.start)},${t2(cue.end)},${c.box ? 'CaptionBox' : 'Caption'},,0,0,0,,${tags}${body}`);
  });

  if (t.introPoster && t.posterStyle) {
    lines.push(...v1CoverLines(t.posterStyle, d.title, t.posterColors?.[1] ?? '#ffe14d', Math.min(POSTER_SECONDS, totalDuration), d.firstSentence, t.posterVariant, { videoBottom: t.video.y + t.video.h, bottomFill: !!t.posterBottomFill, zoom: !!t.posterZoom }));
  } else if (t.introPoster) {
    const [c1, c2] = t.posterColors ?? ['#ffffff', '#ffe500'];
    const pe = t2(Math.min(POSTER_SECONDS, totalDuration));
    const [l1, l2] = d.title;
    const style = (color: string, text: string) => styleTags({ size: 104, color, bold: true, outline: 10, outlineColor: '#000000' }, fitSize(text, 104, 1000));
    // 영상 영역 위쪽에 큰 2줄 제목 (풀스크린이면 화면 상단 부근)
    const y1 = t.video.y + Math.min(330, Math.round(t.video.h * 0.22));
    lines.push(`Dialogue: 5,${t2(0)},${pe},Poster,,0,0,0,,{\\an5\\pos(540,${y1})${style(c1, l1)}\\fad(0,200)}${esc(l1)}`);
    if (l2.trim()) lines.push(`Dialogue: 5,${t2(0)},${pe},Poster,,0,0,0,,{\\an5\\pos(540,${y1 + 140})${style(c2, l2)}\\fad(0,200)}${esc(l2)}`);
  }
  if (motion) {
    lines.push(
      ...beatCalloutMotionLines(motion.beats, totalDuration, c.y, motion.preset === 'clean', t.video, motion.lang),
      ...((motion.preset ?? 'full') === 'full' ? extraMotionLines(motion.beats, motion.seed, t.video) : []),
    );
  }
  const ass = header + lines.join('\n') + '\n';
  // 고른 글꼴로 스타일·인라인 글꼴을 모두 바꾼다 (withLangFont 와 같은 방식)
  return d.font ? ass.replace(/,Pretendard,/g, `,${d.font},`).replace(/\\fnPretendard/g, `\\fn${d.font}`) : ass;
}

/** 흰 글자면 노랑, 노랑·어두운 글자(흰 배경 템플릿)면 빨강으로 강조 */
export function emphasisColor(hex: string): string {
  const h = hex.replace('#', '').toLowerCase();
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  const yellowish = r > 200 && g > 180 && b < 120;
  const dark = 0.299 * r + 0.587 * g + 0.114 * b < 140;
  return yellowish || dark ? '#FF3B30' : '#FFE500';
}

/**
 * v1 스토리쇼핑 표지 (StoryChannelFrame StoryCoverOverlay 와 같은 모양, 1080 기준 px).
 * top: 상단 0~605px 어두운 띠에 흰 줄 + 강조색 줄(검은 테두리), 바로 아래 흰 줄에 제목 전체.
 * band: 화면 전체 검정, 가운데 흰 띠에 검은 글씨 두 줄.
 */
/** 제목이 한 줄뿐이면 가운데에 가까운 띄어쓰기에서 두 줄로 나눈다 (표지 글자를 크게 쓰기 위해) */
export function splitCoverTitle(title: [string, string]): [string, string] {
  const a = title[0].trim();
  const b = title[1].trim();
  if (b || a.replace(/\s/g, '').length <= 7) return [a, b];
  const spaces = [...a.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (!spaces.length) return [a, ''];
  const mid = a.length / 2;
  const cut = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), spaces[0]);
  return [a.slice(0, cut).trim(), a.slice(cut + 1).trim()];
}

function v1CoverLines(style: 'top' | 'band', rawTitle: [string, string], accent0: string, seconds: number, firstSentence?: string, variantId?: string, opts?: { videoBottom?: number; bottomFill?: boolean; zoom?: boolean }): string[] {
  const cv = coverVariant(variantId);
  const accent = cv.accent ?? accent0;
  const title = splitCoverTitle(rawTitle);
  const s0 = t2(0);
  const s1 = t2(seconds);
  const [a, b] = title.map((x) => x.trim()) as [string, string];
  const top = b ? a : '';
  const acc = b || a;
  const full = [a, b].filter(Boolean).join(' ');
  if (!full) return [];
  // 흰 줄에는 대본 첫 문장 (없으면 제목)
  const strip = firstSentence?.trim() || full;
  const rect = (x: number, y: number, w: number, h: number, color: string, alpha = 0) =>
    `Dialogue: 6,${s0},${s1},Layer,,0,0,0,,{\\an7\\pos(${x},${y})\\bord0\\shad0\\1c${assColor(color)}\\1a&H${Math.round(alpha * 255).toString(16).padStart(2, '0')}&\\p1}m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}{\\p0}`;
  const text = (x: number, y: number, str: string, st: TextStyle, size: number, extra = '') =>
    `Dialogue: 7,${s0},${s1},Layer,,0,0,0,,{\\an5\\pos(${x},${y})${styleTags(st, size)}${extra}}${esc(str)}`;
  // 표지 동안 첫 문장 줄이 100% → 118% 로 천천히 커짐
  const zoomTag = opts?.zoom ? `\\fscx100\\fscy100\\t(0,${Math.round(seconds * 1000)},\\fscx118\\fscy118)` : '';
  const bottomY = opts?.videoBottom ?? 1920;
  if (style === 'band') {
    const size = Math.min(...[top, acc].filter(Boolean).map((l) => fitSize(l, 96, 940)));
    const lines2 = [top, acc].filter(Boolean);
    const lh = Math.round(size * 1.3);
    const bandH = lh * lines2.length + 84;
    const y0 = 960 - bandH / 2;
    return [
      rect(0, 0, 1080, 1920, '#000000'),
      rect(0, y0, 1080, bandH, '#ffffff'),
      ...lines2.map((l, i) => text(540, y0 + 42 + lh * i + lh / 2, l, { size, color: '#000000', bold: true }, size)),
    ];
  }
  // 한 줄 최대 140px, 띠 너비 1000px 안에 맞춤
  const size = Math.min(140, ...[top, acc].filter(Boolean).map((l) => fitSize(l, 140, 1000)));
  const outline = Math.max(5, Math.round(size * 0.07));
  const lh = Math.round(size * 1.18);
  const lines2 = [top, acc].filter(Boolean);
  const bandH = 605;
  const yStart = bandH / 2 - (lh * (lines2.length - 1)) / 2;
  const titleSize = fitSize(strip, 56, 980);
  const stripH = Math.round(titleSize * 1.3) + 70;
  return [
    rect(0, 0, 1080, bandH / 2, cv.band[0], cv.bandAlpha ?? 0),
    rect(0, bandH / 2, 1080, bandH / 2, cv.band[1], cv.bandAlpha ?? 0),
    ...(cv.rule ? [rect(60, bandH - 26, 960, 6, cv.rule)] : []),
    rect(0, bandH, 1080, stripH, cv.strip),
    // 아래 채우기: 첫 문장 줄 바로 아래부터 화면 끝까지 (사진 포함) 위 띠와 같은 색·투명도로 덮는다
    ...(opts?.bottomFill ? [rect(0, bandH + stripH, 1080, 1920 - bandH - stripH, cv.band[1], cv.bandAlpha ?? 0)] : []),
    ...(cv.stripRule ? [rect(0, bandH + stripH - 8, 1080, 8, cv.stripRule)] : []),
    ...lines2.map((l, i) => text(540, yStart + lh * i, l, { size, color: l === acc ? accent : cv.topText ?? '#ffffff', bold: true, outline: cv.outline === false ? 0 : outline, outlineColor: '#000000' }, size)),
    text(540, bandH + stripH / 2, strip, { size: titleSize, color: cv.stripText, bold: true }, titleSize, zoomTag),
  ];
}
