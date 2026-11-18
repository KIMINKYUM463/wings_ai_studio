'use client';
import { useRef, useState } from 'react';
import { frameUrl, mediaUrl, patchProject, proxied, startStage } from '@/lib/wings-shopping-v2/client';
import type { Clip, Project, Source } from '@/lib/wings-shopping-v2/types';
import { PLATFORM_COLOR, PLATFORM_LABEL } from './ui';
import type { StepProps } from './types';

const MOSAIC_MODES = [
  { id: 'v2', name: '모자이크', sub: '글자 자리를 모자이크로 가려요', tag: '빠름' },
  { id: 'sttn', name: '자연스럽게 지우기', sub: '주변 화면으로 글자 자리를 채워요 (이 PC의 GPU)', tag: '무료' },
  { id: 'vmake', name: '유료 모자이크 지우기', sub: 'AI가 글자를 깔끔하게 지워요', tag: '유료' },
] as const;

/** 영상 선택: 담은 영상을 장면으로 나누고, 쓸 장면만 남긴다 */
export default function SourcesStep({ project, setProject, refresh, goNext }: StepProps) {
  const job = project.jobs.sources;
  const running = job?.state === 'running';
  const visible = project.sources.filter((s) => s.id !== project.referenceSourceId || project.selected.includes(project.referenceUrl));
  const kept = project.clips.filter((c) => !c.excluded);
  const keptSec = kept.reduce((a, c) => a + (c.end - c.start), 0);
  const mosaicMode: 'v2' | 'vmake' | 'sttn' = project.mosaicMode ?? (project.mosaic === false ? 'vmake' : 'v2');
  const process = async () => { await startStage(project.id, 'sources').catch(() => undefined); refresh(); };
  const toggleClip = async (c: Clip) => setProject(await patchProject(project.id, { clipExcluded: { clipId: c.id, excluded: !c.excluded } }));
  const nothingYet = !project.clips.length && !running;
  // 큰 글자(제목·자막 띠 등)가 박힌 장면: 지우기·모자이크로도 티가 나기 쉬워서 한 번에 뺄 수 있게
  const bigText = kept.filter((c) => textLevel(c) === 'big');
  const [dropping, setDropping] = useState(false);
  const dropBigText = async () => {
    setDropping(true);
    let last: Project | null = null;
    for (const c of bigText) last = await patchProject(project.id, { clipExcluded: { clipId: c.id, excluded: true } });
    if (last) setProject(last);
    setDropping(false);
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-panel">
      <style>{`
        @keyframes vs-shimmer { from { background-position: -300px 0; } to { background-position: 300px 0; } }
        @keyframes vs-cut { 0%, 100% { transform: scaleY(.2); opacity: .4; } 50% { transform: scaleY(1); opacity: 1; } }
        .vs-shimmer { background: linear-gradient(90deg,#eceef4 0,#f7f8fb 50%,#eceef4 100%); background-size: 600px 100%; animation: vs-shimmer 1.4s linear infinite; }
        .vs-cut { animation: vs-cut 1s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) { .vs-shimmer, .vs-cut { animation: none !important; } }
      `}</style>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-6 md:px-8">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">영상 선택</h2>
          <p className="mt-1 text-sm text-muted">담은 영상을 장면으로 나눠요. 쓰고 싶지 않은 장면은 눌러서 빼고, 마우스를 올리면 장면이 재생돼요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <UploadButton projectId={project.id} onDone={refresh} label="＋ 영상 파일 추가" />
          {!nothingYet && <button className="btn btn-ghost" disabled={running} onClick={process}>{running ? '처리 중...' : '바뀐 영상 다시 처리'}</button>}
        </div>
      </header>

      <div className="space-y-6 px-6 py-6 md:px-8">
        {/* 원본 자막·워터마크 처리 */}
        <div>
          <p className="mb-2.5 text-sm font-bold text-text">원본 영상의 글자·워터마크는</p>
          <div role="radiogroup" aria-label="원본 자막·워터마크 처리 방식" className="grid gap-2.5 sm:grid-cols-3">
            {MOSAIC_MODES.map((m) => {
              const on = mosaicMode === m.id;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on}
                  onClick={async () => { if (!on) setProject(await patchProject(project.id, { mosaicMode: m.id })); }}
                  className={`rounded-2xl border-2 p-4 text-left transition ${on ? 'border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_6%,white)] shadow-[0_14px_30px_-18px_rgba(47,59,235,0.6)]' : 'border-line hover:border-[color-mix(in_srgb,var(--amber)_35%,var(--line))]'}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[15px] font-bold text-text">
                      <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${on ? 'border-[var(--amber)]' : 'border-[#cfd3de]'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber)]" />}</span>
                      {m.name}
                    </span>
                    <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{m.tag}</span>
                  </span>
                  <span className="mt-1.5 block pl-7 text-xs leading-relaxed text-muted">{m.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {nothingYet ? (
          /* 아직 장면을 안 나눔 */
          <div className="grid place-items-center rounded-3xl border border-dashed border-line bg-gradient-to-b from-white to-panel-2/50 px-6 py-12 text-center">
            <div className="flex -space-x-3" aria-hidden>
              {project.selected.slice(0, 5).map((u) => {
                const t = proxied(project.searchResults?.find((r) => r.url === u)?.thumbnail);
                return t ? <img key={u} src={t} alt="" className="h-20 w-12 rounded-xl object-cover ring-4 ring-white" /> : <span key={u} className="h-20 w-12 rounded-xl bg-panel-2 ring-4 ring-white" />;
              })}
            </div>
            <p className="mt-5 text-xl font-bold text-text">담은 영상 {project.selected.length}개를 장면으로 나눌게요</p>
            <p className="mt-1 text-sm text-muted">영상을 내려받고 장면이 바뀌는 곳마다 잘라요. 영상 하나에 보통 20~40초 걸려요.</p>
            <button className="btn btn-primary mt-6 !px-8 !py-3.5 text-base" onClick={process} disabled={!visible.length && !project.selected.length}>영상 내려받고 장면 나누기</button>
            {job?.state === 'error' && <p className="mt-3 text-sm text-danger">{job.message}</p>}
          </div>
        ) : (
          <>
            {running && (
              <div className="rounded-2xl bg-gradient-to-r from-[#f3f4ff] to-white p-4 ring-1 ring-line" aria-live="polite">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 items-center gap-[3px]" aria-hidden>
                    {[0, 1, 2, 3, 4].map((i) => <span key={i} className="vs-cut h-full w-[3px] rounded-full bg-[var(--amber)]" style={{ animationDelay: `${i * 0.12}s` }} />)}
                  </span>
                  <p className="text-sm font-semibold text-text">{job?.message ?? '영상을 처리하는 중'}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e6e8f0]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#2f3beb] to-[#20c5ff] transition-[width] duration-700" style={{ width: `${Math.round((job?.progress ?? 0.05) * 100)}%` }} />
                </div>
              </div>
            )}
            {job?.state === 'error' && <p className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">{job.message}</p>}

            {bigText.length > 0 && !running && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ffd8b8] bg-[#fff6ee] px-4 py-3">
                <span className="rounded-md bg-[#ff7a1a] px-2 py-0.5 text-xs font-bold text-white">큰 글자</span>
                <p className="min-w-0 flex-1 text-sm text-text">
                  큰 중국어 글씨가 박힌 장면이 <b>{bigText.length}개</b> 있어요. 지우기·모자이크를 해도 티가 날 수 있어서 빼는 걸 추천해요.
                </p>
                <button type="button" className="btn btn-primary !py-2 text-sm" disabled={dropping} onClick={dropBigText}>
                  {dropping ? '빼는 중...' : `큰 글자 장면 ${bigText.length}개 빼기`}
                </button>
              </div>
            )}

            {visible.map((s) => (
              <SourceBlock key={s.id} project={project} source={s} mosaic={mosaicMode === 'v2'} clips={project.clips.filter((c) => c.sourceId === s.id)}
                onToggle={toggleClip} onUploaded={refresh}
                onFlip={async (c) => setProject(await patchProject(project.id, { clipFlip: { clipId: c.id, flip: !c.flip } }))} />
            ))}
          </>
        )}
      </div>

      {/* 아래 고정: 쓸 장면 요약 */}
      <footer className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-line bg-white/90 px-6 py-4 backdrop-blur md:px-8">
        <p className="text-sm text-text">
          쓸 장면 <b className="tabular-nums text-[var(--amber)]">{kept.length}</b><span className="text-muted"> / {project.clips.length}</span>
          {kept.length > 0 && <span className="ml-2 text-muted">· 약 {Math.round(keptSec)}초 분량</span>}
        </p>
        <span className="flex-1" />
        <button className="btn btn-primary" disabled={!kept.length || running} onClick={goNext}>
          {kept.length ? `장면 ${kept.length}개로 대본 쓰기 →` : '장면을 먼저 나눠 주세요'}
        </button>
      </footer>
    </section>
  );
}

function Thumb({ project, source, className }: { project: Project; source: Source; className: string }) {
  const first = project.clips.find((c) => c.sourceId === source.id);
  const thumb = first ? frameUrl(project.id, first.id) : proxied(project.searchResults?.find((r) => r.url === source.url)?.thumbnail);
  return thumb
    ? <img src={thumb} alt="" className={`object-cover ${className}`} />
    : <span className={`grid place-items-center bg-panel-2 ${className}`}><span className="h-3 w-3 rounded-full" style={{ background: PLATFORM_COLOR[source.platform ?? 'other'] ?? '#8a93b5' }} /></span>;
}

function SourceBlock({ project, source, mosaic, clips, onToggle, onUploaded, onFlip }: {
  project: Project; source: Source; mosaic: boolean; clips: Clip[]; onToggle: (c: Clip) => void; onUploaded: () => void; onFlip: (c: Clip) => void;
}) {
  const kept = clips.filter((c) => !c.excluded).length;
  const pf = source.platform ?? 'other';
  return (
    <section className="rounded-2xl border border-line p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Thumb project={project} source={source} className="h-14 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORM_COLOR[pf] ?? '#8a93b5' }} />{PLATFORM_LABEL[pf] ?? pf}
          </p>
          <h3 className="truncate text-[15px] font-bold text-text">{source.title || source.url || '올린 영상'}</h3>
        </div>
        {source.status === 'ready' && <span className="rounded-full bg-[color-mix(in_srgb,var(--amber)_10%,white)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--amber)]">장면 {kept}/{clips.length} 사용</span>}
        {source.status === 'pending' && <span className="rounded-full bg-panel-2 px-3 py-1 text-xs font-semibold text-muted">대기 중</span>}
      </div>

      {(source.status === 'needsUpload' || source.status === 'error') && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm">
          <span className="flex-1 text-text">{source.error ?? '이 영상은 받지 못했어요'} — 원본을 직접 받아 파일로 올려 주세요.</span>
          {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold underline">원본 열기</a>}
          <UploadButton projectId={project.id} sourceId={source.id} onDone={onUploaded} label="파일 올리기" />
        </div>
      )}

      {source.status === 'pending' && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {[...Array(7)].map((_, i) => <li key={i} className="vs-shimmer aspect-[9/16] rounded-xl" />)}
        </ul>
      )}

      {clips.length > 0 && source.file && (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {clips.map((c) => <ClipCard key={c.id} clip={c} projectId={project.id} mosaic={mosaic} file={source.file!} flip={!!c.flip} onToggle={() => onToggle(c)} onFlip={() => onFlip(c)} />)}
        </ul>
      )}
    </section>
  );
}

function ClipCard({ clip, projectId, mosaic, file, flip, onToggle, onFlip }: { clip: Clip; projectId: string; mosaic: boolean; file: string; flip?: boolean; onToggle: () => void; onFlip: () => void }) {
  const [hover, setHover] = useState(false);
  const out = !!clip.excluded;
  return (
    <li>
      <button onClick={onToggle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-pressed={!out} title={clip.description}
        className={`group relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-[#0e1016] transition duration-300 ${out ? 'opacity-40 grayscale' : 'ring-2 ring-[var(--amber)] hover:-translate-y-0.5 hover:shadow-lg'}`}>
        {hover && !out ? (
          <video src={`${mediaUrl(projectId, file)}#t=${clip.start},${clip.end}`} autoPlay muted playsInline className="h-full w-full object-cover" style={flip ? { transform: 'scaleX(-1)' } : undefined}
            onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= clip.end) e.currentTarget.currentTime = clip.start; }} />
        ) : (
          <img src={frameUrl(projectId, clip.id)} alt={clip.description} loading="lazy" className="h-full w-full object-cover" style={flip ? { transform: 'scaleX(-1)' } : undefined} />
        )}
        {mosaic && !hover && !out && (clip.textBoxes ?? []).map(([y0, x0, y1, x1], k) => (
          <span key={k} aria-hidden className="absolute bg-[repeating-conic-gradient(#0008_0_25%,#fff3_0_50%)] bg-[length:8px_8px] ring-1 ring-white/60"
            style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }} />
        ))}
        <span className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-xs font-bold shadow ${out ? 'bg-white/90 text-[#0e1016]' : 'bg-[var(--amber)] text-white'}`}>{out ? '✕' : '✓'}</span>
        {(clip.textBoxes?.length ?? 0) > 0 && !out && (
          <span className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white ${textLevel(clip) === 'big' ? 'bg-[#ff7a1a]' : 'bg-black/65'}`}>{textLevel(clip) === 'big' ? '큰 글자' : mosaic ? '모자이크' : '글자 지움'}</span>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{(clip.end - clip.start).toFixed(1)}s</span>
        {out && <span className="absolute inset-0 grid place-items-center"><span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">뺀 장면</span></span>}
      </button>
      <div className="mt-1.5 flex items-start gap-1.5">
        <p className={`line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug ${out ? 'text-[#b4b8c4] line-through' : 'text-muted'}`}>{clip.description.replace(/^\[.+?\]\s*/, '')}</p>
        {!out && <FlipButton compact on={!!flip} onClick={onFlip} />}
      </div>
    </li>
  );
}

/** 좌우반전 토글: 켜면 이 장면이 미리보기·완성 영상에서 뒤집혀 나온다 */
export function FlipButton({ on, onClick, compact }: { on: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-pressed={on} title={on ? '좌우반전 끄기' : '이 장면 좌우반전'}
      className={`flex items-center gap-1.5 rounded-full font-semibold transition ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'} ${on ? 'bg-[var(--amber)] text-white' : 'border border-line text-muted hover:text-text'}`}>
      <span aria-hidden>⇋</span>{compact ? (on ? '반전' : '반전') : on ? '좌우반전 켜짐' : '좌우반전'}
    </button>
  );
}

export function UploadButton({ projectId, sourceId, onDone, label }: { projectId: string; sourceId?: string; onDone: () => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', f);
    if (sourceId) fd.append('sourceId', sourceId);
    const res = await fetch(`/api/wings-shopping-v2/projects/${projectId}/upload`, { method: 'POST', body: fd });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? '업로드 실패');
    else await startStage(projectId, 'sources').catch(() => {});
    setBusy(false);
    e.target.value = '';
    onDone();
  }
  return (
    <>
      <input ref={input} type="file" accept="video/*" hidden onChange={onChange} />
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? '올리는 중...' : label}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </>
  );
}

/** 장면에 박힌 글자 크기: 글자 상자 높이가 화면의 9.5% 이상이면 큰 글자 (textBoxes 는 0~1000 [ymin,xmin,ymax,xmax]) */
export function textLevel(c: Clip): 'none' | 'small' | 'big' {
  const boxes = c.textBoxes ?? [];
  if (!boxes.length) return 'none';
  return boxes.some(([y0, , y1]) => (y1 ?? 0) - (y0 ?? 0) >= 95) ? 'big' : 'small';
}
