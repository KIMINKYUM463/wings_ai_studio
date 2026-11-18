import { z } from 'zod';
import type { Analysis, Project } from '../types';
import data from './playbook.json';

type ThumbPattern = { pattern: string; copyType: string };
type ThumbPlaybook = {
  source: string;
  stats: Record<string, unknown>;
  patterns: ThumbPattern[];
  /** 조회수 30만+ 한국 쇼핑 쇼츠 제목(=표지 후킹) 실측. 패턴은 중앙 조회수 내림차순 */
  shopping?: { source: string; stats: Record<string, unknown>; patterns: (ThumbPattern & { example: string; views: number })[] };
};
export const THUMB_PLAYBOOK = data as ThumbPlaybook;

export const ThumbCopySchema = z.object({
  options: z.array(z.object({
    lines: z.array(z.string()).min(1),
    highlight: z.string().default(''),
    type: z.string().default(''),
  })).min(1),
});

/** 썸네일 문구 프롬프트: 분석 통계 + 상위 썸네일 문구 패턴 + 이 영상의 제목·후킹 */
export function thumbCopyPrompt(analysis: Analysis, script: Pick<NonNullable<Project['script']>, 'headcopy' | 'beats'> | undefined): string {
  const s = THUMB_PLAYBOOK.stats;
  const shop = THUMB_PLAYBOOK.shopping;
  const ss = shop?.stats;
  const shopBlock = shop
    ? `[1순위 실측: ${shop.source}]
- 글자 수 중앙값: ${ss?.charsMedian}자 (공백 제외)
- 문구 유형 분포(%): ${JSON.stringify(ss?.copyTypeSharePct)}
- 유형별 중앙 조회수(만): ${JSON.stringify(ss?.copyTypeMedianViews_10k)}
- 자주 쓰는 후킹 단어(%): ${JSON.stringify(ss?.hookWordsPct)}

[1순위: 고조회 쇼핑 쇼츠 문구 패턴 (센 순서)]
${shop.patterns.slice(0, 40).map((p, i) => `${i + 1}. (${p.copyType}) ${p.pattern}  예) "${p.example}" ${Math.round(p.views / 1e4)}만뷰`).join('\n')}

`
    : '';
  return `너는 한국 쇼핑 쇼츠 썸네일 카피라이터다. 아래 실측 데이터를 따라 이 영상의 썸네일 문구 4안을 써라.

${shopBlock}[보조 실측(표지 디자인): ${THUMB_PLAYBOOK.source}]
- 줄 수: ${s.lines} / 글자 수 중앙값: ${s.charsMedian}자 (공백 제외)
- 위치: ${s.area} / ${s.outline} / ${s.font}
- 문구 유형 분포: ${JSON.stringify(s.copyTypes)}
- 한 단어(또는 숫자)를 강조색으로 칠하는 경우가 많다.

[보조: 일반 썸네일 문구 패턴]
${THUMB_PLAYBOOK.patterns.map((p) => `- (${p.copyType}) ${p.pattern}`).join('\n')}

[이 영상]
상품: ${analysis.productName} (${analysis.category})
영상 상단 제목: ${(script?.headcopy ?? []).join(' ')}
첫 문장(후킹): ${script?.beats[0]?.text.replace(/\n/g, ' ') ?? ''}

출력(JSON만):
{ "options": [ { "lines": ["1줄", "2줄", "(선택) 3줄"], "highlight": "강조색으로 칠할 단어(lines 안에 그대로 있는 것)", "type": "유형 · 패턴 (예: 비밀폭로형 · {장소} 직원들이 뽑은 {카테고리}템 TOP{N})" } ] }
- 4안은 각각 1순위 목록의 서로 다른 고조회 패턴 구조를 하나씩 따르고, 고른 유형과 패턴을 type에 "유형 · 패턴"으로 적어라. 유형도 가능하면 겹치지 않게.
- 각 안은 2~3줄, 한 줄 10자 안팎, 전체 공백 제외 12~22자. highlight는 핵심 한 단어(또는 숫자)만.
- 패턴은 뼈대만 빌리고 {자리}는 이 영상 내용으로 채워라. 사실은 위 상품 정보·제목·대본에 있는 것만 쓰고, 확인 안 된 수치·가격·순위·인물·품절 여부는 지어내지 마라 (예시 제목의 숫자·인물도 가져오지 마라).
- 영상 상단 제목과 똑같은 문구는 1안까지만.`;
}
