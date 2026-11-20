'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, frameUrl, mediaUrl } from '@/lib/wings-shopping-v2/client';
import type { Project, ThumbOption } from '@/lib/wings-shopping-v2/types';
import { PhoneShell } from './StudioBits';
import { MvpThumbnailAdvancedEditor } from '@/app/WingsAIStudioShotForm/shortform-studio/MvpThumbnailAdvancedEditor';
import type { MvpThumbnailDesign } from '@/lib/mvp-thumbnail-design';

/** 이미지 data URL → JPG(품질 0.92). 실패하면 원본 그대로 */
function toJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d');
        if (!g) return resolve(dataUrl);
        g.fillStyle = '#000';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function ThumbnailPanel({ project, setProject }: { project: Project; setProject: (p: Project) => void }) {
  const t = project.thumbnail;
  const [clipId, setClipId] = useState<string | undefined>(t?.clipId ?? project.script?.beats[0]?.clipId ?? undefined);
  const [lines, setLines] = useState<string[]>(t?.lines?.length ? t.lines : [...(project.script?.headcopy ?? ['', ''])]);
  const [highlight, setHighlight] = useState(t?.highlight ?? '');
  const [prepend, setPrepend] = useState(t?.prepend ?? false);
  const [options, setOptions] = useState<ThumbOption[]>(t?.options ?? []);
  const [busy, setBusy] = useState<'copy' | 'render' | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AI 썸네일(스튜디오 AI 탭)은 수강생 본인 Replicate 키로 만든다
  const [hasReplicateKey, setHasReplicateKey] = useState(true);
  useEffect(() => {
    try { setHasReplicateKey(!!localStorage.getItem('shotform_replicate_api_key')?.trim()); } catch { /* 저장소 접근 불가 */ }
  }, []);

  const usedClips = useMemo(() => {
    const ids = new Set((project.script?.beats ?? []).map((b) => b.clipId).filter(Boolean) as string[]);
    const list = project.clips.filter((c) => ids.has(c.id));
    return list.length ? list : project.clips.filter((c) => !c.excluded).slice(0, 12);
  }, [project.script, project.clips]);

  async function suggest() {
    setBusy('copy'); setError(null);
    try {
      const r = await api<{ options: ThumbOption[] }>(`/api/wings-shopping-v2/projects/${project.id}/thumbnail/copy`, { method: 'POST' });
      setOptions(r.options);
      if (r.options[0]) { setLines(r.options[0].lines); setHighlight(r.options[0].highlight); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  }
  const saveStudio = async (payload: Record<string, unknown>) => {
    setBusy('render'); setError(null);
    try {
      setProject(await api<Project>(`/api/wings-shopping-v2/projects/${project.id}/thumbnail/studio`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      }));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  // 스튜디오에 넘길 장면 프레임 (영상 프레임 고르기)
  const frames = useMemo(() => usedClips.map((c, i) => ({ id: c.id, timeSec: c.start, dataUrl: frameUrl(project.id, c.id), label: `장면 ${i + 1}` })), [usedClips, project.id]);

  const selectedOpt = options.findIndex((o) => o.lines.join('|') === lines.filter((l) => l.trim()).join('|'));
  const bg = clipId ? frameUrl(project.id, clipId) : frames[0]?.dataUrl;
  const paintHl = (l: string, hl: string) => {
    const k = hl ? l.indexOf(hl) : -1;
    return k < 0 ? l : <>{l.slice(0, k)}<span className="text-[#ffe500]">{hl}</span>{l.slice(k + hl.length)}</>;
  };

  return (
    <section className="rounded-3xl border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-text">썸네일</h2>
          <p className="mt-1 text-sm text-muted">문구와 배경 장면을 고르고 만들기를 누르면 썸네일 스튜디오가 열려요. 스튜디오에서 적용하면 여기에 저장돼요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-text shadow-sm transition hover:border-amber hover:text-amber disabled:opacity-50" disabled={!!busy} onClick={suggest}>
            <span aria-hidden>✦</span>{busy === 'copy' ? 'AI가 쓰는 중...' : 'AI 문구 추천'}
          </button>
          <button className="btn btn-primary !rounded-xl" disabled={!!busy} onClick={() => setStudioOpen(true)}>
            {busy === 'render' ? '저장하는 중...' : t?.file ? '스튜디오에서 고치기' : '썸네일 만들기'}
          </button>
        </div>
      </header>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--amber)_35%,var(--line))] bg-[color-mix(in_srgb,var(--amber)_6%,white)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">AI로 썸네일 그림 만들기</p>
          <p className="mt-0.5 text-xs text-muted">스튜디오가 열리면 왼쪽 &lsquo;AI&rsquo; 탭에서 장면·문구로 AI 썸네일을 만들어요.</p>
          {!hasReplicateKey && <p className="mt-1 text-xs font-semibold text-danger">Replicate API 키가 없어요. 숏폼 첫 화면의 API 키 설정에서 Replicate 키를 저장해 주세요.</p>}
        </div>
        <button type="button" className="btn btn-primary !rounded-xl" disabled={!!busy} onClick={() => setStudioOpen(true)}>
          <span aria-hidden>✦</span> AI 썸네일 만들기
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* AI 추천 문구 */}
          <section>
            <h3 className="text-sm font-bold text-text">AI 추천 문구</h3>
            {options.length ? (
              <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {options.map((o, i) => (
                  <li key={i}>
                    <button type="button" aria-pressed={selectedOpt === i} onClick={() => { setLines(o.lines); setHighlight(o.highlight); }}
                      className={`group relative w-full overflow-hidden rounded-2xl p-4 text-left transition ${selectedOpt === i ? 'bg-[#0e1016] text-white shadow-[0_14px_30px_-14px_rgba(14,16,22,0.7)]' : 'bg-panel-2 text-text hover:bg-[#e9ebf3]'}`}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedOpt === i ? 'bg-white/15 text-white' : 'bg-white text-amber'}`}>{o.type || '추천'}</span>
                      <span className="mt-2 block text-[15px] font-extrabold leading-snug">
                        {o.lines.map((l, k) => <span key={k} className="block">{selectedOpt === i ? paintHl(l, o.highlight) : l}</span>)}
                      </span>
                      {selectedOpt === i && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-[var(--amber)] text-[11px] font-bold" aria-hidden>✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 rounded-2xl border border-dashed border-line bg-panel-2/50 px-4 py-5 text-sm text-muted">
                AI 문구 추천을 누르면 조회수 높은 쇼핑 쇼츠 문구 구조로 4가지를 만들어 드려요.
              </p>
            )}
          </section>

          {/* 문구 직접 고치기 */}
          <section>
            <h3 className="text-sm font-bold text-text">문구</h3>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <label key={i} className="relative block">
                  <span className="sr-only">{i + 1}줄</span>
                  <input className="field !rounded-xl !border-transparent !bg-panel-2 !py-3 !pl-10 !pr-12 font-semibold focus:!border-amber focus:!bg-white" value={lines[i] ?? ''} maxLength={20}
                    placeholder={i === 2 ? '3줄 (선택)' : `${i + 1}줄`}
                    onChange={(e) => { const n = [...lines]; n[i] = e.target.value; setLines(n); }} />
                  <span className="pointer-events-none absolute left-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white text-[10px] font-bold text-muted" aria-hidden>{i + 1}</span>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted">{(lines[i] ?? '').length}/20</span>
                </label>
              ))}
            </div>
          </section>

          {/* 배경 장면 */}
          <section>
            <h3 className="text-sm font-bold text-text">배경 장면</h3>
            <ul className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
              {usedClips.map((c) => (
                <li key={c.id} className="shrink-0">
                  <button onClick={() => setClipId(c.id)} aria-pressed={clipId === c.id} title="썸네일 배경 장면"
                    className={`relative block w-[76px] overflow-hidden rounded-xl transition ${clipId === c.id ? 'ring-[3px] ring-[var(--amber)] ring-offset-2' : 'opacity-80 hover:opacity-100'}`}>
                    <img src={frameUrl(project.id, c.id)} alt={c.description} className="aspect-[9/16] w-full object-cover" />
                    {clipId === c.id && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--amber)] text-[11px] font-bold text-white" aria-hidden>✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 영상 맨 앞에 넣기 */}
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-panel-2 px-4 py-3.5">
            <input type="checkbox" className="peer sr-only" checked={prepend} onChange={(e) => { setPrepend(e.target.checked); if (t?.file) void saveStudio({ prepend: e.target.checked }); }} />
            <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-[#cfd3de] transition peer-checked:bg-[var(--amber)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--amber)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-text">완성 영상 맨 앞 0.01초에 넣기</span>
              <span className="block text-xs text-muted">첫 프레임으로만 들어가서 재생 땐 안 보이고, 피드 표지로 쓰여요</span>
            </span>
          </label>
        </div>

        {/* 결과 미리보기 */}
        <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:self-start">
          <PhoneShell className="max-w-[250px]">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] bg-black">
              {t?.file ? (
                <img src={`${mediaUrl(project.id, t.file)}?v=${t.at ?? 0}`} alt="만든 썸네일" className="h-full w-full object-cover" />
              ) : (
                <>
                  {bg && <img src={bg} alt="" className="h-full w-full object-cover opacity-90" />}
                  <div className="absolute inset-x-0 top-[14%] px-3 text-center text-[20px] font-black leading-tight text-white [paint-order:stroke_fill] [-webkit-text-stroke:5px_#000]">
                    {lines.filter((l) => l.trim()).map((l, k) => <p key={k}>{paintHl(l, highlight)}</p>)}
                  </div>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-text">스튜디오에서 다듬기 전 미리보기</span>
                </>
              )}
            </div>
          </PhoneShell>
          {t?.file && (
            <a className="flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-bold text-text shadow-sm transition hover:border-amber hover:text-amber" href={`${mediaUrl(project.id, t.file)}?download`}>
              <span aria-hidden>↓</span> 썸네일 내려받기
            </a>
          )}
        </aside>
      </div>
      <MvpThumbnailAdvancedEditor
        open={studioOpen}
        onOpenChange={setStudioOpen}
        backgroundUrl={clipId ? frameUrl(project.id, clipId) : frames[0]?.dataUrl ?? ''}
        videoFrames={frames}
        selectedVideoFrameId={clipId ?? null}
        onSelectVideoFrame={(f) => setClipId(f.id)}
        hookingText={{ line1: lines[0] ?? '', line2: lines.slice(1).filter((l) => l.trim()).join(' ') }}
        productName={project.analysis?.productName ?? project.name}
        initialDesign={(t?.studioDesign as MvpThumbnailDesign | undefined) ?? null}
        onApply={(dataUrl, hooking, design) => {
          setStudioOpen(false);
          setBusy('render');
          // PNG(2MB 안팎)를 JPG 로 바꿔 올리면 저장이 훨씬 빠르다 (썸네일은 투명 배경이 필요 없음)
          void toJpeg(dataUrl).then((image) => saveStudio({ image, lines: [hooking.line1, hooking.line2], clipId, prepend, design }));
        }}
      />
    </section>
  );
}
