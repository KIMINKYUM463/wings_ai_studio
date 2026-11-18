import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { projectDir } from '../store';
import { generateJson } from '../ai/gemini';
import type { Project } from '../types';

/**
 * 문장별 장면 추천: 대본 문장마다 어울리는 장면 4개를 이유와 함께 고른다.
 * 대본·장면이 그대로면 저장해 둔 결과를 다시 쓴다 (AI 호출은 대본이 바뀔 때만 1회).
 */
export type ClipRecs = Record<string, { clipId: string; reason: string }[]>;

const Schema = z.object({
  beats: z.array(z.object({
    beat: z.number(),
    picks: z.array(z.object({ clip: z.string(), reason: z.string() })).max(6),
  })),
});

export async function clipRecommendations(p: Project): Promise<ClipRecs> {
  const beats = (p.script?.beats ?? []).filter((b) => b.id);
  const clips = p.clips.filter((c) => !c.excluded);
  if (!beats.length || !clips.length) return {};
  const key = crypto.createHash('sha1').update(JSON.stringify([beats.map((b) => [b.id, b.text]), clips.map((c) => [c.id, c.description])])).digest('hex').slice(0, 16);
  const file = path.join(projectDir(p.id), 'clip-recs.json');
  try {
    const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { key: string; recs: ClipRecs };
    if (saved.key === key) return saved.recs;
  } catch { /* 처음이면 만든다 */ }

  // 장면 id 는 길어서 짧은 번호(c1, c2...)로 주고받는다
  const short = new Map(clips.map((c, i) => [`c${i + 1}`, c]));
  const prompt = `너는 쇼핑 쇼츠 편집자다. 대본 문장마다 화면에 깔 장면을 고른다.

[장면 목록] (번호 | 길이 | 장면 설명 | 샷)
${[...short].map(([k, c]) => `${k} | ${(c.end - c.start).toFixed(1)}초 | ${c.description} | ${c.shotType}`).join('\n')}

[대본 문장] (번호 | 역할 | 음성 길이 | 문장)
${beats.map((b, i) => `${i + 1} | ${b.role ?? ''} | ${b.tts ? `${b.tts.duration.toFixed(1)}초` : '-'} | ${b.text.replace(/\n/g, ' ')}`).join('\n')}

[규칙]
- 문장마다 말하는 내용을 화면이 바로 보여 주는 장면을 4개 고른다 (가장 잘 맞는 것부터).
- 문장이 말하는 대상·동작·상황이 장면 설명에 보이는 것을 우선한다. 훅 문장은 시선을 끄는 장면, 행동 유도 문장은 제품 전체가 보이는 장면.
- 가능하면 음성 길이보다 긴 장면을 앞에 둔다.
- reason 은 왜 어울리는지 15자 안팎 한국어.

JSON 으로만 답하라: {"beats": [{"beat": 1, "picks": [{"clip": "c3", "reason": ""}]}]}`;
  const r = await generateJson(Schema, prompt, undefined, [], 0.2);
  const recs: ClipRecs = {};
  for (const x of r.beats) {
    const b = beats[x.beat - 1];
    if (!b?.id) continue;
    recs[b.id] = x.picks
      .map((pk) => ({ clipId: short.get(pk.clip.trim())?.id ?? '', reason: pk.reason }))
      .filter((pk, i, arr) => pk.clipId && arr.findIndex((y) => y.clipId === pk.clipId) === i)
      .slice(0, 4);
  }
  await fs.writeFile(file, JSON.stringify({ key, recs }, null, 2), 'utf8');
  return recs;
}
