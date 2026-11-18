import { NextResponse, type NextRequest } from "next/server"
import { normalizeToneProfile } from "@/lib/mvp-tone-profile"

const MIN_CHARS = 40
const MAX_CHARS = 4000

const SYSTEM = `너는 한국어 숏폼 대본 분석가다. 사용자가 붙여 넣은 참고 대본에서 "말투와 전개 규칙"만 추출한다.
문장을 베끼는 게 목적이 아니다 — 다른 제품 대본에도 옮겨 쓸 수 있는 일반 규칙으로 요약한다.
JSON만 출력:
{
  "name": "프로필 이름 (10자 이내, 말투 특징)",
  "persona": "화자 설정 한 줄",
  "speechLevel": "해요체 / 반말 / 섞음 등",
  "energy": "텐션과 말 속도 한 줄",
  "sentenceRhythm": "문장 길이·끊는 방식 한 줄",
  "opener": "첫 문장으로 시선을 잡는 방식 (구체 문장 말고 방식)",
  "flow": ["전개 단계 3~5개"],
  "closer": "마무리·행동 유도 방식",
  "signatureExpressions": ["말버릇·어미 3~5개 (짧게)"],
  "avoid": ["이 말투에서 안 쓰는 것 2~4개"]
}`

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { openaiApiKey?: string; referenceScript?: string }
    const apiKey = body.openaiApiKey?.trim()
    const script = (body.referenceScript ?? "").trim().slice(0, MAX_CHARS)
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })
    }
    if (script.length < MIN_CHARS) {
      return NextResponse.json(
        { error: `참고 대본을 ${MIN_CHARS}자 이상 붙여 넣어 주세요.` },
        { status: 400 }
      )
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `참고 대본:\n"""\n${script}\n"""` },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `OpenAI 오류 (${res.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content
    const profile = normalizeToneProfile(content ? JSON.parse(content) : null)
    if (!profile) {
      return NextResponse.json({ error: "말투를 분석하지 못했습니다. 대본을 조금 더 길게 넣어 주세요." }, { status: 422 })
    }
    return NextResponse.json({ profile: { ...profile, id: `tone-${Date.now().toString(36)}`, createdAt: Date.now() } })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "말투 분석 실패" },
      { status: 500 }
    )
  }
}
