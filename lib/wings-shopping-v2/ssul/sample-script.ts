import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { projectDir } from '../store';
import { generateJson } from '../ai/gemini';
import type { Project } from '../types';
import { getPlaybook } from './playbook';
import { getCustomStructure } from './custom-structures';
import { STORY_SCRIPT_TEMPLATES, isStoryScriptTemplateId } from '@/app/WingsAIStudioShotForm/story-shopping/story-script-catalog';

/**
 * 대본 구조 상세보기: 이 프로젝트 상품으로 쓴 샘플 대본 + 문장별 분석.
 * 구조·상품마다 한 번만 AI로 만들고 프로젝트 폴더에 저장해 다시 쓴다.
 */
export const SampleSchema = z.object({
  summary: z.string(),
  hook: z.object({ type: z.string(), why: z.string() }),
  beats: z.array(z.object({ role: z.string(), text: z.string(), why: z.string() })).min(3).max(10),
  retention: z.array(z.string()).default([]),
});
export type ScriptSample = z.infer<typeof SampleSchema> & { structureId: string; product: string; at: number };

const ROLES = 'hook, setup, conflict, curiosity, product_intro, feature, twist, reveal, proof, social_proof, usage, price, comparison, emotion, cta, closing';

/** structureId → 프롬프트에 넣을 구조 설명 */
async function describeStructure(p: Project, structureId: string): Promise<string | null> {
  if (structureId.startsWith('story:')) {
    const id = structureId.slice(6);
    if (!isStoryScriptTemplateId(id)) return null;
    const t = STORY_SCRIPT_TEMPLATES[id];
    return `${t.name} — ${t.description}\n흐름: ${t.flow}\n규칙: ${t.guide}`;
  }
  const custom = await getCustomStructure(structureId);
  const s = custom ?? getPlaybook(p.mode).structures.find((x) => x.id === structureId);
  if (!s) return null;
  return [`${s.name} — ${s.oneLiner}`, ...s.beats.map((b, i) => `${i + 1}. ${b.role} (약 ${Math.round(b.share * 100)}%, ${b.sentences}문장) — ${b.purpose} / 쓰는 법: ${b.guidance} / 패턴: ${b.patterns.join(' / ')}`)].join('\n');
}

const file = (p: Project, structureId: string, product: string) =>
  path.join(projectDir(p.id), 'script-samples', `${crypto.createHash('sha1').update(`${structureId}|${product}`).digest('hex').slice(0, 16)}.json`);

export async function scriptSample(p: Project, structureId: string, force = false): Promise<ScriptSample> {
  const product = p.analysis?.productName ?? '';
  if (!product) throw new Error('먼저 영상 분석을 끝내야 샘플 대본을 볼 수 있어요');
  const f = file(p, structureId, product);
  if (!force) {
    try { return JSON.parse(await fs.readFile(f, 'utf8')) as ScriptSample; } catch { /* 처음이면 만든다 */ }
  }
  const structure = await describeStructure(p, structureId);
  if (!structure) throw new Error('없는 대본 구조입니다');
  const a = p.analysis!;
  const prompt = `너는 한국 썰쇼핑 쇼츠 대본 작가이자 분석가다.
아래 대본 구조로 이 상품의 30초 내외 샘플 대본을 쓰고, 문장마다 왜 효과적인지 짧게 분석해라.

[상품]
${a.productName} (${a.category})
특징: ${[...(a.keySellingPoints ?? []), ...a.keywords].slice(0, 8).join(', ')}

[대본 구조]
${structure}

[규칙]
- 문장은 5~8개. 말하듯 짧게, 한 문장 30자 이내. role 은 ${ROLES} 중 하나.
- 없는 수치·판매량·순위는 지어내지 마라.
- summary: 이 구조가 시청자를 어떻게 끝까지 붙잡는지 한 문장.
- hook.type: 첫 문장 훅의 종류(예: 반전 질문형, 손해 회피형) / hook.why: 왜 스크롤을 멈추게 하는지.
- beats[].why: 그 문장이 하는 일 한 줄 (예: "갈등을 만들어 다음 문장을 기다리게 함").
- retention: 이탈을 막는 장치 2~3개 (짧게).

JSON 으로만 답하라:
{"summary": "", "hook": {"type": "", "why": ""}, "beats": [{"role": "", "text": "", "why": ""}], "retention": [""]}`;
  const r = await generateJson(SampleSchema, prompt, undefined, [], 0.6);
  const out: ScriptSample = { ...r, structureId, product, at: Date.now() };
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, JSON.stringify(out, null, 2), 'utf8');
  return out;
}
