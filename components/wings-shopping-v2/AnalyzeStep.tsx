'use client';
import { useEffect, useRef, useState } from 'react';
import { patchProject, mediaUrl } from '@/lib/wings-shopping-v2/client';
import { JobLine, Panel } from './ui';
import type { StepProps } from './types';
import { extractYoutubeVideoId } from '@/lib/youtube-thumbnail';
import SaveStructureButton from './SaveStructureButton';
import AnalyzeLoading from './AnalyzeLoading';
import { PhoneShell } from './StudioBits';

const SCENE_COLORS = ['#2f3beb', '#6d5cff', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

function SectionLabel({ n, text }: { n: number; text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-text">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--amber)] text-[11px] text-white">{n}</span>
      {text}
    </p>
  );
}

export default function AnalyzeStep({ project, setProject, goNext, nextLabel }: StepProps & { nextLabel?: string }) {
  const a = project.analysis;
  const job = project.jobs.analyze;
  const ref = project.sources.find((s) => s.id === project.referenceSourceId);
  // 영상 파일을 아직 안 받은 경우(스토리 핸드오프) 벤치마킹 YouTube 주소로 플레이어를 띄운다
  const ytId = !ref?.file && project.referenceUrl ? extractYoutubeVideoId(project.referenceUrl) : null;
  const hasVideo = !!ref?.file || !!ytId;

  // 키워드에 섞여 오는 가격·상품명 반복은 따로 빼거나 숨긴다
  const priceKeyword = a?.keywords.find((k) => /가격/.test(k));
  const price = priceKeyword?.replace(/^가격\s*정보\s*:\s*/, '');
  const keywords = (a?.keywords ?? []).filter((k) => k !== priceKeyword && !a?.productName.includes(k));
  // 본문 구조가 "A → B → C" 형태면 순서 흐름으로 보여준다
  const bodyFlow = (a?.structure.body ?? '').split(/\s*(?:→|->)\s*/).filter(Boolean);

  // 벤치마킹 영상 재생 위치 → 장면 구성에서 지금 구간 강조 (장면을 누르면 그 구간으로 이동)
  const videoRef = useRef<HTMLVideoElement>(null);
  const [vt, setVt] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { if (videoRef.current) setVt(videoRef.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const scenes = a?.scenes ?? [];
  const sceneEnd = Math.max(0.1, scenes[scenes.length - 1]?.end ?? 0.1);
  const curScene = scenes.findIndex((x) => vt >= x.start && vt < x.end);
  const live = playing || vt > 0;
  const seekTo = (t: number) => { const v = videoRef.current; if (!v) return; v.currentTime = t + 0.01; setVt(t); void v.play().catch(() => undefined); };
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (playing && curScene >= 0) itemRefs.current[curScene]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [curScene, playing]);

  return (
    <Panel
      title="레퍼런스 분석"
      actions={
        <>
          {job?.state === 'error' && (
            <button className="btn btn-ghost" onClick={async () => setProject(await patchProject(project.id, { retryAnalyze: true }))}>
              다시 분석
            </button>
          )}
          <button className="btn btn-primary" disabled={!a} onClick={goNext}>{nextLabel ?? '같은 상품 영상 찾기'}</button>
        </>
      }
    >
      {job?.state === 'running' && !a ? (
        <AnalyzeLoading project={project} progress={job.progress} message={job.message} />
      ) : (
        <JobLine job={job} />
      )}
      {job?.state === 'error' && /Gemini API 키|GEMINI_API_KEY/.test(job.message ?? '') && (
        <a href="/WingsAIStudioShotForm?settings=open" className="mt-2 inline-flex text-sm font-medium text-amber underline">
          설정에서 Gemini 키 입력
        </a>
      )}
      {a && (
        <div className={`grid gap-6 ${hasVideo ? 'lg:grid-cols-[minmax(0,1fr)_260px]' : ''}`}>
          <div className="min-w-0 space-y-5">
            {/* 1. 상품 */}
            <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
              <SectionLabel n={1} text="어떤 상품인가" />
              <h3 className="mt-3 text-2xl font-bold leading-snug tracking-[-0.02em] text-balance break-keep text-text">{a.productName}</h3>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-panel-2 px-3 py-1 font-medium text-text">{a.category}</span>
                {price && <span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_12%,white)] px-3 py-1 font-semibold text-amber">{price}</span>}
                <span className="rounded-full bg-panel-2 px-3 py-1 tabular-nums text-muted">영상 {a.duration.toFixed(1)}초</span>
                {a.scenes.length > 0 && <span className="rounded-full bg-panel-2 px-3 py-1 tabular-nums text-muted">장면 {a.scenes.length}개</span>}
              </div>
              {keywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
                  <span className="mr-1 text-xs font-semibold text-muted">검색 키워드</span>
                  {keywords.map((k) => <span key={k} className="rounded-md border border-line px-2 py-0.5 text-xs text-text">#{k}</span>)}
                </div>
              )}
            </section>

            {/* 2. 흐름 */}
            <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
              <SectionLabel n={2} text="영상 흐름" />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {([
                  { k: '도입', sub: '첫 3초 훅', color: '#f59e0b', body: a.structure.hook },
                  { k: '본문', sub: '보여 주는 장면', color: '#3b82f6', body: null },
                  { k: '마무리', sub: '행동 유도', color: '#8b5cf6', body: a.structure.cta },
                ] as const).map((c, i) => (
                  <div key={c.k} className="relative overflow-hidden rounded-xl bg-panel-2/60 p-4 pt-5">
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                    <p className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-text">{i + 1}. {c.k}</span>
                      <span className="text-xs font-semibold" style={{ color: c.color }}>{c.sub}</span>
                    </p>
                    {c.body !== null ? (
                      <p className="mt-2 text-sm leading-relaxed text-text">{c.body}</p>
                    ) : bodyFlow.length > 1 ? (
                      <ol className="mt-2 space-y-1.5 text-sm text-text">
                        {bodyFlow.map((part, j) => (
                          <li key={j} className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: c.color }}>{j + 1}</span>{part}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-text">{a.structure.body}</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-panel-2/60 px-4 py-3 text-sm text-text">
                <span className="shrink-0 font-semibold text-muted">말투</span>{a.narrationTone}
              </p>
            </section>

            {/* 3. 장면 */}
            {a.scenes.length > 0 && (
              <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
                <SectionLabel n={3} text={`장면 구성 · ${a.scenes.length}컷`} />
                {/* 시간 막대: 장면마다 길이만큼 */}
                <div className="relative mt-4 flex h-10 overflow-hidden rounded-lg">
                  {a.scenes.map((s, i) => {
                    const on = i === curScene;
                    return (
                      <button key={i} type="button" title={`${s.start.toFixed(1)}–${s.end.toFixed(1)}초 · 눌러서 이 장면 보기`} onClick={() => seekTo(s.start)}
                        className="relative grid place-items-center border-r-2 border-white text-xs font-bold text-white transition-[opacity,filter] duration-300 last:border-r-0"
                        style={{ width: `${((s.end - s.start) / sceneEnd) * 100}%`, background: SCENE_COLORS[i % SCENE_COLORS.length], opacity: live && !on ? 0.35 : 1, filter: on ? 'saturate(1.2)' : undefined }}>
                        {/* 지금 장면 안에서 얼마나 지났는지 */}
                        {on && <span aria-hidden className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${((vt - s.start) / (s.end - s.start)) * 100}%` }} />}
                        <span className="relative">{i + 1}</span>
                      </button>
                    );
                  })}
                  {live && <span aria-hidden className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 rounded bg-[#0e1016] shadow-[0_0_0_2px_white]" style={{ left: `${Math.min(100, (vt / sceneEnd) * 100)}%` }} />}
                </div>
                <p className="mt-2 text-xs text-muted">영상을 재생하면 지금 장면이 강조돼요. 장면을 누르면 그 구간부터 재생해요.</p>
                <ol className="mt-4 space-y-2">
                  {a.scenes.map((s, i) => {
                    const m = s.description.match(/^\[(.+?)\]\s*/);
                    return (
                      <li key={i} ref={(el) => { itemRefs.current[i] = el; }} onClick={() => seekTo(s.start)}
                        className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl border px-3.5 py-3 transition duration-300 ${i === curScene ? 'scale-[1.01] border-transparent bg-white shadow-[0_14px_34px_-16px_rgba(47,59,235,0.55)]' : live ? 'border-line opacity-55 hover:opacity-100' : 'border-line hover:border-[color-mix(in_srgb,var(--amber)_40%,var(--line))]'}`}
                        style={i === curScene ? { boxShadow: `0 0 0 2px ${SCENE_COLORS[i % SCENE_COLORS.length]}, 0 14px 34px -16px rgba(47,59,235,0.55)` } : undefined}>
                        <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: SCENE_COLORS[i % SCENE_COLORS.length] }}>{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-md bg-panel-2 px-2 py-0.5 font-semibold tabular-nums text-text">{s.start.toFixed(1)}–{s.end.toFixed(1)}초</span>
                            {m && <span className="rounded-md border border-line px-2 py-0.5 text-muted">{m[1]}</span>}
                          </div>
                          {s.onScreenText && <p className="mt-1.5 text-[15px] font-semibold leading-snug text-text">“{s.onScreenText}”</p>}
                          <p className="mt-1 text-sm text-muted">{m ? s.description.slice(m[0].length) : s.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {hasVideo && (
              <figure>
                <PhoneShell className="max-w-[260px]">
                  <div className="aspect-[9/16] w-full overflow-hidden rounded-[1.8rem] bg-black">
                    {ref?.file ? (
                      <video ref={videoRef} src={mediaUrl(project.id, ref.file)} controls playsInline className="h-full w-full object-contain"
                        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                        onSeeked={(e) => setVt(e.currentTarget.currentTime)} />
                    ) : (
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title="벤치마킹 영상"
                        allow="encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    )}
                  </div>
                </PhoneShell>
                <figcaption className="mx-auto mt-3 flex max-w-[260px] items-center justify-between text-xs text-muted">
                  <span>벤치마킹 영상</span>
                  {project.referenceUrl && /^https?:\/\//.test(project.referenceUrl) && (
                    <a href={project.referenceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-text hover:underline">원본 열기</a>
                  )}
                </figcaption>
              </figure>
            )}
            <SaveStructureButton project={project} />
          </aside>
        </div>
      )}
    </Panel>
  );
}
