import type { Analysis, Clip } from '../types';
import { MAX_LINE } from './schemas';
import { hookFormulaPromptBlock } from '@/lib/shopping-hook-formulas';

export const ANALYZE_PROMPT = `너는 한국 쇼핑 숏폼(유튜브 쇼츠/릴스/틱톡) 분석가다. 첨부 영상을 보고 아래 JSON만 출력해라.

{
  "productName": "제품명 (브랜드 포함, 한국어 표기와 원어 병기 가능)",
  "category": "카테고리",
  "keywords": ["구매자가 검색할 만한 한국어 키워드 6~10개"],
  "searchQueries": {
    "youtube": ["유튜브 쇼츠에서 같은 제품 영상을 찾을 검색어 4개 (한국어 2, 영어 2)"],
    "tiktok": ["틱톡에서 같은 제품을 찾을 검색어 4개 (영어 위주, 브랜드명 포함)"],
    "instagram": ["인스타 릴스 검색어 4개 (한국어 2, 영어 2)"],
    "douyin": ["더우인 검색어 2개 (중국어 간체, 상품 일반명 + 브랜드명 또는 种草·测评 같은 표현)"],
    "xiaohongshu": ["샤오홍슈 검색어 2개 (중국어 간체, 测评·好物 같은 후기형 표현)"]
  },
  "structure": { "hook": "도입 후킹 방식", "body": "본문 전개 방식", "cta": "마무리/구매유도 방식" },
  "scenes": [
    { "start": 0, "end": 3, "description": "[샷 종류] 화면에 보이는 것", "onScreenText": "화면에 박힌 글자 그대로" }
  ],
  "narrationTone": "말투 특징 (예: 반말 구어체, 짧은 문장, 감탄사 등)"
}

규칙:
- scenes는 컷 전환 기준으로 영상 전체를 빈틈없이 덮어라. 시각은 초 단위 숫자(소수점 1자리).
- 제품을 정확히 식별할 수 없으면 보이는 특징으로 가장 그럴듯한 일반명을 써라.`;

export function describeClipsPrompt(clips: { id: string; start: number; end: number }[]): string {
  return `첨부 영상의 아래 구간들을 각각 보고 JSON 배열만 출력해라.
구간: ${JSON.stringify(clips.map((c) => ({ id: c.id, start: c.start, end: c.end })))}

각 항목 형식:
{ "id": "구간 id", "description": "[샷 종류] 무엇이 보이는지 한 문장", "shotType": "클로즈업|착용|사용|인물|언박싱|텍스트화면|기타", "hasBurnedText": 화면에 자막·글자가 크게 박혀 있으면 true, "quality": 1~5 (쇼핑 쇼츠 소재로서 쓸모, 흔들림/저화질/무관한 장면은 낮게), "textBoxes": [[ymin, xmin, ymax, xmax], ...] }

textBoxes 규칙:
- 그 구간에서 화면 위에 덧입힌 자막·문구·워터마크·채널 로고·계정 아이디·QR 코드의 위치. 제품 자체에 인쇄된 글자(포장, 로고)는 넣지 마라.
- 좌표는 영상 프레임 기준 0~1000 정수, [위, 왼쪽, 아래, 오른쪽] 순서. 구간 동안 글자가 지나가는 영역 전체를 덮게 넉넉히.
- 없으면 빈 배열.

모든 구간 id를 빠짐없이 포함해라.`;
}

export function scriptPrompt(
  analysis: Analysis,
  clips: Clip[],
  targetSeconds: number,
  structure?: string,
): string {
  const lib = clips
    .filter((c) => !c.excluded)
    .map((c) => ({ id: c.id, len: +(c.end - c.start).toFixed(1), desc: c.description, shot: c.shotType, text: c.hasBurnedText, q: c.quality }));
  const beats = Math.max(5, Math.round(targetSeconds / 3.5));
  return `너는 한국 쇼핑 숏폼 대본 작가다. 레퍼런스 영상의 구조와 말투를 참고해서 새 나레이션 대본을 쓰고, 각 문장에 어울리는 영상 클립을 골라라.

[제품] ${analysis.productName} (${analysis.category})
[키워드] ${analysis.keywords.join(', ')}
[레퍼런스 구조] 후킹: ${analysis.structure.hook} / 본문: ${analysis.structure.body} / 마무리: ${analysis.structure.cta}
[레퍼런스 말투] ${analysis.narrationTone}
[레퍼런스 장면 흐름]
${analysis.scenes.map((s) => `- ${s.start}~${s.end}s: ${s.onScreenText ?? ''} | ${s.description}`).join('\n')}

[사용 가능한 클립 라이브러리]
${JSON.stringify(lib)}

출력(JSON만):
{
  "headcopy": ["상단 고정 문구 1줄 (12자 이내)", "2줄 (12자 이내, 제품명이나 핵심 혜택)"],
  "beats": [ { "text": "자막 줄1\\n자막 줄2", "clipId": "라이브러리의 id" } ]
}

규칙:
- 전체 낭독 길이 약 ${targetSeconds}초, 비트 ${beats}개 안팎. 한 비트는 읽는 데 2~5초.
- text는 자막 줄 단위로 \\n 구분, 한 줄 ${MAX_LINE}자 이하, 비트당 1~3줄.
- 첫 비트는 아래 후킹 공식으로 쓰고, 마지막 비트는 구매/댓글 유도.

${hookFormulaPromptBlock()}

- 레퍼런스 문장을 그대로 베끼지 말고 구조와 정보만 살려 새로 써라.
${structure ? `\n${structure}\n` : ""}
- 각 비트의 clipId는 그 문장 내용과 화면이 가장 잘 맞는 클립. 같은 클립을 연속으로 쓰지 말고, 가능하면 클립을 고르게 써라.
- text:true(화면 글자 박힘) 클립과 q가 낮은 클립은 되도록 피하라.
- 숫자·영어는 읽기 쉽게 한글로 풀어 써도 좋다.
- 음성으로 읽히므로 ㄷㄷ, ㅋㅋ, ㅠㅠ 같은 자음·모음 표현과 이모지는 쓰지 마라.`;
}

export const TEXT_BOX_PROMPT = (keys: string[]) => `위 이미지들은 쇼핑 숏폼 영상에서 뽑은 정지 화면이다. 각 이미지에서 영상 위에 덧입힌 글자 영역을 모두 찾아라:
자막, 제목 문구, 가격·설명 텍스트, 워터마크, 채널 로고, 계정 아이디(@...), 플랫폼 로고, QR 코드(다른 사람 페이지로 연결되므로 꼭).
제품 본체나 포장에 원래 인쇄된 글자, 화면 속 디스플레이 숫자는 넣지 마라.

JSON만 출력: { ${keys.map((k) => `"${k}": [[ymin, xmin, ymax, xmax], ...]`).join(', ')} }
- 좌표는 이미지 기준 0~1000 정수. 글자 줄 전체(배경 띠가 있으면 띠까지)를 덮게.
- 글자가 없으면 빈 배열. 모든 키를 포함해라.`;
