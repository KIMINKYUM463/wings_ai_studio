import { GoogleGenAI, createPartFromUri, type File as GFile } from '@google/genai';
import type { z } from 'zod';
import type { Analysis, Beat, Clip, Project, ReviewInfo, TravelInfo } from '../types';
import type { Playbook } from '../ssul/playbook';
import fs from 'node:fs/promises';
import {
  AnalysisSchema, CHARS_PER_SEC, ClipDescSchema, ScriptSchema, TextBoxMapSchema, chunk, estimateSeconds, extractJson, isTooShort, sanitizeBeats,
} from './schemas';
import { ANALYZE_PROMPT, TEXT_BOX_PROMPT, describeClipsPrompt, scriptPrompt } from './prompts';
import { SsulScriptSchema, lengthFeedback, ssulScriptPrompt, targetChars, type SsulScriptOptions } from '../ssul/prompt';
import { probeDuration } from '../media/ffmpeg';
import { GEMINI_KEY_MISSING, geminiApiKey } from '../gemini-key';

const model = () => process.env.GEMINI_MODEL || 'gemini-flash-latest';

let client: GoogleGenAI | null = null;
let clientKey = '';
function ai(): GoogleGenAI {
  const key = geminiApiKey();
  if (!key) throw new Error(GEMINI_KEY_MISSING);
  if (!client || clientKey !== key) {
    client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1beta' } });
    clientKey = key;
    uploads.clear();
  }
  return client;
}

// 같은 파일을 여러 번 올리지 않도록 프로세스 안에서 캐시 (Gemini 파일은 48시간 유지)
const uploads = new Map<string, Promise<GFile>>();

function uploadVideo(file: string): Promise<GFile> {
  let p = uploads.get(file);
  if (!p) {
    p = (async () => {
      let f = await ai().files.upload({ file, config: { mimeType: 'video/mp4' } });
      for (let i = 0; f.state === 'PROCESSING' && i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        f = await ai().files.get({ name: f.name! });
      }
      if (f.state !== 'ACTIVE') throw new Error(`Gemini 영상 처리 실패: ${f.state}`);
      return f;
    })();
    uploads.set(file, p);
    p.catch(() => uploads.delete(file));
  }
  return p;
}

export async function generateJson<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>, prompt: string, video?: string, extraParts: unknown[] = [], temperature = 0.7,
): Promise<T> {
  const contents: unknown[] = [];
  if (video) {
    const f = await uploadVideo(video);
    contents.push(createPartFromUri(f.uri!, f.mimeType!));
  }
  contents.push(...extraParts, prompt);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: model(),
        contents: contents as never,
        config: { responseMimeType: 'application/json', temperature },
      });
      return schema.parse(extractJson(res.text ?? ''));
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Gemini 응답 처리 실패: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export async function analyzeReference(file: string): Promise<Analysis> {
  const a = await generateJson(AnalysisSchema, ANALYZE_PROMPT, file);
  const duration = await probeDuration(file);
  return { ...a, duration };
}

/** 영상 파일 없이 유튜브 주소를 Gemini 에 바로 넘겨 분석한다 (클라우드 PC 에서 유튜브 다운로드가 막힐 때) */
export async function analyzeReferenceYoutube(youtubeUrl: string): Promise<Analysis> {
  const a = await generateJson(AnalysisSchema, ANALYZE_PROMPT, undefined, [createPartFromUri(youtubeUrl, 'video/mp4')]);
  return { ...a, duration: 0 };
}

export async function describeClips(
  file: string,
  clips: { id: string; start: number; end: number }[],
): Promise<Pick<Clip, 'id' | 'description' | 'shotType' | 'hasBurnedText' | 'quality' | 'textBoxes'>[]> {
  return generateJson(ClipDescSchema, describeClipsPrompt(clips), file);
}

export async function writeScript(
  analysis: Analysis,
  clips: Clip[],
  targetSeconds: number,
  structure?: string,
): Promise<{ headcopy: [string, string]; beats: Beat[] }> {
  const ids = new Set(clips.filter((c) => !c.excluded).map((c) => c.id));
  let prompt = scriptPrompt(analysis, clips, targetSeconds, structure);
  let best: { headcopy: [string, string]; beats: Beat[] } | null = null;
  // 너무 짧으면 한 번 더 길게 요청한다
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await generateJson(ScriptSchema, prompt);
    const out = { headcopy: [s.headcopy[0] ?? '', s.headcopy[1] ?? ''] as [string, string], beats: sanitizeBeats(s.beats, ids) };
    if (!best || estimateSeconds(out.beats) > estimateSeconds(best.beats)) best = out;
    if (!isTooShort(out.beats, targetSeconds)) break;
    const need = Math.round(targetSeconds * CHARS_PER_SEC);
    prompt += `\n\n[수정 요청] 방금 대본은 약 ${Math.round(estimateSeconds(out.beats))}초 분량으로 너무 짧았다. 공백 제외 약 ${need}자(약 ${targetSeconds}초)가 되도록 비트 수를 늘리고 정보를 더 넣어 다시 써라.`;
  }
  return best!;
}

/**
 * 장면 정지 화면들에서 덧입힌 자막·워터마크·로고 위치를 찾는다 (영상 전체보다 정확).
 * 반환: { 키: [[ymin,xmin,ymax,xmax] (0~1000)] }
 */
export async function detectTextBoxes(images: { key: string; file: string }[]): Promise<Record<string, number[][]>> {
  const out: Record<string, number[][]> = {};
  for (const group of chunk(images, 16)) {
    const parts: unknown[] = [];
    for (const img of group) {
      parts.push(`이미지 키: ${img.key}`);
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: (await fs.readFile(img.file)).toString('base64') } });
    }
    const res = await generateJson(TextBoxMapSchema, TEXT_BOX_PROMPT(group.map((g) => g.key)), undefined, parts, 0.1);
    Object.assign(out, res);
  }
  return out;
}

/** 썰 쇼핑숏폼 대본: 플레이북 구조·말투·패턴으로 쓰고, 너무 짧으면 한 번 더 늘려 쓴다 */
export async function writeSsulScript(
  analysis: Analysis, clips: Clip[], opts: SsulScriptOptions, pb?: Playbook, facts?: TravelInfo | ReviewInfo,
): Promise<{ headcopy: [string, string]; beats: Beat[]; comment: string; structureId: string; structureReason?: string }> {
  const ids = new Set(clips.filter((c) => !c.excluded).map((c) => c.id));
  const need = targetChars(opts.targetSeconds);
  let prompt = ssulScriptPrompt(analysis, clips, opts, pb, facts);
  let best: Awaited<ReturnType<typeof writeSsulScript>> | null = null;
  const chars = (bs: Beat[]) => bs.reduce((a, b) => a + [...b.text].filter((c) => !/\s/.test(c)).length, 0);
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await generateJson(SsulScriptSchema, prompt);
    const beats: Beat[] = s.beats
      .map((b) => ({ ...sanitizeBeats([{ text: b.text, clipId: b.clipId ?? null }], ids)[0], role: b.role, ...(b.item?.trim() ? { item: b.item.trim().slice(0, 40) } : {}) }))
      .filter((b) => b.text);
    const out = {
      headcopy: [s.title[0] ?? '', s.title[1] ?? ''] as [string, string],
      beats, comment: s.comment,
      structureId: opts.structureId === 'auto' ? s.structureId : opts.structureId,
      structureReason: s.structureReason,
    };
    // 목표 길이에 가장 가까운 안을 고른다 (너무 짧아도, 너무 길어도 한 번 다시 쓰게 함)
    if (!best || Math.abs(chars(out.beats) - need) < Math.abs(chars(best.beats) - need)) best = out;
    const fb = lengthFeedback(chars(out.beats), need);
    if (!fb) break;
    prompt += `\n\n${fb}`;
  }
  return best!;
}

const CONTENT_BOX_PROMPT = `두 이미지는 같은 쇼츠 영상의 서로 다른 시점 화면이다. 이 영상이 '편집 템플릿'(컬러 헤더, 제목 띠, 앱 화면 UI, 흰/검정 여백, 레터박스 등) 안에 실제 촬영 영상(푸티지)을 넣은 형태라면, 두 화면 모두에서 실제 푸티지가 차지하는 사각형 영역을 구해라.
JSON만: { "box": [ymin, xmin, ymax, xmax] }  (0~1000 정수, 이미지 기준)
- 템플릿 없이 화면 전체가 영상이면 [0, 0, 1000, 1000].
- 영상 위에 덧입힌 자막만 있는 경우도 전체 화면으로 본다.`;

/** 템플릿 영상의 실제 푸티지 영역 (0~1000). 실패하면 undefined */
export async function detectContentBox(frames: string[]): Promise<number[] | undefined> {
  const parts: unknown[] = [];
  for (const f of frames) parts.push({ inlineData: { mimeType: 'image/jpeg', data: (await fs.readFile(f)).toString('base64') } });
  const { z } = await import('zod');
  const r = await generateJson(z.object({ box: z.array(z.number()).length(4) }), CONTENT_BOX_PROMPT, undefined, parts, 0.1);
  return r.box;
}

/** 썸네일 문구 4안 (상위 썸네일 281개 분석 패턴 기반) */
export async function writeThumbCopy(analysis: Analysis, script: Project['script']) {
  const { ThumbCopySchema, thumbCopyPrompt } = await import('../thumbnails/copy');
  const r = await generateJson(ThumbCopySchema, thumbCopyPrompt(analysis, script));
  return r.options.slice(0, 4).map((o) => ({ ...o, lines: o.lines.map((l) => l.trim()).filter(Boolean).slice(0, 3) }));
}

/** Flow(Veo)용 문장별 영상 프롬프트 */
export async function writeFlowPrompts(analysis: Analysis, beats: Beat[], style?: string) {
  const { FlowPromptSchema, flowPromptRequest, formatFlowPrompt } = await import('../flow/prompt');
  const r = await generateJson(FlowPromptSchema, flowPromptRequest(analysis, beats, { style }), undefined, [], 0.5);
  const ids = new Set(beats.map((b) => b.id));
  const prompts = Object.fromEntries(r.prompts.filter((p) => ids.has(p.beatId)).map((p) => [p.beatId, { ...p, text: formatFlowPrompt(r.styleBible, p) }]));
  return { styleBible: r.styleBible, style: style ?? '', prompts };
}
