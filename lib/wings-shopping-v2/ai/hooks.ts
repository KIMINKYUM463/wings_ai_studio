import { z } from 'zod';
import type { Project } from '../types';
import { getPlaybook } from '../ssul/playbook';
import { MAX_LINE } from './schemas';
import { getLang } from '../i18n/languages';

/**
 * 첫 문장(후킹) A/B 후보.
 * 숏폼은 첫 1~3초 이탈이 가장 크고, 틱톡샵 등에서는 같은 영상의 후킹만 바꿔 여러 번 올리는 '크리에이티브 리프레시'가 일반적이다.
 */
export const HooksSchema = z.object({
  hooks: z.array(z.object({ text: z.string(), type: z.string().default(''), why: z.string().default('') })).min(1),
});
export type Hook = z.infer<typeof HooksSchema>['hooks'][number];

export function hooksPrompt(p: Project, n = 5): string {
  const pb = getPlaybook(p.mode);
  const beats = p.script?.beats ?? [];
  const l = getLang(p.lang);
  const maxLine = l?.maxLine ?? MAX_LINE;
  return `숏폼 쇼핑 영상의 첫 문장(후킹)을 서로 다른 유형으로 ${n}개 새로 써라. ${l ? `언어: ${l.english}.` : '한국어.'}
첫 1~3초에 스크롤을 멈추게 하는 게 목표다. 지금 첫 문장보다 강해야 한다.

[상품] ${p.analysis?.productName ?? ''} (${p.analysis?.category ?? ''})
[지금 첫 문장] ${beats[0]?.text.replace(/\n/g, ' ') ?? ''}
[이어지는 대본] ${beats.slice(1, 5).map((b) => b.text.replace(/\n/g, ' ')).join(' / ')}

[참고 후킹 유형 — 실제 상위 영상 분석]
${pb.hookPatterns.slice(0, 14).map((h) => `- ${h.type ? `(${h.type}) ` : ''}${h.pattern}`).join('\n')}

규칙:
- 바로 다음 문장과 자연스럽게 이어져야 한다 (두 번째 문장을 고치지 않아도 되게).
- 유형이 겹치지 않게 (질문, 숫자, 반전 예고, 공감, 손해 회피, 비밀 폭로 등).
- 확인 안 된 수치·순위·효과를 지어내지 마라. ㅋㅋ·이모지 금지 (음성으로 읽힘).
- text는 자막 줄 단위 \\n 구분, 한 줄 ${maxLine}자 이하, 1~2줄.

JSON만: {"hooks":[{"text":"","type":"유형","why":"왜 먹히는지 한 줄"}]}`;
}
