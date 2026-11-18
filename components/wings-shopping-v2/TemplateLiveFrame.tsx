'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { SSUL_FONTS } from '@/lib/wings-shopping-v2/templates/fonts';
import { loadSsulOptions, templatePreviewUrl } from './SsulPanel';
import { emphasisColor, splitCoverTitle } from '@/lib/wings-shopping-v2/templates/ass';
import { EMPHASIS_WORD_HEX, emphasisParts } from '@/lib/wings-shopping-v2/motion/ass';
import { fxSettings } from '@/lib/wings-shopping-v2/audio/settings';
import { applyVideoFit } from '@/lib/wings-shopping-v2/templates/video-fit';
import { coverVariant } from '@/lib/wings-shopping-v2/templates/cover-variants';
import { projectTemplateId } from '@/lib/wings-shopping-v2/templates/catalog';
import { adLabel } from '@/lib/wings-shopping-v2/publish/disclosure';

type Layout = {
  video?: { x: number; y: number; w: number; h: number };
  caption?: { x: number; y: number; align: number; maxWidth: number; size: number; color: string; outline?: number; outlineColor?: string; bold?: boolean; box?: { color: string; alpha?: number; pad?: number } };
  canvas?: string;
  introPoster?: boolean;
  posterStyle?: 'top' | 'band';
  posterColors?: [string, string];
};

/** 렌더(ass.ts)와 같은 첫 화면 표지 길이·글자 맞춤 */
export const POSTER_SECONDS = 1.8;
function fitSize(text: string, size: number, maxWidth: number): number {
  const units = [...text].reduce((a, c) => a + (/s/.test(c) ? 0.35 : /[ -~]/.test(c) ? 0.55 : 0.98), 0);
  if (units * size <= maxWidth) return size;
  return Math.max(36, Math.floor(maxWidth / units));
}

const W = 1080;
const H = 1920;
const LayoutCtx = createContext<{ layout: Layout | null; fontFamily: string; emph: boolean }>({ layout: null, fontFamily: '', emph: false });
const pctX = (v: number) => `${(v / W) * 100}%`;

/** 미리보기 겹침 요소가 템플릿 안 영상 영역(1080×1920 좌표)을 알 수 있게 */
export function useLiveVideoRect() {
  return useContext(LayoutCtx).layout?.video ?? { x: 0, y: 0, w: W, h: H };
}
const pctY = (v: number) => `${(v / H) * 100}%`;

function useTemplateLayout(project: Project): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null);
  const templateId = projectTemplateId(project);
  const videoFit = project.ssul?.videoFit;
  useEffect(() => {
    if (!templateId) { setLayout(null); return; }
    let alive = true;
    loadSsulOptions(project.mode ?? 'ssul')
      .then((o) => {
        if (!alive) return;
        const found = o.templates.find((t) => t.id === templateId) as Layout | undefined;
        setLayout(found?.video ? applyVideoFit(found as Layout & { video: NonNullable<Layout['video']> }, videoFit) : found ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [templateId, project.mode, videoFit]);
  return layout;
}

/**
 * 편집기 실시간 미리보기를 고른 템플릿 그대로 보여준다:
 * 템플릿 틀(채널 바·제목, 자막 없이 그린 그림) 위에 장면 영상을 템플릿의 영상 자리에 끼운다.
 * 자식으로 받은 <video>/<img> 는 영상 자리 안에 들어간다. 템플릿을 못 불러오면 화면 전체에 그린다.
 */
export function TemplateLiveFrame({ project, children, overlay, showPoster, posterT = 0 }: { project: Project; children: ReactNode; overlay?: ReactNode; showPoster?: boolean; posterT?: number }) {
  const layout = useTemplateLayout(project);
  const font = SSUL_FONTS.find((f) => f.id === project.ssul?.font);
  const fontFamily = font ? `ssul-live-${font.id}` : '';
  const v = layout?.video;
  return (
    <LayoutCtx.Provider value={{ layout, fontFamily, emph: fxSettings(project).motion }}>
      {font && <style>{`@font-face { font-family: '${fontFamily}'; src: url('/fonts/${font.file}'); font-display: swap; }`}</style>}
      <div className="absolute inset-0 [container-type:inline-size]" style={{ background: layout?.canvas ?? '#000' }}>
        {layout && projectTemplateId(project) && (
          <img src={`${templatePreviewUrl(project, projectTemplateId(project)!, false)}&caption=0`} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute overflow-hidden" style={v ? { left: pctX(v.x), top: pctY(v.y), width: pctX(v.w), height: pctY(v.h) } : { inset: 0 }}>
          {children}
        </div>
        {/* 영상 위에 겹치는 템플릿 요소 (풀스크린 템플릿의 제목 카드 등) */}
        {layout && projectTemplateId(project) && (
          <img key={projectTemplateId(project)} src={`${templatePreviewUrl(project, projectTemplateId(project)!, false)}&caption=0&layer=1`} alt="" aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        )}
        {overlay}
        {project.publish?.onScreen !== false && (
          <span className="pointer-events-none absolute right-[3%] top-[2%] font-extrabold leading-none text-white [text-shadow:0_0_3px_#000,0_0_3px_#000,0_1px_0_#000]" style={{ fontSize: `${(40 / W) * 100}cqw` }}>
            [{adLabel(project.publish?.affiliate ?? 'none', project.lang)}]
          </span>
        )}
        {showPoster && (project.ssul?.introPoster || layout?.introPoster) && (
          <PosterOverlay layout={layout} title={project.script?.headcopy ?? ['', '']} firstSentence={project.script?.beats[0]?.text} fontFamily={fontFamily}
            variantId={project.ssul?.coverVariant} bottomFill={!!project.ssul?.coverBottomFill} zoom={!!project.ssul?.coverZoom} t={posterT} />
        )}
      </div>
    </LayoutCtx.Provider>
  );
}

/** 템플릿의 자막 위치·크기·색·테두리·글꼴로 자막을 그린다 (ASS 정렬 번호: 7 8 9 / 4 5 6 / 1 2 3) */
function Caption({ text }: { text: string }) {
  const { layout, fontFamily, emph } = useContext(LayoutCtx);
  const c = layout?.caption;
  const lines = text.split('\n').filter(Boolean);
  // 렌더와 같은 규칙으로 숫자·핵심 단어 색 강조 (모션그래픽 켜짐일 때)
  const base = c?.color ?? '#ffffff';
  const light = /^#?f{6}$/i.test(base);
  const paint = (l: string) => (emph ? emphasisParts(l).map((p, k) => (
    p.kind === 'num' ? <span key={k} style={{ color: emphasisColor(base) }}>{p.text}</span>
      : p.kind === 'word' && light ? <span key={k} style={{ color: EMPHASIS_WORD_HEX }}>{p.text}</span>
        : p.text
  )) : l);
  if (!c) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[22%] px-4 text-center text-[15px] font-bold leading-snug text-white [text-shadow:0_0_4px_#000,0_0_4px_#000,0_2px_0_#000]">
        {lines.map((l, i) => <p key={i}>{paint(l)}</p>)}
      </div>
    );
  }
  const col = (c.align - 1) % 3; // 0 왼쪽 1 가운데 2 오른쪽
  const row = Math.floor((c.align - 1) / 3); // 0 아래 1 가운데 2 위
  const tx = col === 0 ? '0' : col === 1 ? '-50%' : '-100%';
  const ty = row === 0 ? '-100%' : row === 1 ? '-50%' : '0';
  const unit = (px: number) => `${(px / W) * 100}cqw`;
  const outline = c.outline ? unit(c.outline) : '';
  return (
    <div
      className="pointer-events-none absolute leading-tight"
      style={{
        left: pctX(c.x),
        top: pctY(c.y),
        maxWidth: pctX(c.maxWidth),
        width: 'max-content',
        transform: `translate(${tx}, ${ty})`,
        textAlign: col === 0 ? 'left' : col === 1 ? 'center' : 'right',
        fontSize: unit(c.size),
        fontWeight: c.bold === false ? 500 : 800,
        color: c.color,
        fontFamily: fontFamily ? `'${fontFamily}', Pretendard, sans-serif` : 'Pretendard, sans-serif',
        WebkitTextStroke: outline ? `${outline} ${c.outlineColor ?? '#000'}` : undefined,
        paintOrder: 'stroke fill',
        background: c.box ? c.box.color : undefined,
        padding: c.box ? unit(c.box.pad ?? 14) : undefined,
      }}
    >
      {lines.map((l, i) => <p key={i}>{paint(l)}</p>)}
    </div>
  );
}

/** 첫 2초 표지: ass.ts v1CoverLines / 기본 포스터와 같은 모양 */
function PosterOverlay({ layout, title, firstSentence, fontFamily, variantId, bottomFill, zoom, t = 0 }: {
  layout: Layout | null; title: [string, string]; firstSentence?: string; fontFamily: string; variantId?: string; bottomFill?: boolean; zoom?: boolean; t?: number;
}) {
  const cv = coverVariant(variantId);
  const style = variantId ? 'top' : layout?.posterStyle;
  const [a, b] = splitCoverTitle([title[0] ?? '', title[1] ?? '']);
  const full = [a, b].filter(Boolean).join(' ');
  if (!full) return null;
  const top = b ? a : '';
  const acc = b || a;
  const accent = cv.accent ?? layout?.posterColors?.[1] ?? '#ffe14d';
  const unit = (px: number) => `${(px / W) * 100}cqw`;
  const family = fontFamily ? `'${fontFamily}', Pretendard, sans-serif` : 'Pretendard, sans-serif';
  const lines = [top, acc].filter(Boolean);
  if (style === 'band') {
    const size = Math.min(...lines.map((l) => fitSize(l, 96, 940)));
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center bg-black">
        <div className="w-full bg-white text-center font-extrabold text-black" style={{ padding: `${unit(42)} 0`, fontSize: unit(size), lineHeight: 1.3, fontFamily: family }}>
          {lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </div>
    );
  }
  if (style === 'top') {
    const strip = (firstSentence ?? '').replace(/\s*\n\s*/g, ' ').trim() || full;
    const size = Math.min(140, ...lines.map((l) => fitSize(l, 140, 1000)));
    const titleSize = fitSize(strip, 56, 980);
    const stroke = `${unit(Math.max(5, Math.round(size * 0.07)))} #000`;
    const bandOpacity = 1 - (cv.bandAlpha ?? 0);
    return (
      <>
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          <div className="relative flex flex-col items-center justify-center text-center font-extrabold" style={{ width: '100%', aspectRatio: `${W} / 605`, fontFamily: family }}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg,${cv.band[0]} 0%,${cv.band[1]} 100%)`, opacity: bandOpacity }} />
            {cv.rule && <div className="absolute" style={{ left: pctX(60), right: pctX(60), bottom: unit(20), height: unit(6), background: cv.rule }} />}
            {lines.map((l, i) => (
              <p key={i} className="relative" style={{ fontSize: unit(size), lineHeight: 1.18, color: l === acc ? accent : cv.topText ?? '#fff', WebkitTextStroke: cv.outline === false ? undefined : stroke, paintOrder: 'stroke fill' }}>{l}</p>
            ))}
          </div>
          <div className="text-center font-extrabold" style={{ background: cv.strip, color: cv.stripText, fontSize: unit(titleSize), padding: `${unit(35)} ${unit(60)}`, fontFamily: family, borderBottom: cv.stripRule ? `${unit(8)} solid ${cv.stripRule}` : undefined }}>
            {/* 줌인은 재생 시각에 맞춰: 0초 100% → 표지 끝 118% (렌더와 같은 값) */}
            <span className="inline-block" style={zoom ? { transform: `scale(${1 + 0.18 * Math.min(1, Math.max(0, t / POSTER_SECONDS))})` } : undefined}>{strip}</span>
          </div>
          {bottomFill && <div className="flex-1" style={{ background: cv.band[1], opacity: bandOpacity }} />}
        </div>
      </>
    );
  }
  // 기본 포스터: 영상 위쪽에 큰 두 줄 제목 (흰색 + 노랑)
  const v = layout?.video ?? { x: 0, y: 0, w: W, h: H };
  const y1 = v.y + Math.min(330, Math.round(v.h * 0.22));
  const [c1, c2] = layout?.posterColors ?? ['#ffffff', '#ffe500'];
  return (
    <div className="pointer-events-none absolute inset-x-0 text-center font-extrabold" style={{ top: pctY(y1), transform: 'translateY(-50%)', fontFamily: family }}>
      {[a, b].filter(Boolean).map((l, i) => (
        <p key={i} style={{ fontSize: unit(fitSize(l, 104, 1000)), lineHeight: 1.3, color: i ? c2 : c1, WebkitTextStroke: `${unit(10)} #000`, paintOrder: 'stroke fill' }}>{l}</p>
      ))}
    </div>
  );
}

TemplateLiveFrame.Caption = Caption;
