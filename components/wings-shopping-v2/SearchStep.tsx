'use client';
import { useState } from 'react';
import { patchProject, proxied, startStage } from '@/lib/wings-shopping-v2/client';
import { PLATFORM_COLOR, PLATFORM_LABEL } from './ui';
import type { StepProps } from './types';
import SearchRadar from './SearchRadar';
import SearchKeywords from './SearchKeywords';
import VideoPreviewModal from './VideoPreviewModal';

const TABS = ['all', 'youtube', 'tiktok', 'instagram', 'douyin', 'xiaohongshu'] as const;
const SEARCH_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'douyin', 'xiaohongshu'] as const;

function platformOf(url: string): string {
  if (/youtu\.?be/.test(url)) return 'youtube';
  if (/tiktok/.test(url)) return 'tiktok';
  if (/instagram/.test(url)) return 'instagram';
  if (/douyin/.test(url)) return 'douyin';
  if (/xiaohongshu|xhslink/.test(url)) return 'xiaohongshu';
  return 'other';
}

/** 같은 상품 영상 찾기: AI가 상품 이름으로 여러 플랫폼에서 찾고, 쓸 영상을 담는다 */
export default function SearchStep({ project, setProject, refresh, goNext }: StepProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [manual, setManual] = useState('');
  const [preview, setPreview] = useState<number | null>(null);
  const job = project.jobs.search;
  const running = job?.state === 'running';
  const results = project.searchResults ?? [];
  const shown = tab === 'all' ? results : results.filter((r) => r.platform === tab);
  const selected = new Set(project.selected);
  const queries = project.analysis?.searchQueries;
  const keywords = [...new Set([...(queries?.youtube ?? []), ...(queries?.tiktok ?? [])])].slice(0, 6);

  async function toggle(url: string) {
    const next = selected.has(url) ? project.selected.filter((u) => u !== url) : [...project.selected, url];
    setProject({ ...project, selected: next });
    setProject(await patchProject(project.id, { selected: next }));
  }
  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const url = manual.trim();
    if (!/^https?:\/\//.test(url)) return;
    setManual('');
    if (!selected.has(url)) setProject(await patchProject(project.id, { selected: [...project.selected, url] }));
  }
  const search = async () => { await startStage(project.id, 'search').catch(() => undefined); refresh(); };

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-panel">
      <style>{`
        @keyframes ss-pulse { 0%, 100% { transform: scale(1); opacity: .45; } 50% { transform: scale(1.18); opacity: 1; } }
        @keyframes ss-shimmer { from { background-position: -300px 0; } to { background-position: 300px 0; } }
        .ss-pulse { animation: ss-pulse 1.5s ease-in-out infinite; }
        .ss-shimmer { background: linear-gradient(90deg,#eceef4 0,#f7f8fb 50%,#eceef4 100%); background-size: 600px 100%; animation: ss-shimmer 1.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ss-pulse, .ss-shimmer { animation: none !important; } }
      `}</style>

      {/* 머리 */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-6 md:px-8">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">같은 상품 영상 찾기</h2>
          <p className="mt-1 text-sm text-muted">AI가 상품 이름으로 여러 플랫폼에서 같은 상품 영상을 찾아요. 쓸 영상을 눌러 담으세요.</p>
          {project.analysis && <SearchKeywords project={project} setProject={setProject} disabled={running} />}
        </div>
        {results.length > 0 && (
          <button className="btn btn-ghost" disabled={running} onClick={search}>{running ? '찾는 중...' : '다시 찾기'}</button>
        )}
      </header>

      <div className="px-6 py-6 md:px-8">
        {running ? (
          /* 찾는 중 */
          <SearchRadar keywords={keywords} message={job?.message} />
        ) : results.length === 0 ? (
          /* 아직 안 찾음 */
          <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-gradient-to-b from-white to-panel-2/50 px-6 py-14 text-center">
            <div className="flex -space-x-2" aria-hidden>
              {SEARCH_PLATFORMS.map((p) => <span key={p} className="h-8 w-8 rounded-full ring-4 ring-white" style={{ background: PLATFORM_COLOR[p] }} />)}
            </div>
            <p className="mt-5 text-xl font-bold text-text">유튜브·틱톡·인스타그램·더우인·샤오홍슈에서 찾아볼게요</p>
            <p className="mt-1 text-sm text-muted">보통 30초~1분 걸려요.</p>
            <button className="btn btn-primary mt-6 !px-8 !py-3.5 text-base" onClick={search}>AI로 같은 상품 영상 찾기</button>
            {job?.state === 'error' && <p className="mt-3 text-sm text-danger">{job.message}</p>}
          </div>
        ) : (
          <>
            {!!project.searchWarnings?.length && (
              <ul className="mb-4 flex flex-col gap-1 rounded-xl bg-[color-mix(in_srgb,var(--amber)_8%,white)] px-4 py-2.5 text-sm text-text" role="status">
                {project.searchWarnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="플랫폼">
              {TABS.map((t) => {
                const n = t === 'all' ? results.length : results.filter((r) => r.platform === t).length;
                if (t !== 'all' && !n) return null;
                return (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tab === t ? 'bg-[var(--text)] text-white' : 'border border-line text-muted hover:text-text'}`}>
                    {t !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[t] }} />}
                    {t === 'all' ? '전체' : PLATFORM_LABEL[t]} <span className="tabular-nums opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {shown.map((r, idx) => {
                const on = selected.has(r.url);
                return (
                  <li key={r.url} className="group/card relative">
                    {/* 가운데 ▶: 여기서 바로 재생 (카드의 나머지 부분은 담기) */}
                    <button type="button" onClick={() => setPreview(idx)} aria-label={`${r.title} 재생`}
                      className="absolute left-1/2 top-[38%] z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-[#0e1016] opacity-0 shadow-lg backdrop-blur transition group-hover/card:opacity-100 focus-visible:opacity-100 hover:scale-110 hover:bg-white">
                      ▶
                    </button>
                    <button onClick={() => toggle(r.url)} aria-pressed={on}
                      className={`group relative block w-full overflow-hidden rounded-2xl bg-[#0e1016] text-left transition duration-300 ${on ? '-translate-y-1 ring-[5px] ring-[var(--amber)] shadow-[0_22px_44px_-16px_rgba(47,59,235,0.75)]' : 'hover:-translate-y-1 hover:shadow-xl'}`}>
                      <div className="relative aspect-[9/16]">
                        {r.thumbnail
                          ? <img src={proxied(r.thumbnail)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                          : <span className="absolute inset-0 grid place-items-center text-sm text-white/50">미리보기 없음</span>}
                        {on && <span aria-hidden className="pointer-events-none absolute inset-0 bg-[var(--amber)]/25" />}
                        <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR[r.platform] }} />{PLATFORM_LABEL[r.platform]}
                        </span>
                        <span className={`absolute right-2.5 top-2.5 grid place-items-center rounded-full font-bold shadow-md ring-2 ring-white transition ${on ? 'h-10 w-10 bg-[var(--amber)] text-lg text-white' : 'h-8 w-8 bg-white/90 text-base text-[#0e1016] ring-transparent group-hover:bg-[var(--amber)] group-hover:text-white'}`}>
                          {on ? project.selected.indexOf(r.url) + 1 : '+'}
                        </span>
                        {on && (
                          <span className="absolute inset-x-0 top-[46%] mx-auto w-fit rounded-full bg-[var(--amber)] px-3.5 py-1.5 text-sm font-bold text-white shadow-lg">✓ 담음</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-10">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">{r.title}</p>
                          {r.author && <p className="mt-0.5 truncate text-[11px] text-white/60">{r.author}</p>}
                        </div>
                      </div>
                    </button>
                    <a href={r.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block px-1 text-xs text-muted underline-offset-2 hover:text-text hover:underline">원본 열기 ↗</a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {preview !== null && shown[preview] && (
        <VideoPreviewModal items={shown} index={preview} selected={selected.has(shown[preview]!.url)}
          onToggle={() => toggle(shown[preview]!.url)} onMove={setPreview} onClose={() => setPreview(null)} />
      )}

      {/* 담은 영상 바구니 */}
      <footer className="sticky bottom-0 border-t border-line bg-white/90 px-6 py-4 backdrop-blur md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-text">담은 영상 <span className="tabular-nums text-[var(--amber)]">{project.selected.length}</span></p>
          <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
            {project.selected.map((u) => {
              const r = results.find((x) => x.url === u);
              const pf = r?.platform ?? platformOf(u);
              return (
                <li key={u} className="relative shrink-0">
                  <div className="h-14 w-10 overflow-hidden rounded-lg bg-panel-2 ring-1 ring-line" title={r?.title ?? u}>
                    {r?.thumbnail ? <img src={proxied(r.thumbnail)} alt="" className="h-full w-full object-cover" />
                      : <span className="grid h-full w-full place-items-center"><span className="h-3 w-3 rounded-full" style={{ background: PLATFORM_COLOR[pf] ?? '#8a93b5' }} /></span>}
                  </div>
                  <button type="button" onClick={() => toggle(u)} aria-label="빼기"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#0e1016] text-[11px] text-white hover:bg-danger">×</button>
                </li>
              );
            })}
            {!project.selected.length && <li className="self-center text-sm text-muted">위에서 영상을 눌러 담아 주세요</li>}
          </ul>
          <form onSubmit={addManual} className="flex min-w-[16rem] flex-1 gap-2 sm:flex-none">
            <label htmlFor="manual" className="sr-only">영상 링크로 직접 담기</label>
            <input id="manual" className="field min-w-0 flex-1 !py-2 text-sm" placeholder="링크로 직접 담기" value={manual} onChange={(e) => setManual(e.target.value)} />
            <button className="btn btn-ghost !py-2" disabled={!manual.trim()}>담기</button>
          </form>
          <button className="btn btn-primary" disabled={project.selected.length === 0} onClick={goNext}>
            {project.selected.length ? `${project.selected.length}개로 영상 선택 →` : '영상을 담아 주세요'}
          </button>
        </div>
      </footer>
    </section>
  );
}
