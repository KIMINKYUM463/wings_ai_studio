import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { getProject, newProjectId, projectDir, saveNewProject, setJob, updateProject } from './store';
import { LocalizeSchema, applyLocalization, cloneProjectFiles, localizePrompt, requireLang } from './i18n/localize';
import type { Clip, Project, Source, Stage } from './types';
import { detectPlatform, download, normalizeYoutubeUrl } from './media/ytdlp';
import {
  applyPunchZooms, composeTemplate, concatAudios, concatVideos, cutsToClips, detectScenes, extractFrame, mux, probeDuration, probeTargetFps, renderPiece, runFfmpeg, trimSpeechSilence,
} from './media/ffmpeg';
import { punchZoomWindows , motionExtras, transitionZoomWindows } from './motion/ass';
import { analyzeReference, describeClips, detectContentBox, detectTextBoxes, generateJson, writeScript, writeSsulScript } from './ai/gemini';
import { DEFAULT_REMIX_TEMPLATE_ID, getRemixTemplate, getTemplate } from './templates/catalog';
import { prependStill } from './thumbnails/render';
import { buildTemplateAss } from './templates/ass';
import { applyVideoFit } from './templates/video-fit';
import { templateData, modeDefaults } from './ssul/settings';
import { getPlaybook } from './ssul/playbook';
import { getCustomStructure } from './ssul/custom-structures';
import type { SsulScriptOptions } from './ssul/prompt';

/** 구조 복제 템플릿을 골랐으면 보관함에서 꺼내 대본 옵션에 붙인다 (지워졌으면 자동 추천으로) */
async function withCustomStructure(o: SsulScriptOptions): Promise<SsulScriptOptions> {
  if (!o.structureId?.startsWith('custom:')) return o;
  const custom = await getCustomStructure(o.structureId);
  return custom ? { ...o, custom } : { ...o, structureId: 'auto' };
}
import { canonicalUrl, ensureSearchQueries, sameVideo, searchVideos } from './search/search';
import { resolveThumbnail } from './search/thumbnails';
import { defaultVoice, listVoices, synthesize as tts, voiceStyle } from './tts';

import {
  PAD,
  pieceFrameCounts,
  pieceOutputDuration,
  planContinuousOriginalStreams,
  timedMasksForPiece,
  type SegmentPiece,
} from './sync';
import { buildAss, lineTimings, splitLines, type Cue } from './subtitles';
import { fxSettings } from './audio/settings';
import { generateBgm } from './audio/bgm';
import { ensureSfx, planSfx } from './audio/sfx';
import { mixAudio } from './audio/mix';
import { disclosureLines, withDisclosure, type Affiliate } from './publish/disclosure';
import { packText } from './publish/pack';
import { langFonts, withLangFont } from './i18n/fonts';
import { badgeLines, badgeStyle, itemSpans } from './review/badge';
import { itemNames, reviewQueries } from './review/search';
import { isStoryMode, type Beat, type CharAlignment, type StoryMode } from './types';
import { downloadSourceVideo } from '@/lib/shotform-auto-edit-ffmpeg';
import { withTimeout } from '@/lib/shotform-auto-edit-script-step';
import { remixScriptTemplatePrompt } from '@/lib/shotform-remix-script-templates';
import { synthesizeChosenLine } from '@/lib/shotform-remix-chosen-tts';
import { ttsProviderFromVoiceId } from '@/lib/shotform-tts-providers';
import { removeChineseSubtitlesFromLocalFile } from '@/lib/shotform-vmake-client';
import { cleanSourceWithSttn, sttnAvailable, STTN_NOT_INSTALLED } from './media/sttn';
import { VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS } from '@/lib/shotform-vmake-subtitle-removal';
import { mvpAudioCatalogItem } from '@/lib/mvp-studio-audio-catalog';

export const REF_SOURCE_ID = 'ref';
const FONTS_DIR = process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');

const rel = (id: string, ...p: string[]) => path.join(projectDir(id), ...p);
const exists = (f: string) => fs.access(f).then(() => true, () => false);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

// 지금 이 서버 프로세스에서 실제로 돌고 있는 작업. 핫리로드 후에도 유지되도록 globalThis에 둔다.
const g = globalThis as unknown as { __liveJobs?: Set<string> };
const live = (g.__liveJobs ??= new Set<string>());
const jobKey = (id: string, stage: Stage) => `${id}:${stage}`;

export function isRunning(id: string, stage: Stage): boolean {
  return live.has(jobKey(id, stage));
}

/**
 * 작업 실행 래퍼: 상태를 running → done/error로 기록한다. 예외를 던지지 않는다.
 * 같은 단계가 이미 돌고 있으면 아무것도 하지 않는다. 확인과 점유가 같은 틱에서 일어나서 연속 클릭에도 안전하다.
 */
export async function runJob(id: string, stage: Stage, fn: (progress: (m: string, p?: number) => Promise<unknown>) => Promise<void>) {
  const key = jobKey(id, stage);
  if (live.has(key)) return;
  live.add(key);
  const progress = (message: string, p?: number) => setJob(id, stage, { state: 'running', message, progress: p });
  try {
    await progress('시작하는 중...', 0);
    await fn(progress);
    await setJob(id, stage, { state: 'done', progress: 1 });
  } catch (e) {
    console.error(`[${stage}]`, e);
    await setJob(id, stage, { state: 'error', message: msg(e) }).catch(() => {});
  } finally {
    live.delete(key);
  }
}
const job = runJob;

/** 저장된 상태는 running인데 실제로 도는 작업이 없으면(서버 재시작 등) 중단됨으로 보여준다. */
export function withLiveJobs(p: Project): Project {
  const jobs = { ...p.jobs };
  for (const [stage, j] of Object.entries(jobs) as [Stage, NonNullable<Project['jobs'][Stage]>][]) {
    if (j.state === 'running' && !isRunning(p.id, stage)) {
      jobs[stage] = { ...j, state: 'error', message: '작업이 중단되었습니다 (서버 재시작). 다시 실행해 주세요.' };
    }
  }
  return { ...p, jobs, cleanFresh: !!p.clean && p.clean.key === cleanKey(p) };
}

/** 앞 단계가 바뀌었을 때 뒤 단계 데이터를 정리한다. */
export function markStale(p: Project): void {
  const srcIds = p.sources ? new Set(p.sources.map((s) => s.id)) : null;
  const valid = new Set(p.clips.filter((c) => !c.excluded && (!srcIds || srcIds.has(c.sourceId))).map((c) => c.id));
  for (const b of p.script?.beats ?? []) if (b.clipId && !valid.has(b.clipId)) b.clipId = null;
  if (p.output) p.output.stale = true;
}

/** 음성 생성 방식이 바뀌면 올린다 → 예전 음성 파일은 다시 만들어짐 (v2: Gemini 문장만 전송 + 속도 보정) */
const TTS_VERSION = 'v2';
export const ttsHash = (text: string, voiceId: string, speed: number) =>
  crypto.createHash('sha1').update(`${text}|${voiceId}|${speed}|${TTS_VERSION}`).digest('hex').slice(0, 16);

// ① 분석
export function runAnalyze(id: string) {
  return job(id, 'analyze', async (progress) => {
    const p = await getProject(id);
    const url = normalizeYoutubeUrl(p.referenceUrl) ?? p.referenceUrl;
    const file = rel(id, 'sources', `${REF_SOURCE_ID}.mp4`);
    await progress('레퍼런스 영상을 내려받는 중...', 0.1);
    let dl: { file: string; duration: number; title?: string } = { file, duration: 0 };
    if (await exists(file)) dl.duration = await probeDuration(file);
    else dl = await download(url, file);
    await progress('AI가 영상을 분석하는 중... (1~2분)', 0.4);
    const analysis = await analyzeReference(file);
    await updateProject(id, (x) => {
      x.analysis = analysis;
      x.name = analysis.productName || x.name;
      x.referenceSourceId = REF_SOURCE_ID;
      if (!x.sources.some((s) => s.id === REF_SOURCE_ID)) {
        x.sources.unshift({ id: REF_SOURCE_ID, url: p.referenceUrl, platform: detectPlatform(p.referenceUrl), title: dl.title ?? '레퍼런스', file: `sources/${REF_SOURCE_ID}.mp4`, duration: dl.duration, status: 'ready' });
      }
    });
  });
}

// ② 검색
export function runSearch(id: string) {
  return job(id, 'search', async (progress) => {
    const p = await getProject(id);
    if (!p.analysis) throw new Error('먼저 영상 분석을 끝내야 합니다');
    await progress('YouTube·TikTok·Instagram·더우인·샤오홍슈에서 검색하는 중...', 0.2);
    const warnings: string[] = [];
    // 썰·리믹스 공통: YouTube·TikTok 검색어가 비어 있으면 상품명·키워드로 채운다
    const filled = ensureSearchQueries(p.analysis);
    const queries = p.mode === 'review' ? reviewQueries(filled, p.reviewInfo) : filled;
    await updateProject(id, (x) => {
      if (x.analysis) x.analysis.searchQueries = queries;
    });
    const limit = p.mode === 'review' ? Math.min(8, Math.max(4, itemNames(p.reviewInfo).length + 2)) : 4;
    const results = await searchVideos(queries, [p.referenceUrl], (w) => warnings.push(w), limit);
    await progress(`썸네일을 가져오는 중... (${results.length}개)`, 0.7);
    await pool(results, 6, async (r) => { r.thumbnail = await resolveThumbnail(r); });
    await updateProject(id, (x) => { x.searchResults = results; x.searchWarnings = warnings; });
  });
}

// ③ 소스 다운로드 + 장면 라이브러리
export function runSources(id: string) {
  return job(id, 'sources', async (progress) => {
    // 선택 목록과 소스 목록 동기화
    await updateProject(id, (x) => {
      // 같은 영상의 다른 URL 형태(shorts / watch / youtu.be)는 같은 소스로 본다
      const keep = new Set(x.selected.map(canonicalUrl));
      // URL 없는 소스(직접 업로드)는 항상 유지
      x.sources = x.sources.filter((s) => !s.url || keep.has(canonicalUrl(s.url)) || s.id === REF_SOURCE_ID);
      for (const url of x.selected) {
        if (!x.sources.some((s) => s.url && sameVideo(s.url, url))) {
          const title = x.searchResults?.find((r) => r.url === url)?.title;
          x.sources.push({ id: nanoid(8).replace(/[^A-Za-z0-9]/g, 'x'), url, platform: detectPlatform(url), title, status: 'pending' });
        }
      }
      const refPicked = x.selected.some((u) => sameVideo(u, x.referenceUrl));
      const ids = new Set(x.sources.filter((s) => s.id !== REF_SOURCE_ID || refPicked).map((s) => s.id));
      x.clips = x.clips.filter((c) => ids.has(c.sourceId));
      markStale(x);
    });

    const p = await getProject(id);
    const refPicked = p.selected.some((u) => sameVideo(u, p.referenceUrl));
    const todo = p.sources.filter((s) => (s.id !== REF_SOURCE_ID || refPicked) && (s.status !== 'ready' || !p.clips.some((c) => c.sourceId === s.id)));
    let done = 0;
    await pool(todo, 3, async (s) => {
      const res = await processSource(id, s);
      await updateProject(id, (x) => {
        const t = x.sources.find((y) => y.id === s.id);
        if (!t) return;
        Object.assign(t, res.source);
        x.clips = x.clips.filter((c) => c.sourceId !== s.id).concat(res.clips);
        // 리믹스 선택 영상으로 시작한 프로젝트는 실제 원본 최대 길이를 대본 기준 길이로 반영한다
        if (!x.referenceSourceId && x.analysis) {
          const maxReady = x.sources.reduce((m, row) => Math.max(m, row.duration ?? 0), 0);
          if (maxReady > 5) x.analysis.duration = maxReady;
        }
      });
      done++;
      await progress(`영상 처리 중... (${done}/${todo.length})`, done / Math.max(1, todo.length));
    });
  });
}

async function processSource(id: string, s: Source): Promise<{ source: Partial<Source>; clips: Clip[] }> {
  const relFile = s.file ?? `sources/${s.id}.mp4`;
  const file = rel(id, relFile);
  let duration = s.duration;
  try {
    if (!(await exists(file))) {
      const preferDirectFirst = s.platform === 'douyin' || s.platform === 'xiaohongshu';
      if (preferDirectFirst && s.directUrl) {
        await fs.mkdir(path.dirname(file), { recursive: true });
        try {
          await downloadSourceVideo(s.directUrl, file);
          duration = await probeDuration(file);
        } catch {
          await fs.rm(file, { force: true }).catch(() => {});
        }
      }
      if (!(await exists(file)) && s.url) {
        try {
          const dl = await download(s.url, file);
          duration = dl.duration;
        } catch (dlErr) {
          if (!preferDirectFirst && s.directUrl) {
            await fs.mkdir(path.dirname(file), { recursive: true });
            await downloadSourceVideo(s.directUrl, file);
            duration = await probeDuration(file);
          } else {
            throw dlErr;
          }
        }
      }
      if (!(await exists(file))) {
        return { source: { status: 'needsUpload', error: '파일이 없습니다' }, clips: [] };
      }
    }
    duration ??= await probeDuration(file);
  } catch (e) {
    return { source: { status: 'needsUpload', error: `다운로드 실패: ${msg(e).slice(0, 200)}` }, clips: [] };
  }
  try {
    const cuts = await detectScenes(file);
    const base = cutsToClips(cuts, duration, s.id);
    let desc: Awaited<ReturnType<typeof describeClips>> = [];
    try {
      desc = await describeClips(file, base);
    } catch (e) {
      console.error('describeClips', e);
    }
    const byId = new Map(desc.map((d) => [d.id, d]));
    const clips: Clip[] = base.map((c) => ({
      ...c,
      description: byId.get(c.id)?.description ?? '',
      shotType: byId.get(c.id)?.shotType ?? '',
      hasBurnedText: byId.get(c.id)?.hasBurnedText ?? false,
      quality: byId.get(c.id)?.quality ?? 3,
      textBoxes: byId.get(c.id)?.textBoxes ?? [],
    }));
    await fs.mkdir(rel(id, 'frames'), { recursive: true });
    for (const c of clips) {
      await extractFrame(file, (c.start + c.end) / 2, rel(id, 'frames', `${c.id}.jpg`)).catch(() => {});
    }
    await refineTextBoxes(id, file, clips);
    const contentBox = await findContentBox(id, s.id, file, duration);
    return { source: { status: 'ready', file: relFile, duration, error: undefined, contentBox }, clips };
  } catch (e) {
    return { source: { status: 'error', error: msg(e).slice(0, 300) }, clips: [] };
  }
}

/**
 * 장면마다 정지 화면 2장(30%, 70% 지점)으로 글자 위치를 다시 찾아 textBoxes를 덮어쓴다.
 * 영상 전체를 보고 짐작한 위치보다 정확하다. 실패하면 기존 값을 그대로 둔다.
 */
async function refineTextBoxes(id: string, file: string, clips: Clip[]) {
  try {
    const dir = rel(id, 'frames', 'det');
    await fs.mkdir(dir, { recursive: true });
    const images: { key: string; file: string }[] = [];
    for (const c of clips) {
      for (const [suffix, f] of [['a', 0.3], ['b', 0.7]] as const) {
        const out = path.join(dir, `${c.id}_${suffix}.jpg`);
        await extractFrame(file, c.start + (c.end - c.start) * f, out, 720);
        images.push({ key: `${c.id}_${suffix}`, file: out });
      }
    }
    const found = await detectTextBoxes(images);
    for (const c of clips) {
      const a = found[`${c.id}_a`];
      const b = found[`${c.id}_b`];
      if (a || b) c.textBoxes = [...(a ?? []), ...(b ?? [])];
    }
  } catch (e) {
    console.error('refineTextBoxes', e);
  }
}

/** 소스가 템플릿 영상(제목 띠·앱 UI 등)이면 실제 푸티지 영역을 찾는다. 실패하면 자르지 않는다. */
async function findContentBox(id: string, sourceId: string, file: string, duration: number): Promise<number[] | undefined> {
  try {
    const dir = rel(id, 'frames', 'det');
    await fs.mkdir(dir, { recursive: true });
    const frames = [];
    for (const f of [0.3, 0.7]) {
      const out = path.join(dir, `${sourceId}_content_${f}.jpg`);
      await extractFrame(file, duration * f, out, 540);
      frames.push(out);
    }
    return await detectContentBox(frames);
  } catch (e) {
    console.error('findContentBox', e);
    return undefined;
  }
}

function ensureBeatClips(beats: Beat[], usable: Clip[]): Beat[] {
  if (!usable.length) return beats;
  const usableById = new Map(usable.map((c) => [c.id, c]));
  const useCount = new Map<string, number>();
  let prevClipId: string | null = null;

  return beats.map((beat) => {
    const valid = beat.clipId && usableById.has(beat.clipId) ? beat.clipId : null;
    const repeatedBackToBack = valid !== null && valid === prevClipId && usable.length >= 2;
    if (valid && !repeatedBackToBack) {
      useCount.set(valid, (useCount.get(valid) ?? 0) + 1);
      prevClipId = valid;
      return beat;
    }
    const candidate = [...usable]
      .filter((c) => c.id !== prevClipId || usable.length === 1)
      .sort((a, b) => (useCount.get(a.id) ?? 0) - (useCount.get(b.id) ?? 0) || b.quality - a.quality)[0] ?? usable[0]!;
    useCount.set(candidate.id, (useCount.get(candidate.id) ?? 0) + 1);
    prevClipId = candidate.id;
    return { ...beat, clipId: candidate.id };
  });
}

function proportionalAlignment(text: string, duration: number): CharAlignment {
  const chars = [...text.replace(/\s*\n\s*/g, ' ').trim()];
  if (!chars.length) return { chars: [], starts: [], ends: [] };
  const step = Math.max(0.01, duration / chars.length);
  return {
    chars,
    starts: chars.map((_, idx) => Math.round(idx * step * 10000) / 10000),
    ends: chars.map((_, idx) => Math.round((idx + 1) * step * 10000) / 10000),
  };
}

// ④ 대본
export function runScript(id: string) {
  return job(id, 'script', async (progress) => {
    const p = await getProject(id);
    if (!p.analysis) throw new Error('먼저 영상 분석을 끝내야 합니다');
    const usable = p.clips.filter((c) => !c.excluded);
    if (!usable.length) throw new Error('사용할 클립이 없습니다. 영상 선택 단계를 먼저 끝내세요');
    await progress('AI가 대본을 쓰고 장면을 고르는 중...', 0.3);
    const target = Math.min(50, Math.max(20, p.analysis.duration || p.analysis.estimatedDurationSec || 32));
    if (p.lang && p.lang !== 'ko') throw new Error('해외판은 대본을 새로 쓰지 않습니다. 원본(한국어) 프로젝트에서 대본을 고친 뒤 해외판을 다시 만들거나, 여기서 문장을 직접 고치세요');
    const story = isStoryMode(p.mode);
    const maxSec = p.mode === 'review' ? 50 : 48;
    const facts = p.mode === 'travel' ? p.travelInfo : p.mode === 'review' ? p.reviewInfo : undefined;
    const structurePrompt = p.scriptTemplateId ? remixScriptTemplatePrompt(p.scriptTemplateId) : undefined;
    const rawScript = story
      ? await writeSsulScript(p.analysis, usable, await withCustomStructure({ ...(p.ssul ?? modeDefaults(p.mode as StoryMode)), targetSeconds: Math.min(maxSec, Math.max(22, target)) }), getPlaybook(p.mode), facts)
      : await writeScript(p.analysis, usable, target, structurePrompt);
    const script = { ...rawScript, beats: ensureBeatClips(rawScript.beats, usable) };
    await updateProject(id, (x) => {
      x.script = script;
      markStale(x);
    });
  });
}

export type ExtraTtsKeys = {
  typecastApiKey?: string;
  elevenlabsApiKey?: string;
};

// ④-2 음성
export function runTts(id: string, extraKeys?: ExtraTtsKeys) {
  return job(id, 'tts', async (progress) => {
    let p = await getProject(id);
    if (!p.script?.beats.length) throw new Error('대본이 없습니다');

    const customProvider = p.customVoice?.voiceId ? ttsProviderFromVoiceId(p.customVoice.voiceId) : null;
    if (customProvider && p.customVoice) {
      const { voiceId, style, speed } = p.customVoice;
      const beats = p.script.beats;
      const errors: string[] = [];
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        const spokenText = b.text.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
        if (!spokenText) continue;
        const hash = ttsHash(b.text, `${voiceId}:${style}`, speed);
        if (b.tts?.textHash === hash && (await exists(rel(id, b.tts.file)))) continue;
        await progress(`음성 생성 중... (${i + 1}/${beats.length})`, i / beats.length);
        try {
          const r = await synthesizeChosenLine(
            {
              voiceId,
              style,
              speed,
              typecastApiKey: extraKeys?.typecastApiKey,
              elevenlabsApiKey: extraKeys?.elevenlabsApiKey,
            },
            spokenText,
            rel(id, 'tts', b.id),
          );
          const relOut = `tts/${path.basename(r.file)}`;
          const alignment = proportionalAlignment(b.text, r.duration);
          await updateProject(id, (x) => {
            const t = x.script?.beats.find((y) => y.id === b.id);
            if (t && t.text === b.text) t.tts = { file: relOut, duration: r.duration, alignment, textHash: hash };
            if (x.output) x.output.stale = true;
          });
        } catch (e) {
          errors.push(`${i + 1}번: ${msg(e)}`);
        }
      }
      if (errors.length) throw new Error(`일부 음성 생성 실패 — ${errors.join(' / ')}`);
      return;
    }

    const voices = await listVoices();
    if (!voices.length) throw new Error('사용 가능한 목소리가 없습니다');
    // 목소리가 없거나 예전 제공자(예: Google) 목소리면 현재 제공자(Gemini)의 모드별 기본 목소리로 바꾼다
    if (!p.voice.voiceId || !voices.some((v) => v.id === p.voice.voiceId)) {
      const d = defaultVoice(p.mode);
      p = await updateProject(id, (x) => { x.voice = voices.some((v) => v.id === d.voiceId) ? d : { voiceId: voices[0].id, speed: x.voice.speed }; });
    }
    const { voiceId, speed } = p.voice;
    const beats = p.script!.beats;
    const errors: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const hash = ttsHash(b.text, voiceId, speed);
      const out = `tts/${b.id}.mp3`;
      if (b.tts?.textHash === hash && (await exists(rel(id, b.tts.file)))) continue;
      await progress(`음성 생성 중... (${i + 1}/${beats.length})`, i / beats.length);
      try {
        const r = await tts(b.text, voiceId, speed, { prev: beats[i - 1]?.text, next: beats[i + 1]?.text, style: voiceStyle(p.mode), lang: p.lang }, rel(id, out));
        await updateProject(id, (x) => {
          const t = x.script?.beats.find((y) => y.id === b.id);
          if (t && t.text === b.text) t.tts = { file: out, duration: r.duration, alignment: r.alignment, textHash: hash };
          if (x.output) x.output.stale = true;
        });
      } catch (e) {
        errors.push(`${i + 1}번: ${msg(e)}`);
      }
    }
    if (errors.length) throw new Error(`일부 음성 생성 실패 — ${errors.join(' / ')}`);
  });
}

function expectedBeatHash(p: Project, b: Beat): string {
  if (p.customVoice?.voiceId && ttsProviderFromVoiceId(p.customVoice.voiceId)) {
    return ttsHash(b.text, `${p.customVoice.voiceId}:${p.customVoice.style}`, p.customVoice.speed);
  }
  return ttsHash(b.text, p.voice.voiceId, p.voice.speed);
}

function scaleAlignment(alignment: CharAlignment, newDuration: number): CharAlignment {
  const oldEnd = alignment.ends.length ? alignment.ends[alignment.ends.length - 1]! : 0;
  if (oldEnd <= 0.02 || newDuration <= 0.02) return alignment;
  const ratio = newDuration / oldEnd;
  return {
    chars: alignment.chars,
    starts: alignment.starts.map((t) => Math.round(t * ratio * 10000) / 10000),
    ends: alignment.ends.map((t) => Math.round(t * ratio * 10000) / 10000),
  };
}

export type ExtraRenderOptions = {
  vmakeApiKey?: string;
  vmakeSecretAccessKey?: string;
  /** true일 때만 보관된 Vmake 영상을 무시하고 새로 Vmake 유료 API를 호출한다 */
  forceVmake?: boolean;
};

/** 프로젝트에 Vmake 자막 제거 완료 마스터 영상(vmake-clean.mp4)이 있는지 확인하고, 이전 버전 폴더에 있으면 승격 보관한다 */
export async function ensureVmakeMasterPath(id: string): Promise<string | null> {
  const master = rel(id, 'vmake-clean.mp4');
  if (await exists(master)) return master;

  const p = await getProject(id).catch(() => null);
  const wasVmake = p && (p.mosaicMode === 'vmake' || p.mosaic === false);
  if (wasVmake) {
    for (const candidate of [rel(id, 'vmake-cache', 'legacy.mp4'), rel(id, 'render', 'video.mp4')]) {
      const st = await fs.stat(candidate).catch(() => null);
      if (st && st.size > 50_000) {
        await fs.copyFile(candidate, master).catch(() => {});
        if (await exists(master)) return master;
      }
    }
  }
  return null;
}

type MosaicMode = 'v2' | 'vmake' | 'sttn';
const mosaicModeOf = (p: Project): MosaicMode => p.mosaicMode ?? (p.mosaic === false ? 'vmake' : 'v2');

/** 렌더에 쓸 템플릿 (썰 모드 또는 리믹스 커스텀 템플릿) */
function renderTemplateOf(p: Project) {
  const storyMode = isStoryMode(p.mode);
  const remixTpl = !storyMode && p.remixTemplateId && p.remixTemplateId !== DEFAULT_REMIX_TEMPLATE_ID
    ? getRemixTemplate(p.remixTemplateId)
    : null;
  const tpl = storyMode ? getTemplate(p.ssul?.templateId) : remixTpl;
  return {
    storyMode,
    template: tpl ? applyVideoFit({ ...tpl, introPoster: tpl.introPoster || !!p.ssul?.introPoster, ...(p.ssul?.coverVariant ? { posterStyle: 'top' as const, posterVariant: p.ssul.coverVariant } : {}), posterBottomFill: !!p.ssul?.coverBottomFill, posterZoom: !!p.ssul?.coverZoom }, p.ssul?.videoFit) : null,
  };
}

/**
 * 자막 지운 영상이 지금 프로젝트와 맞는지 가리는 열쇠.
 * 장면·원본·음성·글자 지우기 방식·영상 크기가 바뀔 때만 달라진다 (효과음·배경음악·모션·자막 디자인은 무관).
 */
export function cleanKey(p: Project): string {
  const { storyMode, template } = renderTemplateOf(p);
  const mode = mosaicModeOf(p);
  const size = storyMode && template && mode !== 'vmake' ? [template.video.w, template.video.h] : null;
  const data = {
    mode, size,
    sources: p.sources.map((x) => [x.id, x.file, x.status, x.duration, x.contentBox]),
    clips: p.clips.map((c) => [c.id, c.sourceId, c.start, c.end, !!c.excluded, mode === 'v2' ? c.textBoxes : null, !!c.flip]),
    tts: (p.script?.beats ?? []).map((bt) => [bt.tts?.file, bt.tts?.textHash]),
    // 문장마다 고른 장면 (문장별로 잘라 쓰므로 장면을 바꾸면 다시 만들어야 함)
    beatClips: (p.script?.beats ?? []).map((bt) => bt.clipId ?? ''),
    v: 'per-beat-2', // 마스터에 없는 장면도 Vmake 로 추가 처리
  };
  return crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

const cleanTts = (id: string, i: number) => rel(id, 'clean', `tts_${String(i).padStart(3, '0')}.wav`);

/** 자막 지운 영상이 지금 프로젝트에 맞으면 그 정보를, 아니면 null */
export async function freshClean(p: Project): Promise<Project['clean'] | null> {
  if (!p.clean || p.clean.key !== cleanKey(p)) return null;
  return (await exists(rel(p.id, 'clean', 'video.mp4'))) ? p.clean : null;
}

/**
 * 원본 장면을 1배속으로 이어 붙이고 글자를 지운 영상 + 무음 자른 문장별 음성을 clean/ 에 만든다.
 * 렌더는 이것을 그대로 가져다 효과음·배경음악·모션·자막만 입힌다.
 */
async function buildCleanVideo(id: string, progress: (m: string, f?: number) => Promise<unknown>, opts?: ExtraRenderOptions): Promise<NonNullable<Project['clean']>> {
  const p = await getProject(id);
  const beats = p.script?.beats ?? [];
  if (!beats.length) throw new Error('대본이 없습니다');

  const mosaicMode = mosaicModeOf(p);
  if (mosaicMode === 'sttn' && !(await sttnAvailable())) throw new Error(STTN_NOT_INSTALLED);
  const existingVmakeMaster = mosaicMode === 'vmake' && !opts?.forceVmake
    ? await ensureVmakeMasterPath(id)
    : null;

  const vmakeApiKey = (opts?.vmakeApiKey?.trim() || process.env.shotform_vmake_api_key || process.env.VMAKE_API_KEY || '').trim();
  const vmakeSecretAccessKey = (opts?.vmakeSecretAccessKey?.trim() || process.env.shotform_vmake_secret_access_key || process.env.VMAKE_SECRET_ACCESS_KEY || '').trim();
  if (mosaicMode === 'vmake' && !existingVmakeMaster && (!vmakeApiKey || !vmakeSecretAccessKey)) {
    throw new Error('유료 모자이크 지우기를 처음 실행하려면 ShotForm 홈 설정에서 Vmake AI API Key와 Secret Access Key를 입력해 주세요. (또는 「모자이크」를 선택하세요.)');
  }

  const clips = new Map(p.clips.map((c) => [c.id, c]));
  const sources = new Map(p.sources.map((s) => [s.id, s]));
  for (const [i, b] of beats.entries()) {
    if (!b.clipId || !clips.has(b.clipId)) throw new Error(`${i + 1}번 문장에 클립이 없습니다`);
    if (!b.tts || b.tts.textHash !== expectedBeatHash(p, b)) throw new Error(`${i + 1}번 문장의 음성을 다시 생성해야 합니다`);
  }
  const { storyMode, template } = renderTemplateOf(p);
  // Vmake 자막 제거는 1080x1920 풀해상도 마스터로 보관해 템플릿을 바꿔도 화질 손실·재과금 없이 공유한다
  const pieceSize = storyMode && template && mosaicMode !== 'vmake' ? { w: template.video.w, h: template.video.h } : undefined;
  const key = cleanKey(p);
  const work = rel(id, 'clean-work');
  const outDir = rel(id, 'clean');
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(work, { recursive: true });
  // 덮어쓰지 말고 지우고 새로 만든다: 예전 해외판 복제가 하드링크로 원본과 파일을 나눠 쓰고 있을 수 있음
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  // 1) 문장별 음성의 앞뒤·중간 무음을 잘라내고 문장 길이를 정한다
  const durations: number[] = [];
  for (const [i, b] of beats.entries()) {
    const rawTtsPath = rel(id, b.tts!.file);
    const tight = cleanTts(id, i);
    const tightDur = await trimSpeechSilence(rawTtsPath, tight).catch(() => null);
    if (tightDur == null || !(await exists(tight))) {
      await fs.copyFile(rawTtsPath, tight);
      durations.push(b.tts!.duration + PAD);
    } else durations.push(tightDur + PAD);
  }
  const offset = durations.reduce((x, d) => x + d, 0);

  // 원본 영상을 잘게 토막 내거나 슬로모션·정지화면을 걸지 않고, 준비된 원본을 처음부터 1배속 통째로 이어 쓴다
  // 장면이 있는 원본만 (담지 않은 레퍼런스 영상은 쓰지 않음)
  const streamPieces = planContinuousOriginalStreams(p.sources.filter((s) => p.clips.some((c) => c.sourceId === s.id)), p.clips, offset);
  if (!streamPieces.length) throw new Error('렌더링할 원본 영상 파일이 없습니다');

  // 문장마다 고른 장면의 시작점부터 문장 길이만큼 1배속으로 이어 쓴다 (편집기 미리보기와 같은 규칙 → 자막과 장면이 맞음)
  const beatPieces: SegmentPiece[] = beats.map((b, i) => {
    const c = clips.get(b.clipId!)!;
    const srcDur = sources.get(c.sourceId)?.duration ?? c.end;
    const d = durations[i]!;
    const start = Math.max(0, Math.min(c.start, srcDur - d - 0.05));
    const end = Math.min(srcDur, start + d);
    return { sourceId: c.sourceId, start, end, speed: 1, freezeAfter: Math.max(0, d - (end - start)) };
  });

  // 장면이 바뀌는 경계 시각 (같은 원본에서 이어지는 곳은 제외) — 전환 효과음·모션용
  const switchTimes: number[] = [];
  let beatAcc = 0;
  for (let i = 0; i < beatPieces.length - 1; i++) {
    beatAcc += durations[i]!;
    const a = beatPieces[i]!;
    const b = beatPieces[i + 1]!;
    if (a.sourceId !== b.sourceId || Math.abs(a.end - b.start) > 0.08) switchTimes.push(beatAcc);
  }

  const stitchedVideoPath = path.join(work, 'video.mp4');

  if (mosaicMode === 'vmake' && existingVmakeMaster) {
    // 이미 자막 지우기를 끝낸 마스터 영상이 있으면 추가 과금·재인코딩 없이 그대로 가져온다
    await progress('보관된 자막 지운 영상을 불러오는 중... (추가 과금 없음)', 0.78);
    const masterDur = await probeDuration(existingVmakeMaster).catch(() => offset);
    if (masterDur + 0.15 >= offset) {
      await fs.copyFile(existingVmakeMaster, stitchedVideoPath);
    } else {
      // 대본이 길어져 보관된 마스터 영상보다 길면 끝부분 정지 없이 자연스럽게 루프해 길이를 맞춘다
      await runFfmpeg([
        '-y', '-stream_loop', '-1', '-i', path.resolve(existingVmakeMaster),
        '-t', offset.toFixed(3), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        path.resolve(stitchedVideoPath),
      ]);
    }
  } else {
    // Vmake 는 원본을 통째로 이어 붙인 마스터를 한 번만 지우고(과금 1회) 아래에서 문장별로 잘라 쓴다
    const plan: { piece: SegmentPiece; srcFile: string; out: string }[] = (mosaicMode === 'vmake' ? streamPieces : beatPieces).map((piece, idx) => {
      const pieceSrc = sources.get(piece.sourceId);
      if (!pieceSrc?.file) throw new Error('원본 소스 영상 파일이 없습니다');
      return {
        piece,
        srcFile: rel(id, pieceSrc.file),
        out: path.join(work, `stream_${String(idx).padStart(3, '0')}.mp4`),
      };
    });

    // 무료 자막 지우기(STTN): 쓰이는 원본마다 클립 시간대별 글자만 지운 영상으로 바꿔 끼운다 (결과는 캐시)
    if (mosaicMode === 'sttn') {
      const bySource = [...new Map(plan.map((x) => [x.piece.sourceId, x.srcFile])).entries()];
      for (const [k, [sourceId, srcFile]] of bySource.entries()) {
        const base = k / bySource.length;
        await progress(`글자를 자연스럽게 지우는 중... (${k + 1}/${bySource.length}) · 처음 한 번만 오래 걸려요`, base * 0.4);
        const cleaned = await cleanSourceWithSttn(
          srcFile,
          p.clips.filter((c) => c.sourceId === sourceId),
          (f) => void progress(`글자를 자연스럽게 지우는 중... (${k + 1}/${bySource.length}) ${Math.round(f * 100)}%`, (base + f / bySource.length) * 0.4),
        );
        for (const x of plan) if (x.piece.sourceId === sourceId) x.srcFile = cleaned;
      }
    }

    const uniqueSrcFiles = [...new Set(plan.map((x) => x.srcFile))];
    const targetFps = await probeTargetFps(uniqueSrcFiles);
    const frames = pieceFrameCounts(plan.map((x) => pieceOutputDuration(x.piece)), targetFps);
    const pieces: string[] = [];
    for (const [k, x] of plan.entries()) {
      const pieceBase = mosaicMode === 'sttn' ? 0.4 : 0;
      await progress(`원본 영상 처리 중... (${k + 1}/${plan.length})`, pieceBase + (k / plan.length) * (0.9 - pieceBase));
      await renderPiece(
        x.srcFile,
        x.piece,
        x.out,
        frames[k],
        [],
        pieceSize,
        sources.get(x.piece.sourceId)?.contentBox,
        undefined,
        {
          fps: targetFps,
          timedMasks: mosaicMode === 'v2' ? timedMasksForPiece(p.clips, x.piece) : undefined,
          // 좌우반전: 그 장면을 고른 문장 조각 전체를 뒤집는다 (Vmake 마스터에는 굽지 않고 자를 때 뒤집음)
          flipRanges: mosaicMode !== 'vmake' && beatPieces.includes(x.piece) && clips.get(beats[beatPieces.indexOf(x.piece)]!.clipId!)?.flip
            ? [[x.piece.start, x.piece.end] as [number, number]]
            : [],
        },
      );
      pieces.push(x.out);
    }
    await progress('장면을 이어 붙이는 중...', 0.92);
    await concatVideos(pieces, stitchedVideoPath);

    if (mosaicMode === 'vmake') {
      await progress('유료 모자이크 지우기로 글자를 지우는 중... (최초 1회만 실행·이후 영구 보관)', 0.94);
      const cleanedPath = path.join(work, 'video_vmake_clean.mp4');
      await withTimeout(
        removeChineseSubtitlesFromLocalFile({
          apiKey: vmakeApiKey,
          secretAccessKey: vmakeSecretAccessKey,
          sourcePath: stitchedVideoPath,
          outputPath: cleanedPath,
        }),
        VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
        '자막 지우기 시간이 초과되었습니다(약 12분). 잠시 후 다시 시도하거나 「모자이크」를 선택해 주세요.',
      );
      await fs.rm(rel(id, 'vmake-clean.mp4'), { force: true }); // 해외판과 하드링크로 나눠 쓰는 파일을 덮어쓰지 않게
      await fs.copyFile(cleanedPath, rel(id, 'vmake-clean.mp4'));
      await fs.rename(cleanedPath, stitchedVideoPath);
      await updateProject(id, (x) => { x.vmakeCleanedAt = Date.now(); });
    }
  }

  if (mosaicMode === 'vmake') {
    // 글자 지운 마스터(원본들을 차례로 이어 붙인 영상)에서 문장마다 고른 장면 자리를 찾아 잘라 붙인다 (추가 과금 없음)
    await progress('문장마다 고른 장면으로 맞추는 중...', 0.95);
    const master = (await exists(rel(id, 'vmake-clean.mp4'))) ? rel(id, 'vmake-clean.mp4') : stitchedVideoPath;
    const masterDur = await probeDuration(master);
    const masterPlan = planContinuousOriginalStreams(p.sources.filter((s) => p.clips.some((c) => c.sourceId === s.id)), p.clips, masterDur);
    const fps = await probeTargetFps([master]);
    const frames = pieceFrameCounts(durations, fps);
    const cuts: string[] = [];
    let follow = 0; // 마스터에 없는 장면이면 앞 조각에 이어서

    // 마스터에 없는 장면(처음 지울 때 안 들어간 원본 구간)은 그 부분만 모아 Vmake로 추가로 지운다.
    // 결과는 vmake-patches/<구간 해시>.mp4 로 보관해 같은 장면은 다시 과금되지 않는다. 키가 없으면 무료 모자이크로 대신.
    const patchAt = new Map<number, { file: string; at: number }>();
    const missing = beatPieces.map((bp, i) => ({ bp, i })).filter(({ bp, i }) => masterTimeOf(masterPlan, bp.sourceId, bp.start, durations[i]!) == null && sources.get(bp.sourceId)?.file);
    if (missing.length) {
      const pdir = rel(id, 'vmake-patches');
      await fs.mkdir(pdir, { recursive: true });
      const saved = await fs.readdir(pdir).catch(() => [] as string[]);
      let made = 0;
      for (const { bp, i } of missing) {
        const d = durations[i]!;
        // 같은 원본·같은 시작점에서 이 문장보다 길게 지워 둔 조각이 있으면 그대로 쓴다 (해외판·다시 만들기 재과금 없음)
        const prefix = `piece_${bp.sourceId}_${bp.start.toFixed(2)}_`;
        const hit = saved.filter((f) => f.startsWith(prefix)).map((f) => ({ f, len: Number(f.slice(prefix.length, -4)) })).find((x) => x.len >= d - 0.02);
        if (hit) { patchAt.set(i, { file: path.join(pdir, hit.f), at: 0 }); continue; }
        if (!vmakeApiKey || !vmakeSecretAccessKey) continue; // 키가 없으면 아래에서 무료 모자이크로 대신
        made++;
        await progress(`마스터에 없는 장면을 유료 지우기로 추가 처리 중... (${made}/${missing.length}, 장면마다 처음 한 번만)`, 0.95);
        const src = sources.get(bp.sourceId)!;
        const srcDur = src.duration ?? bp.end;
        const len = Math.min(Math.max(d, srcDur - bp.start), Math.ceil(d) + 3);
        const piece = { ...bp, end: Math.min(srcDur, bp.start + len), freezeAfter: Math.max(0, len - (Math.min(srcDur, bp.start + len) - bp.start)) };
        const raw = path.join(work, `patch_src_${i}.mp4`);
        await renderPiece(rel(id, src.file!), piece, raw, Math.round(len * fps), [], undefined, src.contentBox, undefined, { fps });
        const out = path.join(pdir, `${prefix}${len.toFixed(2)}.mp4`);
        await withTimeout(
          removeChineseSubtitlesFromLocalFile({ apiKey: vmakeApiKey, secretAccessKey: vmakeSecretAccessKey, sourcePath: raw, outputPath: out }),
          VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
          '추가 장면 자막 지우기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
        );
        saved.push(path.basename(out));
        patchAt.set(i, { file: out, at: 0 });
      }
    }

    for (const [i, bp] of beatPieces.entries()) {
      const d = durations[i]!;
      const patched = patchAt.get(i);
      const found = patched ? null : masterTimeOf(masterPlan, bp.sourceId, bp.start, d);
      if (patched) {
        // 추가로 지운 조각에서 그대로 잘라 쓴다
        const out = path.join(work, `beat_${String(i).padStart(3, '0')}.mp4`);
        const flip = !!clips.get(beats[i]!.clipId!)?.flip;
        await runFfmpeg([
          '-y', '-ss', patched.at.toFixed(3), '-i', path.resolve(patched.file),
          '-frames:v', String(frames[i]), '-an', ...(flip ? ['-vf', 'hflip'] : []), '-r', String(fps),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.resolve(out),
        ]);
        cuts.push(out);
        follow += d;
        continue;
      }
      const out = path.join(work, `beat_${String(i).padStart(3, '0')}.mp4`);
      const flip = !!clips.get(beats[i]!.clipId!)?.flip;
      const src = sources.get(bp.sourceId);
      if (found == null && src?.file) {
        // 마스터에 없는 장면(지울 때 안 들어간 구간): 재과금 없이 원본에서 잘라 무료 모자이크로 글자만 가린다
        await renderPiece(rel(id, src.file), bp, out, frames[i]!, [], undefined, src.contentBox, undefined, {
          fps, timedMasks: timedMasksForPiece(p.clips, bp), flipRanges: flip ? [[bp.start, bp.end]] : [],
        });
        cuts.push(out);
        follow += d;
        continue;
      }
      let m = found ?? follow;
      if (m + d > masterDur) m = Math.max(0, masterDur - d);
      follow = m + d;
      const fast = Math.max(0, m - 1.5);
      await runFfmpeg([
        '-y', '-ss', fast.toFixed(3), '-i', path.resolve(master), '-ss', (m - fast).toFixed(3),
        '-frames:v', String(frames[i]), '-an', ...(flip ? ['-vf', 'hflip'] : []), '-r', String(fps),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.resolve(out),
      ]);
      cuts.push(out);
    }

    // 지운 결과 검사 → 글자가 남은 문장만 한 번 더 지우기 (최대 2번). 결과는 해시로 보관해 같은 조각은 다시 과금되지 않는다.
    if (vmakeApiKey && vmakeSecretAccessKey) {
      for (let pass = 1; pass <= 2; pass++) {
        await progress(`지운 결과 검사 중... (${pass}번째 확인)`, 0.96);
        const residual = await residualTextBeats(id, cuts);
        if (!residual.length) break;
        await progress(`글자가 남은 문장 ${residual.length}개를 한 번 더 지우는 중... (${pass}번째)`, 0.965);
        const rkey = crypto.createHash('sha1').update(JSON.stringify(await Promise.all(residual.map(async (i) => [i, (await fs.stat(cuts[i]!)).size])))).digest('hex').slice(0, 16);
        const redo = rel(id, 'vmake-patches', `redo_${rkey}.mp4`);
        if (!(await exists(redo))) {
          const joined = path.join(work, `redo_src_${pass}.mp4`);
          // 조각마다 인코딩이 다를 수 있어 다시 인코딩하며 잇는다
          await runFfmpeg(['-y', ...residual.flatMap((i) => ['-i', path.resolve(cuts[i]!)]),
            '-filter_complex', `${residual.map((i, k) => `[${k}:v]fps=${fps},setsar=1,trim=end_frame=${frames[i]},setpts=PTS-STARTPTS[r${k}]`).join(';')};${residual.map((_, k) => `[r${k}]`).join('')}concat=n=${residual.length}:v=1:a=0[v]`,
            '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.resolve(joined)]);
          await fs.mkdir(path.dirname(redo), { recursive: true });
          await withTimeout(
            removeChineseSubtitlesFromLocalFile({ apiKey: vmakeApiKey, secretAccessKey: vmakeSecretAccessKey, sourcePath: joined, outputPath: redo }),
            VMAKE_SUBTITLE_REMOVAL_TIMEOUT_MS,
            '남은 글자 다시 지우기 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
        let acc = 0;
        for (const i of residual) {
          const o = path.join(work, `beat_${String(i).padStart(3, '0')}_p${pass}.mp4`);
          await runFfmpeg(['-y', '-ss', acc.toFixed(3), '-i', path.resolve(redo), '-frames:v', String(frames[i]), '-an', '-r', String(fps),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.resolve(o)]);
          cuts[i] = o;
          acc += frames[i]! / fps;
        }
      }
    }

    // 마스터 조각과 원본 조각은 인코딩 설정이 다를 수 있어 다시 인코딩하며 잇는다
    // (concat 필터: 조각마다 시각을 0부터 다시 매겨 길이가 정확히 문장 합과 같다)
    const norm = cuts.map((_, k) => `[${k}:v]fps=${fps},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=end_frame=${frames[k]},setpts=PTS-STARTPTS[v${k}]`).join(';');
    await runFfmpeg(['-y', ...cuts.flatMap((f) => ['-i', path.resolve(f)]),
      '-filter_complex', `${norm};${cuts.map((_, k) => `[v${k}]`).join('')}concat=n=${cuts.length}:v=1:a=0[v]`, '-map', '[v]', '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(work, 'video_beats.mp4')]);
    await fs.rm(stitchedVideoPath, { force: true });
    await fs.rename(path.join(work, 'video_beats.mp4'), stitchedVideoPath);
  }

  await fs.copyFile(stitchedVideoPath, path.join(outDir, 'video.mp4'));
  await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  const clean = { key, at: Date.now(), durations, switchTimes };
  await updateProject(id, (x) => { x.clean = clean; delete x.cleanFresh; });
  return clean;
}

/**
 * 지운 문장 조각마다 정지 화면 2장(30%·70%)을 AI로 검사해 글자가 남은 문장 번호를 돌려준다.
 * 아주 작은 상자(워터마크 점 등, 화면 높이 2.5% 미만)는 무시한다. 검사 실패 시 빈 배열(그대로 진행).
 */
async function residualTextBeats(id: string, cuts: string[]): Promise<number[]> {
  try {
    const dir = rel(id, 'frames', 'verify');
    await fs.mkdir(dir, { recursive: true });
    const images: { key: string; file: string }[] = [];
    for (const [i, f] of cuts.entries()) {
      const dur = await probeDuration(f).catch(() => 1);
      for (const [s, k] of [['a', 0.3], ['b', 0.7]] as const) {
        const out = path.join(dir, `${i}_${s}.jpg`);
        await extractFrame(f, dur * k, out, 720);
        images.push({ key: `${i}_${s}`, file: out });
      }
    }
    const found = await detectTextBoxes(images);
    const big = (bs?: number[][]) => (bs ?? []).some(([y0, , y1]) => (y1 ?? 0) - (y0 ?? 0) >= 25);
    return cuts.map((_, i) => i).filter((i) => big(found[`${i}_a`]) || big(found[`${i}_b`]));
  } catch (e) {
    console.error('residualTextBeats', e);
    return [];
  }
}

/** 원본(sourceId)의 t초가 이어 붙인 마스터 영상의 몇 초인지 (없으면 null) */
function masterTimeOf(plan: SegmentPiece[], sourceId: string, t: number, len = 0): number | null {
  let acc = 0;
  for (const pc of plan) {
    // 문장 길이 전체가 그 조각 안에 들어 있어야 한다 (넘치면 다음 원본 영상이 섞여 나온다)
    if (pc.sourceId === sourceId && t >= pc.start - 0.05 && t + len <= pc.end + 0.05) return acc + Math.max(0, t - pc.start);
    acc += pieceOutputDuration(pc);
  }
  return null;
}

// ④-1 자막 지우기: 미리보기에서도 글자 지운 영상을 보도록 먼저 만들어 둔다
export function runClean(id: string, opts?: ExtraRenderOptions) {
  return job(id, 'clean', async (progress) => { await buildCleanVideo(id, progress, opts); });
}

// ⑤ 렌더: 자막 지운 영상(없거나 바뀌었으면 먼저 만듦)에 효과음·배경음악·모션·자막을 합친다
export function runRender(id: string, opts?: ExtraRenderOptions) {
  return job(id, 'render', async (progress) => {
    let p = await getProject(id);
    const beats = p.script?.beats ?? [];
    if (!beats.length) throw new Error('대본이 없습니다');
    const mosaicMode = mosaicModeOf(p);
    let cleanInfo = opts?.forceVmake ? null : await freshClean(p);
    if (!cleanInfo) {
      cleanInfo = await buildCleanVideo(id, (m, f) => progress(m, (f ?? 0) * 0.8), opts);
      p = await getProject(id);
    }
    const clips = new Map(p.clips.map((c) => [c.id, c]));
    const { template } = renderTemplateOf(p);
    const work = rel(id, 'render');
    await fs.rm(work, { recursive: true, force: true });
    await fs.mkdir(work, { recursive: true });
    const stitchedVideoPath = path.join(work, 'video.mp4');
    await fs.copyFile(rel(id, 'clean', 'video.mp4'), stitchedVideoPath);

    const durations = cleanInfo.durations;
    const starts: number[] = [];
    const cues: Cue[] = [];
    let offset = 0;
    for (const [i, b] of beats.entries()) {
      starts.push(offset);
      cues.push(...lineTimings(splitLines(b.text), scaleAlignment(b.tts!.alignment, durations[i]! - PAD), offset));
      offset += durations[i]!;
    }
    const tightAudioFiles = beats.map((_, i) => cleanTts(id, i));
    const streamSwitchTimes = cleanInfo.switchTimes;
    const fx = fxSettings(p);
    const notes: string[] = [];

    // 핵심 문장 구간에 부드러운 펀치 줌(확대샷) — 끊김 없이 가운데로 시선 유도
    if (fx.motion && fx.motionPreset !== 'badge') {
      const mb = beats.map((b, i) => ({ start: starts[i]!, end: starts[i]! + durations[i]!, text: b.text, role: b.role }));
      const zoomWins = [
        ...punchZoomWindows(mb),
        // 풀 모션: 장면이 바뀌는 순간 짧은 줌 전환
        ...(fx.motionPreset === 'full' ? transitionZoomWindows(motionExtras(mb, fx.seed), mb) : []),
      ];
      if (zoomWins.length) {
        await progress('핵심 장면 확대 모션을 넣는 중...', 0.82);
        const zoomedPath = path.join(work, 'video_zoom.mp4');
        try {
          const zoomFps = await probeTargetFps([stitchedVideoPath]);
          await applyPunchZooms(stitchedVideoPath, zoomedPath, zoomWins, zoomFps);
          await fs.rename(zoomedPath, stitchedVideoPath);
        } catch (e) {
          notes.push(`확대 모션 없이 진행: ${msg(e)}`);
          await fs.rm(zoomedPath, { force: true }).catch(() => {});
        }
      }
    }

    await concatAudios(tightAudioFiles, durations, path.join(work, 'narration.m4a'));
    // 배경음악(내장 카탈로그 곡 또는 분위기별 Lyria 생성본) + 효과음 + 나레이션 믹스
    let bgm: string | undefined;
    if (fx.bgm) {
      const catalogTrack = fx.bgmTrackId ? mvpAudioCatalogItem(fx.bgmTrackId) : null;
      if (catalogTrack?.src) {
        const publicFile = path.join(process.cwd(), 'public', decodeURIComponent(catalogTrack.src).replace(/^\/+/, ''));
        if (await exists(publicFile)) bgm = publicFile;
      }
      if (!bgm) {
        const f = rel(id, 'bgm', `${fx.mood}.mp3`);
        if (!(await exists(f))) {
          await progress('배경음악을 만드는 중...', 0.84);
          try { await generateBgm(fx.mood, f); } catch (e) { notes.push(`배경음악 없이 만들었습니다: ${msg(e)}`); }
        }
        if (await exists(f)) bgm = f;
      }
    }
    await progress('나레이션·배경음악·효과음을 섞는 중...', 0.87);
    await mixAudio({
      narration: path.join(work, 'narration.m4a'),
      duration: offset,
      bgm,
      bgmVolume: fx.bgmVolume,
      sfx: fx.sfx
        ? planSfx(
            beats.map((b, i) => ({ start: starts[i]!, end: starts[i]! + durations[i]!, role: b.role, text: b.text })),
            streamSwitchTimes,
            fx.sfxPreset,
            fx.seed,
          )
        : [],
      sfxFiles: await ensureSfx(rel(id, 'sfx')),
    }, path.join(work, 'audio.m4a'));
    const motion = fx.motion
      ? {
          beatStarts: starts,
          beats: beats.map((b, i) => ({
            start: starts[i]!,
            end: starts[i]! + durations[i]!,
            text: b.text,
            role: b.role,
          })),
          streamSwitchTimes,
          preset: fx.motionPreset,
          lang: p.lang,
          seed: fx.seed,
        }
      : undefined;
    const baseAss = template
      ? buildTemplateAss(template, templateData(p, offset), cues, offset, motion)
      : buildAss(cues, p.script!.headcopy, { font: 'Pretendard', width: 1080, height: 1920, totalDuration: offset, motion });
    // 광고·제휴 / AI 생성 영상 표기 (공정위 지침: 첫 부분에 명확히)
    const pub = p.publish;
    const aiUsed = beats.some((b) => clips.get(b.clipId!)?.aiGenerated);
    const disclosure = pub?.onScreen === false ? [] : disclosureLines({ affiliate: (pub?.affiliate ?? 'none') as Affiliate, text: pub?.bannerText, aiUsed, total: offset, lang: p.lang });
    const lf = await langFonts(p.lang, work);
    // 리뷰·랭킹: 상품이 바뀔 때마다 순위 배지 + 상품명 카드
    const badges = template && beats.some((b) => b.item) ? badgeLines(badgeStyle(template), itemSpans(beats, starts, durations)) : [];
    const ass = withLangFont(withDisclosure(baseAss, [...badges, ...disclosure]), lf.font);
    if (lf.missing) notes.push('이 언어용 폰트를 찾지 못해 자막 글자가 깨질 수 있습니다 (SYSTEM_FONTS_DIR 설정)');
    await fs.writeFile(path.join(work, 'subs.ass'), ass, 'utf8');
    const FONTS = lf.dir ?? FONTS_DIR;
    if (pub?.pack) await fs.writeFile(rel(id, 'upload.txt'), packText(pub.pack), 'utf8');
    await progress(template ? '템플릿을 합성하는 중...' : '자막을 입히는 중...', 0.92);
    if (template) await composeTemplate(path.join(work, 'video.mp4'), path.join(work, 'audio.m4a'), path.join(work, 'subs.ass'), FONTS, template, rel(id, 'output.mp4'));
    else await mux(path.join(work, 'video.mp4'), path.join(work, 'audio.m4a'), path.join(work, 'subs.ass'), FONTS, rel(id, 'output.mp4'));
    // 썸네일을 영상 맨 앞 첫 프레임(0.01초 → 영상이 담을 수 있는 최소 1프레임)으로 붙이기 (옵션) — 피드 표지용, 보는 사람 눈엔 거의 안 보임
    const thumb = p.thumbnail?.prepend && p.thumbnail.file ? rel(id, p.thumbnail.file) : null;
    if (thumb && (await exists(thumb))) {
      await progress('썸네일을 앞에 붙이는 중...', 0.97);
      const tmp = path.join(work, 'with-thumb.mp4');
      await prependStill(rel(id, 'output.mp4'), thumb, 0.01, tmp);
      await fs.rename(tmp, rel(id, 'output.mp4'));
    }
    await updateProject(id, (x) => {
      if (mosaicMode === 'vmake' && !x.vmakeCleanedAt) x.vmakeCleanedAt = Date.now();
      x.output = { file: 'output.mp4', stale: false, at: Date.now(), ...(notes.length ? { notes } : {}) };
    });
  });
}

// ⑥ 해외판: 복제 → 현지화 번역 → 음성 → 렌더 (자동)
export async function runLocalize(srcId: string, langId: string, opts?: ExtraRenderOptions): Promise<Project> {
  const l = requireLang(langId);
  const src = await getProject(srcId);
  if (!src.script?.beats.length) throw new Error('대본이 있는 프로젝트만 해외판을 만들 수 있습니다');
  if (src.lang && src.lang !== 'ko') throw new Error('해외판에서 다시 해외판을 만들 수 없습니다. 원본(한국어) 프로젝트에서 만드세요');
  const r = await generateJson(LocalizeSchema, localizePrompt(src, l), undefined, [], 0.5);
  const id = newProjectId();
  const next = { ...applyLocalization(src, l, r), id, createdAt: new Date().toISOString(), localizedFrom: src.id };
  await cloneProjectFiles(src.id, id);
  await saveNewProject(next);
  void runTts(id).then(async () => {
    const p = await getProject(id);
    if (p.jobs.tts?.state === 'done') await runRender(id, opts);
  });
  return next;
}
