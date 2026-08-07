import { NextRequest, NextResponse } from "next/server"
import { fetchYoutubeTranscriptTimed } from "@/lib/youtube-transcript"

export const runtime = "nodejs"
export const maxDuration = 60

function extractYoutubeId(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  if (/^[\w-]{11}$/.test(t)) return t
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`)
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0]
      return id && id.length === 11 ? id : null
    }
    const v = u.searchParams.get("v")
    if (v && v.length === 11) return v
    const embed = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)
    if (embed) return embed[1]
  } catch {
    /* ignore */
  }
  return null
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`
  return `${m}:${String(r).padStart(2, "0")}`
}

type ClipCandidate = {
  id: string
  rank: number
  title: string
  hook: string
  startSec: number
  endSec: number
  durationSec: number
  score: number
  reason: string
  transcriptSnippet: string
  youtubeWatchUrl: string
}

async function fetchVideoMeta(videoId: string): Promise<{
  title: string
  author: string
  thumbnail: string
  durationSec: number | null
}> {
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { next: { revalidate: 0 } }
    )
    if (oembed.ok) {
      const data = (await oembed.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
      return {
        title: data.title || "YouTube 영상",
        author: data.author_name || "",
        thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSec: null,
      }
    }
  } catch {
    /* ignore */
  }
  return {
    title: "YouTube 영상",
    author: "",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationSec: null,
  }
}

function buildChunkedTranscript(
  segments: Array<{ startSec: number; endSec: number; text: string }>,
  chunkSec = 45
): Array<{ startSec: number; endSec: number; text: string }> {
  if (!segments.length) return []
  const chunks: Array<{ startSec: number; endSec: number; text: string }> = []
  let buf: string[] = []
  let start = segments[0].startSec
  let end = segments[0].endSec

  for (const seg of segments) {
    if (seg.startSec - start >= chunkSec && buf.length > 0) {
      chunks.push({ startSec: start, endSec: end, text: buf.join(" ").trim() })
      buf = []
      start = seg.startSec
    }
    buf.push(seg.text)
    end = seg.endSec
  }
  if (buf.length) chunks.push({ startSec: start, endSec: end, text: buf.join(" ").trim() })
  return chunks.filter((c) => c.text.length >= 40)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const url = String(body.url || body.videoUrl || "").trim()
    const openaiApiKey = String(body.openaiApiKey || body.apiKey || "").trim()
    const maxClips = Math.min(12, Math.max(3, Number(body.maxClips) || 8))
    const targetDuration = Math.min(90, Math.max(15, Number(body.targetDurationSec) || 45))

    const videoId = extractYoutubeId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: "유효한 YouTube URL 또는 영상 ID를 입력해주세요." },
        { status: 400 }
      )
    }
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 필요합니다. ShotForm 설정에서 입력해주세요." },
        { status: 400 }
      )
    }

    const [meta, segments] = await Promise.all([
      fetchVideoMeta(videoId),
      fetchYoutubeTranscriptTimed(videoId),
    ])

    if (segments.length < 5) {
      return NextResponse.json(
        {
          error:
            "이 영상의 자막을 가져오지 못했습니다. 자막(자동생성 포함)이 있는 YouTube 영상만 지원합니다.",
          videoId,
          meta,
        },
        { status: 422 }
      )
    }

    const chunks = buildChunkedTranscript(segments, Math.max(30, Math.floor(targetDuration * 0.85)))
    const timeline = chunks
      .slice(0, 80)
      .map(
        (c, i) =>
          `[#${i + 1}] ${formatTime(c.startSec)}–${formatTime(c.endSec)}\n${c.text.slice(0, 420)}`
      )
      .join("\n\n")

    const prompt = `당신은 OpusClip 스타일의 바이럴 숏폼 편집 전문가입니다.
긴 YouTube 영상의 타임라인 자막을 보고, 쇼츠/릴스에 적합한 하이라이트 구간을 ${maxClips}개 골라주세요.

목표 클립 길이: 약 ${targetDuration}초 (허용 범위 ${Math.floor(targetDuration * 0.6)}~${Math.ceil(targetDuration * 1.3)}초)
영상 제목: ${meta.title}
채널: ${meta.author || "(알 수 없음)"}

선택 기준:
1) 호기심/반전/감정/유머/핵심 주장처럼 스크롤을 멈추게 하는 훅
2) 단독으로 봐도 맥락이 통하는 구간
3) 비슷한 구간 중복 금지
4) startSec/endSec는 아래 타임라인의 실제 시각을 기준으로 보정

타임라인:
${timeline.slice(0, 14000)}

반드시 JSON만 출력:
{
  "clips": [
    {
      "title": "숏폼용 제목 (훅, 20자 내외)",
      "hook": "첫 1초에 띄울 한 줄",
      "startSec": 12.5,
      "endSec": 52.0,
      "score": 0부터 100,
      "reason": "왜 바이럴인지 한 줄"
    }
  ]
}`

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: "You analyze long-form video transcripts and return viral short-form clip ranges as JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "")
      return NextResponse.json(
        { error: `클립 분석 실패: ${aiRes.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices?.[0]?.message?.content || "{}"
    let parsed: { clips?: Array<Record<string, unknown>> } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "AI 응답 JSON 파싱 실패" }, { status: 502 })
    }

    const videoEnd = segments[segments.length - 1]?.endSec || 3600
    const clips: ClipCandidate[] = (parsed.clips || [])
      .map((c, i) => {
        let startSec = Number(c.startSec) || 0
        let endSec = Number(c.endSec) || startSec + targetDuration
        if (endSec <= startSec) endSec = startSec + targetDuration
        startSec = Math.max(0, Math.min(startSec, videoEnd - 5))
        endSec = Math.max(startSec + 8, Math.min(endSec, videoEnd))
        const durationSec = Math.round((endSec - startSec) * 10) / 10
        const snippet = segments
          .filter((s) => s.startSec >= startSec - 0.5 && s.startSec <= endSec + 0.5)
          .map((s) => s.text)
          .join(" ")
          .slice(0, 280)
        return {
          id: `clip_${videoId}_${i}_${Math.floor(startSec)}`,
          rank: i + 1,
          title: String(c.title || `클립 ${i + 1}`).trim(),
          hook: String(c.hook || "").trim(),
          startSec: Math.round(startSec * 10) / 10,
          endSec: Math.round(endSec * 10) / 10,
          durationSec,
          score: Math.max(0, Math.min(100, Number(c.score) || 70)),
          reason: String(c.reason || "").trim(),
          transcriptSnippet: snippet,
          youtubeWatchUrl: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startSec)}s`,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxClips)
      .map((c, i) => ({ ...c, rank: i + 1 }))

    if (!clips.length) {
      return NextResponse.json({ error: "클립 후보를 찾지 못했습니다. 다른 영상을 시도해주세요." }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      meta: {
        ...meta,
        durationSec: meta.durationSec ?? Math.round(videoEnd),
      },
      segmentCount: segments.length,
      clips,
    })
  } catch (e) {
    console.error("[longform-clips]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "클립 생성 중 오류" },
      { status: 500 }
    )
  }
}
