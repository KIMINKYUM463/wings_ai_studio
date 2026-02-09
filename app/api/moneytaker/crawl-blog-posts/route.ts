import { NextRequest, NextResponse } from "next/server"

/**
 * 네이버 블로그 상위 글 크롤링 API
 * POST /api/moneytaker/crawl-blog-posts
 * 
 * 요청 본문:
 * {
 *   keyword: string,
 *   count?: number (기본값: 3)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { keyword, count = 3 } = await request.json()

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "키워드가 필요합니다." },
        { status: 400 }
      )
    }

    // 네이버 검색 API 키 (환경 변수 또는 하드코딩)
    // 네이버 개발자 센터에서 발급받은 검색 API 키를 사용해야 합니다
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "6kB_OaGlrFRnTxS1gGVw"
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "RsRHEjRQXq"

    console.log("[MoneyTaker] 네이버 블로그 크롤링 시작:", keyword)

    // 네이버 블로그 검색 API 호출
    const searchUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=${count}&sort=sim`

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[MoneyTaker] 네이버 블로그 검색 API 오류:", response.status, errorText)
      return NextResponse.json(
        {
          error: `블로그 검색 실패: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // 네이버 블로그 검색 결과 파싱
    const posts = (data.items || []).map((item: any) => ({
      title: item.title?.replace(/<[^>]*>/g, "") || "",
      description: item.description?.replace(/<[^>]*>/g, "") || "",
      link: item.link || "",
      bloggername: item.bloggername || "",
      postdate: item.postdate || "",
    }))

    console.log("[MoneyTaker] 네이버 블로그 크롤링 완료:", posts.length, "개")

    // 키워드 추출 (형태소 분석 기반)
    const allText = posts
      .map((post) => `${post.title} ${post.description}`)
      .join(" ")

    // OpenAI API를 활용한 키워드 추출
    let extractedKeywords: string[] = []
    try {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "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"
      
      const keywordPrompt = `다음 블로그 글들의 제목과 설명을 분석하여 공통으로 나타나는 중요한 키워드(형태소)를 추출해주세요.

블로그 글들:
${posts.map((post, idx) => `${idx + 1}. 제목: ${post.title}\n   설명: ${post.description.substring(0, 200)}...`).join("\n\n")}

요구사항:
1. 목표 키워드 "${keyword}"와 관련된 중요한 형태소를 추출
2. 각 글에서 공통으로 나타나는 키워드 우선
3. 명사 위주로 추출 (2글자 이상)
4. 불필요한 조사, 어미 제외
5. 최대 20개까지 추출
6. 키워드는 한 줄에 하나씩, 번호 없이 나열

키워드만 추출하여 한 줄에 하나씩 작성해주세요.`

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
              content: "당신은 한국어 형태소 분석 전문가입니다. 블로그 글에서 중요한 키워드를 정확하게 추출합니다.",
            },
            {
              role: "user",
              content: keywordPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      })

      if (openaiResponse.ok) {
        const openaiData = await openaiResponse.json()
        const keywordsText = openaiData.choices?.[0]?.message?.content || ""
        
        // 키워드 추출 (한 줄에 하나씩)
        extractedKeywords = keywordsText
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => {
            // 번호 제거 (1., 2. 등)
            const cleaned = line.replace(/^\d+[\.\)]\s*/, "").trim()
            // 한글 2글자 이상, 불필요한 단어 제외
            return cleaned.length >= 2 && 
                   /[가-힣]/.test(cleaned) && 
                   !cleaned.match(/^(키워드|형태소|제목|설명|요구사항|분석|추출)/)
          })
          .map((line: string) => line.replace(/^\d+[\.\)]\s*/, "").trim())
          .filter((line: string) => line.length > 0)
          .slice(0, 20)
      }
    } catch (error) {
      console.error("[MoneyTaker] OpenAI 키워드 추출 실패:", error)
      // OpenAI 실패 시 기본 추출 방식 사용
      const words = allText.match(/[가-힣]{2,}/g) || []
      const wordCount: Record<string, number> = {}
      words.forEach((word: string) => {
        wordCount[word] = (wordCount[word] || 0) + 1
      })
      extractedKeywords = Object.entries(wordCount)
        .filter(([_, count]) => count >= 2)
        .sort(([_, a], [__, b]) => (b as number) - (a as number))
        .slice(0, 20)
        .map(([word]) => word)
    }

    console.log("[MoneyTaker] 추출된 키워드:", extractedKeywords.length, "개")

    return NextResponse.json({
      success: true,
      posts,
      keyword,
      commonKeywords: extractedKeywords,
    })
  } catch (error) {
    console.error("[MoneyTaker] 블로그 크롤링 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "블로그 크롤링에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}

