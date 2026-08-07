import { NextRequest, NextResponse } from "next/server"

type MashupLineIn = {
  sceneId: string
  lineIndex: number
  text: string
  visualPrompt?: string
  durationSec: number
}

type MashupPoolIn = {
  id: string
  title: string
  mediaType: "image" | "video"
  durationSec?: number
  source?: string
  frames?: Array<{ timeSec: number; keyframeDataUrl: string }>
}

type AssignmentOut = {
  sceneId: string
  lineIndex: number
  poolItemId: string
  trimStartSec: number
  trimEndSec: number
  reason: string
}

function roundRobin(
  lines: MashupLineIn[],
  pool: MashupPoolIn[]
): AssignmentOut[] {
  if (!pool.length) return []
  return lines.map((line, index) => {
    const item = pool[index % pool.length]!
    const mediaDur = Math.max(line.durationSec, item.durationSec || line.durationSec)
    const maxStart = Math.max(0, mediaDur - line.durationSec)
    const start = item.mediaType === "video" ? (index * 1.37) % Math.max(0.05, maxStart || 0.05) : 0
    return {
      sceneId: line.sceneId,
      lineIndex: line.lineIndex,
      poolItemId: item.id,
      trimStartSec: Number(start.toFixed(2)),
      trimEndSec: Number((start + line.durationSec).toFixed(2)),
      reason: "라운드로빈 배치",
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const productName = String(body.productName || "").trim()
    const productDescription = String(body.productDescription || "").trim()
    const lines = (Array.isArray(body.lines) ? body.lines : []) as MashupLineIn[]
    const pool = (Array.isArray(body.pool) ? body.pool : []) as MashupPoolIn[]
    const openAiKey =
      String(body.openaiApiKey || "").trim() ||
      process.env.OPENAI_API_KEY ||
      process.env.GPT_API_KEY ||
      process.env.CHATGPT_API_KEY ||
      ""

    if (!lines.length) {
      return NextResponse.json({ error: "배치할 대본 줄이 없습니다." }, { status: 400 })
    }
    if (!pool.length) {
      return NextResponse.json({ error: "담아둔 소재 풀이 비어 있습니다." }, { status: 400 })
    }

    if (!openAiKey) {
      return NextResponse.json({
        success: true,
        mode: "fallback",
        assignments: roundRobin(lines, pool),
      })
    }

    const poolSummary = pool.map(({ frames, ...item }) => ({
      ...item,
      frameTimes: (frames || []).map((frame) => frame.timeSec),
    }))
    const visionContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: JSON.stringify({
          productName,
          productDescription,
          lines,
          pool: poolSummary,
        }),
      },
    ]
    for (const item of pool) {
      for (const frame of (item.frames || []).slice(0, 20)) {
        if (!frame.keyframeDataUrl.startsWith("data:image/")) continue
        visionContent.push({
          type: "text",
          text: `POOL ${item.id} · FRAME ${frame.timeSec.toFixed(1)}초`,
        })
        visionContent.push({
          type: "image_url",
          image_url: { url: frame.keyframeDataUrl, detail: "low" },
        })
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 4500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a short-form video editor. Assign pool clips to narration lines.
Return JSON:
{
  "assignments": [
    {
      "sceneId": "string",
      "lineIndex": 0,
      "poolItemId": "string",
      "trimStartSec": 0,
      "trimEndSec": 2.5,
      "reason": "short korean why"
    }
  ]
}
Rules:
- Every input line MUST appear exactly once.
- Inspect the labeled POOL/FRAME images directly and match visible product, action, place, emotion and situation to line text / visualPrompt.
- Choose sourceStart around the best matching frame and return a continuous window.
- For video: trimEndSec - trimStartSec MUST be at least line.durationSec and should exceed it by no more than 0.35s.
- trimStartSec >= 0 and trimEndSec <= pool duration when known.
- Never reuse the same or overlapping source interval for different lines.
- Alternate source videos when multiple suitable videos exist.
- Reject text-dominant, talking-head, unrelated, blank, transition and product-absent intervals.
- Prefer product demonstration and hand-action frames that semantically match the narration.
- Do not invent poolItemId values; only use provided ids.`,
          },
          {
            role: "user",
            content: visionContent,
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        mode: "fallback",
        assignments: roundRobin(lines, pool),
        warning: "AI 배치 실패 → 폴백 적용",
      })
    }

    const data = await response.json()
    const raw = String(data.choices?.[0]?.message?.content || "").trim()
    const parsed = JSON.parse(raw) as { assignments?: AssignmentOut[] }
    const poolIds = new Set(pool.map((item) => item.id))
    const lineKeys = new Set(lines.map((line) => `${line.sceneId}:${line.lineIndex}`))
    const usedIntervals = new Map<
      string,
      Array<{ start: number; end: number }>
    >()
    const findFreeWindow = (
      item: MashupPoolIn,
      preferredStart: number,
      duration: number
    ): { start: number; end: number } | null => {
      const mediaDuration = Math.max(duration, item.durationSec || duration)
      const maxStart = Math.max(0, mediaDuration - duration)
      const candidates = [
        preferredStart,
        ...(item.frames || []).map((frame) => frame.timeSec - duration / 2),
      ]
      for (let cursor = 0; cursor <= maxStart; cursor += duration + 0.08) {
        candidates.push(cursor)
      }
      const used = usedIntervals.get(item.id) || []
      const starts = [...new Set(
        candidates.map((value) =>
          Number(Math.max(0, Math.min(maxStart, value)).toFixed(2))
        )
      )].sort(
        (a, b) =>
          Math.abs(a - preferredStart) - Math.abs(b - preferredStart)
      )
      for (const start of starts) {
        const end = start + duration
        const overlaps = used.some(
          (interval) =>
            start < interval.end - 0.04 && end > interval.start + 0.04
        )
        if (!overlaps) return { start, end }
      }
      return null
    }
    const assignments = (parsed.assignments || [])
      .filter(
        (item) =>
          poolIds.has(item.poolItemId) &&
          lineKeys.has(`${item.sceneId}:${item.lineIndex}`)
      )
      .map((item) => {
        const line = lines.find(
          (entry) => entry.sceneId === item.sceneId && entry.lineIndex === item.lineIndex
        )!
        const preferredStart = Math.max(0, Number(item.trimStartSec) || 0)
        const requestedEnd = Number(item.trimEndSec)
        const requestedDuration =
          Number.isFinite(requestedEnd) && requestedEnd > preferredStart
            ? requestedEnd - preferredStart
            : line.durationSec
        const requiredDuration = Math.max(
          0.35,
          line.durationSec,
          Math.min(line.durationSec + 0.35, requestedDuration)
        )
        const requestedPool = pool.find(
          (entry) => entry.id === item.poolItemId
        )!
        let selectedPool = requestedPool
        let window = findFreeWindow(
          requestedPool,
          preferredStart,
          requiredDuration
        )
        if (!window) {
          for (const alternative of pool) {
            if (alternative.id === requestedPool.id) continue
            window = findFreeWindow(
              alternative,
              preferredStart,
              requiredDuration
            )
            if (window) {
              selectedPool = alternative
              break
            }
          }
        }
        if (!window) {
          const mediaDuration = Math.max(
            requiredDuration,
            requestedPool.durationSec || requiredDuration
          )
          const start = Math.min(
            preferredStart,
            Math.max(0, mediaDuration - requiredDuration)
          )
          window = { start, end: start + requiredDuration }
        }
        usedIntervals.set(selectedPool.id, [
          ...(usedIntervals.get(selectedPool.id) || []),
          window,
        ])
        return {
          sceneId: item.sceneId,
          lineIndex: item.lineIndex,
          poolItemId: selectedPool.id,
          trimStartSec: Number(window.start.toFixed(2)),
          trimEndSec: Number(window.end.toFixed(2)),
          reason: String(item.reason || "AI 배치"),
        }
      })

    // 누락 줄은 폴백으로 채움
    const covered = new Set(assignments.map((item) => `${item.sceneId}:${item.lineIndex}`))
    const missing = lines.filter((line) => !covered.has(`${line.sceneId}:${line.lineIndex}`))
    const missingAssignments = roundRobin(missing, pool).map((assignment) => {
      const line = missing.find(
        (item) =>
          item.sceneId === assignment.sceneId &&
          item.lineIndex === assignment.lineIndex
      )!
      let selectedPool =
        pool.find((item) => item.id === assignment.poolItemId) || pool[0]!
      let window = findFreeWindow(
        selectedPool,
        assignment.trimStartSec,
        Math.max(0.35, line.durationSec)
      )
      if (!window) {
        for (const alternative of pool) {
          window = findFreeWindow(
            alternative,
            assignment.trimStartSec,
            Math.max(0.35, line.durationSec)
          )
          if (window) {
            selectedPool = alternative
            break
          }
        }
      }
      if (!window) {
        window = {
          start: assignment.trimStartSec,
          end: assignment.trimStartSec + Math.max(0.35, line.durationSec),
        }
      }
      usedIntervals.set(selectedPool.id, [
        ...(usedIntervals.get(selectedPool.id) || []),
        window,
      ])
      return {
        ...assignment,
        poolItemId: selectedPool.id,
        trimStartSec: Number(window.start.toFixed(2)),
        trimEndSec: Number(window.end.toFixed(2)),
      }
    })
    const filled = [
      ...assignments,
      ...missingAssignments,
    ]

    return NextResponse.json({
      success: true,
      mode: "ai",
      assignments: filled,
    })
  } catch (error) {
    console.error("[Story Mashup Assign]", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "짜깁기 배치에 실패했습니다.",
      },
      { status: 500 }
    )
  }
}
