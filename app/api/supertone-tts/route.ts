import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, apiKey, style, language, model } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "텍스트가 필요합니다." }, { status: 400 })
    }

    if (!voiceId) {
      return NextResponse.json({ error: "목소리 ID가 필요합니다." }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: "수퍼톤 API 키가 필요합니다." }, { status: 400 })
    }

    console.log("[Superton] TTS 생성 시작, voiceId:", voiceId, "style:", style || "neutral", "language:", language || "ko")
    console.log("[Superton] 텍스트 길이:", text.trim().length, "자")

    // 수퍼톤 API는 텍스트가 300자 이하여야 함
    const MAX_TEXT_LENGTH = 300
    const trimmedText = text.trim()
    
    // 텍스트가 300자를 초과하는 경우 여러 개로 나누기
    if (trimmedText.length > MAX_TEXT_LENGTH) {
      console.log("[Superton] 텍스트가 300자를 초과하여 분할 처리합니다.")
      
      // 텍스트를 적절한 위치에서 나누기
      const textChunks: string[] = []
      let remainingText = trimmedText
      
      while (remainingText.length > MAX_TEXT_LENGTH) {
        // 300자 이하로 자르기
        let chunk = remainingText.substring(0, MAX_TEXT_LENGTH)
        
        // 마지막 문장 끝(마침표, 느낌표, 물음표) 찾기
        const lastPeriod = Math.max(
          chunk.lastIndexOf("."),
          chunk.lastIndexOf("!"),
          chunk.lastIndexOf("?"),
          chunk.lastIndexOf("。"),
          chunk.lastIndexOf("！"),
          chunk.lastIndexOf("？")
        )
        
        // 쉼표나 공백에서 나누기
        let splitIndex = MAX_TEXT_LENGTH
        if (lastPeriod > MAX_TEXT_LENGTH * 0.7) {
          // 문장 끝이 70% 이상 위치에 있으면 문장 끝에서 나누기
          splitIndex = lastPeriod + 1
        } else {
          // 쉼표나 공백에서 나누기
          const lastComma = chunk.lastIndexOf(",")
          const lastSpace = chunk.lastIndexOf(" ")
          if (lastComma > MAX_TEXT_LENGTH * 0.8) {
            splitIndex = lastComma + 1
          } else if (lastSpace > MAX_TEXT_LENGTH * 0.8) {
            splitIndex = lastSpace + 1
          }
        }
        
        chunk = remainingText.substring(0, splitIndex).trim()
        if (chunk.length > 0) {
          textChunks.push(chunk)
        }
        remainingText = remainingText.substring(splitIndex).trim()
      }
      
      // 마지막 남은 텍스트 추가
      if (remainingText.length > 0) {
        textChunks.push(remainingText)
      }
      
      console.log(`[Superton] 텍스트를 ${textChunks.length}개 청크로 분할했습니다.`)
      
      // 각 청크를 개별적으로 TTS 생성
      const audioBuffers: ArrayBuffer[] = []
      const apiUrl = `https://supertoneapi.com/v1/text-to-speech/${voiceId}`
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i]
        console.log(`[Superton] 청크 ${i + 1}/${textChunks.length} 생성 중 (${chunk.length}자): ${chunk.substring(0, 50)}...`)
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sup-api-key": apiKey,
          },
          body: JSON.stringify({
            text: chunk,
            language: language || "ko",
            style: style || "neutral",
            model: model || "sona_speech_1",
          }),
        })
        
        if (!response.ok) {
          let errorText = ""
          try {
            errorText = await response.text()
            try {
              const errorJson = JSON.parse(errorText)
              errorText = errorJson.message?.[0] || errorJson.detail?.message || errorJson.message || errorJson.error || errorText
            } catch {
              // JSON이 아니면 그대로 사용
            }
          } catch (e) {
            errorText = `응답 읽기 실패: ${e instanceof Error ? e.message : String(e)}`
          }
          
          throw new Error(`청크 ${i + 1} 생성 실패: ${errorText}`)
        }
        
        const audioBuffer = await response.arrayBuffer()
        audioBuffers.push(audioBuffer)
        console.log(`[Superton] 청크 ${i + 1}/${textChunks.length} 생성 완료`)
      }
      
      // WAV 파일 합치기
      // WAV 파일 구조: RIFF 헤더(12) + fmt 청크 + data 청크
      // 첫 번째 파일의 헤더를 유지하고, 나머지 파일의 데이터 부분만 합치기
      if (audioBuffers.length === 1) {
        const audioBase64 = Buffer.from(audioBuffers[0]).toString("base64")
        const audioUrl = `data:audio/wav;base64,${audioBase64}`
        return NextResponse.json({
          success: true,
          audioBase64,
          audioUrl,
        })
      }
      
      // 여러 파일 합치기
      const firstBuffer = new Uint8Array(audioBuffers[0])
      // WAV 파일에서 data 청크 찾기 (보통 44바이트 이후에 데이터 시작)
      // "data" 문자열 찾기 (0x64617461)
      let dataStartIndex = 0
      for (let i = 0; i < firstBuffer.length - 4; i++) {
        if (firstBuffer[i] === 0x64 && firstBuffer[i+1] === 0x61 && 
            firstBuffer[i+2] === 0x74 && firstBuffer[i+3] === 0x61) {
          dataStartIndex = i + 8 // "data" + 4바이트 크기 = 8바이트
          break
        }
      }
      
      // 첫 번째 파일의 헤더 부분
      const header = firstBuffer.slice(0, dataStartIndex)
      
      // 모든 파일의 데이터 부분 합치기
      let totalDataLength = 0
      const dataParts: Uint8Array[] = []
      
      for (const buffer of audioBuffers) {
        const bufferArray = new Uint8Array(buffer)
        let dataStart = 0
        for (let i = 0; i < bufferArray.length - 4; i++) {
          if (bufferArray[i] === 0x64 && bufferArray[i+1] === 0x61 && 
              bufferArray[i+2] === 0x74 && bufferArray[i+3] === 0x61) {
            dataStart = i + 8
            break
          }
        }
        const dataPart = bufferArray.slice(dataStart)
        dataParts.push(dataPart)
        totalDataLength += dataPart.length
      }
      
      // 헤더의 파일 크기 업데이트 (RIFF 청크 크기)
      const newFileSize = header.length + totalDataLength - 8 // RIFF 헤더 제외
      header[4] = newFileSize & 0xFF
      header[5] = (newFileSize >> 8) & 0xFF
      header[6] = (newFileSize >> 16) & 0xFF
      header[7] = (newFileSize >> 24) & 0xFF
      
      // data 청크 크기 업데이트 (헤더에서 data 청크 크기 위치 찾기)
      for (let i = 0; i < header.length - 4; i++) {
        if (header[i] === 0x64 && header[i+1] === 0x61 && 
            header[i+2] === 0x74 && header[i+3] === 0x61) {
          header[i+4] = totalDataLength & 0xFF
          header[i+5] = (totalDataLength >> 8) & 0xFF
          header[i+6] = (totalDataLength >> 16) & 0xFF
          header[i+7] = (totalDataLength >> 24) & 0xFF
          break
        }
      }
      
      // 합친 버퍼 생성
      const combinedBuffer = new Uint8Array(header.length + totalDataLength)
      combinedBuffer.set(header, 0)
      let offset = header.length
      for (const dataPart of dataParts) {
        combinedBuffer.set(dataPart, offset)
        offset += dataPart.length
      }
      
      const combinedBase64 = Buffer.from(combinedBuffer).toString("base64")
      const combinedAudioUrl = `data:audio/wav;base64,${combinedBase64}`
      
      console.log(`[Superton] ${textChunks.length}개 청크를 합쳐서 TTS 생성 완료, 총 크기: ${combinedBuffer.length} bytes`)
      
      return NextResponse.json({
        success: true,
        audioBase64: combinedBase64,
        audioUrl: combinedAudioUrl,
      })
    }
    
    // 텍스트가 300자 이하인 경우 기존 로직 사용
    const apiUrl = `https://supertoneapi.com/v1/text-to-speech/${voiceId}`
    console.log("[Superton] API URL:", apiUrl)
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sup-api-key": apiKey, // Bearer가 아닌 커스텀 헤더 사용
      },
      body: JSON.stringify({
        text: trimmedText,
        language: language || "ko", // 기본값: 한국어
        style: style || "neutral", // 사용자가 선택한 스타일 또는 기본값
        model: model || "sona_speech_1", // 기본 모델
      }),
    })

    if (!response.ok) {
      let errorText = ""
      try {
        errorText = await response.text()
        try {
          const errorJson = JSON.parse(errorText)
          errorText = errorJson.detail?.message || errorJson.message || errorJson.error || errorText
        } catch {
          // JSON이 아니면 그대로 사용
        }
      } catch (e) {
        errorText = `응답 읽기 실패: ${e instanceof Error ? e.message : String(e)}`
      }
      
      console.error("[Superton] API 오류:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      
      return NextResponse.json(
        {
          success: false,
          error: `수퍼톤 API 호출 실패 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      )
    }

    // 수퍼톤 API는 오디오 파일 스트림 형식(WAV)으로 응답
    // 헤더에 X-Audio-Length 값이 있음
    const audioLength = response.headers.get("X-Audio-Length")
    console.log("[Superton] 오디오 길이:", audioLength)

    // 오디오 스트림을 ArrayBuffer로 읽기
    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString("base64")
    const audioUrl = `data:audio/wav;base64,${audioBase64}`

    console.log("[Superton] TTS 생성 완료, 오디오 크기:", audioBuffer.byteLength, "bytes")

    return NextResponse.json({
      success: true,
      audioBase64,
      audioUrl,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error("[Superton] TTS 생성 오류:", {
      error: errorMessage,
      textLength: text?.length,
      voiceId: voiceId,
    })
    
    return NextResponse.json(
      {
        success: false,
        error: `TTS 생성 실패: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}


