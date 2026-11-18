'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, flipStyle, frameUrl, mediaUrl, patchProject, startStage } from '@/lib/wings-shopping-v2/client';
import { FlipButton } from './SourcesStep';
import type { Beat, Clip, Source } from '@/lib/wings-shopping-v2/types';
import { isStoryMode } from '@/lib/wings-shopping-v2/types';
import { JobLine, Panel } from './ui';
import SsulPanel, { ROLE_LABEL } from './SsulPanel';
import FlowPanel from './FlowPanel';
import VoiceEnginePicker from './VoiceEnginePicker';
import { VoiceBars, VoiceGeneratingPanel } from './StudioBits';
import ScriptWritingStage from './ScriptWritingStage';
import type { StepProps } from './types';
import ClipPickerModal from './ClipPickerModal';
import RemixFormulaPicker from './RemixFormulaPicker';
import { TemplateLiveFrame } from './TemplateLiveFrame';
import { stageOf } from './ScriptFunnel';

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`grid h-7 w-7 place-items-center rounded-full border border-line text-xs text-muted transition ${danger ? 'hover:border-danger hover:text-danger' : 'hover:border-[var(--text)] hover:text-text'}`}>
      {children}
    </button>
  );
}

type Voice = { id: string; name: string; description?: string };
type Draft = { id?: string; text: string; clipId: string | null; tts?: Beat['tts']; role?: string; item?: string };

const SPEEDS = [0.9, 1.0, 1.1, 1.2];

export default function ScriptStep({ project, setProject, refresh, goNext, separateTemplates, hideFlow }: StepProps) {
  const script = project.script;
  const [head, setHead] = useState<[string, string]>(script?.headcopy ?? ['', '']);
  const [comment, setComment] = useState(script?.comment ?? '');
  const ssul = isStoryMode(project.mode);
  const [beats, setBeats] = useState<Draft[]>(script?.beats ?? []);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  // 문장 음성을 재생하는 동안 오른쪽 미리보기도 그 장면을 재생한다
  const [voicePlay, setVoicePlay] = useState<{ index: number; t: number; playing: boolean }>({ index: -1, t: 0, playing: false });
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  // 서버 데이터가 바뀌면(대본 생성·음성 생성) 편집 중이 아닐 때만 반영
  useEffect(() => {
    if (!dirty && script) {
      setHead(script.headcopy);
      setBeats(script.beats);
      setComment(script.comment ?? '');
    }
  }, [script, dirty]);

  useEffect(() => {
    api<Voice[]>('/api/wings-shopping-v2/voices').then(setVoices).catch((e) => setVoiceErr(e.message));
  }, []);

  // 원본 영상을 빼거나 다시 처리해 장면이 사라진 문장은 AI 추천 장면으로 자동으로 채운다
  const [filling, setFilling] = useState(false);
  const fillTried = useRef('');
  const missingKey = (script?.beats ?? []).filter((b) => !b.clipId).map((b) => b.id).join(',');
  useEffect(() => {
    if (!missingKey || dirty || fillTried.current === missingKey || !project.clips.some((c) => !c.excluded)) return;
    if (project.jobs.script?.state === 'running') return;
    fillTried.current = missingKey;
    setFilling(true);
    api<typeof project>(`/api/wings-shopping-v2/projects/${project.id}/clip-recs`, { method: 'POST' })
      .then((p) => setProject(p))
      .catch(() => undefined)
      .finally(() => setFilling(false));
  }, [missingKey, dirty, project, setProject]);

  const clips = useMemo(() => project.clips.filter((c) => !c.excluded), [project.clips]);
  const clipById = useMemo(() => new Map(project.clips.map((c) => [c.id, c])), [project.clips]);
  const scriptJob = project.jobs.script;
  const ttsJob = project.jobs.tts;
  const busy = scriptJob?.state === 'running' || ttsJob?.state === 'running';
  // 서버 진행 문구 "음성 생성 중... (3/8)" 의 3 = 지금 만드는 문장 번호
  const ttsRunning = ttsJob?.state === 'running';
  const ttsMatch = ttsRunning ? ttsJob?.message?.match(/\((\d+)\/(\d+)\)/) : null;
  const ttsCurrent = ttsMatch ? Number(ttsMatch[1]) - 1 : -1;
  const ttsTotal = ttsMatch ? Number(ttsMatch[2]) : 0;
  const totalSec = (script?.beats ?? []).reduce((a, b) => a + (b.tts?.duration ?? 0), 0);
  const allVoiced = !!script?.beats.length && script.beats.every((b) => b.tts) && !dirty;
  // 문장마다 저장된 내용과 비교: 고친 문장만 음성을 다시 만든다 (서버도 내용이 같은 문장은 그대로 둠)
  const savedText = useMemo(() => new Map((script?.beats ?? []).map((b) => [b.id, b.text])), [script]);
  const changed = (b: Draft) => !b.id || savedText.get(b.id) !== b.text;
  const changedCount = beats.filter((b) => b.text.trim() && changed(b)).length;

  function edit(i: number, patch: Partial<Draft>) {
    setBeats((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    setDirty(true);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= beats.length) return;
    const next = [...beats];
    [next[i], next[j]] = [next[j], next[i]];
    setBeats(next);
    setActive(j);
    setDirty(true);
  }
  async function save() {
    const p = await patchProject(project.id, { headcopy: head, comment, beats: beats.map(({ id, text, clipId, role, item }) => ({ id, text, clipId, role, item: item ?? '' })) });
    setProject(p);
    setDirty(false);
    return p;
  }
  async function generateVoice() {
    if (dirty) await save();
    await startStage(project.id, 'tts').catch(() => undefined);
    refresh();
  }
  async function setVoice(voiceId: string, speed: number) {
    setProject(await patchProject(project.id, { voice: { voiceId, speed } }));
  }

  const ssulPanel = ssul && project.ssul
    ? <SsulPanel project={project} setProject={setProject} hideTemplates={separateTemplates} />
    : project.mode === 'remix' && separateTemplates ? <RemixFormulaPicker project={project} setProject={setProject} /> : null;

  if (!script) {
    return (
      <div className="flex flex-col gap-6">
      {ssulPanel}
      <Panel title="대본·음성" actions={
        <button className="btn btn-primary" disabled={busy} onClick={async () => { await startStage(project.id, 'script').catch(() => undefined); refresh(); }}>대본 만들기</button>
      }>
        {scriptJob?.state === 'running' ? <ScriptWritingStage project={project} progress={scriptJob.progress} /> : <JobLine job={scriptJob} idleText={ssul
          ? '위에서 고른 구조·각도·말투로 썰 대본을 쓰고, 문장마다 어울리는 장면을 고릅니다.'
          : `장면 ${clips.length}개를 보고 AI가 대본을 쓰고, 문장마다 어울리는 장면을 고릅니다.`} />}
      </Panel>
      </div>
    );
  }

  const cur = beats[active];
  const curClip = cur?.clipId ? clipById.get(cur.clipId) : undefined;
  const beatDur = (b: Draft) => b.tts?.duration ?? 2;
  const flowTotal = beats.reduce((a, b) => a + beatDur(b), 0) || 1;

  function playBeat(i: number) {
    const a = audioRefs.current[i];
    if (!a) return;
    if (!a.paused) { a.pause(); return; }
    audioRefs.current.forEach((x, j) => { if (x && j !== i) x.pause(); });
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-6">
    {ssulPanel}
    <div className="grid gap-6 lg:grid-cols-[1fr_300px] [&>*]:min-w-0">
      <section className="overflow-hidden rounded-[28px] border border-line bg-panel">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-5 md:px-7">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">대본·음성</h2>
            <p className="mt-1 text-sm text-muted">문장 {beats.length}개{totalSec > 0 && <> · 음성 {totalSec.toFixed(1)}초</>} · 문장을 누르면 오른쪽에서 장면과 함께 보여요.</p>
          </div>
          <div className="flex gap-2">
            {dirty && <button className="btn btn-primary" onClick={save}>변경 저장</button>}
            <button className="btn btn-ghost" disabled={busy} onClick={async () => { setDirty(false); await startStage(project.id, 'script').catch(() => undefined); refresh(); }}>대본 새로 쓰기</button>
          </div>
        </header>

        <div className="px-6 py-6 md:px-7">
          {scriptJob?.state === 'running' ? <div className="mb-6"><ScriptWritingStage project={project} progress={scriptJob.progress} /></div> : <JobLine job={scriptJob} />}

          {/* 화면 위 문구 */}
          <div className="rounded-2xl bg-panel-2/60 p-4">
            <p className="text-xs font-bold text-muted">{ssul ? '화면 위 제목' : '화면 위 문구'}</p>
            <input className="mt-2 w-full bg-transparent text-lg font-bold text-text placeholder:text-muted focus:outline-none" value={head[0]} placeholder="첫째 줄"
              onChange={(e) => { setHead([e.target.value, head[1]]); setDirty(true); }} aria-label={ssul ? '상단 제목 1줄' : '상단 문구 1줄'} />
            <input className="mt-1 w-full bg-transparent text-lg font-bold text-[var(--amber)] placeholder:text-muted focus:outline-none" value={head[1]} placeholder="둘째 줄 (강조)"
              onChange={(e) => { setHead([head[0], e.target.value]); setDirty(true); }} aria-label={ssul ? '상단 제목 2줄' : '상단 문구 2줄'} />
            {ssul && (
              <input className="mt-3 w-full border-t border-line bg-transparent pt-3 text-sm text-text placeholder:text-muted focus:outline-none" value={comment} maxLength={60} placeholder="하단 코멘트 (레터박스형 템플릿에 표시)"
                onChange={(e) => { setComment(e.target.value); setDirty(true); }} aria-label="하단 코멘트" />
            )}
          </div>

          {/* 대본 흐름 띠: 문장마다 음성 길이만큼, 깔때기 단계 색 */}
          <div className="mt-6 flex h-8 overflow-hidden rounded-xl" role="tablist" aria-label="문장 흐름">
            {beats.map((b, i) => (
              <button key={b.id ?? `f-${i}`} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)}
                title={`${i + 1}. ${ROLE_LABEL[b.role ?? ''] ?? ''}`}
                className="relative grid place-items-center border-r-2 border-white text-[11px] font-bold text-white transition last:border-r-0"
                style={{ width: `${(beatDur(b) / flowTotal) * 100}%`, background: stageOf(b.role ?? '', i, beats.length).color, opacity: i === active ? 1 : 0.55 }}>
                {i + 1}
              </button>
            ))}
          </div>

          <ol className="mt-5 flex flex-col gap-3">
            {beats.map((b, i) => {
              const clip = b.clipId ? clipById.get(b.clipId) : undefined;
              const color = stageOf(b.role ?? '', i, beats.length).color;
              const on = i === active;
              const playingThis = voicePlay.index === i && voicePlay.playing;
              const making = i === ttsCurrent;
              return (
                <li key={b.id ?? `new-${i}`} onFocus={() => setActive(i)} onClick={() => setActive(i)}
                  className={`group grid grid-cols-[76px_minmax(0,1fr)] gap-4 rounded-2xl border bg-white p-3.5 transition duration-300 ${on || making ? 'border-transparent' : 'border-line hover:border-[#d5d8e2]'}`}
                  style={on || making ? { boxShadow: `0 0 0 2px ${color}, 0 18px 36px -22px ${color}` } : undefined}>
                  <div className="flex flex-col items-center gap-1.5">
                    <ClipPicker clips={clips} sources={project.sources} value={clip} projectId={project.id} beatId={b.id} sentence={b.text} need={b.tts?.duration} onChange={(id) => edit(i, { clipId: id })} />
                    {clip && <FlipButton compact on={!!clip.flip}
                      onClick={async () => setProject(await patchProject(project.id, { clipFlip: { clipId: clip.id, flip: !clip.flip } }))} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>{i + 1}</span>
                      {b.role && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: `${color}1a`, color }}>{ROLE_LABEL[b.role] ?? b.role}</span>}
                      {b.tts && !changed(b) && <span className="text-xs tabular-nums text-muted">{b.tts.duration.toFixed(1)}초</span>}
                      {!clip && <span className="text-xs font-semibold text-danger">{filling ? 'AI가 어울리는 장면을 고르는 중...' : '장면을 골라 주세요'}</span>}
                      <span className="flex-1" />
                      <span className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <IconBtn label="위로" onClick={() => move(i, -1)}>↑</IconBtn>
                        <IconBtn label="아래로" onClick={() => move(i, 1)}>↓</IconBtn>
                        <IconBtn label="삭제" danger onClick={() => { setBeats(beats.filter((_, j) => j !== i)); setDirty(true); }}>✕</IconBtn>
                      </span>
                    </div>
                    <textarea
                      className="mt-2 w-full resize-none rounded-xl bg-panel-2/50 px-3.5 py-2.5 text-[16px] font-medium leading-relaxed text-text transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--amber)_40%,transparent)]"
                      value={b.text}
                      rows={Math.max(2, b.text.split('\n').length)}
                      onChange={(e) => edit(i, { text: e.target.value })}
                      aria-label={`${i + 1}번 문장`}
                    />
                    {project.mode === 'review' && (
                      <input className="field mt-1.5 !py-1.5 text-sm" value={b.item ?? ''} maxLength={40}
                        placeholder="화면 라벨 (새 상품이 나오는 문장만, 예: 3위 · 상품명)" onChange={(e) => edit(i, { item: e.target.value })} />
                    )}
                    {i === 0 && <HookPicker projectId={project.id} onPick={(text) => edit(0, { text })} />}

                    {/* 목소리 */}
                    <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
                      {making ? (
                        <span className="inline-flex items-center gap-2 font-semibold" style={{ color }}><VoiceBars /> 목소리 만드는 중…</span>
                      ) : ttsRunning && !b.tts && i > ttsCurrent ? (
                        <span>목소리 대기 중</span>
                      ) : b.tts && !changed(b) ? (
                        <>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setActive(i); playBeat(i); }} aria-label={playingThis ? '멈춤' : '목소리 듣기'}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow transition hover:scale-105" style={{ background: color }}>
                            {playingThis ? '❚❚' : '▶'}
                          </button>
                          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                            <span className="absolute inset-y-0 left-0 rounded-full" style={{ background: color, width: `${voicePlay.index === i ? Math.min(100, (voicePlay.t / b.tts.duration) * 100) : 0}%` }} />
                          </span>
                          <audio ref={(el) => { audioRefs.current[i] = el; }} src={mediaUrl(project.id, b.tts.file)} preload="none" className="hidden"
                            onPlay={(e) => { setActive(i); setVoicePlay({ index: i, t: e.currentTarget.currentTime, playing: true }); }}
                            onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setVoicePlay((v) => (v.index === i ? { ...v, t } : v)); }}
                            onPause={() => setVoicePlay((v) => (v.index === i ? { ...v, playing: false } : v))}
                            onEnded={() => setVoicePlay((v) => (v.index === i ? { ...v, playing: false, t: 0 } : v))} />
                        </>
                      ) : <span className={b.tts ? 'font-semibold text-[var(--amber)]' : ''}>{b.tts ? '고친 문장이에요 · 아래에서 이 문장만 음성을 다시 만들어요' : '아직 목소리가 없어요'}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-3 text-sm font-semibold text-muted transition hover:border-[var(--amber)] hover:text-[var(--amber)]"
            onClick={() => { setBeats([...beats, { text: '', clipId: null }]); setActive(beats.length); setDirty(true); }}>
            ＋ 문장 추가
          </button>

        <div className="mt-8 border-t border-line pt-6">
          <h3 className="text-xl font-bold tracking-[-0.02em] text-text">목소리</h3>
          <div className="mt-3">
            <VoiceEnginePicker
              voice={project.voice}
              customVoice={project.customVoice}
              geminiVoices={voices}
              disabled={busy}
              mode={project.mode}
              onGemini={async (voiceId, speed) => {
                setProject(await patchProject(project.id, { customVoice: { voiceId: '', style: '', speed }, voice: { voiceId, speed } }));
              }}
              onCustom={async (next) => { setProject(await patchProject(project.id, { customVoice: next })); }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button className="btn btn-primary" disabled={busy || beats.some((b) => !b.text.trim())} onClick={generateVoice}>
              {changedCount && script.beats.some((b) => b.tts) ? `고친 문장 ${changedCount}개만 음성 만들기` : script.beats.some((b) => b.tts) ? '바뀐 문장 음성 만들기' : '음성 만들기'}
            </button>
            <button className="btn btn-ghost" disabled={!allVoiced || beats.some((b) => !b.clipId)} onClick={goNext}>
              영상 만들기로 ({totalSec.toFixed(1)}초)
            </button>
          </div>
          {voiceErr && <p className="mt-2 text-sm text-danger">{voiceErr}</p>}
          <div className="mt-3">
            {ttsRunning && ttsCurrent >= 0
              ? <VoiceGeneratingPanel current={ttsCurrent + 1} total={ttsTotal} text={beats[ttsCurrent]?.text} />
              : <JobLine job={ttsJob} />}
          </div>
        </div>
        </div>
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        {(ssul && project.ssul) || project.mode === 'remix' ? (
          <BeatLivePreview project={project} clip={curClip} text={cur?.text ?? ''} index={active} total={beats.length}
            playing={voicePlay.index === active && voicePlay.playing} t={voicePlay.index === active ? voicePlay.t : 0} duration={cur?.tts?.duration} />
        ) : (
          <PhonePreview projectId={project.id} clip={curClip} head={head} text={cur?.text ?? ''} index={active} total={beats.length} />
        )}
      </aside>
    </div>
    {!hideFlow && <FlowPanel project={project} setProject={setProject} />}
    </div>
  );
}

type Hook = { text: string; type: string; why: string };

/** 첫 문장 후킹 A/B 후보: 고르면 1번 문장이 바뀌고, 음성만 다시 만들면 된다 */
function HookPicker({ projectId, onPick }: { projectId: string; onPick: (text: string) => void }) {
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setHooks((await api<{ hooks: Hook[] }>(`/api/wings-shopping-v2/projects/${projectId}/hooks`, { method: 'POST' })).hooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1.5">
      <button className="text-xs text-amber hover:underline disabled:opacity-50" disabled={busy} onClick={load}>
        {busy ? '후킹 문장 쓰는 중...' : hooks ? '후킹 후보 다시 받기' : '후킹 첫 문장 후보 5개 받기 (A/B 테스트용)'}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hooks && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {hooks.map((h) => (
            <li key={h.text}>
              <button className="w-full rounded-lg border border-line px-2.5 py-1.5 text-left text-sm hover:border-amber/70" onClick={() => onPick(h.text)} title={h.why}>
                <span className="mr-2 rounded bg-panel-2 px-1 text-[10px] text-muted">{h.type}</span>{h.text.replace(/\n/g, ' ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClipPicker({ clips, sources, value, projectId, beatId, sentence, need, onChange }: {
  clips: Clip[]; sources: Source[]; value?: Clip; projectId: string; beatId?: string; sentence: string; need?: number; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="group relative block aspect-[9/16] w-16 overflow-hidden rounded-md bg-panel-2" aria-label="장면 바꾸기" aria-haspopup="dialog">
        {value ? <img src={frameUrl(projectId, value.id)} alt="" className="h-full w-full object-cover" style={flipStyle(value)} /> : <span className="text-xs text-muted">장면 선택</span>}
        {value && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] tabular-nums text-white">{(value.end - value.start).toFixed(1)}s</span>}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">바꾸기</span>
      </button>
      {open && (
        <ClipPickerModal projectId={projectId} beatId={beatId} clips={clips} sources={sources} value={value?.id} sentence={sentence} need={need}
          onPick={onChange} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

/** 고른 문장의 장면 미리보기: 그 문장 음성을 재생하면 장면도 같이 재생되고 자막이 줄마다 넘어간다 */
function BeatLivePreview({ project, clip, text, index, total, playing, t, duration }: {
  project: import('@/lib/wings-shopping-v2/types').Project; clip?: Clip; text: string; index: number; total: number; playing: boolean; t: number; duration?: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const file = clip ? project.sources.find((s) => s.id === clip.sourceId)?.file : undefined;
  useEffect(() => {
    const v = video.current;
    if (!v || !clip) return;
    if (playing) {
      // 렌더링처럼 1배속: 장면이 음성보다 짧으면 원본 영상의 다음 부분이 그대로 이어진다 (느리게 늘리지 않음)
      v.playbackRate = 1;
      v.currentTime = clip.start + t;
      void v.play().catch(() => undefined);
    } else {
      v.pause();
      if (t === 0) v.currentTime = clip.start;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, clip?.id]);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const chars = lines.reduce((a, l) => a + l.length, 0) || 1;
  const p = duration ? Math.min(0.999, t / duration) : 0;
  let acc = 0;
  const line = lines.find((l) => { acc += l.length; return p < acc / chars; }) ?? lines[lines.length - 1] ?? '';
  return (
    <figure>
      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-[7px] border-[#1c1c1e] bg-black shadow-2xl">
        <div className="relative aspect-[9/16] w-full">
          <TemplateLiveFrame project={project} overlay={line ? <TemplateLiveFrame.Caption text={line} /> : null}>
            {clip && file ? (
              <video ref={video} key={clip.id} src={`${mediaUrl(project.id, file)}#t=${clip.start}`} muted playsInline preload="auto" style={flipStyle(clip)}
                className="absolute inset-0 h-full w-full object-cover"
                onEnded={(e) => e.currentTarget.pause()} />
            ) : clip ? (
              <img src={frameUrl(project.id, clip.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
          </TemplateLiveFrame>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">
        {total ? `${index + 1}/${total}번 문장 ${playing ? '재생 중' : '· 음성 ▶를 누르면 이 장면이 같이 재생돼요'}` : '문장을 추가하세요'}
      </figcaption>
    </figure>
  );
}

function PhonePreview({ projectId, clip, head, text, index, total }: {
  projectId: string; clip?: Clip; head: [string, string]; text: string; index: number; total: number;
}) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <figure>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] border-panel-2 bg-black shadow-2xl">
        {clip && <img src={frameUrl(projectId, clip.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-x-0 top-[9%] px-3 text-center font-display text-[22px] leading-tight [text-shadow:0_0_4px_#000,0_0_4px_#000,0_2px_0_#000]">
          <p>{head[0]}</p>
          <p className="text-[#ffe500]">{head[1]}</p>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-[17px] font-bold leading-snug [text-shadow:0_0_4px_#000,0_0_4px_#000,0_2px_0_#000]">
          <span>{lines[0] ?? ''}</span>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted">
        {total ? `${index + 1}/${total}번 문장 미리보기 · 자막은 줄마다 바뀝니다` : '문장을 추가하세요'}
      </figcaption>
    </figure>
  );
}
