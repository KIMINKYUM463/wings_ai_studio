'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ProjectWorkspace from '@/components/wings-shopping-v2/ProjectWorkspace';
import { templatePreviewUrl } from '@/components/wings-shopping-v2/SsulPanel';
import { frameUrl, mediaUrl, proxied } from '@/lib/wings-shopping-v2/client';
import { projectTemplateId } from '@/lib/wings-shopping-v2/templates/catalog';
import type { Project, Stage } from '@/lib/wings-shopping-v2/types';
import '../../remix-studio.css';

/** 화면 순서 (ProjectWorkspace 단계 번호: 0 분석 · 1 수집 · 2 선택 · 3 대본 · 5 템플릿 · 4 자동편집) */
const FLOW = [
  { ws: 0, name: 'AI 영상 분석', jobs: ['analyze'] },
  { ws: 1, name: '같은 상품 영상 찾기', jobs: ['search'] },
  { ws: 2, name: '영상 선택', jobs: ['sources'] },
  { ws: 3, name: 'AI 대본·음성', jobs: ['script', 'tts'] },
  { ws: 5, name: '영상 템플릿', jobs: [] },
  { ws: 4, name: 'AI 자동편집', jobs: ['clean', 'render'] },
] as const satisfies readonly { ws: number; name: string; jobs: readonly Stage[] }[];

/** 리믹스 ver2 스튜디오: 위쪽 필름 스트립이 단계마다 실제 결과(장면·대본·템플릿)로 채워진다 */
export default function RemixShoppingV2ProjectPage({ params }: { params: { id: string } }) {
  const [step, setStep] = useState<number | null>(null);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const [available, setAvailable] = useState<boolean[] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const onProject = useCallback((p: Project) => setProject(p), []);
  const onAvailable = useCallback((a: boolean[]) => setAvailable(a), []);

  // 처음 열면 열 수 있는 마지막 단계로
  useEffect(() => {
    if (step !== null || !available) return;
    let last = 0;
    FLOW.forEach((f, i) => { if (available[f.ws]) last = i; });
    setStep(FLOW[last]!.ws);
  }, [available, step]);

  const order = FLOW.findIndex((f) => f.ws === step);
  const go = (ws: number) => {
    const to = FLOW.findIndex((f) => f.ws === ws);
    setDir(to >= order ? 'next' : 'back');
    setStep(ws);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runningJob = project ? (Object.values(project.jobs).find((j) => j?.state === 'running') ?? null) : null;

  return (
    <div className="light-keep wings-shopping-v2 remix-atelier min-h-screen">
      {/* 머리 */}
      <header className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-5 gap-y-2 px-5 pb-4 pt-6 md:px-8">
        <Link href="/WingsAIStudioShotForm/remix-shopping-v2" className="text-sm font-semibold text-muted hover:text-text">← 리믹스 스튜디오</Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold tracking-[-0.02em] text-text" title={project?.name}>{project?.name ?? '불러오는 중...'}</h1>
        <p className="flex items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-text backdrop-blur" aria-live="polite">
          {runningJob ? <><span className="ra-rec" aria-hidden /> {runningJob.message ?? '작업 중'}</> : <><span className="h-2 w-2 rounded-full bg-[#22c55e]" aria-hidden /> 바뀐 내용은 바로 저장돼요</>}
        </p>
      </header>

      {/* 필름 스트립 */}
      <nav aria-label="리믹스 단계" className="mx-auto max-w-[1360px] px-5 md:px-8">
        <div className={`ra-strip light ${runningJob ? 'ra-running' : ''}`}>
          <span className="ra-holes top" aria-hidden />
          <span className="ra-holes bottom" aria-hidden />
          <ol className="grid grid-cols-3 gap-2.5 py-2 md:grid-cols-6">
            {FLOW.map((f, i) => {
              const open = !!available?.[f.ws];
              const active = f.ws === step;
              const done = open && i < order;
              const job = project ? f.jobs.map((s) => project.jobs[s]).find((j) => j?.state === 'running') : undefined;
              return (
                <li key={f.ws}>
                  <button type="button" disabled={!open} onClick={() => go(f.ws)} aria-current={active ? 'step' : undefined}
                    data-active={active} data-locked={!open}
                    className="ra-frame block w-full overflow-hidden rounded-xl bg-[#f3f4f8] text-left ring-1 ring-[#e3e6ec] disabled:cursor-not-allowed">
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      {project && <FrameArt index={i} project={project} name={f.name} />}
                      <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-[11px] font-bold tabular-nums text-white backdrop-blur">{i + 1}</span>
                      {job && <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white"><span className="ra-rec" aria-hidden /> 진행 중</span>}
                      {!job && done && <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#0e1016]">완료</span>}
                    </div>
                    <p className={`truncate px-3 py-2.5 text-[13px] font-bold ${active ? 'text-[var(--amber)]' : open ? 'text-text' : 'text-muted'}`}>{f.name}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <main className="mx-auto max-w-[1360px] px-5 pb-16 pt-6 md:px-8">
        <div key={step ?? -1} className="ra-advance" data-dir={dir}>
          <ProjectWorkspace
            projectId={params.id}
            embedded
            step={step ?? 0}
            onStepChange={(s) => go(s)}
            onAvailableChange={onAvailable}
            onProject={onProject}
            separateTemplateStep
            hideFlowPanel
            exportEditor
            analyzeNextLabel="같은 상품 영상 찾기"
          />
        </div>
      </main>
    </div>
  );
}

/** 필름 칸 그림: 단계마다 지금까지 만든 것 (레퍼런스 장면 · 찾은 영상 · 고른 장면 · 첫 문장 · 템플릿 · 완성) */
function FrameArt({ index, project: p, name }: { index: number; project: Project; name: string }) {
  const clips = p.clips.filter((c) => !c.excluded);
  const refClip = p.clips.find((c) => c.sourceId === p.referenceSourceId) ?? p.clips[0];
  const Blank = () => <BlankArt index={index} name={name} />;
  const img = (src?: string) => (src ? <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <Blank />);
  switch (index) {
    case 0: {
      if (refClip) return img(frameUrl(p.id, refClip.id));
      // 장면을 나누기 전에는 받아 둔 참고 영상 첫 장면을 보여 준다
      const ref = p.sources.find((s) => s.id === p.referenceSourceId) ?? (p.analysis ? { file: 'sources/ref.mp4' } : undefined);
      return ref?.file ? <video src={`${mediaUrl(p.id, ref.file)}#t=0.8`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" /> : <Blank />;
    }
    case 1: {
      const thumbs = (p.searchResults ?? []).map((r) => proxied(r.thumbnail)).filter(Boolean).slice(0, 3) as string[];
      return thumbs.length ? <Mosaic srcs={thumbs} /> : <Blank />;
    }
    case 2: return clips.length ? <Mosaic srcs={clips.slice(0, 3).map((c) => frameUrl(p.id, c.id))} /> : <Blank />;
    case 3: {
      const line = p.script?.beats[0]?.text.split('\n')[0];
      return line ? (
        <div className="absolute inset-0 flex items-center bg-gradient-to-br from-[#1f2340] to-[#2f3beb] px-3">
          <p className="line-clamp-3 text-[13px] font-bold leading-snug text-white">“{line}”</p>
        </div>
      ) : <Blank />;
    }
    case 4: {
      const id = projectTemplateId(p);
      return p.clips.length && id ? <img src={templatePreviewUrl(p, id, false)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" /> : <Blank />;
    }
    default:
      return p.output && !p.output.stale ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#0e1016] to-[#2f3beb]"><span className="text-sm font-bold text-white">▶ 완성 영상</span></div>
      ) : <Blank />;
  }
}

function Mosaic({ srcs }: { srcs: string[] }) {
  return (
    <div className="absolute inset-0 grid gap-px bg-black" style={{ gridTemplateColumns: `repeat(${srcs.length}, minmax(0,1fr))` }}>
      {srcs.map((s, i) => <img key={i} src={s} alt="" loading="lazy" className="h-full w-full object-cover" />)}
    </div>
  );
}

const STEP_ICON = ['🔎', '🌐', '🎞️', '✍️', '🎨', '🎬'];
/** 아직 결과가 없는 칸: 무엇을 할 단계인지 아이콘으로 */
function BlankArt({ index, name }: { index: number; name: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-white to-[#eceef5]" title={name}>
      <span className="text-[52px] leading-none drop-shadow-sm" aria-hidden>{STEP_ICON[index]}</span>
    </div>
  );
}
