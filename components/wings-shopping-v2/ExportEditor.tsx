'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { frameUrl, mediaUrl, patchProject, startStage, useBufferedVideoUrl } from '@/lib/wings-shopping-v2/client';
import type { Beat, Clip } from '@/lib/wings-shopping-v2/types';
import { shotformVmakeApiKey, shotformVmakeSecretAccessKey } from '@/lib/shotform-vmake-subtitle-removal';
import { JobLine } from './ui';
import { ROLE_LABEL } from './SsulPanel';
import { PhoneShell } from './StudioBits';
import { POSTER_SECONDS, TemplateLiveFrame, useLiveVideoRect } from './TemplateLiveFrame';
import ThumbnailPanel from './ThumbnailPanel';
import FxPanel from './FxPanel';
import LocalizePanel from './LocalizePanel';
import LangSwitch from './LangSwitch';
import UploadTab from './UploadTab';
import CoverThumbnailStudio from './CoverThumbnailStudio';
import type { StepProps } from './types';
import { calloutGeometry, motionCallouts, motionExtras, punchZoomWindows, stickerGeometry, transitionZoomWindows, zoomEnvelope, TRANSITION_IN, TRANSITION_OUT } from '@/lib/wings-shopping-v2/motion/ass';
import { fxSettings, previewBgmVolume } from '@/lib/wings-shopping-v2/audio/settings';

const TABS = ['장면', '효과음', '썸네일 생성', '업로드', '해외버전'] as const;
type Tab = (typeof TABS)[number];

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const clipLen = (c?: Clip) => (c ? Math.max(0.3, c.end - c.start) : 2);
/** 문장 안 경과 시간 τ → 장면 안 위치 (끝까지 가면 그 자리에 머문다) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function clipPos(tau: number, _L: number, _D: number): number {
  return Math.max(0, tau);
}
const toPatch = (bs: Beat[]) => bs.map(({ id, text, clipId, role, item }) => ({ id, text, clipId, role, item: item ?? '' }));

/**
 * 끊김 없는 미리보기: 쓰는 영상·음성을 재생 전에 전부 메모리(blob)로 받아 둔다.
 * 재생 중에는 네트워크를 안 타므로 버퍼링이 생기지 않는다.
 */
function useBlobUrls(urls: string[]): { get: (u: string) => string; ready: boolean; done: number } {
  const key = urls.join('|');
  const [state, setState] = useState<{ key: string; map: Map<string, string> }>({ key: '', map: new Map() });
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    const map = new Map<string, string>();
    const list = key ? key.split('|') : [];
    void Promise.all(list.map(async (u) => {
      try {
        const r = await fetch(u);
        if (!r.ok) throw new Error(String(r.status));
        const b = URL.createObjectURL(await r.blob());
        if (!alive) { URL.revokeObjectURL(b); return; }
        made.push(b);
        map.set(u, b);
      } catch {
        map.set(u, u); // 실패하면 원래 주소로
      }
      if (alive) setState({ key, map: new Map(map) });
    }));
    return () => { alive = false; made.forEach((b) => URL.revokeObjectURL(b)); };
  }, [key]);
  const map = state.key === key ? state.map : new Map<string, string>();
  return { get: (u) => map.get(u) ?? u, ready: urls.every((u) => map.has(u)), done: urls.filter((u) => map.has(u)).length };
}

/** 미리보기 배지: 렌더와 같은 자리(영상 영역 안 위쪽 POINT · 아래쪽 CTA) */
function MotionBadge({ kind, label }: { kind: 'cta' | 'point'; label: string }) {
  const v = useLiveVideoRect();
  const g = calloutGeometry(v);
  const y = kind === 'cta' ? g.ctaY : g.pointY;
  return (
    <div className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 justify-center" style={{ left: `${(g.cx / 1080) * 100}%`, top: `${(y / 1920) * 100}%` }}>
      <span className={kind === 'cta'
        ? 'whitespace-nowrap rounded-full border-2 border-[#FFE500] bg-[#5B21B6] px-[4cqw] py-[1.2cqw] text-[3.4cqw] font-bold text-white shadow-lg'
        : 'whitespace-nowrap rounded-full border border-white bg-[#111827]/90 px-[3cqw] py-[1cqw] text-[3cqw] font-bold text-[#FFE500] shadow-lg'}>
        {label}
      </span>
    </div>
  );
}

/** 미리보기 장면 전환·숫자 스티커 (렌더 extraMotionLines 와 같은 모양) */
function MotionExtrasLayer({ t, extras }: { t: number; extras: ReturnType<typeof motionExtras> }) {
  const v = useLiveVideoRect();
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  const box = { left: pct(v.x, 1080), top: pct(v.y, 1920), width: pct(v.w, 1080), height: pct(v.h, 1920) };
  const tr = extras.transitions.find((x) => t >= x.t - TRANSITION_IN && t < x.t + TRANSITION_OUT);
  const st = extras.stickers.find((x) => t >= x.start && t < x.end);
  let trEl: React.ReactNode = null;
  if (tr) {
    const p = (t - (tr.t - TRANSITION_IN)) / (TRANSITION_IN + TRANSITION_OUT);
    if (tr.style === 'glow') {
      const k = t < tr.t ? (t - (tr.t - TRANSITION_IN)) / TRANSITION_IN : 1 - (t - tr.t) / TRANSITION_OUT;
      trEl = <div className="absolute inset-0 bg-white" style={{ opacity: 0.35 * k }} />;
    } else if (tr.style === 'sweep') {
      trEl = <div className="absolute -inset-y-[6%] w-[10%] rotate-[12deg] bg-white/45 blur-[6px]" style={{ left: `${-18 + 125 * p}%` }} />;
    }
  }
  let stEl: React.ReactNode = null;
  if (st) {
    const g = stickerGeometry(v);
    const e = t - st.start;
    const s = e < 0.16 ? (1.18 * e) / 0.16 : e < 0.26 ? 1.18 - 0.18 * ((e - 0.16) / 0.1) : 1;
    const o = Math.min(1, (st.end - t) / 0.15);
    stEl = (
      <div className="pointer-events-none absolute" style={{ left: pct(g.cx, 1080), top: pct(g.cy, 1920), transform: `translate(-50%,-50%) rotate(${st.rot}deg) scale(${s})`, opacity: o }}>
        <span className="block whitespace-nowrap rounded-[2.8cqw] border-[0.5cqw] border-black bg-[#FFE500] px-[3cqw] py-[1cqw] text-[6.6cqw] font-black leading-none text-black">{st.label}</span>
      </div>
    );
  }
  return (<>
    {trEl && <div className="pointer-events-none absolute overflow-hidden" style={box}>{trEl}</div>}
    {stEl}
  </>);
}

/** 썰 숏폼 내보내기: 캡컷식 편집 화면 (왼쪽 휴대폰 미리보기 · 오른쪽 탭 · 아래 타임라인) */
export default function ExportEditor({ project, setProject, refresh, thumbnailSlot, onOpenVersion }: StepProps) {
  const beats = useMemo(() => project.script?.beats ?? [], [project.script]);
  const clipById = useMemo(() => new Map(project.clips.map((c) => [c.id, c])), [project.clips]);
  const fileOf = (c?: Clip) => (c ? project.sources.find((s) => s.id === c.sourceId)?.file : undefined);

  // 렌더 버튼 (ExportStep과 같은 로직)
  const job = project.jobs.render;
  const running = job?.state === 'running';
  const ttsRunning = project.jobs.tts?.state === 'running';
  const out = project.output;
  const missing = beats.findIndex((b) => !b.clipId || !b.tts);
  const rawVideoUrl = out && !running && !out.stale ? `${mediaUrl(project.id, out.file)}?v=${out.at ?? 0}` : null;
  const playableUrl = useBufferedVideoUrl(rawVideoUrl);
  const rendered = !!playableUrl;

  // 자막 지운 영상(자막 제거 버튼)이 지금 장면·음성과 맞으면 미리보기도 그 영상·음성으로 렌더와 똑같이 보여 준다
  const cleanJob = project.jobs.clean;
  const cleaning = cleanJob?.state === 'running';
  const clean = project.cleanFresh && project.clean && project.clean.durations.length === beats.length ? project.clean : null;
  const cleanTtsUrl = (i: number) => `${mediaUrl(project.id, `clean/tts_${String(i).padStart(3, '0')}.wav`)}?v=${clean?.at ?? 0}`;

  // 문장별 길이·시작 시각
  const durs = clean ? clean.durations : beats.map((b) => b.tts?.duration ?? clipLen(b.clipId ? clipById.get(b.clipId) : undefined));
  const starts = durs.reduce<number[]>((a, d, i) => [...a, i ? a[i - 1] + durs[i - 1] : 0], []);
  const beatsTotal = durs.reduce((a, d) => a + d, 0);

  // 재생 상태
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seekNonce, setSeekNonce] = useState(0);
  const [videoDur, setVideoDur] = useState(0);
  const total = rendered ? videoDur || beatsTotal : beatsTotal;
  const tRef = useRef(0);
  tRef.current = t;
  const base = useRef({ t: 0, wall: 0 });
  const outRef = useRef<HTMLVideoElement>(null);
  // 문장마다 자기 장면 영상·음성 요소를 미리 만들어 그 자리에 세워 둔다 → 장면이 바뀔 때 탐색(seek) 없이 바로 재생
  const beatVideos = useRef<(HTMLVideoElement | null)[]>([]);
  const beatAudios = useRef<(HTMLAudioElement | null)[]>([]);
  const cleanRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  let cur = 0;
  for (let i = 0; i < beats.length; i++) if (t >= starts[i]) cur = i;
  const curBeat = beats[cur];
  const curRef = useRef(0);
  curRef.current = cur;
  const startsRef = useRef<number[]>([]);
  startsRef.current = starts;
  const dursRef = useRef<number[]>([]);
  dursRef.current = durs;
  const curClipLenRef = useRef(2);
  const curLines = curBeat ? curBeat.text.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const curLine = (() => {
    if (!curLines.length) return '';
    const p = Math.min(0.999, Math.max(0, (t - (starts[cur] ?? 0)) / (durs[cur] || 1)));
    const totalChars = curLines.reduce((a, l) => a + l.length, 0) || 1;
    let acc = 0;
    for (const l of curLines) { acc += l.length; if (p < acc / totalChars) return l; }
    return curLines[curLines.length - 1];
  })();
  const curClip = curBeat?.clipId ? clipById.get(curBeat.clipId) : undefined;
  const cleanVideoUrl = clean ? `${mediaUrl(project.id, 'clean/video.mp4')}?v=${clean.at}` : '';
  const beatAudioUrl = (i: number) => (clean ? cleanTtsUrl(i) : beats[i]?.tts ? mediaUrl(project.id, beats[i]!.tts!.file) : '');
  const beatVideoUrl = (i: number) => { const f = fileOf(beats[i]?.clipId ? clipById.get(beats[i]!.clipId!) : undefined); return f ? mediaUrl(project.id, f) : ''; };
  const preload = rendered ? [] : [...new Set([...(clean ? [cleanVideoUrl] : beats.map((_, i) => beatVideoUrl(i))), ...beats.map((_, i) => beatAudioUrl(i))].filter(Boolean))];
  const media = useBlobUrls(preload);
  const mediaReady = rendered || media.ready;
  curClipLenRef.current = clipLen(curClip);

  function seek(nt: number) {
    const v = Math.max(0, Math.min(total, nt));
    setT(v);
    base.current = { t: v, wall: performance.now() };
    if (rendered && outRef.current) outRef.current.currentTime = v;
    setSeekNonce((n) => n + 1);
  }

  // 실시간 미리보기 시계 (렌더본이 없을 때)
  useEffect(() => {
    if (!playing || rendered) return;
    base.current = { t: tRef.current >= beatsTotal ? 0 : tRef.current, wall: performance.now() };
    let raf = 0;
    const tick = () => {
      let nt = base.current.t + (performance.now() - base.current.wall) / 1000;
      const cv = cleanRef.current;
      if (cv && !cv.paused && cv.readyState >= 2) {
        // 자막 지운 영상(한 줄짜리)이 재생 중이면 그 영상 시각을 그대로 따른다 → 영상을 되돌려 찾는 일이 없다
        nt = cv.currentTime;
        base.current = { t: nt, wall: performance.now() };
      } else if (!cv) {
        // 문장 음성이 아직 끝나지 않았으면 다음 문장으로 넘어가지 않고 기다린다 (끝 음절 잘림 방지)
        const nextStart = startsRef.current[curRef.current + 1] ?? beatsTotal;
        const a = beatAudios.current[curRef.current];
        if (nt >= nextStart && a && !a.paused && !a.ended && a.currentTime < (a.duration || 0) - 0.02) {
          nt = Math.max(0, nextStart - 0.001);
          base.current = { t: nt, wall: performance.now() };
        }
      }
      if (nt >= beatsTotal) {
        setT(beatsTotal);
        setPlaying(false);
        return;
      }
      setT(nt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rendered, beatsTotal]);

  // 현재 문장의 장면 영상·음성을 시계에 맞춤
  function syncClip() {
    beatVideos.current.forEach((v, i) => {
      if (!v) return;
      const c = beats[i]?.clipId ? clipById.get(beats[i]!.clipId!) : undefined;
      if (!c) return;
      if (i === cur) {
        const want = c.start + clipPos(tRef.current - (starts[i] ?? 0), clipLen(c), durs[i] ?? clipLen(c));
        if (Math.abs(v.currentTime - want) > 0.15) v.currentTime = want; // 미리 세워 둔 자리면 탐색 안 함
        if (playing) void v.play().catch(() => undefined);
        else v.pause();
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - c.start) > 0.05) v.currentTime = c.start; // 다음에 바로 나오게 시작점에 대기
      }
    });
  }
  useEffect(() => {
    if (rendered) return;
    syncClip();
    const cv = cleanRef.current;
    if (cv) {
      cv.currentTime = tRef.current;
      if (playing) void cv.play().catch(() => undefined);
      else cv.pause();
    }
    beatAudios.current.forEach((a, i) => {
      if (!a) return;
      if (i === cur) {
        const want = Math.max(0, tRef.current - (starts[cur] ?? 0));
        if (Math.abs(a.currentTime - want) > 0.08) a.currentTime = want;
        if (playing) void a.play().catch(() => undefined);
        else a.pause();
      } else {
        if (!a.paused) a.pause();
        if (a.currentTime !== 0) a.currentTime = 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, playing, seekNonce, rendered, curClip?.id, mediaReady]);

  // 미리보기 소리: 렌더와 같은 규칙으로 정한 효과음 시각·배경음악 (서버가 계산)
  const [audioPlan, setAudioPlan] = useState<{ sfx: { t: number; gain: number; url: string; name?: string }[]; bgm: { url: string; volume: number } | null } | null>(null);
  const audioKey = JSON.stringify([project.fx, beats.map((b) => [b.role, b.clipId, b.tts?.duration])]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/wings-shopping-v2/projects/${project.id}/audio-plan`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setAudioPlan(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [project.id, audioKey]);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const lastSfxT = useRef(0);
  useEffect(() => {
    const a = bgmRef.current;
    if (!a || rendered) return;
    if (playing) {
      if (a.duration) a.currentTime = tRef.current % a.duration;
      void a.play().catch(() => undefined);
    } else a.pause();
    lastSfxT.current = tRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, seekNonce, rendered, audioPlan?.bgm?.url]);
  // 크기는 저장된 설정을 바로 따른다 (슬라이더를 움직이는 중에는 FxPanel 이 직접 바꿈)
  const bgmVol = project.fx?.bgmVolume ?? 0.18;
  useEffect(() => { if (bgmRef.current) bgmRef.current.volume = previewBgmVolume(bgmVol); }, [bgmVol, audioPlan?.bgm?.url]);
  useEffect(() => {
    if (!playing || rendered || !audioPlan) return;
    const from = lastSfxT.current;
    if (t < from || t - from > 1) { lastSfxT.current = t; return; } // 되감기·건너뛰기
    for (const e of audioPlan.sfx) {
      if (e.t > from && e.t <= t) {
        const s = new Audio(e.url);
        s.volume = Math.min(1, Math.max(0.05, e.gain * 0.9));
        void s.play().catch(() => undefined);
      }
    }
    lastSfxT.current = t;
  }, [t, playing, rendered, audioPlan]);

  // 미리보기 모션: 렌더와 같은 규칙으로 확대샷(1 + 0.16·sin)·CTA·POINT 배지를 보여 준다
  const fx = fxSettings(project);
  const motionBeats = useMemo(() => beats.map((b, i) => ({ start: starts[i] ?? 0, end: (starts[i] ?? 0) + (durs[i] ?? 0), text: b.text, role: b.role })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beats, durs.join(',')]);
  const zoomWins = useMemo(() => (fx.motion && fx.motionPreset !== 'badge' ? punchZoomWindows(motionBeats) : []), [fx.motion, fx.motionPreset, motionBeats]);
  const callouts = useMemo(() => (fx.motion ? motionCallouts(motionBeats, fx.motionPreset === 'clean', project.lang) : []), [fx.motion, fx.motionPreset, motionBeats, project.lang]);
  const extras = useMemo(() => (fx.motion && fx.motionPreset === 'full' ? motionExtras(motionBeats, fx.seed) : null), [fx.motion, fx.motionPreset, fx.seed, motionBeats]);
  const zw = zoomWins.find((w) => t >= w.start && t < w.end);
  const extraZooms = useMemo(() => (extras ? transitionZoomWindows(extras, motionBeats) : []), [extras, motionBeats]);
  // 렌더처럼 여러 확대가 겹치면 더한다 (ffmpeg max 중첩과 같게 가장 큰 값)
  const zoom = 1 + Math.max(zw ? 0.16 * Math.sin((Math.PI * (t - zw.start)) / (zw.end - zw.start)) : 0, ...extraZooms.map((w) => w.amp * zoomEnvelope(w, t)));
  const callout = callouts.find((c) => t >= c.start && t < c.end);

  // 전체화면 = 9:16 쇼츠 크기로 크게 보는 팝업
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big]);

  function togglePlay() {
    if (rendered) {
      const v = outRef.current;
      if (!v) return;
      if (v.paused) void v.play();
      else v.pause();
      return;
    }
    if (!playing && t >= beatsTotal) seek(0);
    setPlaying(!playing);
  }

  // 장면 편집
  const [tab, setTab] = useState<Tab>('장면');
  const [sel, setSel] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoomClip, setZoomClip] = useState<Clip | null>(null);
  const clips = useMemo(() => project.clips.filter((c) => !c.excluded), [project.clips]);
  const listen = useRef<HTMLAudioElement | null>(null);

  async function saveBeat(i: number, patch: Partial<Beat>) {
    const b = beats[i];
    setSaving(b.id);
    setErr(null);
    try {
      setProject(await patchProject(project.id, { beats: toPatch(beats.map((x, j) => (j === i ? { ...x, ...patch } : x))) }));
      setChanged((s) => new Set(s).add(b.id));
      setDrafts(({ [b.id]: _, ...rest }) => rest);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }
  async function remakeVoice() {
    await startStage(project.id, 'tts').catch(() => undefined);
    setChanged(new Set());
    refresh();
  }
  function selectBeat(i: number) {
    setSel(i);
    seek(starts[i] ?? 0);
  }
  const needVoice = beats.filter((b) => !b.tts || changed.has(b.id)).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 상단 바 */}
      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-panel px-6 py-5 shadow-[var(--shadow)]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted">완성 영상 편집</p>
          <h2 className="truncate text-2xl font-extrabold tracking-[-0.02em] text-text" title={project.name}>{project.name}</h2>
          <div className="mt-1.5"><LangSwitch project={project} onOpen={onOpenVersion} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-panel-2 p-1.5">
          {out && !running && (
            <a className="btn btn-ghost" href={`${mediaUrl(project.id, out.file)}?download`}>mp4 내려받기</a>
          )}
          <button className={`rounded-xl bg-white px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:cursor-default ${clean ? 'text-emerald-600' : 'text-text hover:text-amber disabled:opacity-50'}`} disabled={cleaning || running || missing >= 0 || !!clean} onClick={async () => {
            // 유료 모자이크 지우기를 고른 경우 설정에 저장된 Vmake 키를 같이 보낸다
            const vmakeApiKey = shotformVmakeApiKey();
            const vmakeSecretAccessKey = shotformVmakeSecretAccessKey();
            await startStage(project.id, 'clean', vmakeApiKey && vmakeSecretAccessKey ? { vmakeApiKey, vmakeSecretAccessKey } : undefined).catch(() => undefined);
            refresh();
          }}>
            {cleaning ? '자막 지우는 중...' : clean ? '✓ 자막 제거됨' : '① 자막 제거'}
          </button>
          <span aria-hidden className="text-muted">›</span>
          <button className="btn btn-primary !rounded-xl !px-5" disabled={running || cleaning || missing >= 0 || (!!out && !out.stale)} onClick={async () => {
            const vmakeApiKey = shotformVmakeApiKey();
            const vmakeSecretAccessKey = shotformVmakeSecretAccessKey();
            await startStage(project.id, 'render', vmakeApiKey && vmakeSecretAccessKey ? { vmakeApiKey, vmakeSecretAccessKey } : undefined).catch(() => undefined);
            refresh();
          }}>
            {out && !out.stale ? '✓ 렌더링 완료' : '② 렌더링 (합치기)'}
          </button>
        </div>
        <div className="w-full space-y-1 border-t border-line pt-3">
            {missing >= 0 && <p className="text-sm text-danger">{missing + 1}번 문장에 장면이나 음성이 없습니다. 장면 탭에서 채워 주세요.</p>}
            {cleanJob?.state !== 'done' && <JobLine job={cleanJob} />}
            <JobLine job={job} />
            {!clean && !cleaning && missing < 0 && <p className="text-sm text-muted">자막 제거를 누르면 미리보기도 글자가 지워진 영상으로 보여요. 장면이나 음성을 바꾸면 다시 눌러 주세요.</p>}
            {clean && !rendered && !running && <p className="text-sm text-muted">효과음·배경음악·모션은 바꾸는 대로 미리보기에 바로 반영돼요. 마음에 들면 렌더링을 눌러 합치세요.</p>}
            {out?.notes?.map((n) => <p key={n} className="text-sm text-amber">{n}</p>)}
        </div>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 플레이어 */}
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-[radial-gradient(120%_70%_at_50%_0%,#e4e7ff_0%,#f1f2fb_55%,#f7f8fc_100%)] p-5 shadow-[var(--shadow)] ring-1 ring-[#2f3beb]/10">
          <div
            className={big ? 'fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-black/85 p-4' : 'w-full'}
            onClick={big ? (e) => { if (e.target === e.currentTarget) setBig(false); } : undefined}
            role={big ? 'dialog' : undefined}
            aria-modal={big ? true : undefined}
            aria-label={big ? '크게 보기' : undefined}
          >
          {audioPlan?.bgm && !rendered && <audio ref={bgmRef} src={audioPlan.bgm.url} loop preload="auto" data-bgm-editor onLoadedMetadata={(e) => { e.currentTarget.volume = previewBgmVolume(bgmVol); }} />}
          <PhoneShell className={big ? '!max-w-none' : 'max-w-[260px]'} style={big ? { width: 'min(calc((100vh - 150px) * 9 / 16 + 20px), 92vw)' } : undefined}>
            <div ref={screenRef} className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] bg-black">
              {rendered ? (
                <video ref={outRef} key={out?.at} src={playableUrl} playsInline preload="auto" className="h-full w-full object-contain"
                  onLoadedMetadata={(e) => setVideoDur(e.currentTarget.duration)}
                  onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={togglePlay} />
              ) : (
                <TemplateLiveFrame project={project} showPoster={t < POSTER_SECONDS} posterT={t} overlay={<>
                  {curLine ? <TemplateLiveFrame.Caption text={curLine} /> : null}
                  {callout && t >= POSTER_SECONDS && <MotionBadge kind={callout.kind} label={callout.label} />}
                  {extras && <MotionExtrasLayer t={t} extras={extras} />}
                </>}>
                  {clean ? (
                    <video ref={cleanRef} key={media.get(cleanVideoUrl)} src={media.get(cleanVideoUrl)} muted playsInline preload="auto"
                      className="absolute inset-0 h-full w-full object-cover" style={{ transform: `scale(${zoom})` }}
                      onLoadedMetadata={(e) => { e.currentTarget.currentTime = tRef.current; }} />
                  ) : beatVideoUrl(cur) ? (
                    beats.map((b, i) => {
                      const c = b.clipId ? clipById.get(b.clipId) : undefined;
                      const u = beatVideoUrl(i);
                      if (!c || !u || !mediaReady) return null;
                      return (
                        <video key={`${b.id}:${media.get(u)}`} ref={(el) => { beatVideos.current[i] = el; }} src={media.get(u)} muted playsInline preload="auto"
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{ opacity: i === cur ? 1 : 0, transform: i === cur ? `scale(${zoom})${c.flip ? ' scaleX(-1)' : ''}` : c.flip ? 'scaleX(-1)' : undefined }}
                          onLoadedMetadata={(e) => { e.currentTarget.currentTime = i === curRef.current ? c.start + Math.max(0, tRef.current - (starts[i] ?? 0)) : c.start; }} />
                      );
                    })
                  ) : curClip ? (
                    <img src={frameUrl(project.id, curClip.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <p className="absolute inset-0 flex items-center justify-center text-xs text-white/60">장면 없음</p>
                  )}
                  {mediaReady && beats.map((b, i) => beatAudioUrl(i) ? <audio key={`${b.id}:${media.get(beatAudioUrl(i))}`} ref={(el) => { beatAudios.current[i] = el; }} src={media.get(beatAudioUrl(i))} preload="auto" /> : null)}
                  {!mediaReady && (
                    <div className="absolute inset-0 grid place-items-center bg-black/55 text-center text-white">
                      <div>
                        <span className="mx-auto mb-2 block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                        <p className="text-[11px] font-semibold">끊김 없이 보려고 영상을 불러오는 중</p>
                        <p className="mt-0.5 text-[10px] tabular-nums text-white/70">{media.done}/{preload.length}</p>
                      </div>
                    </div>
                  )}

                </TemplateLiveFrame>
              )}
              {/* '맨 앞 0.01초에 넣기': 첫 프레임만 썸네일 → 재생 전 0초에 멈춰 있을 때만 보인다 */}
              {!rendered && project.thumbnail?.prepend && project.thumbnail.file && t < 0.01 && !playing && (
                <img src={`${mediaUrl(project.id, project.thumbnail.file)}?v=${project.thumbnail.at ?? 0}`} alt="맨 앞 썸네일" className="absolute inset-0 z-10 h-full w-full object-cover" />
              )}
            </div>
          </PhoneShell>
          {big && (
            <div className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-white">
              <button className="grid h-10 w-10 place-items-center rounded-full border border-white/30 hover:bg-white/10" onClick={() => seek(0)} aria-label="맨 앞으로" title="맨 앞으로">⏮</button>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-amber text-amber-ink" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'}>{playing ? '❚❚' : '▶'}</button>
              <span className="text-sm tabular-nums">{clock(Math.min(t, total))} / {clock(total)}</span>
              <button className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold hover:bg-white/10" onClick={() => setBig(false)}>닫기</button>
            </div>
          )}
          </div>
          <div className="flex w-full max-w-[260px] items-center gap-1.5 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-line">
            <button className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-text disabled:opacity-40" onClick={() => seek(0)} disabled={t === 0} aria-label="맨 앞으로" title="맨 앞으로">⏮</button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-[var(--amber)] text-white shadow-[0_8px_20px_-8px_var(--amber)] transition hover:brightness-110 disabled:opacity-40" onClick={togglePlay} disabled={(!beats.length && !rendered) || !mediaReady} aria-label={playing ? '일시정지' : '재생'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <span className="flex-1 text-center text-xs tabular-nums text-muted">{clock(Math.min(t, total))} / {clock(total)}</span>
            <button className="rounded-full px-3 py-2 text-xs font-semibold text-muted transition hover:bg-panel-2 hover:text-text" onClick={() => setBig(true)}>⤢ 크게</button>
          </div>
          <p className="text-center text-[11px] text-muted">{rendered ? '완성 영상 재생 중' : '완성 영상 전 · 문장별 장면과 음성으로 미리보기'}</p>
        </section>

        {/* 오른쪽 탭 */}
        <section className="min-w-0 rounded-3xl border border-line bg-panel shadow-[var(--shadow)] lg:relative">
          <div className="flex min-h-0 flex-col lg:absolute lg:inset-0">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-4 py-3" role="tablist">
            {TABS.map((x) => (
              <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === x ? 'bg-[#0e1016] text-white shadow-sm' : 'text-muted hover:bg-panel-2 hover:text-text'}`}>
                {x}
              </button>
            ))}
          </nav>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
            {tab === '장면' && (
              <div className="flex flex-col gap-3">
                {needVoice > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-sm">
                    <span className="font-semibold text-amber">음성 다시 만들기 필요 · {needVoice}개 문장</span>
                    <span className="flex-1" />
                    <button className="btn btn-primary !py-1.5 text-sm" disabled={ttsRunning} onClick={remakeVoice}>{ttsRunning ? '음성 만드는 중...' : '음성 다시 만들기'}</button>
                  </div>
                )}
                <JobLine job={project.jobs.tts} />
                {err && <p className="text-sm text-danger">{err}</p>}
                {!beats.length && <p className="text-sm text-muted">대본이 없습니다. 대본·음성 단계에서 먼저 만들어 주세요.</p>}
                <ol className="flex flex-col gap-2 pr-1">
                  {beats.map((b, i) => {
                    const clip = b.clipId ? clipById.get(b.clipId) : undefined;
                    const draft = drafts[b.id];
                    const stale = !b.tts || changed.has(b.id);
                    return (
                      <li key={b.id} onClick={() => sel !== i && selectBeat(i)}
                        className={`grid cursor-pointer grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-2xl border p-3.5 transition ${i === cur && !rendered ? 'border-amber bg-amber/[0.04] shadow-[0_0_0_3px_rgba(47,59,235,0.10)]' : i === sel ? 'border-amber/50 bg-panel-2/60' : 'border-line hover:border-amber/40 hover:shadow-sm'}`}>
                        <div className="flex flex-col gap-1.5">
                          <div className="aspect-[9/16] w-[72px] overflow-hidden rounded-xl bg-panel-2 shadow-sm ring-1 ring-black/5">
                            {clip && <img src={frameUrl(project.id, clip.id)} alt="" className="h-full w-full object-cover" />}
                          </div>
                          {clip && (
                            <button className="text-[11px] text-amber hover:underline" onClick={(e) => { e.stopPropagation(); setZoomClip(clip); }}>크게 보기</button>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold tabular-nums ${i === cur && !rendered ? 'bg-[var(--amber)] text-white' : 'bg-panel-2 text-text'}`}>{i + 1}</span>
                            {b.role && <span className="rounded bg-amber/15 px-1.5 leading-5 text-amber">{ROLE_LABEL[b.role] ?? b.role}</span>}
                            <span className="tabular-nums text-muted">{b.tts ? `${b.tts.duration.toFixed(1)}초` : '음성 없음'}</span>
                            {stale && <span className="rounded-full bg-danger/10 px-2 leading-5 font-semibold text-danger">음성 다시 만들기 필요</span>}
                            <span className="flex-1" />
                            {b.tts && (
                              <button className="rounded-full border border-line bg-white px-2.5 py-0.5 font-semibold text-muted transition hover:border-amber hover:text-amber" onClick={(e) => {
                                e.stopPropagation();
                                listen.current?.pause();
                                listen.current = new Audio(mediaUrl(project.id, b.tts!.file));
                                void listen.current.play().catch(() => undefined);
                              }}>▶ 목소리 듣기</button>
                            )}
                          </div>
                          <textarea className="field mt-2 min-h-[3.5rem] resize-y !rounded-xl !border-transparent !bg-panel-2/70 text-[15px] font-medium leading-relaxed focus:!border-amber focus:!bg-white" aria-label={`${i + 1}번 문장`}
                            value={draft ?? b.text} rows={Math.max(2, (draft ?? b.text).split('\n').length)}
                            onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))} />
                          {draft !== undefined && draft !== b.text && (
                            <div className="mt-1 flex gap-2">
                              <button className="btn btn-primary !py-1 text-xs" disabled={saving === b.id || !draft.trim()} onClick={(e) => { e.stopPropagation(); void saveBeat(i, { text: draft }); }}>
                                {saving === b.id ? '저장 중...' : '문장 저장'}
                              </button>
                              <button className="btn btn-ghost !py-1 text-xs" onClick={(e) => { e.stopPropagation(); setDrafts(({ [b.id]: _, ...rest }) => rest); }}>취소</button>
                            </div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <select className="field !w-auto max-w-full flex-1 !rounded-lg !py-1 text-xs" value={b.clipId ?? ''} disabled={saving === b.id}
                              onClick={(e) => e.stopPropagation()} onChange={(e) => void saveBeat(i, { clipId: e.target.value || null })} aria-label={`${i + 1}번 장면`}>
                              {!b.clipId && <option value="">장면 선택</option>}
                              {clip?.excluded && <option value={clip.id}>{clip.description} (제외됨)</option>}
                              {clips.map((c, k) => <option key={c.id} value={c.id}>{k + 1}. {c.description.slice(0, 40)}</option>)}
                            </select>
                            {clip && <span className="tabular-nums">{clip.start.toFixed(1)}–{clip.end.toFixed(1)}초</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {tab === '효과음' && <FxPanel project={project} setProject={setProject} />}
            {tab === '썸네일 생성' && (
              <div className="flex flex-col gap-6">
                {project.ssul ? (
                  <>
                    <CoverThumbnailStudio project={project} setProject={setProject} />
                    <details className="rounded-2xl border border-line bg-panel-2/40 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-text">AI 썸네일 스튜디오 (이미지 생성형)</summary>
                      <div className="mt-4">{thumbnailSlot ?? <ThumbnailPanel project={project} setProject={setProject} />}</div>
                    </details>
                  </>
                ) : (thumbnailSlot ?? <ThumbnailPanel project={project} setProject={setProject} />)}
              </div>
            )}
            {tab === '업로드' && <UploadTab project={project} setProject={setProject} refresh={refresh} />}
            {tab === '해외버전' && (
              beats.length ? <LocalizePanel project={project} onOpen={onOpenVersion} /> : <p className="text-sm text-muted">대본이 생기면 해외 버전을 만들 수 있어요.</p>
            )}
          </div>
          </div>
        </section>
      </div>

      <Timeline sfx={fx.sfx ? audioPlan?.sfx ?? [] : []} projectId={project.id} beats={beats} starts={starts} durs={durs} total={Math.max(total, beatsTotal)} t={t} onSeek={(x) => {
        seek(x);
        let i = 0;
        for (let k = 0; k < beats.length; k++) if (x >= starts[k]) i = k;
        setSel(i);
      }} sel={sel} />

      {zoomClip && <ClipModal projectId={project.id} clip={zoomClip} file={fileOf(zoomClip)} onClose={() => setZoomClip(null)} />}
    </div>
  );
}

/** 문장 텍스트로 정해지는 가짜 파형 높이 (매 렌더마다 같은 모양) */
function bars(seed: string, n: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 25 + ((h >>> 16) % 70) * (0.6 + 0.4 * Math.sin(i / 3));
  });
}

function Timeline({ sfx, projectId, beats, starts, durs, total, t, onSeek, sel }: {
  sfx: { t: number; name?: string }[];
  projectId: string; beats: Beat[]; starts: number[]; durs: number[]; total: number; t: number; onSeek: (t: number) => void; sel: number;
}) {
  const [pps, setPps] = useState(48); // 1초당 픽셀
  const width = Math.max(1, total) * pps + 40;
  const step = pps >= 60 ? 1 : pps >= 30 ? 2 : 5;
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  const area = useRef<HTMLDivElement>(null);
  const tracks: { label: string; h: string }[] = [{ label: '자막', h: 'h-8' }, { label: '영상', h: 'h-12' }, { label: '소리', h: 'h-9' }, { label: '효과음', h: 'h-7' }];

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-line bg-panel shadow-[var(--shadow)]">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <h3 className="text-sm font-bold text-text">타임라인</h3>
        <span className="text-xs tabular-nums text-muted">{beats.length}개 장면 · {total.toFixed(1)}초</span>
        <span className="flex-1" />
        <button className="btn btn-ghost !px-2.5 !py-1 text-sm" onClick={() => setPps((p) => Math.max(12, p / 1.5))} aria-label="축소">−</button>
        <span className="w-10 text-center text-xs tabular-nums text-muted">{Math.round((pps / 48) * 100)}%</span>
        <button className="btn btn-ghost !px-2.5 !py-1 text-sm" onClick={() => setPps((p) => Math.min(240, p * 1.5))} aria-label="확대">+</button>
      </div>
      <div className="flex">
        <div className="w-16 shrink-0 border-r border-line bg-panel-2/60 text-[11px] font-semibold text-muted">
          <div className="h-6" />
          {tracks.map((x) => <div key={x.label} className={`${x.h} mb-1.5 flex items-center justify-center`}>{x.label}</div>)}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div ref={area} className="relative cursor-pointer select-none pb-1.5" style={{ width }}
            onClick={(e) => onSeek((e.clientX - area.current!.getBoundingClientRect().left - 8) / pps)}>
            {/* 눈금 */}
            <div className="relative h-6 border-b border-line">
              {ticks.map((s) => (
                <span key={s} className="absolute top-0 h-full border-l border-line pl-1 text-[10px] tabular-nums text-muted" style={{ left: 8 + s * pps }}>
                  {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
                </span>
              ))}
            </div>
            <div className="relative mt-1.5 flex flex-col gap-1.5">
              {/* 자막 */}
              <div className="relative h-8">
                {beats.map((b, i) => (
                  <div key={b.id} className={`absolute inset-y-0 truncate rounded-lg border px-2 text-[11px] font-medium leading-8 ${i === sel ? 'border-amber bg-[var(--amber)] text-white' : 'border-amber/25 bg-amber/[0.07] text-text/80'}`}
                    style={{ left: 8 + starts[i] * pps, width: Math.max(4, durs[i] * pps - 2) }} title={b.text}>
                    {b.text.replace(/\n/g, ' ').split(' ').slice(0, 4).join(' ')}
                  </div>
                ))}
              </div>
              {/* 영상 */}
              <div className="relative h-12">
                {beats.map((b, i) => (
                  <div key={b.id} className={`absolute inset-y-0 overflow-hidden rounded-lg border-2 bg-panel-2 ${i === sel ? 'border-amber' : 'border-transparent'}`}
                    style={{
                      left: 8 + starts[i] * pps, width: Math.max(4, durs[i] * pps - 2),
                      backgroundImage: b.clipId ? `url(${frameUrl(projectId, b.clipId)})` : undefined, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x',
                    }}>
                    {!b.clipId && <span className="px-1 text-[10px] text-danger">장면 없음</span>}
                  </div>
                ))}
              </div>
              {/* 소리 */}
              <div className="relative h-9">
                {beats.map((b, i) => {
                  const w = Math.max(4, durs[i] * pps - 2);
                  return (
                    <div key={b.id} className={`absolute inset-y-0 flex items-center gap-[2px] overflow-hidden rounded-lg border px-1 ${b.tts ? 'border-indigo-200 bg-indigo-50/70' : 'border-dashed border-line bg-transparent'}`}
                      style={{ left: 8 + starts[i] * pps, width: w }}>
                      {b.tts && bars(b.text, Math.floor(w / 4)).map((h, k) => <span key={k} className="w-[2px] shrink-0 rounded-full bg-indigo-500/60" style={{ height: `${h}%` }} />)}
                    </div>
                  );
                })}
              </div>
              {/* 효과음: 렌더와 같은 규칙으로 정한 위치 */}
              <div className="relative h-7">
                {sfx.map((e, i) => (
                  <span key={i} title={`${e.name ?? '효과음'} · ${e.t.toFixed(2)}초`}
                    className="absolute top-0 flex h-full max-w-[96px] items-center gap-1 truncate rounded-md border border-violet-300 bg-violet-50 pl-1 pr-1.5 text-[10px] font-semibold text-violet-700"
                    style={{ left: 8 + e.t * pps }}>
                    <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full bg-violet-500" />
                    {e.name ?? '효과음'}
                  </span>
                ))}
              </div>
            </div>
            {/* 재생 헤드 */}
            <div className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-[var(--amber)]" style={{ left: 8 + t * pps }}>
              <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full border-2 border-white bg-[var(--amber)] shadow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClipModal({ projectId, clip, file, onClose }: { projectId: string; clip: Clip; file?: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal aria-label="장면 크게 보기">
      <div className="w-full max-w-[420px] rounded-2xl bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-sm text-text">{clip.description}<span className="ml-2 tabular-nums text-muted">{clip.start.toFixed(1)}–{clip.end.toFixed(1)}초</span></p>
          <button className="btn btn-ghost !px-2.5 !py-1 text-sm" onClick={onClose}>닫기</button>
        </div>
        {file ? (
          <video src={`${mediaUrl(projectId, file)}#t=${clip.start},${clip.end}`} autoPlay muted playsInline controls
            className="mx-auto aspect-[9/16] max-h-[75vh] w-full rounded-xl bg-black object-contain"
            onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= clip.end - 0.04) e.currentTarget.currentTime = clip.start; }} />
        ) : (
          <img src={frameUrl(projectId, clip.id)} alt="" className="mx-auto aspect-[9/16] max-h-[75vh] rounded-xl bg-black object-contain" />
        )}
      </div>
    </div>
  );
}
