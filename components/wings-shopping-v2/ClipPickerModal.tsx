'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, frameUrl, mediaUrl } from '@/lib/wings-shopping-v2/client';
import type { Clip, Source } from '@/lib/wings-shopping-v2/types';

const PLATFORM: Record<string, string> = { youtube: '유튜브', tiktok: '틱톡', instagram: '인스타그램', douyin: '더우인', xiaohongshu: '샤오홍슈' };
const len = (c: Clip) => c.end - c.start;

/**
 * 문장에 넣을 장면 고르기 팝업: 수집한 영상별로 장면을 묶어 보여 주고,
 * 마우스를 올리면 그 구간이 재생되며, 돋보기로 크게 볼 수 있다.
 */
export default function ClipPickerModal({ projectId, beatId, clips, sources, value, sentence, need, onPick, onClose }: {
  projectId: string; beatId?: string; clips: Clip[]; sources: Source[]; value?: string; sentence: string; need?: number;
  onPick: (clipId: string) => void; onClose: () => void;
}) {
  const [zoom, setZoom] = useState<Clip | null>(null);
  // AI 추천: 이 문장에 어울리는 장면 몇 개 (대본이 같으면 서버가 저장해 둔 결과를 바로 준다)
  const [recs, setRecs] = useState<{ clipId: string; reason: string }[] | null>(beatId ? null : []);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(!beatId);
  useEffect(() => {
    if (!beatId) return;
    let alive = true;
    api<{ recs: Record<string, { clipId: string; reason: string }[]> }>(`/api/wings-shopping-v2/projects/${projectId}/clip-recs`)
      .then((d) => { if (alive) setRecs((d.recs[beatId] ?? []).filter((r) => clips.some((c) => c.id === r.clipId))); })
      .catch((e) => { if (alive) { setRecErr(e instanceof Error ? e.message : String(e)); setRecs([]); setShowAll(true); } });
    return () => { alive = false; };
  }, [projectId, beatId, clips]);
  const clipById = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const fileOf = useMemo(() => new Map(sources.map((s) => [s.id, s.file])), [sources]);
  const groups = useMemo(() => sources
    .map((s) => ({ source: s, clips: clips.filter((c) => c.sourceId === s.id).sort((a, b) => a.start - b.start) }))
    .filter((g) => g.clips.length), [sources, clips]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(null); else onClose(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [zoom, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="장면 고르기" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-[min(96vw,68rem)] flex-col overflow-hidden rounded-2xl bg-white text-[#0f172a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 border-b border-[#eef1f6] px-6 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">장면 고르기</h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-[#475569]">“{sentence.replace(/\n/g, ' ')}”</p>
            <p className="mt-1 text-xs text-[#64748b]">
              {need ? <>이 문장 음성은 <b className="tabular-nums text-[#0f172a]">{need.toFixed(1)}초</b>예요. 장면 길이는 저마다 달라요 (오른쪽 아래 숫자). </> : null}
              마우스를 올리면 재생되고, 돋보기로 크게 볼 수 있어요.
            </p>
          </div>
          <button type="button" aria-label="닫기" className="rounded-full px-2 text-2xl leading-none text-[#94a3b8] hover:text-[#0f172a]" onClick={onClose}>×</button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {beatId && (
            <section>
              <h4 className="text-sm font-bold">이 문장에 어울리는 장면 <span className="ml-1 rounded bg-[#0f172a] px-1.5 py-0.5 text-[10px] font-semibold text-white">AI 추천</span></h4>
              {recs === null ? (
                <>
                  <p className="mt-1 text-xs text-[#64748b]">대본을 읽고 어울리는 장면을 고르는 중... (대본이 바뀌었을 때만 처음 한 번 걸려요)</p>
                  <ul className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((k) => <li key={k} className="aspect-[9/16] animate-pulse rounded-xl bg-[#eef1f6]" />)}
                  </ul>
                </>
              ) : recs.length ? (
                <ul className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {recs.map((r, i) => {
                    const c = clipById.get(r.clipId)!;
                    return (
                      <ClipTile key={c.id} clip={c} projectId={projectId} file={fileOf.get(c.sourceId)} flip={!!c.flip} on={c.id === value} need={need} rank={i + 1} reason={r.reason}
                        onPick={() => { onPick(c.id); onClose(); }} onZoom={() => setZoom(c)} />
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-[#64748b]">{recErr ? `추천을 불러오지 못했어요: ${recErr}` : '추천할 장면을 찾지 못했어요. 아래에서 직접 골라 주세요.'}</p>
              )}
            </section>
          )}
          {!beatId && <p className="text-xs text-[#64748b]">새로 추가한 문장은 저장하면 AI 추천을 볼 수 있어요.</p>}
          {beatId && (
            <button type="button" className="w-full rounded-xl border border-dashed border-[#cbd5e1] py-2.5 text-sm font-semibold text-[#475569] hover:border-[#94a3b8]"
              onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? '다른 장면 접기' : `다른 장면 모두 보기 (${clips.length}개)`}
            </button>
          )}
          {showAll && groups.map(({ source, clips: list }) => (
            <section key={source.id}>
              <h4 className="flex items-baseline gap-2 text-sm font-bold">
                <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-semibold text-[#475569]">{PLATFORM[source.platform ?? ''] ?? (source.platform || '영상')}</span>
                <span className="min-w-0 truncate">{source.title || '수집한 영상'}</span>
                <span className="ml-auto shrink-0 text-xs font-normal text-[#94a3b8]">장면 {list.length}개</span>
              </h4>
              <ul className="mt-2.5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
                {list.map((c) => (
                  <ClipTile key={c.id} clip={c} projectId={projectId} file={fileOf.get(c.sourceId)} flip={!!c.flip} on={c.id === value} need={need}
                    onPick={() => { onPick(c.id); onClose(); }} onZoom={() => setZoom(c)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4" onClick={(e) => { e.stopPropagation(); setZoom(null); }}>
          <div className="w-full max-w-[440px] rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              <p className="min-w-0 flex-1 text-sm">{zoom.description}<span className="ml-2 tabular-nums text-[#64748b]">{len(zoom).toFixed(1)}초</span></p>
              <button type="button" className="rounded-full px-2 text-xl leading-none text-[#94a3b8] hover:text-[#0f172a]" aria-label="크게 보기 닫기" onClick={() => setZoom(null)}>×</button>
            </div>
            {fileOf.get(zoom.sourceId) ? (
              <video src={`${mediaUrl(projectId, fileOf.get(zoom.sourceId)!)}#t=${zoom.start},${zoom.end}`} autoPlay muted playsInline controls
                className="mx-auto aspect-[9/16] max-h-[68vh] w-full rounded-xl bg-black object-contain"
                onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= zoom.end - 0.04) e.currentTarget.currentTime = zoom.start; }} />
            ) : (
              <img src={frameUrl(projectId, zoom.id)} alt="" className="mx-auto aspect-[9/16] max-h-[68vh] rounded-xl bg-black object-contain" />
            )}
            <button type="button" className="mt-3 w-full rounded-full bg-[#0f172a] py-2.5 text-sm font-bold text-white hover:bg-[#1e293b]"
              onClick={() => { onPick(zoom.id); setZoom(null); onClose(); }}>
              {zoom.id === value ? '지금 쓰는 장면' : '이 장면 쓰기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClipTile({ clip, projectId, file, flip, on, need, rank, reason, onPick, onZoom }: {
  clip: Clip; projectId: string; file?: string; flip?: boolean; on: boolean; need?: number; rank?: number; reason?: string; onPick: () => void; onZoom: () => void;
}) {
  const [hover, setHover] = useState(false);
  const short = need !== undefined && len(clip) + 0.05 < need;
  return (
    <li className="relative">
      <button type="button" onClick={onPick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-pressed={on} title={clip.description}
        className={`relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-[#0f172a] transition ${on ? 'ring-[3px] ring-amber' : 'hover:ring-2 hover:ring-[#94a3b8]'}`}>
        {hover && file ? (
          <video src={`${mediaUrl(projectId, file)}#t=${clip.start},${clip.end}`} autoPlay muted playsInline className="h-full w-full object-cover" style={flip ? { transform: 'scaleX(-1)' } : undefined}
            onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= clip.end) e.currentTarget.currentTime = clip.start; }} />
        ) : (
          <img src={frameUrl(projectId, clip.id)} alt={clip.description} loading="lazy" className="h-full w-full object-cover" style={flip ? { transform: 'scaleX(-1)' } : undefined} />
        )}
        <span className={`absolute bottom-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${short ? 'bg-amber text-amber-ink' : 'bg-black/70 text-white'}`}
          title={short ? '문장 음성보다 짧아요 (원본의 다음 장면이 이어서 나와요)' : undefined}>
          {len(clip).toFixed(1)}s
        </span>
        {on ? <span className="absolute left-1.5 top-1.5 rounded-md bg-amber px-1.5 py-0.5 text-[10px] font-bold text-amber-ink">사용 중</span>
          : rank ? <span className="absolute left-1.5 top-1.5 rounded-md bg-[#0f172a]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">추천 {rank}</span> : null}
      </button>
      <button type="button" onClick={onZoom} aria-label="크게 보기"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm shadow hover:bg-white">🔍</button>
      {reason && <p className="mt-1.5 text-xs font-semibold leading-snug text-[#0f172a]">{reason}</p>}
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#64748b]">{clip.description}</p>
    </li>
  );
}
