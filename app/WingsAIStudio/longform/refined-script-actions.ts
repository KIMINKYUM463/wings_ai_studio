"use server"

/**
 * 정교한 대본 생성 함수 (Gemini 2.5 Pro 사용)
 * 초안을 바탕으로 매우 정교하고 완성도 높은 최종 대본을 생성합니다.
 * Gemini API를 사용하여 gemini-2.5-pro 모델로 생성합니다.
 */
export async function generateRefinedScript(
  scriptPlan: string,
  topic: string,
  duration?: number,
  targetChars?: number,
  isStoryMode: boolean = false, // 스토리 형태 모드 (기본값: false = 교훈형)
  apiKey?: string
): Promise<string> {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  // 재시도 함수
  const tryGenerate = async (geminiKey: string, isRetry: boolean = false): Promise<string> => {
    try {
    const durationText = duration ? `${duration}분` : "적절한 분량"
    const charsText = targetChars ? `${targetChars}자` : "적절한 분량"

    // 분량 규칙 프롬프트 생성
    let lengthRulePrompt = ""
    if (targetChars) {
      const minLength = targetChars - Math.floor(targetChars * 0.1)
      const maxLength = targetChars + Math.floor(targetChars * 0.1)
      lengthRulePrompt = `────────────────────────
[1) 분량 규칙: 대본 시간 선택에서 정한 글자수 (최우선 중요 - 절대 준수 필수)]
────────────────────────
⚠️⚠️⚠️ 절대적 필수 조건: 공백 포함 **반드시 ${targetChars}자 이상** 작성하십시오. ⚠️⚠️⚠️

- 목표 글자수: **${targetChars}자** (절대 이보다 적게 쓰지 마세요)
- 최소 글자수: **${minLength}자** (이보다 적으면 실패입니다)
- 최대 글자수: **${maxLength}자** (이를 초과하지 마세요)
- 허용 범위: ${minLength}자 ~ ${maxLength}자 (목표 ±10%)

⚠️ 중요: 목표 글자수(${targetChars}자)에 도달하지 못하면 대본이 사용 불가능합니다.
⚠️ 중요: 각 문장을 충분히 길게 작성하고, 예시와 설명을 풍부하게 추가하세요.
⚠️ 중요: 기획안의 각 파트를 최소 2~3배로 확장하여 충분한 분량을 확보하세요.
⚠️ 중요: 같은 내용을 다른 표현으로 반복하여 분량을 채우는 것도 허용됩니다.

- 각 파트마다 '상세한 미니 장면' 3~5개를 포함하십시오.
- 각 장면은 최소 100자 이상으로 상세히 묘사하십시오.
- 예시, 비유, 배경 설명, 인물 심리 등을 풍부하게 추가하십시오.
- 대본을 완성한 후, 반드시 글자수를 확인하여 최소 ${minLength}자 이상인지 검증하십시오.`
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
[3-1) 문장 종결 표현 다양화 (매우 중요)]
────────────────────────
- 모든 문장이 "~니다"로 끝나지 않도록 다양한 종결 표현을 사용하십시오.
- 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주십시오.
- 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊으십시오.
- 문장 종결 표현 예시: "~니다", "~네요", "~거든요", "~죠", "~거죠", "~는데", "~했고", "~면서", "~겁니다", "~어요", "~아요" 등을 다양하게 사용하십시오.

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

    const userPrompt = `${systemPrompt}\n\n[대본 기획안]:\n${scriptPlan}`

    // 5분, 10분은 한 번에 생성, 20분 이상은 기본 대본 + 클라이맥스로 분할 생성
    const shouldSplit = duration && duration >= 20
    
    let content: string
    
    if (!shouldSplit) {
      // 5분, 10분: 한 번에 생성
      console.log(`[v0] 대본 통합 생성 시작 (${duration}분, 목표: ${targetChars}자)`)
      
      const fullResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
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
              maxOutputTokens: targetChars ? Math.min(32768, Math.max(8192, Math.ceil(targetChars * 2.5))) : 16384,
            },
          }),
        }
      )

      if (!fullResponse.ok) {
        const errorText = await fullResponse.text()
        throw new Error(`대본 생성 실패: ${fullResponse.status} - ${errorText}`)
      }

      const fullData = await fullResponse.json()
      content = fullData.candidates?.[0]?.content?.parts?.[0]?.text

      if (!content) {
        throw new Error("대본을 생성할 수 없습니다.")
      }
      
      content = content.trim()
      console.log(`[v0] 대본 통합 생성 완료: ${content.length}자 (목표: ${targetChars}자)`)
    } else {
      // 20분 이상: 기본 대본(70%)과 클라이맥스(30%)로 나눠서 생성
      const baseTargetChars = targetChars ? Math.floor(targetChars * 0.7) : null // 기본 대본 목표 글자수 (70%)
      const climaxTargetChars = targetChars ? Math.floor(targetChars * 0.3) : null // 클라이맥스 목표 글자수 (30%)
      
      console.log(`[v0] 대본 분할 생성 시작 - 기본: ${baseTargetChars}자, 클라이맥스: ${climaxTargetChars}자`)
      
      // 1단계: 기본 대본 생성 (전반부)
      const baseSystemPrompt = `${systemPrompt}

────────────────────────
[6) 기본 대본 작성 규칙]
────────────────────────
- 이 부분은 대본의 전반부입니다 (약 70% 분량).
- 기획안의 앞부분 내용을 상세하게 작성하세요.
- 클라이맥스나 결론은 포함하지 마세요.
- 자연스러운 흐름으로 작성하되, 마지막 문장은 다음 부분으로 이어질 수 있도록 작성하세요.`

      const baseUserPrompt = `${baseSystemPrompt}\n\n[대본 기획안]:\n${scriptPlan}`
      
      console.log(`[v0] 기본 대본 생성 시작 (목표: ${baseTargetChars}자)`)
      
      const baseResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
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
                    text: baseUserPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: baseTargetChars ? Math.min(32768, Math.max(8192, Math.ceil(baseTargetChars * 2.5))) : 16384,
            },
          }),
        }
      )

      if (!baseResponse.ok) {
        const errorText = await baseResponse.text()
        throw new Error(`기본 대본 생성 실패: ${baseResponse.status} - ${errorText}`)
      }

      const baseData = await baseResponse.json()
      let baseContent = baseData.candidates?.[0]?.content?.parts?.[0]?.text

      if (!baseContent) {
        throw new Error("기본 대본을 생성할 수 없습니다.")
      }
      
      baseContent = baseContent.trim()
      console.log(`[v0] 기본 대본 생성 완료: ${baseContent.length}자 (목표: ${baseTargetChars}자)`)
      
      // 2단계: 클라이맥스 생성 (후반부)
      const climaxSystemPrompt = `${systemPrompt}

────────────────────────
[6) 클라이맥스 대본 작성 규칙]
────────────────────────
- 이 부분은 대본의 후반부이자 클라이맥스입니다 (약 30% 분량).
- 기획안의 뒷부분 내용을 상세하게 작성하세요.
- 전반부 대본의 내용을 자연스럽게 이어받아 작성하세요.
- 클라이맥스, 결론, 여운 질문, CTA를 포함하여 작성하세요.
- 전반부 대본의 마지막 문장 이후에 자연스럽게 이어지는 내용을 작성하세요.`

      const climaxUserPrompt = `${climaxSystemPrompt}

[전반부 대본 (참고용 - 이어서 작성하세요)]:
${baseContent}

[대본 기획안]:
${scriptPlan}

위 전반부 대본의 마지막 문장 이후에 자연스럽게 이어지는 클라이맥스 부분을 작성하세요.`
      
      console.log(`[v0] 클라이맥스 생성 시작 (목표: ${climaxTargetChars}자)`)
      
      const climaxResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
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
                    text: climaxUserPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 1,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: climaxTargetChars ? Math.min(32768, Math.max(8192, Math.ceil(climaxTargetChars * 2.5))) : 16384,
            },
          }),
        }
      )

      if (!climaxResponse.ok) {
        const errorText = await climaxResponse.text()
        throw new Error(`클라이맥스 생성 실패: ${climaxResponse.status} - ${errorText}`)
      }

      const climaxData = await climaxResponse.json()
      let climaxContent = climaxData.candidates?.[0]?.content?.parts?.[0]?.text

      if (!climaxContent) {
        throw new Error("클라이맥스를 생성할 수 없습니다.")
      }
      
      climaxContent = climaxContent.trim()
      console.log(`[v0] 클라이맥스 생성 완료: ${climaxContent.length}자 (목표: ${climaxTargetChars}자)`)
      
      // 3단계: 기본 대본과 클라이맥스를 자연스럽게 합치기
      const lastChar = baseContent.trim().slice(-1)
      const needsSpace = !['.', '?', '!', '。', '？', '！'].includes(lastChar)
      
      // 자연스러운 연결을 위해 공백 추가 (필요한 경우)
      if (needsSpace && !climaxContent.startsWith(' ')) {
        climaxContent = ' ' + climaxContent
      }
      
      content = baseContent + climaxContent
      console.log(`[v0] 대본 합치기 완료: 총 ${content.length}자 (기본: ${baseContent.length}자, 클라이맥스: ${climaxContent.length}자)`)
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
      let currentLength = content.length
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

      // 너무 짧으면 클라이맥스 부분만 확장 시도 (기존 대본 유지)
      if (currentLength < minLength) {
        console.warn(`[v0] ⚠️ 대본이 목표 글자수(${targetChars}자)보다 부족합니다. (현재: ${currentLength}자)`)
        console.warn(`[v0] ⚠️ 최소 글자수(${minLength}자)에 도달하지 못했습니다. 클라이맥스 부분을 확장합니다.`)
        
        const shortage = minLength - currentLength // 부족한 글자수
        const additionalTarget = Math.ceil(shortage * 1.2) // 여유있게 20% 더 생성
        
        // 클라이맥스 확장 시도 (최대 2회)
        for (let retry = 0; retry < 2; retry++) {
          try {
            console.log(`[v0] 클라이맥스 확장 시도 ${retry + 1}/2 (부족: ${shortage}자, 목표 추가: ${additionalTarget}자)`)
            
            // 기존 대본을 유지하고 클라이맥스 부분만 확장하는 프롬프트
            const additionalPrompt = `다음은 이미 생성된 대본입니다. 이 대본의 기본 부분(전반부)은 절대 변경하지 말고, 클라이맥스 부분(후반부)만 자연스럽게 확장하여 추가 내용을 작성해주세요.

⚠️⚠️⚠️ 매우 중요한 지시사항 ⚠️⚠️⚠️
- 기존 대본의 전반부 내용을 절대 변경하거나 수정하지 마세요.
- 클라이맥스 부분(후반부)만 확장하여 추가 내용을 작성하세요.
- 기존 클라이맥스의 마지막 문장 이후에 자연스럽게 이어지는 내용을 작성하세요.
- 반드시 ${additionalTarget}자 이상의 추가 내용을 작성하세요.
- 기존 대본의 주제와 톤을 유지하면서 클라이맥스를 더 풍부하게 확장하세요.
- 예시, 사례, 설명을 풍부하게 추가하여 분량을 채우세요.
- 괄호나 대괄호를 사용하지 마세요.
- "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론" 같은 구조적 단어를 절대 사용하지 마세요.
- 오로지 대본 내용만 작성하세요.

[기존 대본]:
${content}

[추가 작성할 내용]:
(위 대본의 클라이맥스 부분 마지막 문장 이후에 자연스럽게 이어지는 내용을 ${additionalTarget}자 이상 작성하세요)`
            
            const retryResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
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
                          text: additionalPrompt,
                        },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 1.0,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: Math.min(8192, Math.ceil(additionalTarget * 2.5)), // 추가 분량에 맞춰 토큰 할당
                  },
                }),
              }
            )
            
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text()
              console.error(`[v0] 추가 생성 API 호출 실패: ${retryResponse.status} - ${errorText}`)
              break
            }
            
            const retryData = await retryResponse.json()
            let additionalContent = retryData.candidates?.[0]?.content?.parts?.[0]?.text
            
            if (!additionalContent) {
              console.error(`[v0] 추가 생성 결과가 비어있습니다.`)
              break
            }
            
            additionalContent = additionalContent.trim()
            
            // 추가 내용이 기존 대본과 자연스럽게 이어지도록 처리
            // 기존 대본의 마지막 문장 부호 확인
            const lastChar = content.trim().slice(-1)
            const needsSpace = !['.', '?', '!', '。', '？', '！'].includes(lastChar)
            
            // 추가 내용 앞에 공백 추가 (필요한 경우)
            if (needsSpace && !additionalContent.startsWith(' ')) {
              additionalContent = ' ' + additionalContent
            }
            
            // 기존 대본에 추가 내용을 이어붙임
            const combinedContent = content + additionalContent
            const combinedLength = combinedContent.length
            
            console.log(`[v0] 추가 생성 결과: ${additionalContent.length}자 추가됨 (기존: ${currentLength}자, 합계: ${combinedLength}자)`)
            
            // 합친 결과가 더 좋으면 사용
            if (combinedLength >= minLength || combinedLength > currentLength) {
              content = combinedContent
              currentLength = combinedLength
              console.log(`[v0] ✅ 추가 생성 성공: ${currentLength}자 (목표 달성: ${currentLength >= minLength ? "예" : "아니오"})`)
              if (currentLength >= minLength) {
                break // 목표 달성했으면 중단
              }
            } else {
              console.warn(`[v0] 추가 생성 결과가 기대보다 적습니다. (합계: ${combinedLength}자 < 기존: ${currentLength}자)`)
            }
          } catch (retryError) {
            console.error(`[v0] 추가 생성 중 오류 발생:`, retryError)
            break
          }
        }
        
        // 최종 검증
        if (currentLength < minLength) {
          console.error(`[v0] ❌ 최종 대본이 최소 글자수(${minLength}자)에 도달하지 못했습니다. (현재: ${currentLength}자)`)
          console.error(`[v0] ❌ 목표 글자수: ${targetChars}자, 현재: ${currentLength}자, 부족: ${minLength - currentLength}자`)
        } else {
          console.log(`[v0] ✅ 최종 대본 완성: ${currentLength}자 (목표: ${targetChars}자, 최소: ${minLength}자)`)
        }
      }
    }

    return content
    } catch (error) {
      console.error(`[v0] 정교한 대본 생성 실패 (재시도: ${isRetry ? "예" : "아니오"}):`, error)
      throw error
    }
  }

  // 내부 API 키로 생성 시도
  return await tryGenerate(GEMINI_API_KEY, false)
}

/**
 * 단일 씬을 장면으로 분해하는 함수
 * @param sceneText - 씬 텍스트
 * @param sceneNumber - 씬 번호
 * @param apiKey - API 키 (사용되지 않음, 내부 키 사용)
 * @returns 분해된 장면 텍스트
 */
export async function decomposeSingleScene(
  sceneText: string,
  sceneNumber: number,
  apiKey?: string,
  maxScenes: 1 | 2 | 3 = 3
): Promise<string> {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  const trimmedSceneText = sceneText.trim()

  // 씬이 너무 짧으면 기본 형식으로 반환
  if (trimmedSceneText.length < 10) {
    console.warn(`[장면 분해] 씬 ${sceneNumber}이 너무 짧아 기본 형식으로 반환합니다.`)
    return `씬 ${sceneNumber}\n\n[장면 1]\n\n${trimmedSceneText}`
  }

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

3) 장면 개수는 최소 1개, 최대 ${maxScenes}개입니다.

4) 각 장면은 '하나의 대표 이미지'로 표현 가능한 단위여야 합니다.

5) 장면당 문장 수는 1~4문장 이내로 제한합니다.

6) 장면 설명, 해설, 분석 문구는 절대 추가하지 마세요.
   오직 대본 문장만 출력합니다.

7) ⚠️ 매우 중요: 내부 추론 과정, 생각 과정, 판단 과정을 절대 출력하지 마세요.
   - "follow the", "Wait", "I'll", "Let's go", "Actually", "So", "Is there" 같은 영어 추론 문구 금지
   - "4-sentence rule", "2-scene rule" 같은 내부 규칙 언급 금지
   - "씬 {scene_number}" 또는 "[장면 1]" 형식만 출력하세요.
   - 추론 과정 없이 바로 최종 결과만 출력하세요.

[OUTPUT FORMAT]

씬 {scene_number}

[장면 1]

(해당 장면에 속하는 대본 문장들)

${maxScenes >= 2 ? '[장면 2]\n\n(해당 시)\n\n' : ''}${maxScenes >= 3 ? '[장면 3]\n\n(해당 시)' : ''}`

  const userPrompt = `다음은 씬 대본입니다. 길이에 맞게 장면을 최소 1개~최대 ${maxScenes}개로 분해해 주세요.

한국어만 출력하세요.

씬 번호: ${sceneNumber}

씬 대본:

${trimmedSceneText}`

  let response: Response | undefined
  let lastError: Error | undefined
  const maxRetries = 3

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      console.log(`[장면 분해] 씬 ${sceneNumber} 시도 ${retry + 1}/${maxRetries}`)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000) // 3분 타임아웃

      const requestBody = {
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
          temperature: 0.3, // 낮춰서 더 결정적인 출력 (내부 추론 과정 방지)
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }

      const startTime = Date.now()
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }
        )
        clearTimeout(timeoutId)
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`씬 ${sceneNumber} 처리 타임아웃 (3분 초과)`)
        }
        throw fetchError
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]

      if (!candidate) {
        throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 응답 후보가 없습니다.`)
      }

      const content = candidate.content?.parts?.[0]?.text

      if (!content || content.trim().length === 0) {
        throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 내용이 없습니다.`)
      }

      let trimmedContent = content.trim()

      // 내부 추론 과정 제거 (영어 추론 문구가 포함된 경우)
      // "씬 {scene_number}" 또는 "[장면 1]" 형식이 나오기 전의 모든 내용 제거
      const sceneStartPattern = /(씬\s+\d+|\[장면\s+\d+\])/
      const sceneStartMatch = trimmedContent.search(sceneStartPattern)
      
      if (sceneStartMatch > 0) {
        // "씬 N" 또는 "[장면 1]" 이전의 내용이 있으면 제거 (내부 추론 과정으로 간주)
        console.log(`[장면 분해] 씬 ${sceneNumber} 내부 추론 과정 제거 (${sceneStartMatch}자 제거)`)
        trimmedContent = trimmedContent.substring(sceneStartMatch)
      }
      
      // 영어 추론 문구가 포함된 줄 제거
      const lines = trimmedContent.split('\n')
      const filteredLines: string[] = []
      let foundSceneStart = false
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // "씬 N" 또는 "[장면 1]" 형식이 나오면 그 이후부터 유효한 내용으로 간주
        if (trimmedLine.match(/^(씬\s+\d+|\[장면\s+\d+\])/)) {
          foundSceneStart = true
        }
        
        // 씬 시작 전에는 영어 추론 문구가 포함된 줄 제거
        if (!foundSceneStart) {
          const hasEnglishReasoning = /(follow|wait|i'll|let's|actually|so|is there|what if|i'll stick|ready|one more|looking at)/i.test(trimmedLine)
          if (hasEnglishReasoning) {
            console.log(`[장면 분해] 씬 ${sceneNumber} 추론 문구 제거: ${trimmedLine.substring(0, 50)}...`)
            continue
          }
        }
        
        filteredLines.push(line)
      }
      
      trimmedContent = filteredLines.join('\n').trim()

      // 최소한 "씬 N" 또는 "[장면 1]" 같은 패턴이 있는지 확인
      const hasValidFormat = trimmedContent.match(/씬\s+\d+|\[장면\s+\d+\]/)

      if (!hasValidFormat) {
        throw new Error(`씬 ${sceneNumber} 장면 분해 결과 형식이 올바르지 않습니다.`)
      }

      console.log(`[장면 분해] 씬 ${sceneNumber} 처리 완료`)
      return trimmedContent

    } catch (fetchError: any) {
      lastError = fetchError
      console.error(`[장면 분해] 씬 ${sceneNumber} 오류 발생:`, {
        name: fetchError.name,
        message: fetchError.message,
      })

      if (retry < maxRetries - 1) {
        const waitTime = 2000 * (retry + 1)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  // 모든 재시도 실패 시 원본 씬을 그대로 사용
  console.warn(`[장면 분해] 씬 ${sceneNumber} 최종 실패, 원본 사용:`, lastError)
  return `씬 ${sceneNumber}\n\n[장면 1]\n\n${trimmedSceneText}`
}

/**
 * 대본을 장면 단위로 분해하는 함수
 * 대본 장면(씬) 분해 에디터
 * @deprecated 이 함수는 모든 씬을 한 번에 처리합니다. 씬별로 순차 처리하려면 클라이언트에서 decomposeSingleScene을 사용하세요.
 */
export async function decomposeScriptIntoScenes(
  script: string,
  apiKey?: string
): Promise<string> {
  console.log("[장면 분해] 시작")
  console.log(`[장면 분해] 대본 길이: ${script.length}자`)
  
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.error("[장면 분해] Gemini API 키가 설정되지 않았습니다.")
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }
  
  console.log("[장면 분해] API 키 확인 완료")

  if (!script || script.trim().length === 0) {
    console.error("[장면 분해] 대본이 비어있습니다.")
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
    console.log("[장면 분해] 대본을 씬 단위로 분할 중...")
    let scenes = script.split(/\n\s*\n/).filter(s => s.trim().length > 0)
    console.log(`[장면 분해] 빈 줄 기준 분할 결과: ${scenes.length}개 씬`)
    
    if (scenes.length === 0) {
      // 빈 줄이 없으면 전체를 하나의 씬으로 처리
      console.log("[장면 분해] 빈 줄이 없어 전체를 하나의 씬으로 처리")
      scenes = [script]
    }
    
    // 긴 씬을 여러 씬으로 분할 (각 씬이 1000자 이상이면 분할) - 더 작게 분할하여 타임아웃 방지 및 빠른 처리
    const MAX_SCENE_LENGTH = 1000 // 씬당 최대 길이 (1500 -> 1000으로 감소)
    console.log(`[장면 분해] 긴 씬 분할 시작 (최대 길이: ${MAX_SCENE_LENGTH}자)`)
    const splitScenes: string[] = []
    
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx]
      console.log(`[장면 분해] 씬 ${idx + 1} 검사 중 (길이: ${scene.length}자)`)
      
      if (scene.length <= MAX_SCENE_LENGTH) {
        splitScenes.push(scene)
        console.log(`[장면 분해] 씬 ${idx + 1} 분할 불필요 (${scene.length}자)`)
      } else {
        console.log(`[장면 분해] 씬 ${idx + 1} 분할 필요 (${scene.length}자 > ${MAX_SCENE_LENGTH}자)`)
        // 긴 씬을 문장 단위로 분할
        const sentences = scene.split(/([.!?。！？]\s*)/).filter(s => s.trim().length > 0)
        console.log(`[장면 분해] 씬 ${idx + 1} 문장 수: ${sentences.length}개`)
        let currentChunk = ""
        let chunkCount = 0
        
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i]
          if (currentChunk.length + sentence.length <= MAX_SCENE_LENGTH) {
            currentChunk += sentence
          } else {
            if (currentChunk.trim().length > 0) {
              splitScenes.push(currentChunk.trim())
              chunkCount++
              console.log(`[장면 분해] 씬 ${idx + 1} -> 청크 ${chunkCount} 생성 (${currentChunk.trim().length}자)`)
            }
            currentChunk = sentence
          }
        }
        
        if (currentChunk.trim().length > 0) {
          splitScenes.push(currentChunk.trim())
          chunkCount++
          console.log(`[장면 분해] 씬 ${idx + 1} -> 청크 ${chunkCount} 생성 (${currentChunk.trim().length}자)`)
        }
        console.log(`[장면 분해] 씬 ${idx + 1} 분할 완료: ${chunkCount}개 청크로 분할됨`)
      }
    }
    
    scenes = splitScenes
    console.log(`[장면 분해] 최종 분할 완료: 총 ${scenes.length}개의 씬으로 분할됨 (최대 길이: ${MAX_SCENE_LENGTH}자)`)

    const allResults: string[] = []

    // 각 씬을 순차적으로 처리 (모든 씬이 성공해야 함)
    for (let i = 0; i < scenes.length; i++) {
      const sceneText = scenes[i].trim()
      const sceneNumber = i + 1

      // 씬이 너무 짧으면 기본 형식으로 추가
      if (sceneText.length < 10) {
        console.warn(`[장면 분해] 씬 ${sceneNumber}이 너무 짧아 기본 형식으로 추가합니다.`)
        allResults.push(`씬 ${sceneNumber}\n\n[장면 1]\n\n${sceneText}`)
        continue
      }

      const userPrompt = `다음은 씬 대본입니다. 길이에 맞게 장면을 최소 1개~최대 3개로 분해해 주세요.

한국어만 출력하세요.

씬 번호: ${sceneNumber}

씬 대본:

${sceneText}`

      // Gemini API 호출 (타임아웃 및 재시도 로직 포함)
      console.log(`[장면 분해] 씬 ${sceneNumber} API 호출 시작 (${i + 1}/${scenes.length})`)
      console.log(`[장면 분해] 씬 ${sceneNumber} 텍스트 길이: ${sceneText.length}자`)
      console.log(`[장면 분해] 씬 ${sceneNumber} 프롬프트 길이: ${userPrompt.length}자`)
      
      let response: Response | undefined
      let lastError: Error | undefined
      const maxRetries = 3
      
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          console.log(`[장면 분해] 씬 ${sceneNumber} 시도 ${retry + 1}/${maxRetries}`)
          const controller = new AbortController()
          // 타임아웃을 3분으로 단축 (504 에러 방지)
          const timeoutId = setTimeout(() => controller.abort(), 180000) // 3분 타임아웃
          
          const requestBody = {
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
              maxOutputTokens: 8192, // Gemini 2.5 Pro의 최대 토큰 제한
            },
          }
          
          console.log(`[장면 분해] 씬 ${sceneNumber} 요청 본문 크기: ${JSON.stringify(requestBody).length}자`)
          console.log(`[장면 분해] 씬 ${sceneNumber} fetch 시작...`)
          
          const startTime = Date.now()
          try {
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              }
            )
            clearTimeout(timeoutId)
          } catch (fetchError) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              throw new Error(`씬 ${sceneNumber} 처리 타임아웃 (3분 초과)`)
            }
            throw fetchError
          }
          
          const elapsedTime = Date.now() - startTime
          console.log(`[장면 분해] 씬 ${sceneNumber} fetch 완료 (소요 시간: ${elapsedTime}ms)`)
          console.log(`[장면 분해] 씬 ${sceneNumber} 응답 상태: ${response.status} ${response.statusText}`)
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error(`[장면 분해] 씬 ${sceneNumber} 응답 오류:`, errorText)
            throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
          }

          console.log(`[장면 분해] 씬 ${sceneNumber} JSON 파싱 시작...`)
          const data = await response.json()
          console.log(`[장면 분해] 씬 ${sceneNumber} JSON 파싱 완료`)
          console.log(`[장면 분해] 씬 ${sceneNumber} 응답 데이터 구조:`, {
            hasCandidates: !!data.candidates,
            candidatesLength: data.candidates?.length || 0,
          })
          
          // 응답 검증
          const candidate = data.candidates?.[0]
          if (!candidate) {
            console.error(`[장면 분해] 씬 ${sceneNumber} 응답 후보 없음:`, data)
            throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 응답 후보가 없습니다.`)
          }

          // finishReason 확인 (응답이 잘렸는지 확인)
          const finishReason = candidate.finishReason
          console.log(`[장면 분해] 씬 ${sceneNumber} finishReason: ${finishReason}`)
          if (finishReason === "MAX_TOKENS") {
            console.warn(`[장면 분해] 씬 ${sceneNumber} 응답이 토큰 제한으로 잘렸습니다.`)
          }

          const content = candidate.content?.parts?.[0]?.text
          console.log(`[장면 분해] 씬 ${sceneNumber} 응답 내용 길이: ${content?.length || 0}자`)

          if (!content || content.trim().length === 0) {
            console.error(`[장면 분해] 씬 ${sceneNumber} 응답 내용 없음`)
            throw new Error(`씬 ${sceneNumber} 장면 분해에 실패했습니다: 내용이 없습니다.`)
          }

          // 내용이 잘렸는지 확인 (마지막 문장이 완전한지)
          const trimmedContent = content.trim()
          console.log(`[장면 분해] 씬 ${sceneNumber} 트림된 내용 길이: ${trimmedContent.length}자`)
          console.log(`[장면 분해] 씬 ${sceneNumber} 응답 내용 미리보기:`, trimmedContent.substring(0, 200))
          
          // 최소한 "씬 N" 또는 "[장면 1]" 같은 패턴이 있는지 확인
          const hasValidFormat = trimmedContent.match(/씬\s+\d+|\[장면\s+\d+\]/)
          console.log(`[장면 분해] 씬 ${sceneNumber} 형식 검증:`, hasValidFormat ? "통과" : "실패")
          
          if (!hasValidFormat) {
            console.error(`[장면 분해] 씬 ${sceneNumber} 형식 오류 - 전체 내용:`, trimmedContent)
            throw new Error(`씬 ${sceneNumber} 장면 분해 결과 형식이 올바르지 않습니다.`)
          }

          allResults.push(trimmedContent)
          console.log(`[장면 분해] 씬 ${sceneNumber} 처리 완료 (총 ${allResults.length}개 씬 완료)`)
          break // 성공하면 루프 종료
          
        } catch (fetchError: any) {
          lastError = fetchError
          console.error(`[장면 분해] 씬 ${sceneNumber} 오류 발생:`, {
            name: fetchError.name,
            message: fetchError.message,
            stack: fetchError.stack,
          })
          
          if (fetchError.name === 'AbortError') {
            console.warn(`[장면 분해] 씬 ${sceneNumber} 타임아웃 (${retry + 1}/${maxRetries})`)
          } else {
            console.warn(`[장면 분해] 씬 ${sceneNumber} API 호출 실패 (${retry + 1}/${maxRetries}):`, fetchError.message)
          }
          
          if (retry < maxRetries - 1) {
            const waitTime = 2000 * (retry + 1)
            console.log(`[장면 분해] 씬 ${sceneNumber} 재시도 전 대기: ${waitTime}ms`)
            // 재시도 전 대기
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
      
      // 모든 재시도 실패 시 원본 씬을 그대로 사용 (부분 성공 허용)
      if (!response) {
        console.error(`[장면 분해] 씬 ${sceneNumber} 최종 실패:`, lastError)
        console.warn(`[장면 분해] 씬 ${sceneNumber}는 원본 그대로 사용합니다.`)
        // 실패한 씬은 원본을 그대로 사용 (장면 분해 없이)
        allResults.push(`씬 ${sceneNumber}\n\n[장면 1]\n\n${sceneText}`)
        console.log(`[장면 분해] 씬 ${sceneNumber} 원본 사용 (총 ${allResults.length}개 씬 완료)`)
      }
      
      // 씬 처리 간 딜레이 추가 (API 제한 방지 및 서버 부하 완화)
      if (i < scenes.length - 1) {
        const delay = 2000 // 2초 대기
        console.log(`[장면 분해] 다음 씬 처리 전 ${delay}ms 대기...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // 모든 씬의 결과를 합쳐서 반환
    console.log(`[장면 분해] 모든 씬 처리 완료, 결과 합치기 시작...`)
    
    // 결과가 비어있으면 원본 대본을 기본 형식으로 반환
    if (allResults.length === 0) {
      console.warn(`[장면 분해] 모든 씬이 실패하거나 건너뛰어짐. 원본 대본을 기본 형식으로 반환합니다.`)
      // 원본 대본을 씬 단위로 나누어 기본 형식으로 반환
      const fallbackResults: string[] = []
      for (let i = 0; i < scenes.length; i++) {
        const sceneText = scenes[i].trim()
        if (sceneText.length >= 10) {
          fallbackResults.push(`씬 ${i + 1}\n\n[장면 1]\n\n${sceneText}`)
        }
      }
      
      if (fallbackResults.length === 0) {
        // 씬도 없으면 전체를 하나의 씬으로 반환
        return `씬 1\n\n[장면 1]\n\n${script.trim()}`
      }
      
      const fallbackResult = fallbackResults.join("\n\n")
      console.log(`[장면 분해] 기본 형식 결과 길이: ${fallbackResult.length}자`)
      return fallbackResult
    }
    
    const finalResult = allResults.join("\n\n")
    console.log(`[장면 분해] 최종 결과 길이: ${finalResult.length}자`)
    console.log(`[장면 분해] 완료: ${allResults.length}/${scenes.length}개 씬 처리 성공`)
    console.log(`[장면 분해] 최종 결과 미리보기:`, finalResult.substring(0, 500))
    
    // 최종 결과가 비어있거나 너무 짧으면 원본 반환
    if (!finalResult || finalResult.trim().length < 10) {
      console.warn(`[장면 분해] 최종 결과가 비어있음. 원본 대본을 기본 형식으로 반환합니다.`)
      return `씬 1\n\n[장면 1]\n\n${script.trim()}`
    }
    
    return finalResult
  } catch (error) {
    console.error("[장면 분해] 전체 프로세스 실패:", error)
    console.error("[장면 분해] 에러 상세:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * 대본을 의미 단위로 자동 분할하는 함수
 * 한 줄로 된 대본을 AI가 분석하여 의미 단위로 나눠줍니다.
 */
export async function autoSplitScriptByMeaning(
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
    const systemPrompt = `당신은 대본 편집 전문가입니다. 한 줄로 된 대본을 의미 단위로 분석하여 적절한 위치에 빈 줄을 추가하여 나눠주세요.

[중요 규칙]
1. 대본의 내용을 절대 변경하거나 수정하지 마세요.
2. 문장을 추가하거나 삭제하지 마세요.
3. 오직 의미 단위로 구분하기 위해 빈 줄만 추가하세요.
4. 의미 단위란:
   - 주제가 바뀌는 지점
   - 장면이 전환되는 지점
   - 시간이나 공간이 바뀌는 지점
   - 새로운 이야기나 사건이 시작되는 지점
5. 각 의미 단위는 2-5문장 정도로 구성되도록 나누세요.
6. 너무 짧게 나누지 말고, 너무 길게 묶지도 마세요.
7. 원본 대본의 모든 문장을 그대로 유지하세요.

[출력 형식]
- 의미 단위 사이에 빈 줄 하나를 추가하세요.
- 각 의미 단위는 자연스럽게 연결되어야 합니다.
- 원본 대본의 모든 내용을 포함해야 합니다.`

    const userPrompt = `다음 대본을 의미 단위로 나눠주세요. 빈 줄만 추가하고 내용은 절대 변경하지 마세요.

[대본]:
${script}`

    console.log("[씬 나누기] 의미 단위 분석 시작...")
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
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
            temperature: 0.3, // 낮은 온도로 정확한 분석
            topK: 40,
            topP: 0.95,
            maxOutputTokens: Math.min(32768, Math.ceil(script.length * 1.5)), // 원본보다 약간 더 긴 토큰 할당
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`씬 나누기 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    let result = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!result) {
      throw new Error("씬 나누기 결과를 생성할 수 없습니다.")
    }

    result = result.trim()
    
    // 결과에서 "[대본]:" 같은 프롬프트 부분 제거
    const lines = result.split('\n')
    let startIndex = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('대본') && lines[i].includes(':')) {
        startIndex = i + 1
        break
      }
    }
    result = lines.slice(startIndex).join('\n').trim()
    
    // 원본 대본의 글자수와 비교하여 너무 많이 변경되었는지 확인
    const originalLength = script.replace(/\s+/g, '').length
    const resultLength = result.replace(/\s+/g, '').length
    const lengthDiff = Math.abs(originalLength - resultLength) / originalLength
    
    if (lengthDiff > 0.1) {
      // 10% 이상 차이나면 원본을 반환하고 경고
      console.warn("[씬 나누기] 결과가 원본과 너무 많이 달라서 원본을 반환합니다.")
      return script
    }
    
    console.log(`[씬 나누기] 완료: 원본 ${script.length}자 -> 결과 ${result.length}자`)
    
    return result
  } catch (error) {
    console.error("씬 나누기 실패:", error)
    throw error
  }
}
