import { NextRequest, NextResponse } from "next/server"

/**
 * 블로그 링크 분석 API
 * POST /api/moneytaker/analyze-blog-link
 * 
 * 요청 본문:
 * {
 *   url: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: "블로그 링크가 필요합니다." },
        { status: 400 }
      )
    }

    console.log("[MoneyTaker] 블로그 링크 분석 시작:", url)

    // OpenAI API를 활용하여 블로그 링크 내용 분석
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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"

    // 실제로는 블로그 링크에서 내용을 크롤링해야 하지만,
    // 여기서는 OpenAI API를 활용하여 링크 분석 프롬프트 생성
    // 실제 구현 시 Puppeteer나 Cheerio 등을 사용하여 HTML 크롤링 후 분석

    try {
      // 블로그 링크에서 내용 추출 (실제로는 크롤링 필요)
      // 여기서는 OpenAI API로 링크 분석 요청
      const analysisPrompt = `다음 블로그 링크를 분석해주세요: ${url}

블로그 링크의 내용을 분석하여 다음 정보를 추출해주세요:
1. 주요 키워드 (5~10개)
2. 글의 주요 내용 요약 (200자 이내)
3. 사용된 문체와 톤
4. SEO 최적화 요소

분석 결과를 JSON 형식으로 반환해주세요:
{
  "keywords": ["키워드1", "키워드2", ...],
  "summary": "주요 내용 요약",
  "tone": "문체 설명",
  "seoElements": ["SEO 요소1", "SEO 요소2", ...]
}`

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "당신은 블로그 콘텐츠 분석 전문가입니다. 블로그 글의 키워드, 내용, 문체를 정확하게 분석합니다.",
            },
            {
              role: "user",
              content: analysisPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      })

      if (!openaiResponse.ok) {
        throw new Error("OpenAI API 호출 실패")
      }

      const openaiData = await openaiResponse.json()
      const analysisText = openaiData.choices?.[0]?.message?.content || ""

      // JSON 파싱 시도
      let analysis: any = {}
      try {
        // JSON 코드 블록 제거
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          // JSON 형식이 아니면 텍스트에서 키워드 추출
          const keywords = analysisText.match(/키워드[:\s]*([^\n]+)/i)?.[1]?.split(/[,，]/).map(k => k.trim()) || []
          analysis = {
            keywords: keywords.length > 0 ? keywords : ["분석 실패"],
            summary: analysisText.substring(0, 200),
            tone: "분석 필요",
            seoElements: [],
          }
        }
      } catch (parseError) {
        // 파싱 실패 시 기본값
        analysis = {
          keywords: ["분석 실패"],
          summary: analysisText.substring(0, 200) || "블로그 링크 분석에 실패했습니다.",
          tone: "분석 필요",
          seoElements: [],
        }
      }

      console.log("[MoneyTaker] 블로그 링크 분석 완료")

      return NextResponse.json({
        success: true,
        analysis,
        url,
      })
    } catch (error) {
      console.error("[MoneyTaker] OpenAI 분석 실패:", error)
      // OpenAI 실패 시 기본 응답
      return NextResponse.json({
        success: true,
        analysis: {
          keywords: [],
          summary: "블로그 링크 분석에 실패했습니다. 링크를 확인해주세요.",
          tone: "분석 필요",
          seoElements: [],
        },
        url,
      })
    }
  } catch (error) {
    console.error("[MoneyTaker] 블로그 링크 분석 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "블로그 링크 분석에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}


