import { NextRequest, NextResponse } from "next/server"
import type { StoryScriptTemplateId } from "@/app/WingsAIStudioShotForm/story-shopping/story-types"

export const runtime = "nodejs"

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
    const targetCharacters = Math.round(targetSeconds * 4.2)
    const targetSceneCount = Math.max(4, Math.min(10, Math.round(targetSeconds / 5)))
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
    ].join("\n\n")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.72,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `너는 쇼핑 숏폼 전문 스토리 작가다.

핵심 원칙:
- 제품 → 기능 → 구매 순서의 광고 대본을 쓰지 않는다.
- 흥미로운 이야기 → 갈등 → 궁금증 → 해결 → 알고 보니 제품 순서로 쓴다.
- 제품명은 전체 대본의 70% 이후에 처음 공개한다.
- 첫 3초 안에 강한 궁금증을 만든다.
- 정확히 ${targetSeconds}초를 목표로 자연스러운 한국어 구어체로 쓴다.
- 공백 제외 약 ${targetCharacters}자를 목표로 하며 지나치게 짧거나 길게 쓰지 않는다.
- 기능을 나열하지 않고 이야기 속 행동과 결과로 보여준다.
- 입력 근거에 없는 역사·기업·인물·수치·효능을 사실처럼 만들지 않는다.
- 실화 근거가 없으면 반드시 가상의 상황임을 자연스럽게 드러낸다.
- 마지막은 제품이 필요한 이유와 자연스럽게 연결하되 과장 구매 유도는 하지 않는다.

필드 구분 규칙:
- narration은 화면 설명이 아니라 성우가 실제로 읽을 완성된 대사다.
- narration에 "장면", "모습", "화면", "클로즈업", "보여준다", "연출한다" 같은 촬영 지시를 쓰지 않는다.
- 나쁜 narration 예시: "친구가 캠핑을 준비하는 모습", "버튼을 눌러 음료를 따르는 장면"
- 좋은 narration 예시: "캠핑만 가면 음료 따르는 일이 왜 이렇게 번거로운지 모르겠더라고요."
- caption은 해당 narration의 핵심을 압축한 짧은 화면 자막이다.
- visualPrompt에만 인물 행동, 배경, 카메라 구도 등 장면 설명을 쓴다.
- script는 모든 narration을 순서대로 이어 붙인 실제 음성 대본이어야 한다.

선택 템플릿:
${TEMPLATE_GUIDES[templateId]}

JSON만 출력:
{
  "templateName":"유형명",
  "typeReason":"이 유형이 적합한 이유",
  "hook":"첫 3초 후킹",
  "title":"쇼츠 제목",
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
    if (directionCount >= Math.ceil(rawScenes.length / 2)) {
      const repairResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.45,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `너는 숏폼 대본 교정 작가다. 입력 JSON의 스토리 순서와 사실은 유지하되 scenes를 교정한다.

반드시 지킬 규칙:
- narration은 성우가 그대로 읽는 자연스러운 한국어 대사다.
- narration에 장면·모습·화면·카메라·클로즈업·연출 같은 촬영 설명을 절대 쓰지 않는다.
- 시각적 행동과 촬영 설명은 visualPrompt로 옮긴다.
- caption은 narration의 의미를 짧게 압축한다.
- 모든 narration을 합치면 약 ${targetCharacters}자, ${targetSeconds}초 분량이 되게 한다.
- 제품명은 전체 narration의 70% 이후에 처음 말한다.
- 확인되지 않은 사실은 추가하지 않는다.

JSON만 출력:
{"script":"실제로 읽을 전체 대본","scenes":[{"narration":"실제로 읽을 대사","caption":"짧은 화면 자막","visualPrompt":"장면 설명","durationSec":5}]}`,
            },
            {
              role: "user",
              content: `상품명: ${productName}\n\n교정할 JSON:\n${JSON.stringify(parsed)}`,
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
    const scenes = rawScenes.slice(0, 10).map((scene: Record<string, unknown>, index: number) => ({
      id: `story_scene_${Date.now()}_${index + 1}`,
      order: index + 1,
      narration: String(scene.narration || "").trim(),
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
        title: String(parsed.title || "").trim(),
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
