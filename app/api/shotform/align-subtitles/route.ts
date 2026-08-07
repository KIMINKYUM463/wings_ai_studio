import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 180

type WordTiming = { word: string; start: number; end: number }

function calculateWordSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1
  if (word1.includes(word2) || word2.includes(word1)) return 0.8
  const maxLen = Math.max(word1.length, word2.length)
  if (!maxLen) return 1
  let matches = 0
  const minLen = Math.min(word1.length, word2.length)
  for (let i = 0; i < minLen; i += 1) {
    if (word1[i] === word2[i]) matches += 1
  }
  return matches / maxLen
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\s"'“”‘’·.,!?~\-–—…\[\](){}<>/\\|:;·•]/g, "")
    .toLowerCase()
}

/** 정답 대본을 토큰으로 쪼갠 뒤 Whisper 시각에 강제 매칭 */
function forceAlignScriptWords(script: string, whisperWords: WordTiming[]): WordTiming[] {
  if (!script.trim() || !whisperWords.length) return whisperWords

  const raw = script
    .split(/(\s+|[,，.。!！?？;；:：])/)
    .map((part) => part.trim())
    .filter(Boolean)
  const scriptTokens: string[] = []
  for (const token of raw) {
    if (/^[,，.。!！?？;；:：]+$/.test(token) && scriptTokens.length) {
      scriptTokens[scriptTokens.length - 1] += token
    } else {
      scriptTokens.push(token)
    }
  }
  if (!scriptTokens.length) return whisperWords

  const sorted = [...whisperWords].sort((a, b) => a.start - b.start)
  const matched: WordTiming[] = []
  let whisperIndex = 0
  let lastEnd = sorted[0]?.start ?? 0

  for (const token of scriptTokens) {
    const needle = normalizeToken(token)
    if (!needle) continue

    let bestIndex = -1
    let bestScore = 0
    const windowEnd = Math.min(sorted.length, whisperIndex + 6)
    for (let j = whisperIndex; j < windowEnd; j += 1) {
      const candidate = normalizeToken(sorted[j]!.word)
      if (!candidate) continue
      if (candidate === needle) {
        bestIndex = j
        bestScore = 1
        break
      }
      const score = calculateWordSimilarity(needle, candidate)
      if (score > bestScore) {
        bestScore = score
        bestIndex = j
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.55) {
      const hit = sorted[bestIndex]!
      matched.push({
        word: token,
        start: hit.start,
        end: hit.end,
      })
      whisperIndex = bestIndex + 1
      lastEnd = hit.end
    } else {
      // 매칭 실패: 짧은 추정 구간 (다음 Whisper 단어 전까지)
      const next = sorted[whisperIndex]
      const start = lastEnd
      const end = next ? Math.max(start + 0.12, Math.min(next.start, start + 0.35)) : start + 0.25
      matched.push({ word: token, start, end })
      lastEnd = end
    }
  }

  return matched.length ? matched : whisperWords
}

function extractWordsFromResponse(data: {
  words?: Array<{ word?: string; start?: number; end?: number }>
  segments?: Array<{
    start?: number
    end?: number
    text?: string
    words?: Array<{ word?: string; start?: number; end?: number }>
  }>
}): WordTiming[] {
  const fromWords = (data.words || [])
    .map((word) => ({
      word: String(word.word || "").trim(),
      start: Number(word.start),
      end: Number(word.end),
    }))
    .filter(
      (word) =>
        word.word &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start
    )
  if (fromWords.length) return fromWords

  const fromSegments: WordTiming[] = []
  for (const segment of data.segments || []) {
    if (segment.words?.length) {
      for (const word of segment.words) {
        const start = Number(word.start)
        const end = Number(word.end)
        const text = String(word.word || "").trim()
        if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
          fromSegments.push({ word: text, start, end })
        }
      }
      continue
    }
    const text = String(segment.text || "").trim()
    const start = Number(segment.start)
    const end = Number(segment.end)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const parts = text.split(/\s+/).filter(Boolean)
    if (!parts.length) continue
    const span = end - start
    parts.forEach((part, index) => {
      fromSegments.push({
        word: part,
        start: start + (span * index) / parts.length,
        end: start + (span * (index + 1)) / parts.length,
      })
    })
  }
  return fromSegments
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.formData()
    const audio = input.get("audio")
    const apiKey = (
      String(input.get("apiKey") || "").trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.GPT_API_KEY?.trim() ||
      process.env.CHATGPT_API_KEY?.trim() ||
      ""
    )
    const script = String(input.get("script") || "").trim()

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "정렬할 오디오 파일이 필요합니다." }, { status: 400 })
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API 키가 필요합니다. 설정에 shotform_openai_api_key를 등록하거나 서버 OPENAI_API_KEY를 설정해주세요.",
        },
        { status: 400 }
      )
    }

    const body = new FormData()
    body.append("file", audio, audio.name || "tts.wav")
    body.append("model", "whisper-1")
    body.append("language", "ko")
    body.append("response_format", "verbose_json")
    body.append("timestamp_granularities[]", "word")
    body.append("timestamp_granularities[]", "segment")
    body.append("temperature", "0")
    if (script) body.append("prompt", script.slice(0, 1500))

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json(
        { error: `음성·자막 정렬 실패 (${response.status}): ${errorText.slice(0, 300)}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as {
      words?: Array<{ word?: string; start?: number; end?: number }>
      segments?: Array<{
        start?: number
        end?: number
        text?: string
        words?: Array<{ word?: string; start?: number; end?: number }>
      }>
      text?: string
    }

    const rawWords = extractWordsFromResponse(data)
    if (rawWords.length === 0) {
      return NextResponse.json({ error: "단어 타임스탬프를 찾지 못했습니다." }, { status: 422 })
    }

    // 정답 대본 토큰에 Whisper 시각을 강제 매칭 → 클라이언트 줄 분할이 더 정확해짐
    const words = script ? forceAlignScriptWords(script, rawWords) : rawWords

    return NextResponse.json({
      success: true,
      words,
      rawWords,
      text: data.text || "",
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "음성·자막 정렬 실패" },
      { status: 500 }
    )
  }
}
