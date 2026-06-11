import { type NextRequest, NextResponse } from "next/server"

import { fetchProductPageMeta, runMvpXhsTest } from "@/lib/shotform-mvp-xhs-test"



export const maxDuration = 300



/** MVP 테스트 — 제품 URL → 중국어 키워드 → Apify 小红书 영상 검색 */

export async function POST(req: NextRequest) {

  try {

    const body = await req.json().catch(() => ({}))

    const url = typeof body.url === "string" ? body.url.trim() : ""

    const openaiApiKey =

      (typeof body.openaiApiKey === "string" && body.openaiApiKey.trim()) ||

      process.env.OPENAI_API_KEY ||

      ""

    const apifyToken =

      (typeof body.apifyApiKey === "string" && body.apifyApiKey.trim()) ||

      process.env.APIFY_TOKEN ||

      ""



    if (!url) return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 })

    if (!openaiApiKey) {

      return NextResponse.json({ error: "OpenAI API 키가 필요합니다." }, { status: 400 })

    }

    if (!apifyToken) {

      return NextResponse.json(

        {

          error:

            "소스 검색 토큰이 필요합니다. ShotForm 설정에 소스 검색 토큰을 저장하거나 서버 환경 변수를 설정하세요.",

        },

        { status: 400 }

      )

    }



    let urlObj: URL

    try {

      urlObj = new URL(url)

    } catch {

      return NextResponse.json({ error: "유효한 URL 형식이 아닙니다." }, { status: 400 })

    }

    if (!["http:", "https:"].includes(urlObj.protocol)) {

      return NextResponse.json({ error: "http(s) URL만 지원합니다." }, { status: 400 })

    }



    const pageMeta = await fetchProductPageMeta(url)



    const result = await runMvpXhsTest({

      url,

      pageTitle: pageMeta.title,

      pageDescription: pageMeta.description,

      openaiApiKey,

      apifyToken,

    })



    return NextResponse.json({

      input: { url, pageTitle: pageMeta.title, pageDescription: pageMeta.description.slice(0, 300) },

      extraction: result.extraction,

      chineseKeywords: result.extraction.chineseKeywords,

      xhsSearchQueries: result.extraction.xhsSearchQueries,

      similarVideos: result.similarVideos,

      signals: {

        apifyHttpCalls: result.apifyHttpCalls,

        apifyActor: result.apifyActor,

        keywordsUsed: result.keywordsUsed,

      },

      notice: result.notice,

    })

  } catch (e) {

    console.error("[mvp-test]", e)

    return NextResponse.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 })

  }

}

