import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getProject, updateProject } from '@/lib/wings-shopping-v2/store';
import { ensureVmakeMasterPath, markStale, runAnalyze, withLiveJobs } from '@/lib/wings-shopping-v2/pipeline';
import { err, type Ctx } from '@/lib/wings-shopping-v2/api';
import { wrapLine } from '@/lib/wings-shopping-v2/ai/schemas';
import type { Beat, FxSettings, PlatformCopy, PlatformCopyEntry, PublishSettings, ReviewInfo, SsulSettings, TravelInfo } from '@/lib/wings-shopping-v2/types';
import { isStoryMode } from '@/lib/wings-shopping-v2/types';
import { AFFILIATES } from '@/lib/wings-shopping-v2/publish/disclosure';
import { getLang } from '@/lib/wings-shopping-v2/i18n/languages';
import { fxSettings, mergeFx } from '@/lib/wings-shopping-v2/audio/settings';
import { modeDefaults } from '@/lib/wings-shopping-v2/ssul/settings';
import { SSUL_FONTS } from '@/lib/wings-shopping-v2/templates/fonts';
import { COVER_VARIANTS } from '@/lib/wings-shopping-v2/templates/cover-variants';
import { getRemixTemplate, getTemplate } from '@/lib/wings-shopping-v2/templates/catalog';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    let p = await getProject(id);
    if (!p.vmakeCleanedAt) {
      const master = await ensureVmakeMasterPath(id);
      if (master) {
        p = await updateProject(id, (x) => {
          if (!x.vmakeCleanedAt) x.vmakeCleanedAt = Date.now();
        });
      }
    }
    return NextResponse.json(withLiveJobs(p));
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
}

type Patch = {
  selected?: string[];
  headcopy?: [string, string];
  beats?: { id?: string; text: string; clipId: string | null; role?: string; item?: string }[];
  voice?: { voiceId: string; speed: number };
  clipExcluded?: { clipId: string; excluded: boolean };
  clipFlip?: { clipId: string; flip: boolean };
  retryAnalyze?: boolean;
  mosaic?: boolean;
  mosaicMode?: 'v2' | 'vmake' | 'sttn';
  remixTemplateId?: string;
  scriptTemplateId?: string;
  customVoice?: { voiceId: string; style: string; speed: number };
  targetSeconds?: number;
  comment?: string;
  fx?: Partial<FxSettings>;
  publish?: Partial<Omit<PublishSettings, 'pack'>>;
  ssul?: Partial<SsulSettings>;
  travelInfo?: Partial<TravelInfo>;
  reviewInfo?: Partial<ReviewInfo>;
  platformCopy?: Partial<Record<'youtube' | 'instagram' | 'tiktok', Partial<PlatformCopyEntry>>>;
  searchQueries?: Partial<Record<'youtube' | 'tiktok' | 'instagram' | 'douyin' | 'xiaohongshu', unknown>>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Patch;
  let p;
  try {
    p = await updateProject(id, (x) => {
      if (body.selected) x.selected = [...new Set(body.selected)];
      if (typeof body.mosaic === 'boolean') {
        x.mosaic = body.mosaic;
        x.mosaicMode = body.mosaic ? 'v2' : 'vmake';
      }
      if (body.mosaicMode === 'v2' || body.mosaicMode === 'vmake' || body.mosaicMode === 'sttn') {
        x.mosaicMode = body.mosaicMode;
        x.mosaic = body.mosaicMode === 'v2';
        if (x.output) x.output.stale = true;
      }
      if (typeof body.remixTemplateId === 'string' && body.remixTemplateId.trim()) {
        x.remixTemplateId = getRemixTemplate(body.remixTemplateId.trim()).id;
        if (x.output) x.output.stale = true;
      }
      if (typeof body.scriptTemplateId === 'string' && body.scriptTemplateId.trim()) {
        x.scriptTemplateId = body.scriptTemplateId.trim();
      }
      if (body.customVoice && typeof body.customVoice === 'object') {
        const speed = Math.min(1.5, Math.max(0.7, Number(body.customVoice.speed) || 1.1));
        const voiceId = typeof body.customVoice.voiceId === 'string' ? body.customVoice.voiceId.trim() : '';
        const style = typeof body.customVoice.style === 'string' ? body.customVoice.style : '';
        x.customVoice = { voiceId, style, speed };
        if (voiceId) x.voice = { voiceId, speed };
      }
      if (body.publish && typeof body.publish === 'object') {
        const n = body.publish;
        const cur = x.publish ?? { affiliate: 'none' };
        x.publish = {
          ...cur,
          ...(typeof n.affiliate === 'string' && AFFILIATES.some((a) => a.id === n.affiliate) ? { affiliate: n.affiliate } : {}),
          ...(typeof n.link === 'string' ? { link: n.link.trim().slice(0, 300) } : {}),
          ...(typeof n.bannerText === 'string' ? { bannerText: n.bannerText.slice(0, 40) } : {}),
          ...(typeof n.onScreen === 'boolean' ? { onScreen: n.onScreen } : {}),
        };
        if (x.output) x.output.stale = true;
      }
      if (body.fx && typeof body.fx === 'object') {
        x.fx = mergeFx(fxSettings(x), body.fx);
        if (x.output) x.output.stale = true;
      }
      if (body.travelInfo && x.mode === 'travel') {
        const cur = x.travelInfo ?? { productType: '' };
        const n = body.travelInfo;
        const clip = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : undefined);
        x.travelInfo = { ...cur, ...Object.fromEntries(Object.entries({
          productType: clip(n.productType, 20), productName: clip(n.productName), location: clip(n.location, 40),
          price: clip(n.price, 40), period: clip(n.period, 40), howToBuy: clip(n.howToBuy, 60),
          firsthand: typeof n.firsthand === 'boolean' ? n.firsthand : undefined,
        }).filter(([, v]) => v !== undefined)) } as TravelInfo;
        if (x.output) x.output.stale = true;
      }
      if (body.reviewInfo && x.mode === 'review') {
        const n = body.reviewInfo;
        x.reviewInfo = {
          items: typeof n.items === 'string' ? n.items.slice(0, 1500) : x.reviewInfo?.items ?? '',
          basis: typeof n.basis === 'string' ? n.basis.trim().slice(0, 100) || undefined : x.reviewInfo?.basis,
          firsthand: typeof n.firsthand === 'boolean' ? n.firsthand : x.reviewInfo?.firsthand,
        };
        if (x.output) x.output.stale = true;
      }
      if (body.ssul && isStoryMode(x.mode)) {
        const cur = x.ssul ?? (({ voice: _v, ...rest }) => rest)(modeDefaults(x.mode));
        const n = body.ssul;
        x.ssul = {
          ...cur,
          ...(typeof n.structureId === 'string' ? { structureId: n.structureId } : {}),
          ...(typeof n.angleId === 'string' ? { angleId: n.angleId } : {}),
          ...(typeof n.toneId === 'string' ? { toneId: n.toneId } : {}),
          ...(typeof n.ctaType === 'string' ? { ctaType: n.ctaType } : {}),
          ...(typeof n.ctaKeyword === 'string' ? { ctaKeyword: n.ctaKeyword.trim().slice(0, 20) } : {}),
          ...(typeof n.templateId === 'string' ? { templateId: getTemplate(n.templateId).id } : {}),
          ...(typeof n.channelName === 'string' ? { channelName: n.channelName.slice(0, 20) } : {}),
          ...(typeof n.introPoster === 'boolean' ? { introPoster: n.introPoster } : {}),
          ...(n.videoFit === 'default' || n.videoFit === 'square' || n.videoFit === 'fill' ? { videoFit: n.videoFit } : {}),
          ...(typeof n.coverVariant === 'string' && COVER_VARIANTS.some((v) => v.id === n.coverVariant) ? { coverVariant: n.coverVariant } : {}),
          ...(typeof n.coverBottomFill === 'boolean' ? { coverBottomFill: n.coverBottomFill } : {}),
          ...(typeof n.coverZoom === 'boolean' ? { coverZoom: n.coverZoom } : {}),
          ...(typeof n.font === 'string' && SSUL_FONTS.some((f) => f.id === n.font) ? { font: n.font } : {}),
          ...(typeof n.titleScale === 'number' && Number.isFinite(n.titleScale) ? { titleScale: Math.min(2, Math.max(0.6, n.titleScale)) } : {}),
          ...(typeof n.channelScale === 'number' && Number.isFinite(n.channelScale) ? { channelScale: Math.min(2, Math.max(0.6, n.channelScale)) } : {}),
        };
        if (x.output) x.output.stale = true;
      }
      // 같은 상품 영상 검색어 고치기 (플랫폼마다 최대 8개, 40자)
      if (body.searchQueries && typeof body.searchQueries === 'object' && x.analysis) {
        const clean = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string').map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 8) : undefined);
        const cur = x.analysis.searchQueries;
        for (const k of ['youtube', 'tiktok', 'instagram', 'douyin', 'xiaohongshu'] as const) {
          const next = clean(body.searchQueries[k]);
          if (next) cur[k] = next;
        }
      }
      if (typeof body.targetSeconds === 'number' && Number.isFinite(body.targetSeconds) && x.analysis) {
        const sec = Math.min(50, Math.max(20, Math.round(body.targetSeconds)));
        x.analysis.duration = sec;
        x.analysis.estimatedDurationSec = sec;
      }
      if (x.script && typeof body.comment === 'string') x.script.comment = body.comment.slice(0, 60);
      if (body.voice) x.voice = { voiceId: body.voice.voiceId, speed: Math.min(1.5, Math.max(0.7, Number(body.voice.speed) || 1)) };
      if (body.clipFlip && typeof body.clipFlip.flip === 'boolean') {
        const c = x.clips.find((y) => y.id === body.clipFlip!.clipId);
        if (c) { c.flip = body.clipFlip.flip; if (x.output) x.output.stale = true; }
      }
      if (body.clipExcluded) {
        const c = x.clips.find((y) => y.id === body.clipExcluded!.clipId);
        if (c) c.excluded = body.clipExcluded.excluded;
      }
      if (x.script && body.headcopy) x.script.headcopy = [body.headcopy[0] ?? '', body.headcopy[1] ?? ''];
      if (body.beats) {
        const old = new Map((x.script?.beats ?? []).map((b) => [b.id, b]));
        const beats: Beat[] = body.beats.map((b) => {
          const text = b.text.split('\n').flatMap((l) => wrapLine(l, getLang(x.lang)?.maxLine)).join('\n');
          const prev = b.id ? old.get(b.id) : undefined;
          return { id: prev?.id ?? nanoid(8), text, clipId: b.clipId, tts: prev?.tts, role: b.role ?? prev?.role, ...((b.item ?? prev?.item) ? { item: (b.item ?? prev?.item)!.slice(0, 40) } : {}) };
        });
        x.script = { ...(x.script ?? { headcopy: ['', ''] as [string, string] }), beats };
      }
      if (body.platformCopy && typeof body.platformCopy === 'object') {
        const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
        const next: PlatformCopy = { ...(x.platformCopy ?? {}), at: Date.now() };
        for (const k of ['youtube', 'instagram', 'tiktok'] as const) {
          const n = body.platformCopy[k];
          if (!n || typeof n !== 'object') continue;
          const cur = next[k] ?? { description: '', tags: '', comment: '' };
          next[k] = {
            ...(k === 'youtube' ? { title: str(n.title, 100) ?? cur.title ?? '' } : {}),
            description: str(n.description, 5000) ?? cur.description,
            tags: str(n.tags, 1000) ?? cur.tags,
            comment: str(n.comment, 500) ?? cur.comment,
          };
        }
        x.platformCopy = next;
      }
      // 업로드 문구만 바꿀 때는 완성본을 '다시 만들기 필요'로 만들지 않는다
      if (!body.platformCopy || Object.keys(body).length > 1) markStale(x);
    });
  } catch {
    return err('프로젝트를 찾을 수 없습니다', 404);
  }
  if (body.retryAnalyze) void runAnalyze(id);
  return NextResponse.json(withLiveJobs(p));
}
