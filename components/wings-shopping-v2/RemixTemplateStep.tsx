'use client';
import { useEffect, useMemo, useState } from 'react';
import { flipStyle, mediaUrl, patchProject } from '@/lib/wings-shopping-v2/client';
import { TemplateLiveFrame } from './TemplateLiveFrame';
import type { Project } from '@/lib/wings-shopping-v2/types';
import { DEFAULT_REMIX_TEMPLATE_ID, REMIX_TEMPLATES } from '@/lib/wings-shopping-v2/templates/catalog';
import { templatePreviewUrl } from './SsulPanel';
import type { StepProps } from './types';

/** 템플릿 분류 (시중 쇼핑 숏폼 화면 문법 기준) */
const GROUPS: { id: string; name: string; ids: string[] }[] = [
  { id: 'deal', name: '핫딜·가격', ids: ['remix-hotdeal-red', 'remix-m-hotdeal-tag', 'remix-m-countdown', 'remix-m-budget-red', 'remix-m-sale-bomb', 'remix-m-coupon', 'remix-m-cart-tag', 'remix-m-douyin-banner', 'remix-m-live', 'remix-m-receipt'] },
  { id: 'review', name: '리뷰·비교', ids: ['remix-m-rank-top', 'remix-m-review-stars', 'remix-m-before-after', 'remix-m-vs-compare', 'remix-m-beauty-pick', 'remix-m-living-check', 'remix-m-tech-spec', 'remix-m-unboxing', 'remix-m-wishlist'] },
  { id: 'scene', name: '화면 연출', ids: ['remix-m-breaking-news', 'remix-m-search-bar', 'remix-m-chat-bubble', 'remix-m-comment-reply', 'remix-m-question', 'remix-m-push-alert', 'remix-m-reels-ad', 'remix-m-caution-tape', 'remix-m-memo', 'remix-m-hook-strip'] },
  { id: 'mood', name: '감성 스타일', ids: ['remix-cinema-dark', 'remix-magazine-white', 'remix-cozy-beige', 'remix-mint-board', 'remix-neon-purple', 'remix-m-minimal-white', 'remix-m-neon-night', 'remix-m-pastel-cute', 'remix-m-luxury-gold', 'remix-m-magazine-cover', 'remix-m-polaroid', 'remix-m-sticker-full', 'remix-m-dual-band'] },
];

/** 리믹스 영상 템플릿 고르기: 왼쪽 큰 미리보기 + 오른쪽 템플릿 목록 (프로젝트 장면·제목으로 그림) */
export default function RemixTemplateStep({ project, setProject, goNext }: StepProps) {
  const current = project.remixTemplateId || DEFAULT_REMIX_TEMPLATE_ID;
  const [hover, setHover] = useState<string | null>(null);
  const [group, setGroup] = useState('all');
  const grouped = new Set(GROUPS.flatMap((g) => g.ids));
  const list = group === 'all' ? REMIX_TEMPLATES
    : group === 'basic' ? REMIX_TEMPLATES.filter((t) => !grouped.has(t.id))
    : REMIX_TEMPLATES.filter((t) => GROUPS.find((g) => g.id === group)?.ids.includes(t.id));
  const shown = hover ?? current;
  // 템플릿 그림은 서버에서 처음 그릴 때 1~2초 걸린다 → 단계 들어오자마자 전부 미리 받아 둬서 고르는 즉시 보이게
  const previewKey = templatePreviewUrl(project, '');
  useEffect(() => {
    let alive = true;
    const urls = [current, ...REMIX_TEMPLATES.map((t) => t.id)].flatMap((id) => {
      const u = `${templatePreviewUrl(project, id, false)}&caption=0`;
      return [u, `${u}&layer=1`];
    });
    const keep: HTMLImageElement[] = [];
    const worker = async () => {
      while (alive && urls.length) {
        const img = new Image();
        keep.push(img);
        await new Promise<void>((done) => { img.onload = img.onerror = () => done(); img.src = urls.shift()!; });
      }
    };
    for (let n = 0; n < 4; n++) void worker();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);
  const tpl = REMIX_TEMPLATES.find((t) => t.id === shown) ?? REMIX_TEMPLATES[0]!;
  const pick = async (id: string) => {
    setProject({ ...project, remixTemplateId: id });
    setProject(await patchProject(project.id, { remixTemplateId: id }));
  };

  return (
    <section className="grid gap-8 rounded-[28px] border border-line bg-panel p-6 md:p-8 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="light-keep relative flex flex-col items-center gap-4 overflow-hidden rounded-[24px] bg-[radial-gradient(120%_70%_at_50%_0%,#e4e7ff_0%,#f1f2fb_55%,#f7f8fc_100%)] px-5 pb-6 pt-7 ring-1 ring-[#2f3beb]/10 shadow-[0_24px_50px_-30px_rgba(47,59,235,0.35)] lg:sticky lg:top-[max(1.5rem,calc(50vh-370px))] lg:self-start">
        <TemplateMontage project={project} templateId={shown} />
        <div className="w-full max-w-[280px] text-center">
          <p className="text-base font-bold text-text">{tpl.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{tpl.description}</p>
        </div>
        <button type="button" className="btn btn-primary w-full max-w-[280px]" onClick={goNext}>AI 자동편집으로</button>
      </div>

      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-text">영상 템플릿</h2>
        <p className="mt-1 text-sm text-muted">시중 쇼핑 숏폼 화면을 분석해 만든 {REMIX_TEMPLATES.length}가지예요. 고른 디자인이 모든 장면에 들어가고, 마우스를 올리면 왼쪽에서 크게 보여요.</p>
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="템플릿 분류">
          {[{ id: 'all', name: '전체' }, ...GROUPS, { id: 'basic', name: '기본' }].map((g) => {
            const n = g.id === 'all' ? REMIX_TEMPLATES.length : g.id === 'basic' ? REMIX_TEMPLATES.filter((t) => !grouped.has(t.id)).length : REMIX_TEMPLATES.filter((t) => (g as { ids: string[] }).ids.includes(t.id)).length;
            if (!n) return null;
            return (
              <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${group === g.id ? 'bg-[var(--text)] text-white' : 'border border-line text-muted hover:text-text'}`}>
                {g.name} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {list.map((t) => {
            const on = t.id === current;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => void pick(t.id)} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(t.id)} onBlur={() => setHover(null)} aria-pressed={on}
                  className={`group relative block w-full overflow-hidden rounded-2xl bg-black text-left transition duration-300 ${on ? '-translate-y-1 ring-[5px] ring-[var(--amber)] shadow-[0_22px_44px_-16px_rgba(47,59,235,0.75)]' : 'ring-1 ring-line hover:-translate-y-1 hover:shadow-xl'}`}>
                  <img src={templatePreviewUrl(project, t.id, false)} alt="" loading="lazy" className="aspect-[9/16] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  {on && (
                    <>
                      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[var(--amber)]/15" />
                      <span className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-[var(--amber)] text-base font-bold text-white shadow-lg ring-2 ring-white">✓</span>
                      <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-[var(--amber)] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg">사용 중</span>
                    </>
                  )}
                </button>
                <p className={`mt-2.5 truncate text-sm ${on ? 'font-bold text-[var(--amber)]' : 'text-muted'}`}>{t.name}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * 템플릿 미리보기: 고른(마우스 올린) 템플릿을 입힌 채 장면들이 빠르게 반복 재생되고 자막이 넘어간다.
 * 자막 지운 영상이 있으면 그것을, 없으면 쓰는 장면을 1.6배속으로 차례로 보여 준다.
 */
function TemplateMontage({ project, templateId }: { project: Project; templateId: string }) {
  const view = useMemo(() => ({ ...project, remixTemplateId: templateId }), [project, templateId]);
  const clips = useMemo(() => project.clips.filter((c) => !c.excluded).slice(0, 8), [project.clips]);
  const lines = useMemo(() => (project.script?.beats ?? []).map((b) => b.text.split('\n')[0]?.trim() ?? '').filter(Boolean), [project.script]);
  const [i, setI] = useState(0);
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((n) => n + 1), 1300); return () => clearInterval(t); }, []);
  const clean = project.cleanFresh && project.clean ? `${mediaUrl(project.id, 'clean/video.mp4')}?v=${project.clean.at}` : null;
  const clip = clips.length ? clips[i % clips.length]! : null;
  const file = clip ? project.sources.find((s) => s.id === clip.sourceId)?.file : undefined;
  return (
    <div className="w-full max-w-[280px] rounded-[2.4rem] bg-[#16181d] px-2.5 pb-3 pt-2.5 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.55)]">
      <div className="mb-2 flex justify-center" aria-hidden><span className="h-[18px] w-24 rounded-full bg-black" /></div>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.8rem] bg-black">
        <TemplateLiveFrame project={view} overlay={lines.length ? <TemplateLiveFrame.Caption text={lines[k % lines.length]!} /> : null}>
          {clean ? (
            <video src={clean} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover"
              onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 1.6; }} />
          ) : clip && file ? (
            <video key={clip.id} src={`${mediaUrl(project.id, file)}#t=${clip.start},${clip.end}`} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover"
              style={flipStyle(clip)}
              onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 1.6; }}
              onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= clip.end - 0.05) setI((n) => n + 1); }}
              onEnded={() => setI((n) => n + 1)} />
          ) : null}
        </TemplateLiveFrame>
      </div>
      <div className="mt-2.5 flex justify-center" aria-hidden><span className="h-1 w-24 rounded-full bg-white/40" /></div>
    </div>
  );
}
