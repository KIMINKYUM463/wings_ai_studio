import { NextRequest, NextResponse } from "next/server"

/**
 * YouTube 영상의 자막(트랜스크립트)을 가져옵니다.
 * POST /api/youmaker/get-video-transcript
 * 
 * Python의 youtube-transcript-api와 유사한 방식으로 YouTube의 자막을 직접 가져옵니다.
 * 참고: https://dss99911.github.io/miscellanea/2025/01/08/youtube-transcript.html
 * 
 * Python 라이브러리 방식:
 * - list_transcripts: 사용 가능한 자막 목록 가져오기
 * - fetch: 선택한 자막의 실제 데이터 가져오기
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      })

      if (!watchPageResponse.ok) {
        throw new Error(`YouTube 페이지를 가져올 수 없습니다: ${watchPageResponse.status}`)
      }

      const watchPageHtml = await watchPageResponse.text()
      console.log(`[Transcript] watch 페이지 HTML 길이: ${watchPageHtml.length}자`)

      // 2단계: HTML에서 자막 트랙 정보 추출
      // Python 라이브러리는 여러 방법으로 ytInitialPlayerResponse를 찾습니다
      // 방법 1: var ytInitialPlayerResponse = {...}
      let playerResponse: any = null
      
      // 정규식 패턴 개선: 더 넓은 범위로 매칭
      const patterns = [
        /var ytInitialPlayerResponse = ({.+?});/s,
        /ytInitialPlayerResponse\s*=\s*({.+?});/s,
        /"playerResponse":({.+?})/s,
      ]

      for (const pattern of patterns) {
        const match = watchPageHtml.match(pattern)
        if (match) {
          try {
            playerResponse = JSON.parse(match[1])
            console.log(`[Transcript] ytInitialPlayerResponse 찾기 성공 (패턴: ${pattern})`)
            break
          } catch (e) {
            console.log(`[Transcript] JSON 파싱 실패, 다음 패턴 시도`)
            continue
          }
        }
      }

      // 방법 2: window["ytInitialPlayerResponse"] 형태도 시도
      if (!playerResponse) {
        const windowMatch = watchPageHtml.match(/window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/s)
        if (windowMatch) {
          try {
            playerResponse = JSON.parse(windowMatch[1])
            console.log(`[Transcript] window["ytInitialPlayerResponse"] 찾기 성공`)
          } catch (e) {
            console.log(`[Transcript] window 형태 JSON 파싱 실패`)
          }
        }
      }

      if (!playerResponse) {
        throw new Error("YouTube 페이지에서 자막 정보를 찾을 수 없습니다.")
      }

      // Python의 list_transcripts와 유사하게 사용 가능한 자막 목록 가져오기
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
      
      console.log(`[Transcript] 사용 가능한 자막 트랙: ${captionTracks.length}개`)
      
      // 사용 가능한 자막 목록 로깅
      captionTracks.forEach((track: any, index: number) => {
        const name = track.name?.simpleText || track.name?.runs?.[0]?.text || track.languageCode
        const kind = track.kind || 'manual'
        console.log(`  [${index}] 언어: ${name}, 코드: ${track.languageCode}, 종류: ${kind}, URL 존재: ${!!track.baseUrl}`)
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

      console.log(`[Transcript] 선택된 자막: ${selectedTrack.languageCode} (${selectedTrack.name?.simpleText || selectedTrack.name?.runs?.[0]?.text || 'N/A'})`)

      // 4단계: 자막 URL에서 자막 데이터 가져오기
      // Python 라이브러리는 baseUrl을 그대로 사용하거나 fmt 파라미터를 추가합니다
      let transcriptUrl = selectedTrack.baseUrl
      
      // baseUrl에 이미 fmt 파라미터가 있는지 확인
      const urlObj = new URL(transcriptUrl)
      
      // 여러 fmt 형식을 시도 (우선순위: srv3 > srv1 > json3 > ttml1)
      const fmtOptions = ['srv3', 'srv1', 'json3', 'ttml1']
      let transcriptContent = ""
      let successfulFmt = ""
      
      for (const fmt of fmtOptions) {
        // fmt 파라미터 설정
        urlObj.searchParams.set('fmt', fmt)
        const testUrl = urlObj.toString()
        
        console.log(`[Transcript] ${fmt} 형식으로 시도: ${testUrl.substring(0, 200)}...`)
        
        try {
          // Python 라이브러리처럼 자막 URL을 직접 호출
          // Referer와 User-Agent를 watch 페이지와 동일하게 설정
          const transcriptResponse = await fetch(testUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': watchPageUrl,
              'Origin': 'https://www.youtube.com',
            },
          })

          if (transcriptResponse.ok) {
            const content = await transcriptResponse.text()
            console.log(`[Transcript] ${fmt} 형식 응답 길이: ${content.length}자`)
            
            if (content.length > 0) {
              transcriptContent = content
              successfulFmt = fmt
              console.log(`[Transcript] ${fmt} 형식으로 자막 가져오기 성공!`)
              console.log(`[Transcript] 자막 응답 시작 부분: ${content.substring(0, 200)}`)
              break
            } else {
              console.log(`[Transcript] ${fmt} 형식 응답이 비어있음, 다음 형식 시도`)
            }
          } else {
            const errorText = await transcriptResponse.text().catch(() => '')
            console.log(`[Transcript] ${fmt} 형식 실패: ${transcriptResponse.status} ${transcriptResponse.statusText}`)
            console.log(`[Transcript] 에러 응답: ${errorText.substring(0, 200)}`)
          }
        } catch (fetchError) {
          console.error(`[Transcript] ${fmt} 형식 fetch 오류:`, fetchError)
          continue
        }
      }

      if (transcriptContent.length === 0) {
        console.error(`[Transcript] 모든 형식 시도 실패. baseUrl: ${selectedTrack.baseUrl}`)
        return NextResponse.json({
          success: false,
          transcript: "",
          hasCaptions: false,
          message: "자막 데이터를 가져올 수 없습니다. 자막이 비활성화되었거나 접근이 제한된 영상일 수 있습니다.",
        })
      }

      // 5단계: 자막 데이터 파싱
      return parseTranscript(transcriptContent, successfulFmt, selectedTrack.languageCode)
      
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

/**
 * 자막 데이터를 파싱하여 텍스트로 변환합니다.
 * Python 라이브러리의 fetch 메서드와 동일한 방식으로 처리합니다.
 */
function parseTranscript(content: string, fmt: string, languageCode: string): NextResponse {
  let transcriptText = ""
  
  try {
    if (fmt === 'json3') {
      // JSON3 형식 파싱
      try {
        const jsonData = JSON.parse(content)
        
        if (jsonData.events) {
          // Python 라이브러리와 동일하게 events 배열에서 텍스트 추출
          transcriptText = jsonData.events
            .filter((event: any) => event.segs && event.segs.length > 0)
            .map((event: any) => {
              return event.segs
                .map((seg: any) => {
                  // utf8 필드가 있으면 사용, 없으면 text 필드 사용
                  return seg.utf8 || seg.text || ''
                })
                .join('')
            })
            .filter((text: string) => text && text.trim().length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
          
          console.log(`[Transcript] JSON3 형식으로 자막 추출 완료: ${transcriptText.length}자`)
        } else if (jsonData.actions) {
          // actions 배열을 사용하는 경우
          transcriptText = jsonData.actions
            .filter((action: any) => action.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups)
            .flatMap((action: any) => {
              const cueGroups = action.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups || []
              return cueGroups.flatMap((group: any) => {
                const cues = group.transcriptCueGroupRenderer?.cues || []
                return cues.map((cue: any) => {
                  const runs = cue.transcriptCueRenderer?.cue?.simpleText || 
                             cue.transcriptCueRenderer?.cue?.runs?.map((r: any) => r.text).join('') || ''
                  return runs
                })
              })
            })
            .filter((text: string) => text && text.trim().length > 0)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
          
          console.log(`[Transcript] JSON3 actions 형식으로 자막 추출 완료: ${transcriptText.length}자`)
        }
      } catch (jsonError) {
        console.error(`[Transcript] JSON3 파싱 실패:`, jsonError)
      }
    } else if (fmt === 'srv3' || fmt === 'srv1') {
      // SRV 형식 파싱 (서버 응답 형식)
      try {
        // srv3/srv1은 XML 형식일 수 있음
        if (content.trim().startsWith('<')) {
          // XML 형식으로 파싱
          const textMatches = content.match(/<text[^>]*>([^<]+)<\/text>/g)
          
          if (textMatches && textMatches.length > 0) {
            transcriptText = textMatches
              .map((match: string) => {
                const textContent = match.replace(/<[^>]+>/g, "")
                return decodeHtmlEntities(textContent)
              })
              .filter((text: string) => text && text.trim().length > 0)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim()
            
            console.log(`[Transcript] SRV XML 형식(${fmt})으로 자막 추출 완료: ${transcriptText.length}자`)
          }
        } else {
          // JSON 형식일 수도 있음
          try {
            const jsonData = JSON.parse(content)
            if (jsonData.events) {
              transcriptText = jsonData.events
                .filter((event: any) => event.segs && event.segs.length > 0)
                .map((event: any) => {
                  return event.segs
                    .map((seg: any) => seg.utf8 || seg.text || '')
                    .join('')
                })
                .filter((text: string) => text && text.trim().length > 0)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim()
              
              console.log(`[Transcript] SRV JSON 형식(${fmt})으로 자막 추출 완료: ${transcriptText.length}자`)
            }
          } catch (jsonError) {
            // JSON이 아니면 텍스트로 직접 처리
            console.log(`[Transcript] SRV 텍스트 형식으로 처리 시도`)
            transcriptText = content
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          }
        }
      } catch (srvError) {
        console.error(`[Transcript] SRV(${fmt}) 파싱 실패:`, srvError)
      }
    } else if (fmt === 'ttml1' || fmt === 'xml') {
      // XML 형식 파싱
      console.log(`[Transcript] XML 형식(${fmt})으로 파싱 시도`)
      
      // XML 파싱하여 텍스트 추출
      const textMatches = content.match(/<text[^>]*>([^<]+)<\/text>/g)
      
      if (textMatches && textMatches.length > 0) {
        transcriptText = textMatches
          .map((match: string) => {
            // <text> 태그 제거하고 텍스트만 추출
            const textContent = match.replace(/<[^>]+>/g, "")
            // HTML 엔티티 디코딩
            return decodeHtmlEntities(textContent)
          })
          .filter((text: string) => text && text.trim().length > 0)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
        
        console.log(`[Transcript] XML 형식으로 자막 추출 완료: ${transcriptText.length}자`)
      }
    }

    if (transcriptText.length === 0) {
      return NextResponse.json({
        success: true,
        transcript: "",
        hasCaptions: false,
        message: "자막 텍스트를 추출할 수 없습니다.",
      })
    }

    return NextResponse.json({
      success: true,
      transcript: transcriptText,
      hasCaptions: true,
      message: "자막을 성공적으로 가져왔습니다.",
      language: languageCode,
    })
  } catch (parseError) {
    console.error(`[Transcript] 파싱 오류 (${fmt}):`, parseError)
    return NextResponse.json({
      success: true,
      transcript: "",
      hasCaptions: false,
      message: `자막 파싱에 실패했습니다: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    })
  }
}

/**
 * HTML 엔티티를 디코딩합니다.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
}
