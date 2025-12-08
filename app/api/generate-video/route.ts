import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { script, voiceModel, autoImages, userApiKey } = await request.json()

    console.log("[v0] API Route: 영상 생성 시작")

    const apiKey = userApiKey || process.env.GOOGLE_TTS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Google TTS API 키가 없습니다." }, { status: 400 })
    }

    const sentences = script
      .split(/(?<=[.!?])\s+/)
      .filter((s: string) => s.trim().length > 0)
      .map((s: string) => s.trim())

    console.log(`[v0] 문장 분할 완료, 총 ${sentences.length} 개`)

    function splitIntoSubtitleChunks(text: string): string[] {
      const maxLength = 15
      const words = text.split(/\s+/)
      const chunks: string[] = []
      let currentChunk = ""

      for (const word of words) {
        if ((currentChunk + word).length > maxLength && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = word
        } else {
          currentChunk += (currentChunk ? " " : "") + word
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
      }

      return chunks.length > 0 ? chunks : [text]
    }

    const allSubtitleLines: string[] = []
    for (const sentence of sentences) {
      const chunks = splitIntoSubtitleChunks(sentence)
      allSubtitleLines.push(...chunks)
    }

    console.log(`[v0] 총 자막 라인: ${allSubtitleLines.length}개`)

    const MAX_SSML_BYTES = 4500 // 안전 마진을 위해 4500바이트로 제한
    const ssmlChunks: Array<{ ssml: string; startLineIndex: number; endLineIndex: number }> = []
    let currentChunk = ""
    let currentStartIndex = 0
    let currentLineCount = 0

    for (let i = 0; i < allSubtitleLines.length; i++) {
      const line = allSubtitleLines[i]
      const markTag = `<mark name="L${i + 1}"/>${line}`
      const testSsml = `<speak>${currentChunk}${currentChunk ? " " : ""}${markTag}</speak>`
      const byteLength = new TextEncoder().encode(testSsml).length

      if (byteLength > MAX_SSML_BYTES && currentChunk.length > 0) {
        // 현재 청크를 저장하고 새 청크 시작
        ssmlChunks.push({
          ssml: `<speak>${currentChunk}</speak>`,
          startLineIndex: currentStartIndex,
          endLineIndex: currentStartIndex + currentLineCount - 1,
        })
        currentChunk = markTag
        currentStartIndex = i
        currentLineCount = 1
      } else {
        currentChunk += (currentChunk ? " " : "") + markTag
        currentLineCount++
      }
    }

    // 마지막 청크 추가
    if (currentChunk.length > 0) {
      ssmlChunks.push({
        ssml: `<speak>${currentChunk}</speak>`,
        startLineIndex: currentStartIndex,
        endLineIndex: currentStartIndex + currentLineCount - 1,
      })
    }

    console.log(`[v0] SSML을 ${ssmlChunks.length}개 청크로 분할`)

    // 각 청크에 대해 TTS 생성
    const allAudioSegments: string[] = []
    const allSubtitles: Array<{ text: string; start: number; end: number }> = []
    let currentTime = 0

    for (let chunkIdx = 0; chunkIdx < ssmlChunks.length; chunkIdx++) {
      const chunk = ssmlChunks[chunkIdx]
      console.log(
        `[v0] 청크 ${chunkIdx + 1}/${ssmlChunks.length} 처리 중 (라인 ${chunk.startLineIndex + 1}~${chunk.endLineIndex + 1})`,
      )

      const response = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { ssml: chunk.ssml },
          voice: {
            languageCode: "ko-KR",
            name: voiceModel || "ko-KR-Neural2-C",
            ssmlGender: "MALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0,
          },
          enableTimePointing: ["SSML_MARK"],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] TTS API 오류:", errorText)
        throw new Error(`TTS API 오류: ${response.status}`)
      }

      const data = await response.json()
      allAudioSegments.push(data.audioContent)

      const timepoints = data.timepoints || []
      const lineCount = chunk.endLineIndex - chunk.startLineIndex + 1

      for (let i = 0; i < lineCount; i++) {
        const globalLineIndex = chunk.startLineIndex + i
        const line = allSubtitleLines[globalLineIndex]
        const localMarkName = `L${globalLineIndex + 1}`
        const nextLocalMarkName = `L${globalLineIndex + 2}`

        const currentMark = timepoints.find((tp: any) => tp.markName === localMarkName)
        const nextMark = timepoints.find((tp: any) => tp.markName === nextLocalMarkName)

        const startTime = currentTime + (currentMark?.timeSeconds || 0)
        let endTime: number

        if (nextMark) {
          endTime = currentTime + nextMark.timeSeconds
        } else if (i === lineCount - 1) {
          // 청크의 마지막 라인
          const avgDuration = currentMark ? currentMark.timeSeconds / (i + 1) : 1.0
          endTime = startTime + avgDuration * 1.2
        } else {
          endTime = startTime + 1.0
        }

        allSubtitles.push({
          text: line,
          start: startTime,
          end: endTime,
        })
      }

      // 현재 청크의 마지막 자막 종료 시간으로 currentTime 업데이트
      if (allSubtitles.length > 0) {
        currentTime = allSubtitles[allSubtitles.length - 1].end
      }
    }

    // 모든 오디오 세그먼트를 하나의 Base64로 결합 (단순히 이어붙이기)
    const combinedAudioBase64 = allAudioSegments.join("")

    const totalDuration = allSubtitles[allSubtitles.length - 1]?.end || 0

    console.log(`[v0] Base64 오디오 크기: ${Math.round(combinedAudioBase64.length / 1024)} KB`)
    console.log(`[v0] 최종 영상 길이: ${totalDuration.toFixed(3)}초`)
    console.log(`[v0] 총 자막 개수: ${allSubtitles.length}개`)

    return NextResponse.json({
      audioBase64: combinedAudioBase64,
      subtitles: allSubtitles,
      duration: totalDuration,
      autoImages: autoImages || [],
    })
  } catch (error) {
    console.error("[v0] API Route 오류:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "알 수 없는 오류" }, { status: 500 })
  }
}
