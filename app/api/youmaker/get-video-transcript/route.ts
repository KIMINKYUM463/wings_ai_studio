import { NextRequest, NextResponse } from "next/server"

/**
 * YouTube 영상의 자막(트랜스크립트)을 가져옵니다.
 * POST /api/youmaker/get-video-transcript
 * 
 * Python의 youtube-transcript-api와 유사한 방식으로 YouTube의 자막을 직접 가져옵니다.
 * YouTube의 watch 페이지에서 자막 정보를 추출하고, 자막 URL을 통해 자막 데이터를 가져옵니다.
 * 
 * 참고 문서:
 * - Python youtube-transcript-api: https://github.com/jdepoix/youtube-transcript-api
 * - YouTube Data API v3 자막 가이드: https://developers.google.com/youtube/v3/guides/implementation/captions?hl=ko
 * 
 * 참고: YouTube Data API v3의 captions.list와 captions.download를 사용하려면 OAuth 2.0 인증이 필요합니다.
 * 현재 구현은 OAuth 없이도 작동하는 방식입니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId } = body

    if (!videoId) {
      return NextResponse.json(
        { error: "영상 ID가 필요합니다." },
        { status: 400 }
      )
    }

    try {
      console.log(`[Transcript] 자막 가져오기 시작: ${videoId}`)
      
      // 1단계: YouTube watch 페이지에서 자막 트랙 정보 가져오기
      const watchPageUrl = `https://www.youtube.com/watch?v=${videoId}`
      console.log(`[Transcript] watch 페이지 가져오기: ${watchPageUrl}`)
      
      const watchPageResponse = await fetch(watchPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      })

      if (!watchPageResponse.ok) {
        throw new Error(`YouTube 페이지를 가져올 수 없습니다: ${watchPageResponse.status}`)
      }

      const watchPageHtml = await watchPageResponse.text()
      console.log(`[Transcript] watch 페이지 HTML 길이: ${watchPageHtml.length}자`)

      // 2단계: HTML에서 자막 트랙 정보 추출
      // YouTube는 자막 정보를 ytInitialPlayerResponse에 포함시킵니다
      const ytInitialPlayerResponseMatch = watchPageHtml.match(/var ytInitialPlayerResponse = ({.+?});/s)
      
      if (!ytInitialPlayerResponseMatch) {
        throw new Error("YouTube 페이지에서 자막 정보를 찾을 수 없습니다.")
      }

      let playerResponse: any
      try {
        playerResponse = JSON.parse(ytInitialPlayerResponseMatch[1])
      } catch (parseError) {
        throw new Error("YouTube 응답을 파싱할 수 없습니다.")
      }

      // Python의 list_transcripts와 유사하게 사용 가능한 자막 목록 가져오기
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
      const audioTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.audioTracks || []
      
      console.log(`[Transcript] 사용 가능한 자막 트랙: ${captionTracks.length}개`)
      
      // 사용 가능한 자막 목록 로깅 (Python의 list_transcripts와 유사)
      captionTracks.forEach((track: any, index: number) => {
        console.log(`  [${index}] 언어: ${track.name?.simpleText || track.languageCode}, 코드: ${track.languageCode}, 종류: ${track.kind || 'manual'}`)
      })

      if (captionTracks.length === 0) {
        return NextResponse.json({
          success: true,
          transcript: "",
          hasCaptions: false,
          message: "이 영상에는 사용 가능한 자막이 없습니다.",
        })
      }

      // 3단계: Python의 get_transcript와 동일하게 언어 우선순위에 따라 자막 트랙 선택
      // languages=['ko', 'en'] 형태로 우선순위 지정
      const languagePriority = ['ko', 'ko-KR', 'en', 'en-US']
      let selectedTrack: any = null

      // Python 라이브러리처럼 우선순위대로 찾기
      for (const lang of languagePriority) {
        selectedTrack = captionTracks.find((track: any) => {
          const trackLang = track.languageCode?.toLowerCase() || ''
          return trackLang === lang.toLowerCase() || trackLang.startsWith(lang.toLowerCase())
        })
        if (selectedTrack) {
          console.log(`[Transcript] 우선순위에 따라 선택된 자막: ${selectedTrack.languageCode}`)
          break
        }
      }

      // 우선순위 언어가 없으면 자동 생성 자막(asr) 찾기
      if (!selectedTrack) {
        selectedTrack = captionTracks.find((track: any) => track.kind === 'asr')
        if (selectedTrack) {
          console.log(`[Transcript] 자동 생성 자막 선택: ${selectedTrack.languageCode}`)
        }
      }

      // 그래도 없으면 첫 번째 자막 사용
      if (!selectedTrack) {
        selectedTrack = captionTracks[0]
        console.log(`[Transcript] 첫 번째 자막 사용: ${selectedTrack.languageCode}`)
      }

      if (!selectedTrack || !selectedTrack.baseUrl) {
        return NextResponse.json({
          success: true,
          transcript: "",
          hasCaptions: false,
          message: "자막 URL을 찾을 수 없습니다.",
        })
      }

      console.log(`[Transcript] 선택된 자막: ${selectedTrack.languageCode} (${selectedTrack.name?.simpleText || 'N/A'})`)

      // 4단계: 자막 URL에서 자막 데이터 가져오기
      // Python의 youtube_transcript_api와 동일하게 baseUrl 사용
      let transcriptUrl = selectedTrack.baseUrl
      
      // baseUrl에 fmt 파라미터 추가 (Python 라이브러리와 동일)
      if (!transcriptUrl.includes('fmt=')) {
        transcriptUrl += (transcriptUrl.includes('?') ? '&' : '?') + 'fmt=json3'
      }
      
      console.log(`[Transcript] 자막 URL: ${transcriptUrl.substring(0, 150)}...`)

      const transcriptResponse = await fetch(transcriptUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': watchPageUrl,
        },
      })

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text().catch(() => '')
        console.error(`[Transcript] 자막 fetch 실패: ${transcriptResponse.status} ${transcriptResponse.statusText}`)
        console.error(`[Transcript] 에러 응답: ${errorText.substring(0, 500)}`)
        throw new Error(`자막 데이터를 가져올 수 없습니다: ${transcriptResponse.status}`)
      }

      const transcriptContent = await transcriptResponse.text()
      console.log(`[Transcript] 자막 응답 길이: ${transcriptContent.length}자`)
      console.log(`[Transcript] 자막 응답 시작 부분: ${transcriptContent.substring(0, 200)}`)

      if (transcriptContent.length === 0) {
        return NextResponse.json({
          success: true,
          transcript: "",
          hasCaptions: false,
          message: "자막 데이터가 비어있습니다.",
        })
      }

      // 5단계: Python의 youtube_transcript_api처럼 자막 데이터 파싱
      // JSON 형식 또는 XML 형식 모두 처리
      let transcriptText = ""
      
      try {
        // JSON 형식 시도 (fmt=json3)
        const jsonData = JSON.parse(transcriptContent)
        if (jsonData.events) {
          // Python 라이브러리와 동일하게 events 배열에서 텍스트 추출
          transcriptText = jsonData.events
            .map((event: any) => {
              if (event.segs) {
                return event.segs
                  .map((seg: any) => seg.utf8 || seg.text || '')
                  .join('')
              }
              return ''
            })
            .filter((text: string) => text && text.trim().length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
          
          console.log(`[Transcript] JSON 형식으로 자막 추출 완료: ${transcriptText.length}자`)
        }
      } catch (jsonError) {
        // JSON 파싱 실패 시 XML 형식으로 처리
        console.log(`[Transcript] JSON 파싱 실패, XML 형식으로 시도`)
        
        // XML 파싱하여 텍스트 추출
        const textMatches = transcriptContent.match(/<text[^>]*>([^<]+)<\/text>/g)
        
        if (textMatches && textMatches.length > 0) {
          transcriptText = textMatches
            .map((match: string) => {
              // <text> 태그 제거하고 텍스트만 추출
              const textContent = match.replace(/<[^>]+>/g, "")
              // HTML 엔티티 디코딩
              return textContent
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, " ")
                .replace(/&apos;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&#x2F;/g, "/")
            })
            .filter((text: string) => text && text.trim().length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
          
          console.log(`[Transcript] XML 형식으로 자막 추출 완료: ${transcriptText.length}자`)
        } else {
          return NextResponse.json({
            success: true,
            transcript: "",
            hasCaptions: false,
            message: "자막 텍스트를 추출할 수 없습니다.",
          })
        }
      }

      console.log(`[Transcript] 자막 추출 완료: ${transcriptText.length}자`)

      if (transcriptText.length === 0) {
        return NextResponse.json({
          success: true,
          transcript: "",
          hasCaptions: false,
          message: "자막 텍스트가 비어있습니다.",
        })
      }

      return NextResponse.json({
        success: true,
        transcript: transcriptText,
        hasCaptions: true,
        message: "자막을 성공적으로 가져왔습니다.",
        language: selectedTrack.languageCode,
      })
    } catch (transcriptError) {
      console.error("[Get Video Transcript] 자막 가져오기 실패:", transcriptError)
      
      const errorMessage = transcriptError instanceof Error 
        ? transcriptError.message 
        : String(transcriptError)
      
      console.error("[Get Video Transcript] 에러 스택:", transcriptError instanceof Error ? transcriptError.stack : "N/A")
      
      return NextResponse.json({
        success: false,
        transcript: "",
        hasCaptions: false,
        message: `자막을 가져올 수 없습니다: ${errorMessage}. 자막이 없는 영상이거나 비공개 영상일 수 있습니다.`,
        error: errorMessage,
      })
    }
  } catch (error) {
    console.error("[Get Video Transcript] 오류:", error)
    return NextResponse.json(
      {
        error: `서버 오류: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
