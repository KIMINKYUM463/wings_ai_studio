import { NextResponse } from "next/server"
import {
  getSupertonicBaseUrl,
  isSupertonicVoiceHidden,
  labelSupertonicVoice,
  SUPERTONIC_BUNDLED_HQ_VOICES,
  SUPERTONIC_BUILTIN_VOICES,
} from "@/lib/supertonic-local"

type VoiceRow = {
  voice_id: string
  name: string
  gender?: string
  kind?: string
}

export async function GET() {
  const base = getSupertonicBaseUrl()
  const hqBundled: VoiceRow[] = SUPERTONIC_BUNDLED_HQ_VOICES.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    gender: v.gender,
    kind: "custom",
  }))
  const builtins: VoiceRow[] = [
    ...hqBundled,
    ...SUPERTONIC_BUILTIN_VOICES.map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      gender: v.gender,
      kind: "builtin" as const,
    })),
  ]

  try {
    const res = await fetch(`${base}/v1/styles`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return NextResponse.json({
        success: true,
        online: false,
        baseUrl: base,
        voices: builtins,
        note: "로컬 서버 스타일 목록을 못 읽어 기본 F1–F5 / M1–M5를 사용합니다.",
      })
    }

    const raw = (await res.json().catch(() => null)) as unknown
    const rows: VoiceRow[] = []

    const pushVoice = (voiceId: string, kind?: string) => {
      const id = voiceId.trim()
      if (!id) return
      if (isSupertonicVoiceHidden(id)) return
      if (rows.some((r) => r.voice_id === id)) return
      const meta = labelSupertonicVoice(id, kind)
      rows.push({
        voice_id: id,
        name: meta.name,
        gender: meta.gender,
        kind: kind || (meta.custom ? "custom" : "builtin"),
      })
    }

    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string") pushVoice(item)
        else if (item && typeof item === "object") {
          const o = item as Record<string, unknown>
          pushVoice(String(o.name ?? o.voice ?? o.voice_id ?? o.id ?? ""), String(o.kind ?? ""))
        }
      }
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      for (const key of ["styles", "voices", "data", "items", "builtin", "custom"]) {
        const nested = obj[key]
        if (!Array.isArray(nested)) continue
        for (const item of nested) {
          if (typeof item === "string") pushVoice(item, key === "custom" ? "custom" : undefined)
          else if (item && typeof item === "object") {
            const o = item as Record<string, unknown>
            pushVoice(
              String(o.name ?? o.voice ?? o.voice_id ?? o.id ?? ""),
              String(o.kind ?? (key === "custom" ? "custom" : "") ?? "")
            )
          }
        }
      }
    }

    // HQ 번들 → 기타 커스텀 → F*/M*
    const hqIds = new Set(hqBundled.map((v) => v.voice_id))
    const voices = (rows.length ? rows : builtins).slice().sort((a, b) => {
      const ah = hqIds.has(a.voice_id) ? 0 : 1
      const bh = hqIds.has(b.voice_id) ? 0 : 1
      if (ah !== bh) return ah - bh
      const ac = a.kind === "custom" ? 0 : 1
      const bc = b.kind === "custom" ? 0 : 1
      if (ac !== bc) return ac - bc
      return a.voice_id.localeCompare(b.voice_id, "en")
    })

    const ids = new Set(voices.map((v) => v.voice_id))
    for (const b of builtins) {
      if (!ids.has(b.voice_id)) voices.push(b)
    }
    // HQ는 항상 맨 앞
    for (let i = hqBundled.length - 1; i >= 0; i--) {
      const hq = hqBundled[i]!
      const idx = voices.findIndex((v) => v.voice_id === hq.voice_id)
      if (idx >= 0) voices.splice(idx, 1)
      voices.unshift(hq)
    }

    return NextResponse.json({
      success: true,
      online: true,
      baseUrl: base,
      voices,
    })
  } catch {
    return NextResponse.json({
      success: true,
      online: false,
      baseUrl: base,
      voices: builtins,
      note: "로컬 서버 오프라인 — 기본 보이스만 표시. serve 실행 후 TTS를 사용하세요.",
    })
  }
}
