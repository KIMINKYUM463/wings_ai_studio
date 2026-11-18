import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { dataDir } from '../store';
import { generateJson } from '../ai/gemini';
import type { Analysis } from '../types';
import type { Structure } from './playbook';

/**
 * 구조 복제 템플릿: 잘 된 벤치마크 영상의 대본 구조(문장 역할·비중·쓰는 법)를 뽑아 저장하고,
 * 다른 상품의 대본을 쓸 때 그 구조를 그대로 따르게 한다. 모든 프로젝트가 같이 쓰는 보관함.
 */
export const CUSTOM_PREFIX = 'custom:';
export type CustomStructure = Structure & { createdAt: number; fromProjectId?: string; sourceTitle?: string };

const ROLES = 'hook, setup, conflict, curiosity, product_intro, feature, twist, reveal, proof, social_proof, usage, price, comparison, emotion, cta, closing';

const file = () => path.join(dataDir(), 'structures.json');

export async function listCustomStructures(): Promise<CustomStructure[]> {
  try {
    const list = JSON.parse(await fs.readFile(file(), 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAll(list: CustomStructure[]) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(list, null, 2), 'utf8');
}

export async function getCustomStructure(structureId: string | undefined): Promise<CustomStructure | null> {
  if (!structureId?.startsWith(CUSTOM_PREFIX)) return null;
  return (await listCustomStructures()).find((s) => s.id === structureId) ?? null;
}

export async function deleteCustomStructure(id: string): Promise<boolean> {
  const list = await listCustomStructures();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

const ExtractSchema = z.object({
  name: z.string(),
  oneLiner: z.string(),
  whenToUse: z.string(),
  beats: z.array(z.object({
    role: z.string(),
    purpose: z.string(),
    share: z.number(),
    sentences: z.number(),
    guidance: z.string(),
    patterns: z.array(z.string()).default([]),
  })).min(3).max(10),
});

function extractPrompt(a: Analysis): string {
  const scenes = a.scenes.map((s) => `- ${s.start.toFixed(1)}~${s.end.toFixed(1)}초: ${s.description}${s.onScreenText ? ` / 화면 글자 "${s.onScreenText}"` : ''}`).join('\n');
  return `너는 한국 쇼핑 쇼츠 대본 분석가다. 아래는 조회수가 잘 나온 벤치마크 영상의 분석이다.
이 영상의 "대본 구조"를 다른 상품에도 그대로 쓸 수 있는 구조 템플릿으로 뽑아라.

[벤치마크 영상]
상품: ${a.productName} (${a.category})
길이: ${a.duration}초
도입: ${a.structure.hook}
본문: ${a.structure.body}
마무리: ${a.structure.cta}
말투: ${a.narrationTone}
${a.hookStyle ? `훅 방식: ${a.hookStyle}\n` : ''}${a.narrativeArc ? `이야기 흐름: ${a.narrativeArc}\n` : ''}장면:
${scenes}

[규칙]
- 영상 흐름을 순서대로 3~8개 비트로 나눈다. role 은 다음 중 하나: ${ROLES}
- share 는 영상 전체에서 그 비트가 차지하는 비율(0~1, 합 1). 장면 시간을 보고 정한다.
- sentences 는 그 비트의 문장 수(1~4).
- purpose 는 그 비트가 시청자에게 하는 일, guidance 는 다른 상품으로 쓸 때 어떻게 쓰는지 한두 문장.
- patterns 는 이 영상에서 쓴 말투·문장 틀을 2~3개. 상품 이름 대신 [상품], [문제], [숫자] 같은 빈칸을 써라. 이 상품 이름·브랜드는 쓰지 마라.
- name 은 이 구조를 한눈에 알 수 있는 짧은 이름(12자 이내), oneLiner 는 "A → B → C" 꼴 한 줄 공식, whenToUse 는 어떤 상품에 맞는지 한 줄.

JSON 으로만 답하라:
{"name": "", "oneLiner": "", "whenToUse": "", "beats": [{"role": "", "purpose": "", "share": 0.2, "sentences": 2, "guidance": "", "patterns": [""]}]}`;
}

/** 분석된 벤치마크 영상에서 구조를 뽑아 보관함에 저장한다 */
export async function saveStructureFromAnalysis(a: Analysis, o: { projectId: string; name?: string; sourceTitle?: string }): Promise<CustomStructure> {
  const r = await generateJson(ExtractSchema, extractPrompt(a), undefined, [], 0.3);
  const total = r.beats.reduce((x, b) => x + Math.max(0, b.share), 0) || 1;
  const s: CustomStructure = {
    id: `${CUSTOM_PREFIX}${nanoid(8)}`,
    name: (o.name?.trim() || r.name).slice(0, 30),
    oneLiner: r.oneLiner,
    whenToUse: r.whenToUse,
    evidence: `벤치마크: ${o.sourceTitle || a.productName}`,
    targetSeconds: Math.round(a.duration || a.estimatedDurationSec || 30),
    register: a.narrationTone,
    beats: r.beats.map((b) => ({
      ...b,
      share: Math.round((Math.max(0, b.share) / total) * 100) / 100,
      sentences: Math.min(4, Math.max(1, Math.round(b.sentences))),
    })),
    createdAt: Date.now(),
    fromProjectId: o.projectId,
    sourceTitle: o.sourceTitle,
  };
  await writeAll([s, ...(await listCustomStructures())]);
  return s;
}
