"use server"

/**
 * 정교한 대본 생성 함수 (Gemini 2.0 Flash 사용)
 * 초안을 바탕으로 매우 정교하고 완성도 높은 최종 대본을 생성합니다.
 * Gemini API를 사용하여 gemini-2.5-flash 모델로 생성합니다.
 */
export async function generateRefinedScript(
  scriptPlan: string,
  topic: string,
  duration?: number,
  targetChars?: number,
  isStoryMode: boolean = false, // 스토리 형태 모드 (기본값: false = 교훈형)
  apiKey?: string
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  try {
    const durationText = duration ? `${duration}분` : "적절한 분량"
    const charsText = targetChars ? `${targetChars}자` : "적절한 분량"

    // 분량 규칙 프롬프트 생성
    let lengthRulePrompt = ""
    if (targetChars) {
      const minLength = targetChars - Math.floor(targetChars * 0.1)
      const maxLength = targetChars + Math.floor(targetChars * 0.1)
      lengthRulePrompt = `────────────────────────
[1) 분량 규칙: 대본 시간 선택에서 정한 글자수 (최우선 중요)]
────────────────────────
- 공백 포함 **정확히 ${charsText} 정도**로 작성하십시오. (목표: ${targetChars}자)
- 허용 범위: ${minLength}자 ~ ${maxLength}자 (목표 ±10%)
- ⚠️ 절대로 목표 글자수(${targetChars}자)를 크게 초과하지 마십시오. 최대 ${maxLength}자를 넘지 마세요.
- ⚠️ 목표 글자수에 맞추기 위해 기획안의 각 파트를 적절히 확장하되, 불필요하게 길게 쓰지 마십시오.
- 분량을 맞추기 위해 같은 말을 반복하지 마십시오.
- 기획안의 각 파트를 충분한 서사/예시/상황 묘사로 확장하되, 목표 글자수(${targetChars}자)를 초과하지 않도록 주의하십시오.
- 각 파트마다 '짧은 미니 장면' 2~3개를 포함하십시오.
- 대본을 완성한 후, 글자수를 확인하여 목표 글자수(${targetChars}자)에 맞는지 검토하십시오.`
    } else {
      lengthRulePrompt = `────────────────────────
[1) 분량 규칙: 대본 시간 선택에서 정한 글자 이상]
────────────────────────
- 공백 포함 최소 **${charsText} 이상** 작성하십시오. (무조건 글자 수 조건을 충족해주고 글자수를 줄이지 마십시오)
- 분량을 맞추기 위해 같은 말을 반복하지 마십시오.
- 기획안의 각 파트를 충분한 서사/예시/상황 묘사로 확장하십시오.
- 각 파트마다 '짧은 미니 장면' 2~3개를 포함하십시오.`
    }

    const systemPrompt = `당신은 '지식 스토리텔링 전문 유튜브 대본 작가'입니다.

입력으로 [대본 기획안]이 주어집니다.

당신은 이 기획안을 절대 변경하지 말고,
기획안의 흐름을 그대로 "TTS 전용 순수 내레이션 대본"으로 작성하십시오.

${lengthRulePrompt}

────────────────────────
[2) TTS 전용 출력 규칙]
────────────────────────
- 제목, 소제목, 번호, 목차, 불릿을 넣지 마십시오.
- [BGM], [자료화면], (쉼), (강조) 같은 지시문/괄호를 절대 쓰지 마십시오.
- 오직 내레이션 문장만 출력하십시오.

────────────────────────
[3) 문장 분리/장면화 친화 규칙 (매우 중요)]
────────────────────────
- 한 문장은 너무 길지 않게 작성하십시오.
- 쉼표로 길게 이어붙이지 말고 문장을 끊으십시오.
- 각 문장은 한 가지 장면이 떠오르도록 구체적으로 쓰십시오.
  (장소/사람/행동/소품 중 최소 2개 포함)
- 장면 전환이 있을 때는, 전환을 알 수 있게 단서를 넣으십시오.
  (예: "그날 밤", "몇 시간 뒤", "다음 날 새벽" 등)

────────────────────────
[4) 사실 기반 안전장치]
────────────────────────
- 확실하지 않은 수치/단정은 피하십시오.
- 필요 시 "기록에 따르면", "자료에 따라 차이가 있지만" 같은 표현을 사용하십시오.
- 허구 인물/드라마적 운명 교차/로맨스/과장된 배신극을 금지합니다.

────────────────────────
[5) CTA 처리 규칙]
────────────────────────
- 본문 끝에는 여운 질문 1개로 마무리하십시오.
- 그 다음 줄에 구독/좋아요/다음 영상 예고를 2~3문장으로 출력하십시오.
- "CTA:" 같은 레이블이나 제목은 사용하지 마십시오.

────────────────────────
[프롬프트 실행]
────────────────────────
[대본 기획안]:`

    const userPrompt = `${systemPrompt}\n\n${scriptPlan}`

    // Gemini API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: userPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 20000,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error("정교한 대본을 생성할 수 없습니다.")
    }

    // 대본이 잘렸는지 확인하고, 마지막 문장이 완전한지 검증
    content = content.trim()
    
    // 마지막 문장이 완전한 문장으로 끝나는지 확인
    const lastSentenceEnd = Math.max(
      content.lastIndexOf("."),
      content.lastIndexOf("?"),
      content.lastIndexOf("!"),
      content.lastIndexOf("。"),
      content.lastIndexOf("？"),
      content.lastIndexOf("！")
    )
    
    // 마지막 문장이 완전하지 않으면 (문장 부호로 끝나지 않으면) 잘린 것으로 간주
    if (lastSentenceEnd < content.length - 50) {
      // 마지막 50자 내에 문장 부호가 없으면 잘린 것으로 간주하고, 마지막 완전한 문장까지만 사용
      if (lastSentenceEnd > 0) {
        console.warn("[v0] ⚠️ 대본이 잘린 것으로 보입니다. 마지막 완전한 문장까지만 사용합니다.")
        content = content.substring(0, lastSentenceEnd + 1)
      } else {
        console.warn("[v0] ⚠️ 대본이 완전하지 않습니다. 마지막에 마침표를 추가합니다.")
        content = content + "."
      }
    }

    // 목표 글자수 확인 및 조정
    if (targetChars) {
      const currentLength = content.length
      const maxLength = targetChars + Math.floor(targetChars * 0.1) // 목표 + 10%
      const minLength = targetChars - Math.floor(targetChars * 0.1) // 목표 - 10%

      // 너무 길면 잘라내기 (마지막 완전한 문장까지만)
      if (currentLength > maxLength) {
        console.warn(`[v0] ⚠️ 대본이 목표 글자수(${targetChars}자)를 초과했습니다. (현재: ${currentLength}자)`)
        // 마지막 완전한 문장 위치 다시 계산
        const finalLastSentenceEnd = Math.max(
          content.lastIndexOf("."),
          content.lastIndexOf("?"),
          content.lastIndexOf("!"),
          content.lastIndexOf("。"),
          content.lastIndexOf("？"),
          content.lastIndexOf("！")
        )
        if (finalLastSentenceEnd > 0 && finalLastSentenceEnd < content.length) {
          const truncated = content.substring(0, finalLastSentenceEnd + 1)
          if (truncated.length >= minLength) {
            content = truncated
            console.log(`[v0] 대본을 ${content.length}자로 조정했습니다.`)
          }
        }
      }

      // 너무 짧으면 경고 (재생성은 하지 않고 경고만)
      if (currentLength < minLength) {
        console.warn(`[v0] ⚠️ 대본이 목표 글자수(${targetChars}자)보다 부족합니다. (현재: ${currentLength}자)`)
      }
    }

    return content
  } catch (error) {
    console.error("정교한 대본 생성 실패:", error)
    throw error
  }
}

/**
 * 대본을 장면 단위로 분해하는 함수
 * 대본 장면(씬) 분해 에디터
 */
export async function decomposeScriptIntoScenes(
  script: string,
  apiKey?: string
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  if (!script || script.trim().length === 0) {
    throw new Error("대본이 비어있습니다.")
  }

  try {
    const systemPrompt = `[YOUR ROLE]

당신은 '씬(Scene) 기반 장면 분해 에디터'이자
'시각적 일관성 관리자(Visual Consistency Controller)'입니다.

입력으로 들어온 하나의 씬 대본을
영상 연출 기준에 맞게 장면으로 분해합니다.

[CRITICAL: VISUAL CONSISTENCY RULES]

장면 분해의 최우선 기준은 문장 수가 아니라
'같은 화면으로 표현 가능한가'입니다.

다음 요소가 동일할 때만 같은 장면으로 묶을 수 있습니다:
1) 배경(장소, 공간, 환경)
2) 시대(과거/현대/고대 등)
3) 인물 구성(등장 인물 유무 및 동일성)
4) 시점(관찰, 회상, 설명, 현재 진행)

위 요소 중 하나라도 달라지면
반드시 새로운 장면으로 분리하세요.

[CRITICAL RULES]

1) 출력 언어는 반드시 한국어만 사용합니다.

2) 입력 대본 문장은 최대한 그대로 유지합니다.
   - 요약, 재작성, 문장 창작 금지

3) 장면 개수는 최소 1개, 최대 3개입니다.

4) 각 장면은 '하나의 대표 이미지'로 표현 가능한 단위여야 합니다.

5) 장면당 문장 수는 1~4문장 이내로 제한합니다.

6) 장면 설명, 해설, 분석 문구는 절대 추가하지 마세요.
   오직 대본 문장만 출력합니다.

[OUTPUT FORMAT]

씬 {scene_number}

[장면 1]

(해당 장면에 속하는 대본 문장들)

[장면 2]

(해당 시)

[장면 3]

(해당 시)`

    // 대본을 의미 단위(씬)로 나누기 (빈 줄 기준 또는 자연스러운 구분)
    const scenes = script.split(/\n\s*\n/).filter(s => s.trim().length > 0)
    
    if (scenes.length === 0) {
      // 빈 줄이 없으면 전체를 하나의 씬으로 처리
      scenes.push(script)
    }

    const allResults: string[] = []

    // 각 씬을 순차적으로 처리
    for (let i = 0; i < scenes.length; i++) {
      const sceneText = scenes[i].trim()
      const sceneNumber = i + 1

      const userPrompt = `다음은 씬 대본입니다. 길이에 맞게 장면을 최소 1개~최대 3개로 분해해 주세요.

한국어만 출력하세요.

씬 번호: ${sceneNumber}

씬 대본:

${sceneText}`

      // Gemini API 호출
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\n${userPrompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 20000, // 장면 분해 시 충분한 토큰 확보 (8000 -> 20000으로 증가)
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      // 응답 검증
      const candidate = data.candidates?.[0]
      if (!candidate) {
        throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 응답 후보가 없습니다.`)
      }

      // finishReason 확인 (응답이 잘렸는지 확인)
      const finishReason = candidate.finishReason
      if (finishReason === "MAX_TOKENS") {
        console.warn(`[장면 분해] 씬 ${sceneNumber} 응답이 토큰 제한으로 잘렸습니다. maxOutputTokens를 늘려야 할 수 있습니다.`)
      }

      const content = candidate.content?.parts?.[0]?.text

      if (!content) {
        throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 내용이 없습니다.`)
      }

      // 내용이 잘렸는지 확인 (마지막 문장이 완전한지)
      const trimmedContent = content.trim()
      const lastChar = trimmedContent[trimmedContent.length - 1]
      const isComplete = lastChar === "." || lastChar === "!" || lastChar === "?" || lastChar === "]" || trimmedContent.endsWith("장면 3]")
      
      if (!isComplete && finishReason === "MAX_TOKENS") {
        console.warn(`[장면 분해] 씬 ${sceneNumber} 응답이 불완전할 수 있습니다. 마지막 문자: "${lastChar}"`)
      }

      allResults.push(trimmedContent)
    }

    // 모든 씬의 결과를 합쳐서 반환
    return allResults.join("\n\n")
  } catch (error) {
    console.error("장면 분해 실패:", error)
    throw error
  }
}


