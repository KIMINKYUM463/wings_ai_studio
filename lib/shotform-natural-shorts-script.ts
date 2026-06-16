/**
 * 쇼츠 자연스러운 스토리형 대본 (주제 + " 1" 스타일 모드)
 * — 프롬프트 본문은 서버 전용, 클라이언트·API 응답에 노출하지 않음
 */

import { cleanNarrationLineBreaks } from "@/lib/shotform-narration-timing"
import { NARRATION_FLOW_RHYTHM_PROMPT } from "@/lib/shotform-narration-flow-rhythm"

export const NATURAL_SHORTS_CTA = "영상 속 링크를 클릭해보세요"

export type NaturalShortsScriptExtras = {
  thumbnailTitle: string
  headcopies: string[][]
  commentKeyword: string
  youtubeDescription: string
  seoTags: string
  tiktokCaption: string
  instagramCaption: string
}

/** 프로젝트명·주제 끝의 " 1" → 자연스러운 스토리형 모드 */
export function parseTopicWithStyleMode(raw: string): { topic: string; naturalShorts: boolean } {
  const t = (raw || "").trim()
  if (!t) return { topic: "", naturalShorts: false }
  const m = t.match(/^(.+?)\s+1$/)
  if (m && m[1]!.trim().length >= 2) {
    return { topic: m[1]!.trim(), naturalShorts: true }
  }
  return { topic: t, naturalShorts: false }
}

const FEW_SHOT_LINES = [
  "전세집으로 이사했는데 계란창이 투명해서 은근 신경 쓰였거든요. 근데 이런 게 있더라고요. 접착 없이 붙이는 사생활 보호 필름인데 물만 뿌리고 쓱 붙이면 끝. 혼자서도 쉬워서 여기저기 붙였더니 분위기가 확 살았어요.",
  "이거 몰라서 100만 원 날렸어요. 욕실 타일 금 간 걸 놔뒀더니 아래집에서 물 샌다고 올라왔더라고요. 찾아보니 전용 보수제가 있었어요. 발라주고 문지르면 깔끔하게 복원되는 거 있죠. 누수 걱정 완전히 끝냈어요. 영상 속 링크를 클릭해보세요.",
  "이거 몰라서 냄새로 오해받았어요. 세탁기 안쪽을 안 닦았는데 동료가 쉰내라고 조용히 말해 주더라고요. 이거 넣고 쓱 밀기만 하면 시커먼 때가 줄줄 나오는데 냄새도 싹 사라졌어요. 영상 아래 링크를 클릭해 보세요.",
]

function cutRoleNatural(index: number, total: number): string {
  if (index === 1) return "①초반 후킹 — 호기심·감탄·「이거 몰라서/저만 몰랐네요」 패턴, 3초 내 관심"
  if (index === total) return "⑤마무리 CTA — 결과·혜택 한 줄 + 반드시 「영상 속 링크를 클릭해보세요」"
  if (index === 2) return "②일상 갈등 — 현실적 문제·주변 반응(가족·이웃·회사 등)"
  if (index <= Math.ceil(total * 0.45)) return "③반전·제품 발견 — 「찾아보니/이런 게 있더라고요」 + 제품이 뭔지·왜 쓰는지 자연스럽게"
  if (index < total) return "④사용·결과 — 화면 데모에 맞게 쓰는 방법·효과·Benefit (제품 설명 포함)"
  return "④결과 강조"
}

export function buildNaturalShortsNarrationSystemPrompt(args: {
  cutCount: number
  mode: "generate" | "rewrite"
}): string {
  const { cutCount, mode } = args
  return `한국어 유튜브·숏폼 쇼핑 스크립트 작가. JSON만 출력.
${mode === "rewrite" ? "**모드: 대본 다시쓰기** — 영상·컷 순서 유지, 문장만 전면 교체.\n" : ""}

## 목적
- 12~18초 분량이 **한 편의 연결형 스토리** (컷마다 따로 설명 금지)
- 구조: **초반 후킹 → 일상 갈등 → 반전·제품 발견 → 사용·결과 → CTA**
- 말하듯 자연스러운 대화체, 행동·반응 묘사 가능
- **제품이 무엇인지·왜 쓰는지·어떤 효과인지** 스토리 안에 반드시 포함 (제품 설명 생략 금지)

## 초반 후킹 (컷1)
- **3초 안에** 「이거 몰라서…」「파트너 없어도…」「저만 몰랐네요」 등 **문제·호기심·반전**으로 시작
- 「와 이 화면 보니까」「이 장면 보면」 같은 **무난한 관찰 문장 금지**
- 구체적 금액·결과 암시 가능 (예: 200만 원 아낌) — **치수·스펙 수치 금지**

## CTA (마지막 컷)
- 마지막 줄에 반드시 「${NATURAL_SHORTS_CTA}」 포함 (또는 「영상 아래 링크를 클릭해 보세요」)

## 금지
- **####·##·# 같은 마크다운 헤더·기호를 lines에 넣지 말 것** (TTS에 그대로 읽힘)
- **중국어·한자(简体/繁体) 절대 사용 금지**
- **치수·규격·cm/mm/m/인치/숫자×숫자 치수 표기 금지** (금액·시간·횟수는 OK)
- 장면 분석문 그대로 읽기, 「~모습 해요」「~보임」 금지
- 컷마다 같은 문장·「한번 보세요/직접 써봤어요」 반복 금지
- **「와 이 화면 보니까」「이 장면 보면」「바로 이해됐어요」「여성의 손에」** 등 장면 나열·템플릿 문구 **절대 금지** — 컷마다 문장이 달라야 함
- **그리고/그래서/바로/이어서/여기서로 문장 시작 금지** — 맥락은 내용으로 이어지게 (접속사 남발 X)

## 참고 톤 (전체 흐름 예시 — 컷 나누기 전 한 덩어리)
${FEW_SHOT_LINES.map((l, i) => `${i + 1}. ${l}`).join("\n")}

## 출력 JSON
{
  "lines": ["나레이션 첫줄\\n둘째줄", ...] — **반드시 정확히 ${cutCount}개** (누락·병합·빈 문자열 금지), lines[i] = i번째 컷 **순수 나레이션만** (「컷1」「컷2」 같은 라벨·번호 금지), \\n = 자막 한 줄,
  "thumbnailTitle": "10~12자 썸네일·제목 (숫자·호기심, 대화체)",
  "headcopies": [["썸네일1줄","제목1줄"], ...] 4~5세트,
  "commentKeyword": "댓글 키워드",
  "youtubeDescription": "스토리형 설명 + CTA",
  "seoTags": "해시 10개, 콤마 구분 (#생활꿀템 #홈바구니 #살림템 포함)",
  "tiktokCaption": "💜구매정보>프로필링크>5번 포함, 짧은 후킹 + 해시 3~5개",
  "instagramCaption": "💜팔로우하고 '키워드' 남겨주시면 링크 보내드릴게요~ 포함 + 감성 CTA"
}

## lines 규칙
- ${cutCount}개 컷이 **한 명이 말하는 한 편**처럼 이어질 것
- ${NARRATION_FLOW_RHYTHM_PROMPT}
- 각 컷: 해당 화면(visual) 동작·대상 반영 + **제품 가치가 스토리에 녹아 있을 것**
- 컷 길이(초)×4.5자 **권장** — 짧은 컷은 8~14자 한 줄, **…하는/…하게/…되는** 으로 끊기지 않게 (중간 컷은 ~고/~며 연결, 첫·마지막만 ~요 완결)
- **? ! 는 앞 문장에 붙여 쓰기** (예: 번거롭죠?) — 구두점만 따로 한 줄·공백 뒤 ? 금지
- 화면에 없는 기능·스펙 지어내기 금지
- lines 각 요소에 **「컷1」「컷2」·컷 번호·장면 번호를 넣지 말 것** — TTS에 그대로 읽힘`
}

export function buildNaturalShortsNarrationUserPrompt(args: {
  topic: string
  productName: string
  productContext: string
  cutsBlock: string
  cutCount: number
  previousScriptBlock?: string
  mode: "generate" | "rewrite"
}): string {
  const { topic, productName, productContext, cutsBlock, cutCount, previousScriptBlock, mode } = args
  return `주제(스토리 소재): ${topic || productName}
제품·영상 맥락:
${productContext}

편집 컷 ${cutCount}개 (순서 = 이미 스토리 흐름에 맞게 배치됨):
${cutsBlock}

컷별 역할:
${Array.from({ length: cutCount }, (_, i) => `${i + 1}. ${cutRoleNatural(i + 1, cutCount)}`).join("\n")}

${
  mode === "rewrite" && previousScriptBlock
    ? `이전 대본 (표현 재사용 금지):\n${previousScriptBlock}\n\n`
    : ""
}위 컷 ${cutCount}개에 맞춰 **자연스러운 연결형 쇼핑 스토리** 대본과 썸네일·SNS 메타를 JSON으로 작성하세요.
주제 「${topic || productName}」에 맞는 **일상 갈등·반전·제품 효과**를 넣고, 마지막 컷에 CTA를 넣으세요.`
}

const CUT_LABEL_LINE = /^(?:컷|cut|장면|scene)\s*#?\s*\d+\s*$/i

/** 컷1·컷2·장면3 같은 메타 라벨 제거 */
export function stripCutLabelsFromNarration(text: string): string {
  const lines = (text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CUT_LABEL_LINE.test(line))
    .map((line) => line.replace(/^(?:컷|cut|장면|scene)\s*#?\s*\d+\s*[:：.\-]\s*/i, ""))
  return lines.join("\n").trim()
}

/** 대본·자막 후처리 — 중국어·치수·깨진 조각 제거 */
export function sanitizeNarrationForOutput(text: string): string {
  let t = stripCutLabelsFromNarration(text)
  if (!t) return t

  t = t.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, "")
  t = t.replace(/\bP\d*LED\b/gi, "LED")
  t = t.replace(/\d+(?:\.\d+)?\s*(?:cm|mm|m|CM|MM|인치|inch|")\b/gi, "")
  t = t.replace(/\d+\s*[x×*]\s*\d+(?:\s*(?:cm|mm|m))?/gi, "")
  t = t.replace(/(?:가로|세로|너비|높이|두께|길이)\s*\d+/gi, "")
  t = t.replace(/[*#]\s*\d+\s*[.!！，,]*/g, "")
  t = t.replace(/^[,，、.!！\s]+/g, "")
  t = t.replace(/[!！，,]{2,}/g, " ")
  t = t.replace(/^[0-9*#.,!！\s]+$/gm, "")

  const lines = t
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}[\s,.，、]*/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
  const deduped: string[] = []
  for (const line of lines) {
    if (deduped[deduped.length - 1] === line) continue
    deduped.push(line)
  }
  t = deduped.join("\n")
  t = t.replace(/\n{3,}/g, "\n\n")
  return cleanNarrationLineBreaks(t.trim())
}

export function ensureNaturalShortsCtaOnLastLine(text: string, isLastCut: boolean): string {
  if (!isLastCut) return sanitizeNarrationForOutput(text)
  const t = sanitizeNarrationForOutput(text)
  if (!t) return NATURAL_SHORTS_CTA
  if (/링크를?\s*클릭|클릭해\s*보세요|클릭해보세요/i.test(t)) return t
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean)
  lines.push(NATURAL_SHORTS_CTA)
  return lines.join("\n")
}

export function normalizeNaturalShortsExtras(raw: Record<string, unknown> | null | undefined): NaturalShortsScriptExtras | null {
  if (!raw || typeof raw !== "object") return null
  const headcopies = Array.isArray(raw.headcopies)
    ? raw.headcopies
        .filter((r) => Array.isArray(r))
        .map((r) => (r as string[]).map((s) => sanitizeNarrationForOutput(String(s))).filter(Boolean))
        .filter((r) => r.length >= 1)
        .slice(0, 5)
    : []
  const thumbnailTitle = sanitizeNarrationForOutput(String(raw.thumbnailTitle || ""))
  const commentKeyword = sanitizeNarrationForOutput(String(raw.commentKeyword || "")).replace(/\s+/g, "")
  const youtubeDescription = sanitizeNarrationForOutput(String(raw.youtubeDescription || ""))
  const seoTags = sanitizeNarrationForOutput(String(raw.seoTags || ""))
  const tiktokCaption = sanitizeNarrationForOutput(String(raw.tiktokCaption || ""))
  const instagramCaption = sanitizeNarrationForOutput(String(raw.instagramCaption || ""))

  if (!thumbnailTitle && !headcopies.length && !youtubeDescription) return null

  return {
    thumbnailTitle: thumbnailTitle || headcopies[0]?.[0] || "",
    headcopies: headcopies.length ? headcopies : [[thumbnailTitle, thumbnailTitle]].filter((r) => r[0]),
    commentKeyword,
    youtubeDescription,
    seoTags,
    tiktokCaption,
    instagramCaption,
  }
}
