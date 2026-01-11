import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const dynamic = 'force-dynamic'

/**
 * 벤치마킹 썸네일 스타일 분석 API
 * POST /api/analyze-benchmark-thumbnail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, mimeType, openaiApiKey, geminiApiKey } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: "이미지 데이터가 필요합니다." },
        { status: 400 }
      )
    }

    if (!openaiApiKey && !geminiApiKey) {
      return NextResponse.json(
        { error: "OpenAI 또는 Gemini API 키가 필요합니다." },
        { status: 400 }
      )
    }

    const imageMimeType = mimeType || 'image/jpeg'
    const imageType = imageMimeType.split('/')[1] || 'jpeg'

    // OpenAI로 먼저 시도
    let styleDescription = ""
    let useGeminiFallback = false

    if (openaiApiKey) {
      try {
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
                    text: `You are a professional thumbnail design analyzer. Analyze this YouTube thumbnail image comprehensively, focusing on ALL visual design elements that can be replicated.

⚠️ CRITICAL RULES:
- DO NOT describe what the image shows (people, objects, content, meaning)
- DO NOT interpret or explain the subject matter
- ONLY analyze visual design elements: structure, typography, colors, illustration style, composition
- Focus on measurable and replicable design elements

ANALYZE THESE ELEMENTS IN DETAIL:

1. TEXT POSITION AND LAYOUT (Most Important)
   - Exact text position: top/center/bottom, left/center/right (with percentages)
   - Text alignment: center/left/right
   - Number of text lines and their exact vertical positions
   - Text area coverage: what percentage of thumbnail does text occupy?
   - Text spacing: gaps between lines, margins around text
   - Text placement relative to image elements

2. TEXT VISUAL PROPERTIES
   - Text colors: exact colors used (white, yellow, red, etc.) with hex codes if possible
   - Text effects: shadows (color, direction, blur, offset), outlines (color, width), background boxes (color, opacity, blur)
   - Typography: font weight (bold/regular), estimated size (large/medium/small), font style (sans-serif/serif), font family characteristics
   - Text readability aids: semi-transparent boxes, blur effects, gradients, overlays

3. ILLUSTRATION AND ART STYLE (Very Important)
   - Illustration style: cartoon/realistic/flat/3D/vector/photorealistic/etc.
   - Art technique: digital painting/hand-drawn/vector art/photography/composite/etc.
   - Rendering style: cel-shaded/flat colors/gradient/smooth shading/etc.
   - Line art style: thick outlines/thin lines/no outlines/etc.
   - Visual effects: shadows, highlights, glows, filters, post-processing effects
   - Overall art direction: professional/amateur/sketchy/polished/etc.

4. COLOR STRUCTURE
   - Primary color palette: dominant colors with descriptions
   - Background colors: main background color and gradients
   - Accent colors: colors used for emphasis
   - Color distribution: where each color appears (top/bottom/left/right)
   - Overall color tone: bright/dark/warm/cool/saturated/desaturated
   - Color harmony: complementary/analogous/monochromatic/etc.

5. LAYOUT COMPOSITION
   - Text-to-image ratio: how much space text vs image occupies
   - Visual element positions: where main elements are placed
   - Composition type: symmetrical/asymmetrical/balanced/rule of thirds/etc.
   - Grid structure: if text follows any grid system
   - Focal points: where the eye is drawn to
   - Negative space usage

6. VISUAL STYLE AND MOOD
   - Overall visual tone: energetic/calm/bold/subtle/dramatic/etc.
   - Design aesthetic: modern/vintage/minimalist/busy/etc.
   - Visual hierarchy: how elements are prioritized
   - Professional quality level

Write a comprehensive analysis in English. Format:
"Text layout: [detailed position and alignment]. Text properties: [colors, effects, typography details]. Illustration style: [art style, technique, rendering]. Color scheme: [color palette and distribution]. Layout: [composition structure]. Visual style: [overall style and mood]."

Example:
"Text layout: Two lines of text positioned at top center (15% from top), centered alignment, text occupies top 30% of thumbnail, 10px gap between lines. Text properties: Bold white text (#FFFFFF) with black outline (2px width), large font size (estimated 60pt), sans-serif font, text shadow (black, offset 2px down, 3px blur). Background: Semi-transparent dark box (rgba(0,0,0,0.6)) behind text with 5px border radius. Illustration style: Digital cartoon illustration, flat 2D vector art style, cel-shaded rendering, thick black outlines (3px), vibrant solid colors, no gradients, professional digital art. Color scheme: Bright yellow (#FFD700) and red (#FF0000) accents on dark blue background (#1a1a2e), high saturation, warm color temperature. Layout: Asymmetrical composition, text-heavy top section (30%), main image in center (70%), rule of thirds applied. Visual style: High contrast, energetic, bold, professional YouTube thumbnail design, modern digital art aesthetic."

Provide extremely detailed and precise information about ALL visual design elements.`
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
          useGeminiFallback = true
        } else {
          const analysisData = await analysisResponse.json()
          styleDescription = analysisData.choices?.[0]?.message?.content || ""

          if (!styleDescription) {
            useGeminiFallback = true
          } else {
            // OpenAI 콘텐츠 정책 위반 감지
            if (styleDescription.toLowerCase().includes("i'm sorry") || 
                styleDescription.toLowerCase().includes("i can't assist") ||
                styleDescription.toLowerCase().includes("cannot assist") ||
                styleDescription.toLowerCase().includes("content policy")) {
              console.warn("[Benchmark Thumbnail Analysis] OpenAI 콘텐츠 정책 위반 감지 - Gemini로 fallback 시도")
              useGeminiFallback = true
            }
          }
        }
      } catch (openaiError) {
        console.error("[Benchmark Thumbnail Analysis] OpenAI 분석 실패:", openaiError)
        useGeminiFallback = true
      }
    } else {
      // OpenAI API 키가 없으면 바로 Gemini 사용
      useGeminiFallback = true
    }

    // Gemini fallback 시도
    if (useGeminiFallback) {
      if (!geminiApiKey) {
        return NextResponse.json(
          { 
            error: "OpenAI 콘텐츠 정책으로 인해 이 썸네일을 분석할 수 없습니다. Gemini API 키를 입력하면 대체 분석을 시도할 수 있습니다.",
            contentPolicyViolation: true
          },
          { status: 403 }
        )
      }

      try {
        console.log("[Benchmark Thumbnail Analysis] Gemini로 fallback 분석 시작")
        const genAI = new GoogleGenerativeAI(geminiApiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

        const geminiPrompt = `You are a professional thumbnail design analyzer. Analyze this YouTube thumbnail image comprehensively, focusing on ALL visual design elements that can be replicated.

⚠️ CRITICAL RULES:
- DO NOT describe what the image shows (people, objects, content, meaning)
- DO NOT interpret or explain the subject matter
- ONLY analyze visual design elements: structure, typography, colors, illustration style, composition
- Focus on measurable and replicable design elements

ANALYZE THESE ELEMENTS IN DETAIL:

1. TEXT POSITION AND LAYOUT (Most Important)
   - Exact text position: top/center/bottom, left/center/right (with percentages)
   - Text alignment: center/left/right
   - Number of text lines and their exact vertical positions
   - Text area coverage: what percentage of thumbnail does text occupy?
   - Text spacing: gaps between lines, margins around text
   - Text placement relative to image elements

2. TEXT VISUAL PROPERTIES
   - Text colors: exact colors used (white, yellow, red, etc.) with hex codes if possible
   - Text effects: shadows (color, direction, blur, offset), outlines (color, width), background boxes (color, opacity, blur)
   - Typography: font weight (bold/regular), estimated size (large/medium/small), font style (sans-serif/serif), font family characteristics
   - Text readability aids: semi-transparent boxes, blur effects, gradients, overlays

3. ILLUSTRATION AND ART STYLE (Very Important)
   - Illustration style: cartoon/realistic/flat/3D/vector/photorealistic/etc.
   - Art technique: digital painting/hand-drawn/vector art/photography/composite/etc.
   - Rendering style: cel-shaded/flat colors/gradient/smooth shading/etc.
   - Line art style: thick outlines/thin lines/no outlines/etc.
   - Visual effects: shadows, highlights, glows, filters, post-processing effects
   - Overall art direction: professional/amateur/sketchy/polished/etc.

4. COLOR STRUCTURE
   - Primary color palette: dominant colors with descriptions
   - Background colors: main background color and gradients
   - Accent colors: colors used for emphasis
   - Color distribution: where each color appears (top/bottom/left/right)
   - Overall color tone: bright/dark/warm/cool/saturated/desaturated
   - Color harmony: complementary/analogous/monochromatic/etc.

5. LAYOUT COMPOSITION
   - Text-to-image ratio: how much space text vs image occupies
   - Visual element positions: where main elements are placed
   - Composition type: symmetrical/asymmetrical/balanced/rule of thirds/etc.
   - Grid structure: if text follows any grid system
   - Focal points: where the eye is drawn to
   - Negative space usage

6. VISUAL STYLE AND MOOD
   - Overall visual tone: energetic/calm/bold/subtle/dramatic/etc.
   - Design aesthetic: modern/vintage/minimalist/busy/etc.
   - Visual hierarchy: how elements are prioritized
   - Professional quality level

Write a comprehensive analysis in English. Format:
"Text layout: [detailed position and alignment]. Text properties: [colors, effects, typography details]. Illustration style: [art style, technique, rendering]. Color scheme: [color palette and distribution]. Layout: [composition structure]. Visual style: [overall style and mood]."

Example:
"Text layout: Two lines of text positioned at top center (15% from top), centered alignment, text occupies top 30% of thumbnail, 10px gap between lines. Text properties: Bold white text (#FFFFFF) with black outline (2px width), large font size (estimated 60pt), sans-serif font, text shadow (black, offset 2px down, 3px blur). Background: Semi-transparent dark box (rgba(0,0,0,0.6)) behind text with 5px border radius. Illustration style: Digital cartoon illustration, flat 2D vector art style, cel-shaded rendering, thick black outlines (3px), vibrant solid colors, no gradients, professional digital art. Color scheme: Bright yellow (#FFD700) and red (#FF0000) accents on dark blue background (#1a1a2e), high saturation, warm color temperature. Layout: Asymmetrical composition, text-heavy top section (30%), main image in center (70%), rule of thirds applied. Visual style: High contrast, energetic, bold, professional YouTube thumbnail design, modern digital art aesthetic."

Provide extremely detailed and precise information about ALL visual design elements.`

        const imagePart = {
          inlineData: {
            data: imageBase64,
            mimeType: imageMimeType,
          },
        }

        const result = await model.generateContent([geminiPrompt, imagePart])
        const response = await result.response
        styleDescription = response.text().trim()

        if (!styleDescription) {
          return NextResponse.json(
            { error: "썸네일 스타일 분석 결과를 받을 수 없습니다." },
            { status: 500 }
          )
        }

        console.log("[Benchmark Thumbnail Analysis] Gemini 분석 성공:", styleDescription.substring(0, 100) + "...")
      } catch (geminiError) {
        console.error("[Benchmark Thumbnail Analysis] Gemini 분석 실패:", geminiError)
        return NextResponse.json(
          {
            error: `썸네일 분석 실패: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}`,
          },
          { status: 500 }
        )
      }
    }

    console.log("[Benchmark Thumbnail Analysis] 분석된 스타일:", styleDescription.substring(0, 100) + "...")
    
    // 한국어 번역 요청 (OpenAI 또는 Gemini 사용)
    let koreanTranslation = ""
    try {
      // OpenAI로 먼저 시도
      if (openaiApiKey && !useGeminiFallback) {
        try {
          const translationResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
                  content: `다음 영어 텍스트를 한국어로 자연스럽게 번역해주세요. 전문 용어는 그대로 유지하되, 일반적인 설명은 자연스러운 한국어로 번역해주세요:\n\n${styleDescription}`
                }
              ],
              max_tokens: 1500,
              temperature: 0.3,
            }),
          })
          
          if (translationResponse.ok) {
            const translationData = await translationResponse.json()
            koreanTranslation = translationData.choices?.[0]?.message?.content?.trim() || ""
          }
        } catch (openaiTranslationError) {
          console.warn("[Benchmark Thumbnail Analysis] OpenAI 번역 실패, Gemini로 시도:", openaiTranslationError)
        }
      }

      // Gemini로 번역 시도 (OpenAI 실패했거나 이미 Gemini를 사용한 경우)
      if (!koreanTranslation && geminiApiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
          
          const translationPrompt = `다음 영어 텍스트를 한국어로 자연스럽게 번역해주세요. 전문 용어는 그대로 유지하되, 일반적인 설명은 자연스러운 한국어로 번역해주세요:\n\n${styleDescription}`
          
          const result = await model.generateContent(translationPrompt)
          const response = await result.response
          koreanTranslation = response.text().trim()
        } catch (geminiTranslationError) {
          console.warn("[Benchmark Thumbnail Analysis] Gemini 번역 실패:", geminiTranslationError)
        }
      }
    } catch (translationError) {
      console.warn("[Benchmark Thumbnail Analysis] 한국어 번역 실패:", translationError)
      // 번역 실패해도 계속 진행
    }
    
    return NextResponse.json({
      success: true,
      stylePrompt: styleDescription.trim(),
      koreanTranslation: koreanTranslation || undefined
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

