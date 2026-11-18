import { z } from 'zod';
import type { Analysis, Clip, ReviewInfo, TravelInfo } from '../types';
import { MAX_LINE } from '../ai/schemas';
import { PLAYBOOK, REVIEW_PLAYBOOK, TRAVEL_PLAYBOOK, getAngle, getStructure, getTone, type Playbook, type Structure } from './playbook';
import { STORY_SCRIPT_TEMPLATES, isStoryScriptTemplateId } from '@/app/WingsAIStudioShotForm/story-shopping/story-script-catalog';
import { hookFormulaPromptBlock } from '@/lib/shopping-hook-formulas';

/** structureId 가 "story:<id>" 면 스토리쇼핑숏폼(v1)의 스토리 공식을 쓴다 */
const STORY_PREFIX = 'story:';
function storyFormula(structureId: string) {
  if (!structureId.startsWith(STORY_PREFIX)) return null;
  const id = structureId.slice(STORY_PREFIX.length);
  return isStoryScriptTemplateId(id) ? STORY_SCRIPT_TEMPLATES[id] : null;
}

/** 썰 쇼핑 상위 영상 실측 낭독 속도 (공백 제외 글자/초) */
export const SSUL_CHARS_PER_SEC = 8.1;
export const targetChars = (seconds: number) => Math.round(seconds * SSUL_CHARS_PER_SEC);

export type SsulScriptOptions = {
  structureId: string; // 'auto' = AI가 고름
  angleId?: string;
  toneId: string;
  ctaType: string;
  ctaKeyword?: string;
  targetSeconds: number;
  /** 구조 복제 템플릿 (structureId 가 custom:<id> 일 때 서버가 채움) */
  custom?: Structure;
};

export const SsulScriptSchema = z.object({
  structureId: z.string().default(''),
  structureReason: z.string().optional(),
  title: z.array(z.string()).min(1),
  comment: z.string().default(''),
  beats: z.array(z.object({ role: z.string().default(''), text: z.string(), clipId: z.string().nullable().optional(), item: z.string().nullable().optional() })).min(1),
});

const pick = <T,>(arr: T[], n: number) => arr.slice(0, n);
const lines = (items: { pattern: string; example?: string }[]) => items.map((p) => `- ${p.pattern}${p.example ? `  (예: ${p.example})` : ''}`).join('\n');

function structureBlock(s: Structure, seconds: number): string {
  return [
    `### ${s.id} — ${s.name}`,
    `공식: ${s.oneLiner} / 적합: ${s.whenToUse}`,
    ...s.beats.map((b, i) => [
      `${i + 1}. role="${b.role}" (영상의 약 ${Math.round(b.share * 100)}% ≈ ${Math.round(b.share * seconds)}초, ${b.sentences}문장) — ${b.purpose}`,
      `   쓰는 법: ${b.guidance}`,
      `   패턴: ${b.patterns.join(' / ')}`,
    ].join('\n')),
  ].join('\n');
}

/** 여행 모드: 사용자가 입력한 사실 정보. 가격·기간은 이것만 쓰게 한다 */
export function factsBlock(f: TravelInfo): string {
  const rows = ([['상품 종류', f.productType], ['상품명', f.productName], ['지역', f.location], ['가격', f.price], ['기간·마감', f.period], ['예약·구매 방법', f.howToBuy]] as const)
    .filter(([, v]) => v && String(v).trim()).map(([k, v]) => `- ${k}: ${v}`);
  const missing = [!f.price && '가격', !f.period && '기간'].filter(Boolean).join('·');
  return ['[상품 사실 정보 — 사용자가 입력]', ...rows,
    '- 가격·할인율·기간·순위 같은 수치는 위에 적힌 것만 써라. 없는 수치를 지어내지 마라.',
    ...(f.firsthand ? ['- 사용자가 직접 이용·방문한 상품이다. 체험담 말투를 써도 된다.'] : ['- 사용자가 직접 써보거나 다녀온 상품이 아니다. 직접 묵은·써본 척하지 마라 (내돈내산, 재방문, 수십 번 묵음, 내 후기 같은 1인칭 체험 표현 금지). 정보 전달·추천 말투로 써라.']),
    ...(missing ? [`- ${missing} 정보가 없으니 ${missing}은(는) 언급하지 마라.`] : [])].join('\n');
}

/** 리뷰·랭킹 모드: 사용자가 넣은 상품 목록. 상품명·가격은 이것만 쓰게 한다 */
export function reviewFactsBlock(r: ReviewInfo): string {
  const items = r.items.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 10);
  return [
    '[상품 목록 — 사용자가 입력, 한 줄에 하나: 상품명 | 가격 | 특징]',
    ...(items.length ? items.map((l, i) => `${i + 1}. ${l}`) : ['- (입력 없음) 레퍼런스 영상의 상품 하나로 리뷰·비교형을 써라. 다른 상품을 지어내지 마라.']),
    '- 랭킹·비교라면 위 상품들만 써라. 목록에 없는 상품·가격·순위·판매량을 지어내지 마라. 가격이 없는 상품은 가격을 말하지 마라.',
    '- 순위는 사용자가 적은 순서를 1위로 보되, 카운트다운(역순)으로 말해도 된다.',
    r.basis?.trim()
      ? `- 순위·추천 근거는 "${r.basis.trim()}" 이다. 근거를 말할 때는 이것만 써라.`
      : '- 순위·추천 근거가 주어지지 않았다. "판매량 기준", "실제 판매 데이터", "가장 많이 팔린", "가장 사랑받는", "올영 1위", "리뷰 수 1위" 같은 근거·인기 주장을 하지 마라. 근거가 필요하면 "제가 고른", "추천 순위"처럼 말해라.',
    '- 효능은 단정하지 마라 (치료·완치·여드름이 사라짐 등 금지). "~에 좋다는 평", "~용으로 나온" 처럼 말해라.',
    r.firsthand
      ? '- 사용자가 직접 써본 상품이다. 사용 후기 말투를 써도 된다.'
      : '- 사용자가 직접 써본 상품이 아니다. 내돈내산·한 달 써봄·직접 써보니 같은 1인칭 사용 후기를 지어내지 마라. 정보·추천·비교 말투로 써라 ("후기를 보면", "이런 분께 맞아요").',
  ].join('\n');
}

/** 대본 길이 피드백: 목표 대비 80% 미만이면 늘리고, 125% 초과면 줄이라고 한다 */
export function lengthFeedback(chars: number, need: number): string | null {
  if (chars < need * 0.8) return `[수정 요청] 방금 대본은 공백 제외 ${chars}자로 너무 짧았다. 약 ${need}자가 되도록 비트를 늘리고 더 구체적으로 다시 써라.`;
  if (chars > need * 1.25) return `[수정 요청] 방금 대본은 공백 제외 ${chars}자로 너무 길었다. 약 ${need}자가 되도록 비슷한 기능 비트를 합치고 군더더기를 빼서 다시 써라.`;
  return null;
}

export function ssulScriptPrompt(analysis: Analysis, clips: Clip[], o: SsulScriptOptions, pb: Playbook = PLAYBOOK, facts?: TravelInfo | ReviewInfo): string {
  const review = pb === REVIEW_PLAYBOOK;
  const genreLine = pb === PLAYBOOK
    ? '썰(이야기)을 풀면서 상품을 자연스럽게 소개하는'
    : pb === TRAVEL_PLAYBOOK
      ? '여행 상품(숙소·투어·입장권·여행템·항공)을 소개해 예약·구매로 이어지게 하는'
      : '상품을 리뷰·랭킹·비교(TOP N, A vs B, 비포/애프터, 문제→해결, 솔직후기)해서 구매로 이어지게 하는';
  const factsText = facts ? ('items' in facts ? reviewFactsBlock(facts) : factsBlock(facts)) : '';
  const itemField = review ? ', "item": "새 상품이 처음 나오는 비트에만 화면 라벨 (예: 3위 · 상품명 / A · 상품명 / 상품명), 나머지 비트는 빈 문자열"' : '';
  const tone = getTone(o.toneId, pb);
  const angle = getAngle(o.angleId, pb);
  const auto = o.structureId === 'auto';
  const story = storyFormula(o.structureId);
  const lib = clips.filter((c) => !c.excluded)
    .map((c) => ({ id: c.id, src: c.sourceId, len: +(c.end - c.start).toFixed(1), desc: c.description, shot: c.shotType, text: c.hasBurnedText, q: c.quality }));
  const ctas = pb.ctaPatterns.filter((c) => c.type === o.ctaType);

  return `너는 한국 "${pb.genre}" 대본 작가다. ${genreLine} 쇼츠 대본을 쓴다.
아래 플레이북은 실제 상위 영상을 문장 단위로 분석해서 만든 것이다. 구조·패턴·말투를 그대로 따르되, 문장은 이 상품에 맞게 새로 써라.

[이 장르의 본질]
${pb.summary}

[상품]
${analysis.productName} (${analysis.category})
키워드: ${analysis.keywords.join(', ')}
레퍼런스 영상 정보: 도입=${analysis.structure.hook} / 본문=${analysis.structure.body} / 마무리=${analysis.structure.cta}
레퍼런스 장면: ${analysis.scenes.map((s) => s.onScreenText || s.description).filter(Boolean).slice(0, 12).join(' | ')}
${factsText ? `
${factsText}
` : ''}

[대본 구조]
${o.custom
    ? `반드시 이 구조를 따른다. 조회수가 잘 나온 벤치마크 영상에서 그대로 뽑은 구조다 (structureId="${o.structureId}"):
${structureBlock(o.custom, o.targetSeconds)}
원래 말투: ${o.custom.register}`
    : story
    ? `반드시 이 스토리 공식을 따른다 (structureId="${o.structureId}"):
${story.name} — ${story.description}
흐름: ${story.flow}
규칙: ${story.guide}
목표 길이 약 ${o.targetSeconds}초. 각 문장의 role 은 hook, setup, conflict, curiosity, product_intro, feature, twist, reveal, proof, social_proof, usage, price, comparison, emotion, cta, closing 중에서 흐름에 맞게 고른다.`
    : auto
    ? `아래 구조 중 이 상품에 가장 잘 맞는 하나를 골라 structureId에 적고 이유를 structureReason에 써라.\n\n${pb.structures.map((s) => structureBlock(s, o.targetSeconds)).join('\n\n')}`
    : `반드시 이 구조를 따른다 (structureId="${o.structureId}"):\n${structureBlock(getStructure(o.structureId, pb), o.targetSeconds)}`}

${angle ? `[썰 각도] ${angle.name} — ${angle.description}\n제목 패턴: ${angle.titlePattern}` : '[썰 각도] 상품에 가장 흥미로운 각도를 스스로 정해라.'}

[말투: ${tone.name}] ${tone.register}, 어미 ${tone.endings.join(' / ')}, 문장 길이 ${tone.sentenceChars}
예시 말투: ${tone.example}

${hookFormulaPromptBlock()}

[후킹 패턴 참고 — 실제 상위 썰 쇼핑 영상 첫 문장]
${lines(pick(pb.hookPatterns, 12))}

[상단 고정 제목 공식]
${lines(pick(pb.titleFormulas, 10))}

[썰 → 상품 전환 문장]
${lines(pick(pb.productTransitions, 8))}

[반전 장치]
${lines(pick(pb.twistDevices, 6))}

[증거 장치]
${lines(pick(pb.proofDevices, 6))}

[마무리/CTA: ${o.ctaType}]
${ctas.length ? lines(ctas) : '- 별도 CTA 없이 여운 있는 한 문장으로 끝낸다'}
${o.ctaType === '댓글키워드' && o.ctaKeyword?.trim() ? `- 댓글 키워드는 반드시 "${o.ctaKeyword.trim()}" 이다. 마지막 문장에서 이 단어를 그대로 (따옴표 없이, 바꾸지 말고) 댓글로 남기라고 말해라. comment 에도 이 키워드를 넣어라.\n` : ''}${o.ctaType !== '없음' ? `- 구조에 cta 비트가 없더라도 마지막 비트는 반드시 role="cta"로 "${o.ctaType}" 방식의 한 문장을 넣어라.` : ''}

[페이싱 — 실측]
- 전체 낭독 약 ${o.targetSeconds}초 = 공백 제외 약 ${targetChars(o.targetSeconds)}자 (초당 ${SSUL_CHARS_PER_SEC}자, 빠른 호흡)
- 상품은 ${pb.pacing.productFirstMentionSec} 안에 처음 등장 (실측 중앙값 4초)
${pb.pacing.notes.map((n) => `- ${n}`).join('\n')}

[규칙]
해라: ${pb.rules.do.join(' / ')}
하지 마라: ${pb.rules.dont.join(' / ')}
- 원본 영상·패턴 예시 문장을 그대로 베끼지 말 것. 확인되지 않은 수치·인물·사건을 사실처럼 지어내지 말고, 일반적인 표현(예: "후기가 많다")을 쓸 것.
- ㄷㄷ, ㅋㅋ 같은 자음·모음 표현과 이모지는 대본(text)에 쓰지 마라 (음성으로 읽힘). comment에는 써도 된다.
- text는 그대로 자막에 나온다. 숫자·순위·모델명·영문 브랜드는 표기대로 써라 (3위, V16, A9S, 2만 원). "삼위", "브이십육", "에이나인에스"처럼 소리 나는 대로 풀어 쓰지 마라.

[사용 가능한 클립 라이브러리]
${JSON.stringify(lib)}

출력(JSON만):
{
  "structureId": "사용한 구조 id",
  "structureReason": "왜 이 구조인지 한 줄",
  "title": ["상단 고정 제목 1줄 (14자 이내)", "2줄 (14자 이내, 강조할 핵심)"],
  "comment": "영상 하단에 들어갈 시청자 반응 같은 짧은 한 줄 (ㅋㅋ 가능)",
  "beats": [ { "role": "구조의 role 그대로", "text": "자막 줄1\\n자막 줄2", "clipId": "라이브러리 id"${itemField} } ]
}
- beats는 구조의 비트 순서를 따르고, 한 비트(role)가 여러 문장이면 beats를 여러 개로 나눠라.
- text는 자막 줄 단위 \\n 구분, 한 줄 ${MAX_LINE}자 이하, 비트당 1~2줄.
- clipId는 그 문장 내용과 화면이 가장 맞는 클립. 같은 클립 연속 사용 금지, text:true·q 낮은 클립은 피함.
- 화면이 지루하지 않게 가능하면 여러 소스 영상(src)을 섞어 써라. 한 소스에서 전체의 절반 넘게 쓰지 마라 (맞는 장면이 없을 때만 예외).`;
}
