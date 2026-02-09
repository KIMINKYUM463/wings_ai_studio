import { NextRequest, NextResponse } from "next/server"

/**
 * 네이버 블로그 자동 업로드 API
 * POST /api/moneytaker/upload-to-naver
 * 
 * 요청 본문:
 * {
 *   title: string,
 *   content: string (HTML),
 *   category?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      content, 
      category = "일반",
      publishType = "immediate",
      scheduledDate,
      tags = [],
      visibility = "public"
    } = await request.json()

    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 내용이 필요합니다." },
        { status: 400 }
      )
    }

    // 네이버 블로그 API 키 (환경 변수 또는 설정에서 가져오기)
    // 실제 구현 시 OAuth 2.0 인증이 필요합니다
    const NAVER_CLIENT_ID = process.env.NAVER_BLOG_CLIENT_ID || ""
    const NAVER_CLIENT_SECRET = process.env.NAVER_BLOG_CLIENT_SECRET || ""
    const NAVER_ACCESS_TOKEN = process.env.NAVER_BLOG_ACCESS_TOKEN || ""

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: "네이버 블로그 API 설정이 필요합니다. 환경 변수에 NAVER_BLOG_CLIENT_ID와 NAVER_BLOG_CLIENT_SECRET을 설정해주세요.",
        },
        { status: 500 }
      )
    }

    console.log("[MoneyTaker] 네이버 블로그 업로드 시작:", title)

    // 네이버 블로그 API 호출
    // 참고: 네이버 블로그 API는 OAuth 2.0 인증이 필요하며, 실제 구현 시 토큰 갱신 로직이 필요합니다
    const blogApiUrl = "https://openapi.naver.com/blog/writePost.json"

    const requestBody: any = {
      title: title,
      contents: content,
      categoryNo: category,
      // 공개 설정
      open: visibility === "public" ? "Y" : visibility === "unlisted" ? "Y" : "N",
      // 태그
      tags: tags.length > 0 ? tags : undefined,
    }

    // 예약 발행 설정
    if (publishType === "scheduled" && scheduledDate) {
      requestBody.publishDate = scheduledDate
    }

    const response = await fetch(blogApiUrl, {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        "Authorization": `Bearer ${NAVER_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[MoneyTaker] 네이버 블로그 API 오류:", response.status, errorText)

      // OAuth 토큰이 필요한 경우
      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "네이버 블로그 인증이 필요합니다. OAuth 토큰을 설정해주세요.",
            requiresAuth: true,
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error: `네이버 블로그 업로드 실패: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log("[MoneyTaker] 네이버 블로그 업로드 성공:", data)

    return NextResponse.json({
      success: true,
      postUrl: data.postUrl || data.url || "업로드 완료",
      postId: data.postId || data.id,
      message: "네이버 블로그에 성공적으로 업로드되었습니다.",
    })
  } catch (error) {
    console.error("[MoneyTaker] 네이버 블로그 업로드 중 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "네이버 블로그 업로드에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}

