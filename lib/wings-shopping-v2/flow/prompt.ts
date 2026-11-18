import { z } from 'zod';
import type { Analysis, Beat } from '../types';

/**
 * Google Flow(Veo) 연동: 장면이 부족한 문장마다 Flow에 붙여 넣을 영상 프롬프트를 만든다.
 * 원칙: AI 영상은 분위기·B롤(공항, 짐 싸기, 도시 풍경, 해변 등)에만 쓴다.
 * 실제 판매 상품(특정 호텔 객실, 특정 투어 현장, 특정 제품)을 AI로 지어내 보여주면 허위 광고가 된다.
 */

export const FlowPromptSchema = z.object({
  styleBible: z.string().default(''),
  prompts: z.array(z.object({
    beatId: z.string(),
    shot: z.string().default(''),
    subject: z.string().default(''),
    action: z.string().default(''),
    setting: z.string().default(''),
    camera: z.string().default(''),
    seconds: z.number().min(2).max(8).default(6),
    /** false면 실제 상품을 보여줘야 하는 문장이라 AI 생성 대신 실제 영상을 써야 함 */
    safe: z.boolean().default(true),
    note: z.string().optional(),
  })),
});
export type FlowPrompt = z.infer<typeof FlowPromptSchema>['prompts'][number];

export function flowPromptRequest(analysis: Analysis, beats: Pick<Beat, 'id' | 'text' | 'role'>[], opts: { style?: string }): string {
  return `너는 쇼츠용 AI 영상(Google Flow / Veo) 프롬프트 디렉터다. 아래 대본의 각 문장(beat)에 깔릴 세로 9:16 B롤 영상 프롬프트를 영어로 써라.

[상품] ${analysis.productName} (${analysis.category})
[스타일] ${opts.style || '자연스러운 실사, 밝고 따뜻한 여행 브이로그 톤'}

[대본]
${beats.map((b) => `- "${b.id}" (${b.role ?? ''}): ${b.text.replace(/\n/g, ' ')}`).join('\n')}

규칙:
- 실제 상품(이 호텔의 객실·로비, 이 투어의 현장, 이 제품의 모양)을 AI로 그리지 마라. 그런 문장은 safe=false로 두고 note에 "실제 영상 필요"라고 써라.
- AI로 만들 수 있는 것: 일반적인 풍경·분위기(해변, 도시 야경, 공항, 비행기 창밖, 짐 싸기, 사람 뒷모습, 음식 클로즈업 등), 감정 리액션.
- 모든 프롬프트는 같은 styleBible(색감·렌즈·조명)을 공유해 한 영상처럼 이어지게 하라.
- 사람 얼굴 클로즈업, 브랜드 로고, 화면 속 글자는 넣지 마라.
- 길이(seconds)는 문장 길이에 맞게 4~8초.

JSON만:
{ "styleBible": "영어 한 줄 (색감, 렌즈, 조명, 필름 질감)",
  "prompts": [ { "beatId": "...", "shot": "shot type", "subject": "...", "action": "...", "setting": "...", "camera": "camera movement", "seconds": 6, "safe": true, "note": "" } ] }`;
}

/** Flow에 그대로 붙여 넣을 수 있는 한 덩어리 프롬프트 */
export function formatFlowPrompt(styleBible: string, p: FlowPrompt): string {
  return [
    `${p.shot ? `${p.shot} of ` : ''}${p.subject}${p.action ? `, ${p.action}` : ''}${p.setting ? `, ${p.setting}` : ''}.`,
    p.camera ? `Camera: ${p.camera}.` : '',
    styleBible ? `Style: ${styleBible}.` : '',
    `Vertical 9:16, ${p.seconds} seconds, photorealistic. No text, no logos, no watermarks, no on-screen captions.`,
  ].filter(Boolean).join(' ');
}
