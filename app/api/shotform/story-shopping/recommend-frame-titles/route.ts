import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const productName = String(body.productName || "").trim()
    const script = String(body.script || "").trim()
    const apiKey =
      String(body.apiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY
    if (!productName || !script) {
      return NextResponse.json(
        { error: "상품과 스토리 대본이 필요합니다." },
        { status: 400 }
      )
    }
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 503 })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.88,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `너는 조회수를 높이는 한국어 썰 채널 제목 전문 작가다.

입력된 스토리를 바탕으로 서로 다른 후킹 방식의 제목 6개를 만든다.

규칙:
- 12~28자
- 제목만 봐도 결말이 궁금해야 한다.
- 제품명은 가능하면 숨기고 사건·갈등·반전부터 보여준다.
- 질문형, 경고형, 반전형, 숫자형, 고백형, 결과 선공개형을 각각 활용한다.
- 과장 광고 문구, 구매 유도, 느낌표 남발을 피한다.
- 대본에 없는 사실·수치·효능·인물을 만들지 않는다.
- 결말을 제목에서 전부 공개하지 않는다.
- "충격", "소름" 같은 단어를 반복하지 않고 자연스럽게 쓴다.

JSON만 출력:
{"titles":["제목1","제목2","제목3","제목4","제목5","제목6"]}`,
          },
          {
            role: "user",
            content: `상품: ${productName}\n스토리 유형: ${String(
              body.templateName || ""
            )}\n후킹: ${String(body.hook || "")}\n대본:\n${script.slice(0, 7000)}`,
          },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`제목 추천 실패 (${response.status}): ${detail.slice(0, 180)}`)
    }
    const data = await response.json()
    const parsed = JSON.parse(String(data.choices?.[0]?.message?.content || "{}"))
    const titles = Array.isArray(parsed.titles)
      ? Array.from(
          new Set(
            parsed.titles
              .map((title: unknown) => String(title || "").trim())
              .filter((title: string) => title.length >= 4)
          )
        ).slice(0, 6)
      : []
    if (!titles.length) throw new Error("추천 제목을 생성하지 못했습니다.")
    return NextResponse.json({ success: true, titles })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "제목 추천에 실패했습니다." },
      { status: 500 }
    )
  }
}
