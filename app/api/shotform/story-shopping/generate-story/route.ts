import { NextRequest, NextResponse } from "next/server"
import type {
  StoryNarrationStyle,
  StoryScriptTemplateId,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-types"
import {
  STORY_MAX_SCENES,
  storyTargetCharacters,
  storyTargetSceneCount,
} from "@/app/WingsAIStudioShotForm/story-shopping/story-script-pace"
import { STORY_TITLE_FORMULAS } from "@/app/WingsAIStudioShotForm/story-shopping/story-title-formulas"

export const runtime = "nodejs"

/** 선물가게·수상한상점·신사들 등 썰쇼핑 채널 대본을 분석해 뽑은 문체 규칙 */
const SSUL_STYLE_GUIDE = `문체: 썰쇼핑 채널식 3인칭 서사 (선물가게·수상한상점·신사들 스타일)
- 첫 문장은 영상 제목 그대로 읽는다. 명사로 끝나는 짧은 후킹 문장 + 마침표.
- 둘째 문장부터 바로 대상의 정체·배경을 밝힌다. 제품명은 전체의 15~45% 지점 안에 공개한다. 제품명은 브랜드+핵심 이름만 짧게 쓰고 영어는 한글 발음으로 쓴다. 예) "Abc Pro 2세대 무선 이어폰 블랙, 1개" → "에이비씨 이어폰".
- 이야기 뼈대: 누가/무엇이 문제였나 → 그래서 무엇을 시도했나 → 그 결과 생긴 핵심 차별점(작동 원리) → 사람들의 반응·근황. 앞뒤 문장이 원인→결과로 이어져야 하며 맥락 없는 점프 금지.
- 존댓말 금지. 음슴체·반말 서술로 끝낸다: ~했음, ~함, ~버림, ~거임, ~는 거, ~정도임, ~다고. (마지막 한 문장만 "~입니다/~요" 허용)
- 친구에게 썰 풀듯 빠르고 과장된 리듬. 반전 직전에 "근데 여기서 ~함." 같은 전환 문장을 1번 쓴다. 같은 연결어(결국·근데·그래서)는 2번까지만.
- 제품을 쓰는 순간의 감각을 그 제품에 맞는 감각(소리·맛·향·촉감·시야 중)으로 구체적으로 묘사하고, 일상적 비유를 1번 쓴다. 다른 제품군의 표현(예: 음식이 아닌데 맛·향)을 가져오지 않는다.
- 유행어는 핵심 1~2곳에만: 미친, 1티어, 도파민 폭발, 극락, 때려 넣은, 풀매수.
- 등장인물의 생각이나 한마디를 따옴표 대사로 1번 넣는다.
- 마지막 장면은 구매 권유 대신 꿀팁("아, 참고로 ~") 또는 사람들의 반응·근황 한 문장이다. "아, 참고로" 뒤에는 장면을 더 붙이지 않는다. 가격 숫자는 쓰지 않는다.
- 근거 자료에 없는 순위·판매량("1위", "1황", "완판")과 질병 치료·의학 효과는 지어내지 않는다.
- 기능 나열 금지. 사람의 집착·문제·시도·반전·반응으로 보여준다.
- 위 문장들은 형식 설명이다. 예시 문구를 그대로 가져오지 말고 이 제품에 맞는 새 표현을 쓴다.`

const POLITE_STYLE_GUIDE = `문체: 자연스러운 존댓말 구어체
- 제품 → 기능 → 구매 순서의 광고 대본을 쓰지 않는다.
- 흥미로운 이야기 → 갈등 → 궁금증 → 해결 → 알고 보니 제품 순서로 쓴다.
- 제품명은 전체 대본의 70% 이후에 처음 공개한다.
- 첫 3초 안에 강한 궁금증을 만든다.
- 마지막은 제품이 필요한 이유와 자연스럽게 연결하되 과장 구매 유도는 하지 않는다.`

/** 채널 인기 영상 제목에서 반복되는 공식 */
const TEMPLATE_GUIDES: Record<StoryScriptTemplateId, string> = {
  origin:
    "탄생비화형: 평범한 문제 → 만든 사람의 집착 → 기존 제품 불만 → 반복 실패 → 해결 발견 → 제품 공개. 확인되지 않은 실제 역사는 만들지 말고 가상의 상황으로 명시한다.",
  inventor:
    "발명가형: 기발한 생각 → 주변의 의심 → 시도와 발명 → 무시 → 사용자의 반응 → 제품 공개. 실제 발명가 정보가 없으면 가상의 상황으로 구성한다.",
  competition:
    "경쟁박살형: 업계의 기존 방식 → 불편과 빈틈 → 새로운 방식의 등장 → 의심 → 소비자 선택 → 제품 공개. 특정 기업을 근거 없이 비방하지 않는다.",
  "unexpected-use":
    "의외의 활용형: 평범한 원래 용도 → 예상 밖 상황 → 다른 사용법 발견 → 확산 → 제품 공개. 수집된 사실과 리뷰에 있는 활용법을 우선한다.",
  "hidden-truth":
    "숨겨진 진실형: 익숙한 문제나 물건 → 거의 모르는 포인트 → 단서 공개 → 반전 → 제품 공개. 사실 확인이 안 된 비밀은 만들지 않는다.",
  "heartwarming-true":
    "감동 실화형: 힘든 상황 → 반복 실패 → 포기 직전 → 관계와 계기 → 마지막 시도 → 해결 → 제품 공개. 실화 근거가 없으면 가상의 상황이라고 명확히 표현한다.",
  "review-twist":
    "리뷰 반전형: 처음에는 과장 광고라고 의심 → 실제 리뷰 속 구체적인 불편과 사용 맥락 → 반복해서 등장하는 공통 평가 → 예상 밖 결과와 인식 반전 → 제품 공개. 입력된 실제 리뷰와 분석만 근거로 사용하고, 없는 후기·효능·수치·사용 경험을 만들지 않는다.",
  "problem-solution":
    "문제 해결형: 반복되는 구체적인 생활 불편 → 기존 방법의 한계 → 새로운 해결법 발견 → 사용 과정 → 달라진 결과 → 제품 공개. 근거 없는 효능 대신 확인된 기능과 사용 맥락으로 해결을 보여준다.",
  "before-after":
    "비포애프터형: 사용 전 상태와 불편 → 바꾸게 된 계기 → 사용 → 사용 후 변화 → 제품 공개. 전후 차이는 입력 자료에서 확인된 내용만 사용하며 과장된 수치나 효과를 만들지 않는다.",
  "challenge-test":
    "도전 실험형: 제품에 대한 의문 → 공정한 실험 조건 → 직접 테스트 → 예상 밖 결과 → 판정 → 제품 공개. 실제로 제공된 정보로 검증할 수 없는 실험 결과는 단정하지 않는다.",
  "mistake-warning":
    "실수 경고형: 많은 사람이 하는 실수 → 반복되는 손해나 불편 → 원인 발견 → 피하는 방법 → 제품 공개. 공포를 과장하지 말고 확인된 위험과 사용상 주의만 다룬다.",
  "expert-tip":
    "전문가 꿀팁형: 흔한 오해 → 좋은 제품을 고르는 기준 → 놓치기 쉬운 핵심 포인트 → 실제 적용 → 제품 공개. 확인되지 않은 전문가·기관·인증을 인용하지 않는다.",
  comparison:
    "비교 검증형: 기존 방식과 새로운 방식 → 동일한 사용 상황 → 차이 관찰 → 장단점 판정 → 제품 공개. 경쟁사를 비방하거나 근거 없는 우월성을 주장하지 않는다.",
  "time-saving":
    "시간 절약형: 매번 반복되는 귀찮은 작업 → 쌓이는 시간과 피로 → 방법 전환 → 간결해진 과정 → 생긴 여유 → 제품 공개. 시간 수치는 근거가 있을 때만 사용한다.",
  "gift-reaction":
    "선물 반응형: 상대가 겪는 불편 관찰 → 무엇을 선물할지 고민 → 제품 선택 → 첫 사용 반응 → 달라진 일상 → 제품 공개. 실제 사연이 없으면 가상의 상황임을 자연스럽게 드러낸다.",
  "trend-discovery":
    "트렌드 발견형: 최근 자주 보이는 현상 → 왜 인기인지 의문 → 사람들이 선택하는 이유 → 직접 사용 맥락 확인 → 제품 공개. 판매량·국가·유행 수치는 수집 근거가 없으면 만들지 않는다.",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const templateId = String(body.templateId || "") as StoryScriptTemplateId
    const productName = String(body.productName || "").trim()
    const targetSeconds = Math.max(10, Math.min(60, Math.round(Number(body.targetSeconds) || 30)))
    const narrationStyle: StoryNarrationStyle = body.narrationStyle === "polite" ? "polite" : "ssul"
    const isSsul = narrationStyle === "ssul"
    const targetCharacters = storyTargetCharacters(targetSeconds, narrationStyle)
    const targetSceneCount = storyTargetSceneCount(targetSeconds, narrationStyle)
    const referenceTitle = String(body.referenceTitle || "").trim().slice(0, 120)
    const referenceTranscript = String(body.referenceTranscript || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500)
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY
    if (!TEMPLATE_GUIDES[templateId]) {
      return NextResponse.json({ error: "스토리 템플릿을 선택해주세요." }, { status: 400 })
    }
    if (!productName) {
      return NextResponse.json({ error: "선택된 상품이 없습니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const collector = body.collectorData || {}
    const reviews = Array.isArray(collector.reviews)
      ? collector.reviews
          .slice(0, 30)
          .map((review: { content?: string }) => String(review.content || "").trim())
          .filter(Boolean)
      : []
    const evidence = [
      `상품명: ${productName}`,
      `상품 설명: ${String(body.productDescription || "").slice(0, 2500) || "없음"}`,
      `가격 정보: ${String(body.priceBenefit || "") || "없음"}`,
      `상세 분석: ${JSON.stringify(collector.detailInsights || {}).slice(0, 5000)}`,
      `리뷰 분석: ${JSON.stringify(collector.reviewInsights || {}).slice(0, 5000)}`,
      `실제 리뷰: ${reviews.join(" | ").slice(0, 6000) || "없음"}`,
      referenceTranscript || referenceTitle
        ? `참고 영상(같은 제품을 다룬 인기 쇼츠) 제목: ${referenceTitle || "없음"}\n참고 영상 대본: ${referenceTranscript || "없음"}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
    const referenceRule = referenceTranscript
      ? `\n참고 영상 활용 규칙:
- 참고 영상 대본은 이야기 구조·정보 순서·리듬을 배우는 용도다. 문장을 그대로 베끼지 말고(같은 어절 6개 이상 연속 금지) 새 문장으로 다시 쓴다.
- 참고 영상에 나온 제품 사실(탄생 배경·인물·수치)은 입력 상품과 같은 제품일 때만 근거로 쓴다.`
      : ""

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `너는 조회수 수백만 쇼핑 썰 쇼츠 전문 작가다.

${isSsul ? SSUL_STYLE_GUIDE : POLITE_STYLE_GUIDE}

분량 규칙 (매우 중요):
- ${targetSeconds}초 영상이며 성우가 빠르게 읽는다. narration 전체 합계가 공백 제외 ${targetCharacters}자(±10%)가 되어야 한다. 짧으면 실패다.
- 장면은 ${targetSceneCount}개 안팎, 장면당 narration은 1~2문장 약 ${Math.round(targetCharacters / targetSceneCount)}자.
${isSsul ? "- 첫 장면 narration은 제목 문장 하나만 쓴다." : ""}

사실 규칙:
- 입력 근거(상품 설명·상세 분석·리뷰·참고 영상)에 없는 역사·기업·인물·수치·수상·효능을 사실처럼 만들지 않는다.
- 탄생 비화 근거가 없으면 지어내지 말고, 리뷰 속 실제 사용자 반응·문제 상황·사용 장면으로 서사를 만든다.
- 각색은 말투와 연출(대사·비유)까지만 허용한다.${referenceRule}

${STORY_TITLE_FORMULAS}

필드 구분 규칙:
- narration은 화면 설명이 아니라 성우가 실제로 읽을 완성된 대사다.
- narration에 "장면", "모습", "화면", "클로즈업", "보여준다", "연출한다" 같은 촬영 지시를 쓰지 않는다.
- 나쁜 narration 예시: "친구가 캠핑을 준비하는 모습", "버튼을 눌러 음료를 따르는 장면"
- 좋은 narration 예시: ${
              isSsul
                ? `"캠핑만 가면 음료 따르다 손이 끈적해지는 게 너무 싫었던 한 아저씨가 있었음."`
                : `"캠핑만 가면 음료 따르는 일이 왜 이렇게 번거로운지 모르겠더라고요."`
            }
- caption은 해당 narration의 핵심을 압축한 짧은 화면 자막이다.
- visualPrompt에만 인물 행동, 배경, 카메라 구도 등 장면 설명을 쓴다.
- script는 모든 narration을 순서대로 이어 붙인 실제 음성 대본이어야 한다.

이야기 흐름 템플릿 (흐름 참고용 — 제품 공개 시점과 말투는 위 문체 규칙이 우선):
${TEMPLATE_GUIDES[templateId]}

JSON만 출력:
{
  "templateName":"유형명",
  "typeReason":"이 유형이 적합한 이유",
  "hook":"첫 3초 후킹",
  "title":"쇼츠 제목 (제목 공식 사용, 마침표 없이)",
  "script":"전체 대본",
  "scenes":[
    {"narration":"장면 내레이션","caption":"짧은 자막","visualPrompt":"필요한 영상이나 사진 설명","durationSec":5}
  ]
}

장면은 약 ${targetSceneCount}개로 나누고, 모든 durationSec 합계는 정확히 ${targetSeconds}초가 되게 구성한다.`,
          },
          { role: "user", content: evidence },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`스토리 생성 실패 (${response.status}): ${detail.slice(0, 200)}`)
    }
    const data = await response.json()
    let parsed = JSON.parse(String(data.choices?.[0]?.message?.content || "{}"))
    let rawScenes: Record<string, unknown>[] = Array.isArray(parsed.scenes)
      ? parsed.scenes
      : []
    if (rawScenes.length === 0) {
      throw new Error("AI가 완전한 스토리 대본을 반환하지 않았습니다.")
    }
    const directionPattern =
      /(하는\s*장면|하는\s*모습|보여주는\s*장면|보여준다|클로즈업|화면에|화면을|카메라|연출|소개하며\s*.+있다|누르는\s*장면|담는\s*모습)/i
    const directionCount = rawScenes.filter((scene: Record<string, unknown>) =>
      directionPattern.test(String(scene.narration || ""))
    ).length
    // 모델이 글자 수를 잘 못 지켜 2배 가까이 길게 쓰는 경우가 많아, 길이 초과도 교정 대상으로 본다.
    const narrationChars = rawScenes.reduce(
      (sum, scene) => sum + String(scene.narration || "").replace(/\s+/g, "").length,
      0
    )
    const tooLong = narrationChars > targetCharacters * 1.2
    const tooShort = narrationChars < targetCharacters * 0.75
    if (tooLong || tooShort || directionCount >= Math.ceil(rawScenes.length / 2)) {
      const repairResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.5,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `너는 숏폼 대본 교정 작가다. 입력 JSON의 스토리 순서·사실·말투는 유지하되 scenes를 교정한다.

${isSsul ? SSUL_STYLE_GUIDE : POLITE_STYLE_GUIDE}

반드시 지킬 규칙:
- narration은 성우가 그대로 읽는 대사다.
- narration에 장면·모습·화면·카메라·클로즈업·연출 같은 촬영 설명을 절대 쓰지 않는다.
- 시각적 행동과 촬영 설명은 visualPrompt로 옮긴다.
- caption은 narration의 의미를 짧게 압축한다.
- 현재 narration 합계는 공백 제외 ${narrationChars}자다. ${
                tooLong || tooShort
                  ? `반드시 ${targetCharacters}자 안팎으로 ${tooLong ? "줄이고" : "늘리고(근거 안의 감각 묘사·반응·꿀팁 추가, 사실 추가 금지)"}, 장면당 약 ${Math.round(targetCharacters / Math.max(rawScenes.length, targetSceneCount))}자로 맞춘다.`
                  : "분량은 크게 바꾸지 않는다."
              }
- 확인되지 않은 사실은 추가하지 않는다.

JSON만 출력:
{"script":"실제로 읽을 전체 대본","scenes":[{"narration":"실제로 읽을 대사","caption":"짧은 화면 자막","visualPrompt":"장면 설명","durationSec":5}]}`,
            },
            {
              role: "user",
              content: `${evidence}\n\n교정할 JSON:\n${JSON.stringify(parsed)}`,
            },
          ],
        }),
      })
      if (repairResponse.ok) {
        const repairData = await repairResponse.json()
        const repaired = JSON.parse(
          String(repairData.choices?.[0]?.message?.content || "{}")
        )
        if (Array.isArray(repaired.scenes) && repaired.scenes.length > 0) {
          parsed = { ...parsed, ...repaired }
          rawScenes = repaired.scenes as Record<string, unknown>[]
        }
      }
    }
    const stripEnd = (text: string) => text.trim().replace(/[.。!?]+$/, "")
    const title = stripEnd(String(parsed.title || ""))
    const firstNarration = stripEnd(String(rawScenes[0]?.narration || ""))
    // 썰 채널은 제목을 첫 문장으로 읽음 — 모델이 빠뜨리면 제목 장면을 맨 앞에 추가
    const needsTitleScene = isSsul && title && !firstNarration.startsWith(title.slice(0, 8))
    const sceneSource = needsTitleScene
      ? [
          { narration: `${title}.`, caption: title, visualPrompt: rawScenes[0]?.visualPrompt, durationSec: 2 },
          ...rawScenes.slice(0, STORY_MAX_SCENES - 1),
        ]
      : rawScenes.slice(0, STORY_MAX_SCENES)
    const scenes = sceneSource.map((scene: Record<string, unknown>, index: number) => ({
      id: `story_scene_${Date.now()}_${index + 1}`,
      order: index + 1,
      narration: String(scene.narration || "").replace(/>>\s*/g, "").trim(),
      caption: String(scene.caption || "").trim(),
      visualPrompt: String(scene.visualPrompt || "").trim(),
      durationSec: Math.max(1, Number(scene.durationSec) || 5),
    }))
    const rawDuration = scenes.reduce((sum, scene) => sum + scene.durationSec, 0) || 1
    let remainingDuration = targetSeconds
    const normalizedScenes = scenes.map((scene, index) => {
      const remainingSceneCount = scenes.length - index - 1
      const maxForCurrent = Math.max(1, remainingDuration - remainingSceneCount)
      const durationSec =
        index === scenes.length - 1
          ? remainingDuration
          : Math.max(
              1,
              Math.min(
                maxForCurrent,
                Math.round((scene.durationSec / rawDuration) * targetSeconds)
              )
            )
      remainingDuration -= durationSec
      return { ...scene, durationSec }
    })
    return NextResponse.json({
      success: true,
      story: {
        templateId,
        templateName: String(parsed.templateName || "").trim(),
        targetDurationSec: targetSeconds,
        typeReason: String(parsed.typeReason || "").trim(),
        hook: String(parsed.hook || "").trim(),
        title,
        narrationStyle,
        script: normalizedScenes
          .map((scene) => scene.narration)
          .filter(Boolean)
          .join("\n\n"),
        scenes: normalizedScenes,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "스토리 생성에 실패했습니다." },
      { status: 500 }
    )
  }
}
