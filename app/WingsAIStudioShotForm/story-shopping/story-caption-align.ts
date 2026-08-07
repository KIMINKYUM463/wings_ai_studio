/**
 * 스토리 쇼핑: 장면 통 TTS ↔ 의미 단위 자막 싱크
 * Whisper word timestamps로 각 자막 줄의 start/end 를 계산합니다.
 */

export type AlignedWord = { word: string; start: number; end: number }

export type CaptionTimingCue = {
  lineIndex: number
  text: string
  startSec: number
  endSec: number
  alignmentSource: "whisper" | "estimated"
}

/** 비교용: 공백·따옴표·문장부호 제거 */
function normalizeAlignText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\s"'“”‘’·.,!?~\-–—…\[\](){}<>/\\|:;·•]/g, "")
    .toLowerCase()
}

function charWeight(value: string): number {
  return Math.max(1, normalizeAlignText(value).length || value.replace(/\s/g, "").length || 1)
}

/** 글자 수 비율 폴백 (Whisper 실패 시에만) */
export function buildEstimatedCaptionCues(
  lines: string[],
  durationSec: number
): CaptionTimingCue[] {
  const safeLines = lines.length ? lines : [""]
  const total = Math.max(0.8, durationSec || safeLines.length * 1.5)
  const weights = safeLines.map((text) => Math.max(8, text.length))
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1
  let cursor = 0
  return safeLines.map((text, lineIndex) => {
    const share = total * (weights[lineIndex]! / weightSum)
    const startSec = cursor
    const endSec =
      lineIndex === safeLines.length - 1 ? total : cursor + Math.max(0.45, share)
    cursor = endSec
    return {
      lineIndex,
      text,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
      alignmentSource: "estimated" as const,
    }
  })
}

/**
 * Whisper 단어열 → 자막 줄 매핑 (강제 정렬).
 * 핵심: 글자 수 비율이 아니라, 정답 대본의 각 글자를 Whisper 발화 시각에 붙입니다.
 */
export function alignMeaningLinesToWhisperWords(
  lines: string[],
  words: AlignedWord[],
  durationSec?: number,
  fullScript?: string
): CaptionTimingCue[] | null {
  const safeLines = lines.map((text) => text.trim()).filter(Boolean)
  if (!safeLines.length || !words.length) return null

  const lastEnd = words[words.length - 1]?.end
  const audioEnd =
    Number.isFinite(durationSec) && (durationSec as number) > 0
      ? (durationSec as number)
      : Number.isFinite(lastEnd)
        ? Number(lastEnd)
        : undefined

  const script = (fullScript || safeLines.join("")).trim()
  const byForced = alignByForcedCharDtw(safeLines, script, words, audioEnd)
  if (byForced?.length) return byForced

  const bySubstring = alignBySubstringSearch(safeLines, words, audioEnd)
  if (bySubstring) return bySubstring

  return alignByCharacterWeight(safeLines, words, audioEnd)
}

type TimedChar = { char: string; start: number; end: number }

/** Whisper 단어를 글자 단위로 펼치고, 단어 구간을 글자에 균등 분배 */
function expandWordsToTimedChars(words: AlignedWord[]): TimedChar[] {
  const out: TimedChar[] = []
  for (const word of words) {
    const chars = Array.from(normalizeAlignText(word.word))
    if (!chars.length) continue
    const span = Math.max(0.04, word.end - word.start)
    chars.forEach((char, index) => {
      const start = word.start + (span * index) / chars.length
      const end = word.start + (span * (index + 1)) / chars.length
      out.push({ char, start, end })
    })
  }
  return out
}

/**
 * Needleman–Wunsch로 정답 대본 글자 ↔ Whisper 발화 글자를 맞춥니다.
 * TTS는 대본이 확정이라, 전사 오타가 있어도 대본 순서를 기준으로 시간을 붙입니다.
 */
function forceAlignScriptChars(
  scriptChars: string[],
  timed: TimedChar[]
): Array<{ start: number; end: number }> {
  const n = scriptChars.length
  const m = timed.length
  if (!n) return []
  if (!m) {
    return scriptChars.map(() => ({ start: 0, end: 0.2 }))
  }

  const MATCH = 0
  const MISMATCH = 1
  const GAP = 1
  const dp: Float64Array[] = Array.from({ length: n + 1 }, () =>
    new Float64Array(m + 1).fill(1e12)
  )
  const bt: Uint8Array[] = Array.from({ length: n + 1 }, () =>
    new Uint8Array(m + 1)
  )
  // 0=diag, 1=up(script gap / whisper skip), 2=left(whisper gap / script skip→reuse time)

  dp[0]![0] = 0
  for (let i = 1; i <= n; i += 1) {
    dp[i]![0] = i * GAP
    bt[i]![0] = 2
  }
  for (let j = 1; j <= m; j += 1) {
    dp[0]![j] = j * GAP
    bt[0]![j] = 1
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost =
        scriptChars[i - 1] === timed[j - 1]!.char ? MATCH : MISMATCH
      const diag = dp[i - 1]![j - 1]! + cost
      const up = dp[i - 1]![j]! + GAP
      const left = dp[i]![j - 1]! + GAP
      if (diag <= up && diag <= left) {
        dp[i]![j] = diag
        bt[i]![j] = 0
      } else if (up <= left) {
        dp[i]![j] = up
        bt[i]![j] = 2
      } else {
        dp[i]![j] = left
        bt[i]![j] = 1
      }
    }
  }

  const aligned: Array<{ start: number; end: number } | null> = Array(n).fill(
    null
  )
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const dir = bt[i]![j]!
    if (i > 0 && j > 0 && dir === 0) {
      aligned[i - 1] = {
        start: timed[j - 1]!.start,
        end: timed[j - 1]!.end,
      }
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || dir === 1)) {
      j -= 1
    } else if (i > 0) {
      // 대본 글자에 Whisper 짝이 없음 → 근처 시각으로 채움
      const nearby =
        j < m
          ? timed[Math.min(m - 1, j)]
          : timed[Math.max(0, m - 1)]
      aligned[i - 1] = nearby
        ? { start: nearby.start, end: nearby.end }
        : { start: 0, end: 0.2 }
      i -= 1
    } else {
      break
    }
  }

  // null 메우기 + 단조 증가
  const result: Array<{ start: number; end: number }> = []
  let last = { start: timed[0]!.start, end: timed[0]!.end }
  for (let idx = 0; idx < n; idx += 1) {
    const hit = aligned[idx]
    if (hit) {
      last = hit
      result.push({ ...hit })
    } else {
      result.push({ ...last })
    }
  }
  for (let idx = 1; idx < result.length; idx += 1) {
    if (result[idx]!.start < result[idx - 1]!.start) {
      result[idx] = { ...result[idx - 1]! }
    }
  }
  return result
}

/** 정답 대본 기준으로 줄 경계를 자르고, DTW로 붙인 시각을 사용 */
function alignByForcedCharDtw(
  lines: string[],
  fullScript: string,
  words: AlignedWord[],
  audioEnd?: number
): CaptionTimingCue[] | null {
  const timed = expandWordsToTimedChars(words)
  if (!timed.length) return null

  const scriptChars = Array.from(normalizeAlignText(fullScript))
  if (!scriptChars.length) return null

  const alignedTimes = forceAlignScriptChars(scriptChars, timed)
  if (alignedTimes.length !== scriptChars.length) return null

  // 각 줄이 대본에서 차지하는 글자 구간 (순서대로)
  const lineRanges: Array<{ lineIndex: number; text: string; start: number; end: number }> =
    []
  let cursor = 0
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex]!
    const needle = Array.from(normalizeAlignText(text))
    if (!needle.length) continue

    let start = cursor
    // 커서부터 needle 탐색 (표기 차이 시 앞에서부터 최대한)
    let found = -1
    const hay = scriptChars
    outer: for (let s = cursor; s <= hay.length - needle.length; s += 1) {
      for (let k = 0; k < needle.length; k += 1) {
        if (hay[s + k] !== needle[k]) continue outer
      }
      found = s
      break
    }
    if (found < 0) {
      // 부분 일치
      const minLen = Math.max(2, Math.floor(needle.length * 0.6))
      outer2: for (let len = needle.length; len >= minLen; len -= 1) {
        for (let s = cursor; s <= hay.length - len; s += 1) {
          let ok = true
          for (let k = 0; k < len; k += 1) {
            if (hay[s + k] !== needle[k]) {
              ok = false
              break
            }
          }
          if (ok) {
            found = s
            start = s
            const end = Math.min(hay.length - 1, s + len - 1)
            lineRanges.push({ lineIndex, text, start, end })
            cursor = end + 1
            found = -2 // marker: handled
            break outer2
          }
        }
      }
      if (found === -2) continue
      // 완전 실패: 남은 글자를 균등 분할
      const remainLines = lines.length - lineIndex
      const remainChars = Math.max(1, hay.length - cursor)
      const take = Math.max(1, Math.floor(remainChars / remainLines))
      start = cursor
      const end = Math.min(hay.length - 1, start + take - 1)
      lineRanges.push({ lineIndex, text, start, end })
      cursor = end + 1
      continue
    }

    start = found
    const end = Math.min(hay.length - 1, found + needle.length - 1)
    lineRanges.push({ lineIndex, text, start, end })
    cursor = end + 1
  }

  if (!lineRanges.length) return null

  const cues: CaptionTimingCue[] = lineRanges.map((range) => {
    const startSec = alignedTimes[range.start]?.start ?? 0
    const endSec = alignedTimes[range.end]?.end ?? startSec + 0.2
    return {
      lineIndex: range.lineIndex,
      text: range.text,
      startSec: Number(Math.max(0, startSec).toFixed(3)),
      endSec: Number(Math.max(startSec + 0.08, endSec).toFixed(3)),
      alignmentSource: "whisper" as const,
    }
  })

  return normalizeCaptionTimingCues(cues, audioEnd)
}

/** 정규화 대본을 Whisper 전사 문자열에서 찾아 단어 구간으로 환산 */
function alignBySubstringSearch(
  lines: string[],
  words: AlignedWord[],
  audioEnd?: number
): CaptionTimingCue[] | null {
  type CharMap = { wordIndex: number }
  const charMap: CharMap[] = []
  let transcript = ""

  words.forEach((word, wordIndex) => {
    const plain = normalizeAlignText(word.word)
    for (let i = 0; i < plain.length; i += 1) {
      transcript += plain[i]
      charMap.push({ wordIndex })
    }
  })

  if (!transcript.length) return null

  const cues: CaptionTimingCue[] = []
  let cursor = 0
  let matchedChars = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex]!
    const needle = normalizeAlignText(text)
    if (!needle) continue

    let startChar = transcript.indexOf(needle, cursor)
    if (startChar < 0 && needle.length >= 4) {
      const minLen = Math.max(3, Math.floor(needle.length * 0.7))
      for (let len = needle.length; len >= minLen; len -= 1) {
        const partial = needle.slice(0, len)
        const found = transcript.indexOf(partial, cursor)
        if (found >= 0) {
          startChar = found
          break
        }
      }
    }
    if (startChar < 0) {
      const remainLines = lines.length - lineIndex
      const remainChars = Math.max(1, transcript.length - cursor)
      const take = Math.max(1, Math.floor(remainChars / remainLines))
      startChar = cursor
      const endChar = Math.min(transcript.length - 1, startChar + take - 1)
      const startWord = charMap[startChar]?.wordIndex ?? 0
      const endWord = charMap[endChar]?.wordIndex ?? words.length - 1
      const startSec = words[startWord]?.start ?? 0
      const endSec =
        lineIndex === lines.length - 1 && audioEnd != null
          ? audioEnd
          : words[endWord]?.end ?? startSec + 0.4
      cues.push({
        lineIndex,
        text,
        startSec: Number(Math.max(0, startSec).toFixed(3)),
        endSec: Number(Math.max(startSec + 0.12, endSec).toFixed(3)),
        alignmentSource: "whisper",
      })
      cursor = endChar + 1
      matchedChars += take
      continue
    }

    const endChar = Math.min(transcript.length - 1, startChar + needle.length - 1)
    const startWord = charMap[startChar]?.wordIndex ?? 0
    const endWord = charMap[endChar]?.wordIndex ?? words.length - 1
    const startSec = words[startWord]?.start ?? 0
    let endSec = words[endWord]?.end ?? startSec + 0.4
    if (lineIndex === lines.length - 1 && audioEnd != null) {
      endSec = Math.min(endSec, audioEnd)
    }

    cues.push({
      lineIndex,
      text,
      startSec: Number(Math.max(0, startSec).toFixed(3)),
      endSec: Number(Math.max(startSec + 0.12, endSec).toFixed(3)),
      alignmentSource: "whisper",
    })
    cursor = endChar + 1
    matchedChars += needle.length
  }

  if (!cues.length) return null
  if (matchedChars < transcript.length * 0.35 && lines.length > 1) return null

  return ensureMonotonicCues(cues, audioEnd)
}

/** 줄 글자 비중 ↔ Whisper 단어 글자 비중으로 구간 분할 (최후 폴백) */
function alignByCharacterWeight(
  lines: string[],
  words: AlignedWord[],
  audioEnd?: number
): CaptionTimingCue[] {
  const phraseWeights = lines.map((text) => charWeight(text))
  const wordWeights = words.map((word) => charWeight(word.word))
  const totalPhrase = phraseWeights.reduce((sum, w) => sum + w, 0) || 1
  const totalWord = wordWeights.reduce((sum, w) => sum + w, 0) || 1

  const cues: CaptionTimingCue[] = []
  let phraseWeightCursor = 0
  let wordStartIndex = 0
  let wordWeightCursor = 0

  lines.forEach((text, lineIndex) => {
    phraseWeightCursor += phraseWeights[lineIndex]!
    const targetWordWeight = (phraseWeightCursor / totalPhrase) * totalWord
    let wordEndIndex = wordStartIndex
    while (
      wordEndIndex < words.length - 1 &&
      wordWeightCursor + wordWeights[wordEndIndex]! < targetWordWeight
    ) {
      wordWeightCursor += wordWeights[wordEndIndex]!
      wordEndIndex += 1
    }
    const first = words[wordStartIndex]
    const last = words[wordEndIndex]
    const startSec = first?.start ?? 0
    let endSec = last?.end ?? startSec + 0.4
    if (lineIndex === lines.length - 1 && audioEnd != null) {
      endSec = Math.min(Math.max(endSec, startSec + 0.12), audioEnd)
    }
    cues.push({
      lineIndex,
      text,
      startSec: Number(Math.max(0, startSec).toFixed(3)),
      endSec: Number(Math.max(startSec + 0.12, endSec).toFixed(3)),
      alignmentSource: "whisper",
    })
    wordWeightCursor += wordWeights[wordEndIndex] || 0
    wordStartIndex = Math.min(words.length - 1, wordEndIndex + 1)
  })

  return ensureMonotonicCues(cues, audioEnd)
}

/**
 * 자막 큐를 실제 오디오 길이에 맞게 정규화합니다.
 * - 모든 시각을 [0, audioEnd]로 클램프 (Whisper가 오디오보다 길게 주는 경우 방지)
 * - 줄 사이 공백(gap)을 메워 재생 중 자막이 튀지 않게 함
 * - 첫 줄 0초 시작, 마지막 줄은 오디오 끝
 */
export function normalizeCaptionTimingCues(
  cues: CaptionTimingCue[],
  audioEnd?: number
): CaptionTimingCue[] {
  if (!cues.length) return cues

  const whisperLast = Math.max(...cues.map((cue) => cue.endSec), 0.2)
  const limit =
    Number.isFinite(audioEnd) && (audioEnd as number) > 0.05
      ? (audioEnd as number)
      : whisperLast

  const next = cues.map((cue, index) => {
    const startSec = Math.max(0, Math.min(limit, cue.startSec))
    const endSec = Math.max(startSec + 0.08, Math.min(limit, cue.endSec))
    return {
      ...cue,
      lineIndex: cue.lineIndex ?? index,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
    }
  })

  next.sort((a, b) => a.lineIndex - b.lineIndex || a.startSec - b.startSec)
  next[0]!.startSec = 0

  for (let i = 0; i < next.length - 1; i += 1) {
    const cur = next[i]!
    const nxt = next[i + 1]!
    // 겹치면 중간에서 자르고, 공백이면 앞 줄 end를 다음 start까지 연장
    if (nxt.startSec < cur.endSec) {
      const mid = (cur.startSec + nxt.endSec) / 2
      cur.endSec = Number(Math.max(cur.startSec + 0.08, mid).toFixed(3))
      nxt.startSec = cur.endSec
    } else if (nxt.startSec > cur.endSec) {
      cur.endSec = nxt.startSec
    }
    if (nxt.endSec <= nxt.startSec) {
      nxt.endSec = Number((nxt.startSec + 0.12).toFixed(3))
    }
  }

  const last = next[next.length - 1]!
  last.endSec = Number(Math.max(last.startSec + 0.08, limit).toFixed(3))

  // 클램프 후 역전된 구간 한 번 더 정리
  for (let i = 0; i < next.length; i += 1) {
    const cue = next[i]!
    cue.startSec = Number(Math.max(0, Math.min(limit, cue.startSec)).toFixed(3))
    cue.endSec = Number(
      Math.max(cue.startSec + 0.08, Math.min(limit, cue.endSec)).toFixed(3)
    )
  }

  return next
}

/** @deprecated 이름 호환 — normalizeCaptionTimingCues 사용 */
function ensureMonotonicCues(
  cues: CaptionTimingCue[],
  audioEnd?: number
): CaptionTimingCue[] {
  return normalizeCaptionTimingCues(cues, audioEnd)
}

async function audioUrlToFile(audioUrl: string, filename = "story-tts.wav"): Promise<File> {
  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error("TTS 오디오를 불러오지 못했습니다.")
  }
  const blob = await response.blob()
  const type = blob.type || "audio/wav"
  const name =
    type.includes("mpeg") || type.includes("mp3")
      ? filename.replace(/\.wav$/i, ".mp3")
      : filename
  return new File([blob], name, { type })
}

function resolveOpenAiKey(): string {
  if (typeof window === "undefined") return ""
  return (
    localStorage.getItem("shotform_openai_api_key") ||
    localStorage.getItem("openai_api_key") ||
    ""
  ).trim()
}

/**
 * Whisper(OpenAI)로 장면 TTS 단어 타임스탬프 추출 후 자막 줄 타이밍 생성.
 * apiKey가 비어 있어도 서버 env(OPENAI_API_KEY) 폴백을 시도합니다.
 */
export async function alignStoryCaptionsWithWhisper(opts: {
  audioUrl: string
  script: string
  lines: string[]
  durationSec?: number
  apiKey?: string
}): Promise<CaptionTimingCue[]> {
  const apiKey = (opts.apiKey ?? resolveOpenAiKey()).trim()
  const file = await audioUrlToFile(opts.audioUrl)
  const form = new FormData()
  form.append("audio", file)
  form.append("script", opts.script)
  if (apiKey) form.append("apiKey", apiKey)

  const response = await fetch("/api/shotform/align-subtitles", {
    method: "POST",
    body: form,
  })
  const data = (await response.json().catch(() => ({}))) as {
    words?: AlignedWord[]
    error?: string
  }
  if (!response.ok || !data.words?.length) {
    throw new Error(
      data.error ||
        "Whisper 자막 싱크 분석에 실패했습니다. OpenAI API 키를 확인해주세요."
    )
  }

  const aligned = alignMeaningLinesToWhisperWords(
    opts.lines,
    data.words,
    opts.durationSec,
    opts.script
  )
  if (!aligned?.length) {
    throw new Error("Whisper 결과를 자막 줄에 매핑하지 못했습니다.")
  }

  const whisperAudioEnd = Math.max(
    ...data.words.map((word) => word.end),
    0.2
  )
  // 브라우저 측정 길이와 Whisper 끝 중 더 신뢰할 수 있는 쪽을 고릅니다.
  // (측정값이 Whisper보다 크게 부풀면 자막 end가 오디오를 초과함)
  let audioEnd = opts.durationSec
  if (!audioEnd || !Number.isFinite(audioEnd) || audioEnd <= 0) {
    audioEnd = whisperAudioEnd
  } else if (audioEnd > whisperAudioEnd + 0.75) {
    // metadata가 과도하게 긴 경우 Whisper 끝을 우선
    audioEnd = whisperAudioEnd
  } else if (whisperAudioEnd > audioEnd + 0.35) {
    // Whisper가 살짝 넘치면 실제 재생 길이로 클램프
    audioEnd = audioEnd
  }

  return normalizeCaptionTimingCues(aligned, audioEnd)
}

/**
 * 무음 트림된 오디오에 맞춰 Whisper 큐 시각을 보정합니다.
 * (원본 기준 start/end − 앞쪽 잘린 초 → 트림본 duration으로 정규화)
 */
export function shiftCaptionCuesForTrim(
  cues: Array<{
    lineIndex: number
    text: string
    startSec: number
    endSec: number
    alignmentSource?: "whisper" | "estimated"
  }>,
  trimStartSec: number,
  trimmedDurationSec: number
): CaptionTimingCue[] {
  const offset = Math.max(0, trimStartSec || 0)
  const shifted = cues.map((cue) => ({
    lineIndex: cue.lineIndex,
    text: cue.text,
    startSec: cue.startSec - offset,
    endSec: cue.endSec - offset,
    alignmentSource: (cue.alignmentSource || "whisper") as "whisper" | "estimated",
  }))
  return normalizeCaptionTimingCues(shifted, trimmedDurationSec)
}
