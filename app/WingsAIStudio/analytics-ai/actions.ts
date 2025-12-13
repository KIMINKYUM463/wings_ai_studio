"use server"

async function fileToBase64(file: File): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  return buffer.toString("base64")
}

export async function analyzeShortMetrics(script: string, metricsImage: File, thumbnail: File) {
  try {
    console.log("[v0] Starting short metrics analysis...")

    const metricsBase64 = await fileToBase64(metricsImage)
    const thumbnailBase64 = await fileToBase64(thumbnail)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `당신은 유튜브 쇼츠 전문 분석가입니다. 
            
업로드된 지표 이미지에서 다음 정보를 추출하고 분석해주세요:
1. 시청자 참여도 (%) - 좋아요, 댓글, 공유 등의 상호작용 비율
2. 시청지속시간 (%) - 영상을 끝까지 본 비율

분석 규칙:
- 시청자 참여도가 60% 미만이면 썸네일 문제로 진단
  → 클릭을 유도하는 썸네일 문구 10개를 추천해주세요 (숫자, 충격적인 문구, 호기심 유발 등)
  → 예: "99%가 모르는", "3초만에 해결", "충격! 이것만 알면" 등
  
- 시청지속시간이 100% 미만이면 대본 문제로 진단
  → 대본을 분석하고 문제점을 지적해주세요
  → 앞으로 피해야 할 대본 스타일을 구체적으로 제시해주세요
  → 예: "도입부가 너무 길다", "핵심 내용이 늦게 나온다", "반복이 많다" 등

**중요: 응답은 반드시 순수 JSON 형식으로만 작성하고, 다른 텍스트는 포함하지 마세요.**

JSON 형식:
{
  "engagement": 숫자,
  "retention": 숫자,
  "engagementAnalysis": "참여도 분석 내용",
  "retentionAnalysis": "시청지속시간 분석 내용",
  "thumbnailSuggestions": ["문구1", "문구2", ...],
  "scriptIssues": "대본 문제점 및 피해야 할 스타일",
  "suggestions": "전체 개선 방안"
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `대본:\n${script}\n\n위 대본과 아래 지표 이미지, 썸네일을 분석해주세요.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${metricsImage.type};base64,${metricsBase64}`,
                },
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${thumbnail.type};base64,${thumbnailBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    console.log("[v0] AI Response:", content)

    let result
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error("[v0] No JSON found in response")
        throw new Error("No JSON found in AI response")
      }
      result = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error("[v0] JSON parse error:", parseError)
      throw new Error("Failed to parse AI response")
    }

    return {
      engagement: typeof result.engagement === "number" ? result.engagement : 0,
      retention: typeof result.retention === "number" ? result.retention : 0,
      engagementAnalysis: result.engagementAnalysis || "참여도 분석 결과를 가져올 수 없습니다.",
      retentionAnalysis: result.retentionAnalysis || "시청지속시간 분석 결과를 가져올 수 없습니다.",
      thumbnailSuggestions: Array.isArray(result.thumbnailSuggestions) ? result.thumbnailSuggestions : [],
      scriptIssues: result.scriptIssues || "",
      suggestions: result.suggestions || "개선 방안을 생성할 수 없습니다.",
    }
  } catch (error) {
    console.error("[v0] Analysis error:", error)
    throw new Error(`분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
  }
}

export async function analyzeLongMetrics(script: string, metricsImage: File, thumbnail: File) {
  try {
    console.log("[v0] Starting long metrics analysis...")

    const metricsBase64 = await fileToBase64(metricsImage)
    const thumbnailBase64 = await fileToBase64(thumbnail)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `당신은 유튜브 롱폼 전문 분석가입니다. 
            
업로드된 지표 이미지에서 시청지속시간(%)을 추출하고, 썸네일과 대본을 종합적으로 분석해주세요.

분석 규칙:

1. **시청지속시간 분석**:
   - 30% 미만: 앞부분 1분 30초의 후킹 실패로 진단
     → 대본의 첫 10초: 충격적인 시작인가? 호기심을 유발하는가?
     → 1분 30초까지: 핵심 내용이 나오는가? 지루하지 않은가?
     → 구체적인 후킹 개선 방안 제시
     → 앞으로 피해야 할 대본 스타일 제시
   - 30% 이상: 긍정적 평가 및 유지 방안 제시

2. **썸네일 분석**:
   - 썸네일 이미지에서 기존 문구를 추출하고 길이를 파악
   - 썸네일의 시각적 요소 평가 (색상, 구도, 가독성 등)
   - 클릭률을 높일 수 있는 개선 방안 제시
   - 기존 문구와 비슷한 길이의 후킹 문구 5개 추천
     → 숫자 활용 (예: "3가지 방법", "99%가 모르는")
     → 호기심 유발 (예: "이것만 알면", "충격! 진실은")
     → 긴급성 강조 (예: "지금 바로", "놓치면 후회")

**중요: 응답은 반드시 순수 JSON 형식으로만 작성하고, 다른 텍스트는 포함하지 마세요.**

JSON 형식:
{
  "retention": 숫자,
  "retentionAnalysis": "시청지속시간 분석 내용",
  "hookingAnalysis": "후킹 분석 내용 (30% 미만일 때)",
  "scriptIssues": "대본 문제점 및 피해야 할 스타일 (30% 미만일 때)",
  "thumbnailFeedback": "썸네일 분석 및 개선 방안",
  "thumbnailSuggestions": ["문구1", "문구2", "문구3", "문구4", "문구5"],
  "suggestions": "전체 개선 방안"
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `대본:\n${script}\n\n위 대본과 아래 지표 이미지, 썸네일을 종합적으로 분석해주세요.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${metricsImage.type};base64,${metricsBase64}`,
                },
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${thumbnail.type};base64,${thumbnailBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API error:", errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    console.log("[v0] AI Response:", content)

    let result
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error("[v0] No JSON found in response")
        throw new Error("No JSON found in AI response")
      }
      result = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error("[v0] JSON parse error:", parseError)
      throw new Error("Failed to parse AI response")
    }

    return {
      retention: typeof result.retention === "number" ? result.retention : 0,
      retentionAnalysis: result.retentionAnalysis || "시청지속시간 분석 결과를 가져올 수 없습니다.",
      hookingAnalysis: result.hookingAnalysis || "",
      scriptIssues: result.scriptIssues || "",
      thumbnailFeedback: result.thumbnailFeedback || "썸네일 분석 결과를 가져올 수 없습니다.",
      thumbnailSuggestions: Array.isArray(result.thumbnailSuggestions) ? result.thumbnailSuggestions : [],
      suggestions: result.suggestions || "개선 방안을 생성할 수 없습니다.",
    }
  } catch (error) {
    console.error("[v0] Analysis error:", error)
    throw new Error(`분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
  }
}
