import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { Project } from '../types';
import { getLang, type Lang } from './languages';
import { wrapLine } from '../ai/schemas';
import { projectDir } from '../store';

/**
 * 해외판: 완성된 한국어 프로젝트를 복제해 대본·제목·화면 문구를 현지화한다.
 * 장면(클립)·싱크 구조는 그대로 두고 문장만 바꾼 뒤 음성·렌더를 새로 한다.
 * 같은 영상을 여러 나라 틱톡샵·아마존·쇼피에 올리는 용도.
 */
export const LocalizeSchema = z.object({
  title: z.array(z.string()).min(1),
  comment: z.string().default(''),
  channel: z.string().default(''),
  footer: z.string().default(''),
  beats: z.array(z.object({ text: z.string(), item: z.string().nullable().optional() })),
  travel: z.object({ location: z.string().default(''), price: z.string().default(''), period: z.string().default('') }).partial().optional(),
  statics: z.record(z.string(), z.string()).default({}),
});

/** 템플릿 고정 문구 중 번역할 것 */
const STATIC_TEXTS = ['[광고]', '궁금하면 여기 클릭', '특가'];

export function localizePrompt(p: Project, l: Lang): string {
  const src = {
    title: p.script?.headcopy ?? ['', ''],
    comment: p.script?.comment ?? '',
    channel: p.ssul?.channelName ?? '',
    footer: p.travelInfo?.howToBuy ? `예약 · ${p.travelInfo.howToBuy}` : '구매방법 > 프로필 링크 클릭',
    beats: (p.script?.beats ?? []).map((b) => ({ text: b.text, ...(b.item ? { item: b.item } : {}) })),
    ...(p.travelInfo ? { travel: { location: p.travelInfo.location ?? '', price: p.travelInfo.price ?? '', period: p.travelInfo.period ?? '' } } : {}),
    statics: Object.fromEntries(STATIC_TEXTS.map((s) => [s, s])),
  };
  return `You localize a Korean shopping short-form video script into ${l.english} for ${l.market}.
This is not literal translation: rewrite each line the way a native ${l.english} shopping-shorts narrator would say it, keeping the same meaning, order and energy.

Rules:
- Return the SAME JSON shape with the same number of beats in the same order (each beat is one narrated sentence synced to a video cut — do not merge or split beats).
- Keep each beat about the same spoken length as the Korean (the video cut length is fixed).
- beats[].text: subtitle lines separated by \\n, max ${l.maxLine} characters per line, 1-2 lines.
- beats[].item: on-screen product label; translate it (rank words like "3위" → natural local form, e.g. "#3" in English). Keep empty if empty.
- Prices in Korean won (원, 만원) are not valid abroad: remove the specific won amount and use neutral wording (e.g. "for a great price"), unless the line makes no sense without it. Never invent a local price.
- Korea-only stores/platforms (쿠팡, 올리브영, 네이버, 11번가) → generic words ("online", "the link in my bio") unless the store exists in ${l.market}.
- No invented facts, rankings, sales numbers or personal experience that the Korean does not state.
- title: 2 short lines for the fixed on-screen title. statics: translate each value (keys stay Korean). footer: short "how to buy" line.
- No emoji or slang letters in beats (they are read aloud).

Korean source JSON:
${JSON.stringify(src)}

Return JSON only.`;
}

/** 번역 결과를 프로젝트에 적용 (클립·싱크 구조 유지, 음성·출력은 지움) */
export function applyLocalization(p: Project, l: Lang, r: z.infer<typeof LocalizeSchema>): Project {
  const beats = p.script?.beats ?? [];
  if (r.beats.length !== beats.length) throw new Error(`번역 문장 수가 다릅니다 (${r.beats.length} / ${beats.length})`);
  const wrap = (t: string) => t.split('\n').flatMap((x) => wrapLine(x, l.maxLine)).slice(0, 3).join('\n');
  return {
    ...p,
    lang: l.id,
    name: `[${l.name}] ${p.name}`,
    script: {
      ...p.script!,
      headcopy: [r.title[0] ?? '', r.title[1] ?? ''],
      comment: r.comment,
      beats: beats.map((b, i) => {
        const { tts: _tts, ...rest } = b;
        const item = r.beats[i].item?.trim();
        return { ...rest, id: nanoid(8), text: wrap(r.beats[i].text), ...(b.item ? { item: item || b.item } : {}) };
      }),
    },
    ...(p.ssul && r.channel ? { ssul: { ...p.ssul, channelName: r.channel.slice(0, 20) } } : {}),
    ...(p.travelInfo && r.travel ? { travelInfo: { ...p.travelInfo, ...Object.fromEntries(Object.entries(r.travel).filter(([, v]) => v !== undefined)) } } : {}),
    localText: { footer: r.footer || undefined, statics: r.statics },
    output: undefined,
    thumbnail: undefined,
    publish: p.publish ? { ...p.publish, pack: undefined } : undefined,
    flow: undefined,
    jobs: {},
  };
}

/** 프로젝트 폴더 복제: 원본 영상·프레임은 하드링크(용량 0), 음성·렌더 결과는 제외 */
// clean·render 는 언어마다 음성이 달라 따로 만든다 (하드링크로 같이 쓰면 해외판이 원본 파일을 덮어씀)
const SKIP = new Set(['render', 'tts', 'previews', 'output.mp4', 'upload.txt', 'thumbnail.jpg', 'project.json', 'clean', 'clean-work']);
async function cloneDir(src: string, dst: string, top = true): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (top && (SKIP.has(e.name) || e.name.endsWith('.tmp') || /^output.*\.mp4$/.test(e.name))) continue;
    const a = path.join(src, e.name);
    const b = path.join(dst, e.name);
    if (e.isDirectory()) await cloneDir(a, b, false);
    else await fs.link(a, b).catch(() => fs.copyFile(a, b));
  }
}

export async function cloneProjectFiles(srcId: string, newId: string): Promise<void> {
  await cloneDir(projectDir(srcId), projectDir(newId));
}

export function requireLang(id: string): Lang {
  const l = getLang(id);
  if (!l) throw new Error('지원하지 않는 언어입니다');
  return l;
}
