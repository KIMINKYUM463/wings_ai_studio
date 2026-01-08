import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

/**
 * 벤치마킹 썸네일 스타일 분석 API
 * POST /api/analyze-benchmark-thumbnail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, mimeType, openaiApiKey } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: "이미지 데이터가 필요합니다." },
        { status: 400 }
      )
    }

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다." },
        { status: 400 }
      )
    }

    const imageMimeType = mimeType || 'image/jpeg'
    const imageType = imageMimeType.split('/')[1] || 'jpeg'

    const analysisResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a thumbnail structure analyzer. Analyze ONLY the structural layout, typography positioning, and color scheme of this YouTube thumbnail image. 

⚠️ CRITICAL RULES:
- DO NOT describe what the image shows (people, objects, content, meaning)
- DO NOT interpret or explain the subject matter
- ONLY analyze the visual structure: text positions, colors, layout, typography
- Focus on measurable design elements that can be replicated

ANALYZE THESE STRUCTURAL ELEMENTS:

1. TEXT POSITION AND LAYOUT (Most Important)
   - Exact text position: top/center/bottom, left/center/right
   - Text alignment: center/left/right
   - Number of text lines and their vertical positions (percentage from top)
   - Text area coverage: what percentage of thumbnail does text occupy?
   - Text spacing: gaps between lines, margins around text
   - Text placement relative to image elements

2. TEXT VISUAL PROPERTIES
   - Text colors: exact colors used (white, yellow, red, etc.)
   - Text effects: shadows (color, direction, blur), outlines (color, width), background boxes (color, opacity)
   - Typography: font weight (bold/regular), estimated size (large/medium/small), font style (sans-serif/serif)
   - Text readability aids: semi-transparent boxes, blur effects, gradients

3. COLOR STRUCTURE
   - Primary color palette: dominant colors
   - Background colors: main background color
   - Accent colors: colors used for emphasis
   - Color distribution: where each color appears (top/bottom/left/right)
   - Overall color tone: bright/dark/warm/cool

4. LAYOUT COMPOSITION
   - Text-to-image ratio: how much space text vs image occupies
   - Visual element positions: where main elements are placed
   - Composition type: symmetrical/asymmetrical/balanced
   - Grid structure: if text follows any grid system

5. VISUAL STYLE STRUCTURE
   - Illustration style: cartoon/realistic/flat/etc.
   - Overall visual tone: energetic/calm/bold/subtle

Write the analysis in English, focusing ONLY on structural and design elements. Format:
"Text layout: [exact position and alignment]. Text properties: [colors, effects, typography]. Color scheme: [color palette and distribution]. Layout: [composition structure]. Style: [visual style]."

Example:
"Text layout: Two lines of text positioned at top center (15% from top), centered alignment, text occupies top 30% of thumbnail. Text properties: Bold white text (#FFFFFF) with black outline (2px), large font size, text shadow (black, offset 2px). Background: Semi-transparent dark box (rgba(0,0,0,0.6)) behind text. Color scheme: Bright yellow (#FFD700) and red (#FF0000) accents on dark blue background (#1a1a2e). Layout: Asymmetrical, text-heavy top section. Style: High contrast, energetic, professional YouTube thumbnail design."

Provide precise, measurable structural information only.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageMimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    })

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text()
      console.error("[Benchmark Thumbnail Analysis] OpenAI API 오류:", errorText)
      return NextResponse.json(
        { error: `썸네일 분석 실패: ${analysisResponse.status}` },
        { status: analysisResponse.status }
      )
    }

    const analysisData = await analysisResponse.json()
    const styleDescription = analysisData.choices?.[0]?.message?.content

    if (!styleDescription) {
      return NextResponse.json(
        { error: "썸네일 스타일 분석 결과를 받을 수 없습니다." },
        { status: 500 }
      )
    }

    // OpenAI 콘텐츠 정책 위반 감지
    if (styleDescription.toLowerCase().includes("i'm sorry") || 
        styleDescription.toLowerCase().includes("i can't assist") ||
        styleDescription.toLowerCase().includes("cannot assist") ||
        styleDescription.toLowerCase().includes("content policy")) {
      console.error("[Benchmark Thumbnail Analysis] OpenAI 콘텐츠 정책 위반 감지")
      return NextResponse.json(
        { 
          error: "OpenAI 콘텐츠 정책으로 인해 이 썸네일을 분석할 수 없습니다. 다른 썸네일을 사용해주세요.",
          contentPolicyViolation: true
        },
        { status: 403 }
      )
    }

    console.log("[Benchmark Thumbnail Analysis] 분석된 스타일:", styleDescription.substring(0, 100) + "...")
    return NextResponse.json({
      success: true,
      stylePrompt: styleDescription.trim()
    })
  } catch (error) {
    console.error("[Benchmark Thumbnail Analysis] 썸네일 분석 실패:", error)
    return NextResponse.json(
      {
        error: `썸네일 분석 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

