"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Globe2,
  Loader2,
  Mic,
  Music2,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserRound,
  Volume2,
} from "lucide-react"
// Mic also used as step shell icon
import {
  TYPECAST_CATEGORY_CHIPS,
  enrichTypecastVoice,
  typecastMatchesCategory,
  typecastResolveGender,
  typecastUseCaseLabel,
} from "@/lib/shotform-tts-providers"
import {
  SUPERTONIC_BUILTIN_VOICES,
  isSupertonicVoiceHidden,
  buildSupertonicVoiceId,
  labelSupertonicVoice,
} from "@/lib/supertonic-local"
import {
  audioBlobToWav,
  sanitizeSupertonicVoiceName,
} from "@/lib/supertonic-voice-register"
import { isRecordedVoiceId } from "@/lib/supertonic-recorded"
import {
  fetchSupertonicHealth,
  fetchSupertonicVoices,
} from "@/lib/supertonic-runtime-client"
import { SupertonicSetupBar } from "../components/SupertonicSetupBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StoryboardScene } from "./project-actions"
import { VoiceRecordWaveform } from "./VoiceRecordWaveform"
import { Ver2StepPanel, Ver2StepShell } from "./Ver2StepShell"

const DEFAULT_ELEVEN_ID = "jB1Cifc2UQbq1gR3wnb0"
const TRAIN_SAMPLE_SECONDS = 10
const TRAIN_SAMPLE_SCRIPT =
  "안녕하세요. 윙스에이아이입니다. 오늘도 좋은 하루 되세요. 제 목소리로 쇼츠 나레이션을 테스트합니다."

type RecordMode = "train" | "narrate"

const ELEVEN_PRESETS = [
  { id: "jB1Cifc2UQbq1gR3wnb0", name: "Rachel", gender: "female" as const },
  { id: "8jHHF8rMqMlg8if2mOUe", name: "Voice 2", gender: "female" as const },
  { id: "uyVNoMrnUku1dZyVEXwD", name: "Voice 3", gender: "female" as const },
  { id: "1KNqBv4TutQtzSIACsMC", name: "Voice 4", gender: "male" as const },
  { id: "4JJwo477JUAx3HV0T7n7", name: "Voice 5", gender: "male" as const },
] as const

type Provider = "supertone" | "elevenlabs" | "typecast" | "supertonic"
type GenderFilter = "all" | "female" | "male"

type CatalogVoice = {
  voice_id: string
  name: string
  name_en?: string
  language?: string[]
  styles?: string[]
  thumbnail_image_url?: string
  gender?: string
  age?: string
  use_cases?: string[]
}

const TYPECAST_AGE_LABELS: Record<string, string> = {
  child: "어린이",
  teenager: "청소년",
  young_adult: "청년",
  middle_age: "중년",
  elder: "노년",
}

const TYPECAST_EMOTIONS = [
  { id: "normal", label: "보통" },
  { id: "happy", label: "밝은" },
  { id: "sad", label: "차분" },
  { id: "angry", label: "강한" },
  { id: "whisper", label: "속삭임" },
  { id: "smart", label: "스마트" },
] as const

const PROVIDERS: Array<{
  id: Provider
  title: string
  blurb: string
  icon: typeof Radio
}> = [
  {
    id: "supertone",
    title: "SuperTone",
    blurb: "쇼츠 나레이션용 연동 보이스",
    icon: Radio,
  },
  {
    id: "supertonic",
    title: "Supertonic 3",
    blurb: "PC 설치형 · 로컬 무료 TTS",
    icon: Sparkles,
  },
  {
    id: "typecast",
    title: "타입캐스트",
    blurb: "한국어 캐릭터 · 감정 프리셋",
    icon: UserRound,
  },
  {
    id: "elevenlabs",
    title: "ElevenLabs",
    blurb: "한국어/다국어 공유 보이스",
    icon: Globe2,
  },
]

function providerFromVoiceId(voiceId: string): Provider {
  // 주의: "supertonic-" 가 "supertone-" 보다 먼저여야 함
  if (voiceId.startsWith("supertonic-")) return "supertonic"
  if (voiceId.startsWith("supertone-")) return "supertone"
  if (voiceId.startsWith("typecast-")) return "typecast"
  return "elevenlabs"
}

function guessGender(name: string): GenderFilter {
  const n = name.toLowerCase()
  if (/남|male|man|민준|도윤|지호|m\d/.test(n)) return "male"
  if (/여|female|woman|하린|서윤|채원|rachel|f\d/.test(n)) return "female"
  return "all"
}

function snip(text: string, n = 36) {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

export function AiVoiceStepPanel({
  storyboardScenes,
  script,
  editedScript,
  selectedVoiceId,
  setSelectedVoiceId,
  selectedSupertoneVoiceId,
  setSelectedSupertoneVoiceId,
  selectedSupertoneStyle,
  setSelectedSupertoneStyle,
  customElevenLabsVoiceId,
  setCustomElevenLabsVoiceId,
  supertoneVoices,
  isLoadingSupertoneVoices,
  fetchSupertoneVoices,
  typecastVoices,
  isLoadingTypecastVoices,
  fetchTypecastVoices,
  selectedTypecastVoiceId,
  setSelectedTypecastVoiceId,
  selectedTypecastEmotion,
  setSelectedTypecastEmotion,
  previewingVoiceId,
  handlePreviewVoice,
  ttsAudioUrl,
  setTtsAudioUrl,
  isGeneratingTTS,
  ttsProgress,
  ttsSpeed,
  setTtsSpeed,
  handleGenerateTTS,
  voiceRecordings,
  setVoiceRecordings,
  showRecordingDialog,
  setShowRecordingDialog,
  isRecordingVoice,
  recordedVoiceUrl,
  setRecordedVoiceUrl,
  handleStartRecording,
  handleStopRecording,
  handleSaveRecordedVoice,
  onBack,
  onNext,
}: {
  storyboardScenes: StoryboardScene[]
  script: string
  editedScript: string
  selectedVoiceId: string
  setSelectedVoiceId: (id: string) => void
  selectedSupertoneVoiceId: string
  setSelectedSupertoneVoiceId: (id: string) => void
  selectedSupertoneStyle: string
  setSelectedSupertoneStyle: (s: string) => void
  customElevenLabsVoiceId: string
  setCustomElevenLabsVoiceId: (id: string) => void
  supertoneVoices: CatalogVoice[]
  isLoadingSupertoneVoices: boolean
  fetchSupertoneVoices: () => void
  typecastVoices: CatalogVoice[]
  isLoadingTypecastVoices: boolean
  fetchTypecastVoices: () => void
  selectedTypecastVoiceId: string
  setSelectedTypecastVoiceId: (id: string) => void
  selectedTypecastEmotion: string
  setSelectedTypecastEmotion: (s: string) => void
  previewingVoiceId: string | null
  handlePreviewVoice: (voiceId: string) => void
  ttsAudioUrl: string
  setTtsAudioUrl: (url: string) => void
  isGeneratingTTS: boolean
  ttsProgress: { current: number; total: number }
  ttsSpeed: number
  setTtsSpeed: (n: number) => void
  handleGenerateTTS: () => void
  voiceRecordings: Record<string, string>
  setVoiceRecordings: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showRecordingDialog: boolean
  setShowRecordingDialog: (open: boolean) => void
  isRecordingVoice: boolean
  recordedVoiceUrl: string
  setRecordedVoiceUrl: (url: string) => void
  handleStartRecording: () => void
  handleStopRecording: () => void
  handleSaveRecordedVoice: () => void
  onBack: () => void
  onNext: () => void
}) {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all")
  const [typecastQuery, setTypecastQuery] = useState("")
  const [typecastCategory, setTypecastCategory] = useState<string>("all")
  const [typecastAge, setTypecastAge] = useState<string>("all")
  const [supertonicOnline, setSupertonicOnline] = useState<boolean | null>(null)
  const [supertonicVoices, setSupertonicVoices] = useState<
    Array<{ voice_id: string; name: string; gender?: string; kind?: string }>
  >(() => SUPERTONIC_BUILTIN_VOICES.map((v) => ({ ...v, kind: "builtin" })))
  const [recordedVoiceMeta, setRecordedVoiceMeta] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null)
  const [supertonicHealthMsg, setSupertonicHealthMsg] = useState("")
  const [activeSceneIdx, setActiveSceneIdx] = useState(0)
  const [localRecording, setLocalRecording] = useState(false)
  const [recordAnalyser, setRecordAnalyser] = useState<AnalyserNode | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordMode, setRecordMode] = useState<RecordMode>("narrate")
  const [trainVoiceName, setTrainVoiceName] = useState("")
  const [isRegisteringVoice, setIsRegisteringVoice] = useState(false)
  const [isImportingJsonVoice, setIsImportingJsonVoice] = useState(false)
  const [jsonVoiceName, setJsonVoiceName] = useState("")
  const [trainStatusMsg, setTrainStatusMsg] = useState("")
  const uploadRef = useRef<HTMLInputElement>(null)
  const trainJsonInputRef = useRef<HTMLInputElement>(null)
  const voiceJsonInputRef = useRef<HTMLInputElement>(null)
  const resultAudioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderLocalRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const recordBlobRef = useRef<Blob | null>(null)
  const recordStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const recordTimerRef = useRef<number | null>(null)
  const recordModeRef = useRef<RecordMode>("narrate")

  useEffect(() => {
    recordModeRef.current = recordMode
  }, [recordMode])

  // 예전 TTSMaker 선택이 남아 있으면 ElevenLabs로 이전
  useEffect(() => {
    if (!selectedVoiceId?.startsWith("ttsmaker-") && selectedVoiceId) return
    const eid = customElevenLabsVoiceId || DEFAULT_ELEVEN_ID
    setCustomElevenLabsVoiceId(eid)
    setSelectedSupertoneVoiceId("")
    setSelectedVoiceId(`elevenlabs-${eid}`)
  }, [selectedVoiceId])

  const provider = providerFromVoiceId(selectedVoiceId || `elevenlabs-${DEFAULT_ELEVEN_ID}`)

  const sceneItems = useMemo(() => {
    if (storyboardScenes.length > 0) {
      return storyboardScenes.map((s, i) => ({
        id: s.id,
        label: `S${i + 1}`,
        title: snip(s.narration || s.title || `장면 ${i + 1}`),
        body: (s.narration || "").trim(),
      }))
    }
    const chunks = (editedScript || script || "")
      .split(/(?<=[.!?。~])\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (!chunks.length) {
      return [{ id: "s1", label: "S1", title: "대본 없음", body: "" }]
    }
    return chunks.map((body, i) => ({
      id: `s${i + 1}`,
      label: `S${i + 1}`,
      title: snip(body),
      body,
    }))
  }, [storyboardScenes, script, editedScript])

  useEffect(() => {
    if (activeSceneIdx >= sceneItems.length) setActiveSceneIdx(0)
  }, [sceneItems.length, activeSceneIdx])

  // 배속은 TTS API 합성에 반영되므로 결과 플레이어는 항상 1x
  useEffect(() => {
    if (resultAudioRef.current) {
      resultAudioRef.current.playbackRate = 1
    }
  }, [ttsAudioUrl, voiceRecordings.main])

  const active = sceneItems[activeSceneIdx] || sceneItems[0]
  const hasAudio = Boolean(ttsAudioUrl || voiceRecordings.main)
  const audioSrc = ttsAudioUrl || voiceRecordings.main || ""

  const setProvider = (next: Provider) => {
    if (next === "supertone") {
      if (supertoneVoices.length === 0) fetchSupertoneVoices()
      const first = selectedSupertoneVoiceId || supertoneVoices[0]?.voice_id
      if (first) {
        setSelectedSupertoneVoiceId(first)
        setSelectedVoiceId(`supertone-${first}`)
        const v = supertoneVoices.find((x) => x.voice_id === first)
        if (v?.styles?.length) {
          const neu = v.styles.find((s) => s.toLowerCase().includes("neutral") || s === "중립")
          setSelectedSupertoneStyle(neu || v.styles[0])
        }
      }
      setGenderFilter("all")
      return
    }
    if (next === "typecast") {
      if (typecastVoices.length === 0) fetchTypecastVoices()
      const first = selectedTypecastVoiceId || typecastVoices[0]?.voice_id
      if (first) {
        setSelectedTypecastVoiceId(first)
        setSelectedVoiceId(`typecast-${first}`)
        const v = typecastVoices.find((x) => x.voice_id === first)
        if (v?.styles?.length) {
          setSelectedTypecastEmotion(
            v.styles.includes("normal") ? "normal" : v.styles[0]
          )
        } else {
          setSelectedTypecastEmotion("normal")
        }
      } else {
        setSelectedVoiceId("typecast-")
      }
      setGenderFilter("all")
      return
    }
    if (next === "supertonic") {
      void checkSupertonic()
      const currentBare = selectedVoiceId.startsWith("supertonic-")
        ? selectedVoiceId.replace("supertonic-", "")
        : ""
      const first =
        currentBare ||
        supertonicVoices[0]?.voice_id ||
        SUPERTONIC_BUILTIN_VOICES[0].voice_id
      setSelectedVoiceId(buildSupertonicVoiceId(first))
      setGenderFilter("all")
      return
    }
    const eid = customElevenLabsVoiceId || DEFAULT_ELEVEN_ID
    setCustomElevenLabsVoiceId(eid)
    setSelectedSupertoneVoiceId("")
    setSelectedVoiceId(`elevenlabs-${eid}`)
    setGenderFilter("all")
  }

  /** 엔진 선택 시 — 상태만 확인 (.cmd 다운로드·자동 설치는 「자동 실행」에서만) */
  const checkSupertonic = async () => {
    setSupertonicHealthMsg("Supertonic 상태 확인 중…")
    setSupertonicOnline(null)
    try {
      const health = await fetchSupertonicHealth()
      const [voicesRes, recordedRes] = await Promise.all([
        fetchSupertonicVoices(),
        fetch("/api/supertonic-recorded"),
      ])
      const voicesData = (await voicesRes.json().catch(() => ({}))) as {
        voices?: Array<{ voice_id: string; name: string; gender?: string; kind?: string }>
        online?: boolean
        note?: string
      }
      const recordedData = (await recordedRes.json().catch(() => ({}))) as {
        voices?: Array<{ id: string; label: string }>
      }
      if (voicesData.voices?.length) setSupertonicVoices(voicesData.voices)
      if (Array.isArray(recordedData.voices)) {
        setRecordedVoiceMeta(
          recordedData.voices.map((v) => ({ id: v.id, label: v.label }))
        )
      }

      const online = Boolean(health.online)
      setSupertonicOnline(online)
      if (online) {
        setSupertonicHealthMsg(
          health.message ||
            `연결됨 · ${health.model || "supertonic-3"} · ${health.baseUrl || "127.0.0.1:7788"}`
        )
      } else {
        setSupertonicHealthMsg(
          health.message ||
            health.error ||
            "꺼져 있습니다. 아래 「Supertonic 자동 실행」을 누르세요. (에이전트 창이 이미 열려 있으면 .cmd를 다시 받지 않습니다)"
        )
      }
    } catch {
      setSupertonicOnline(false)
      setSupertonicHealthMsg(
        "상태 확인 실패. 「Supertonic 자동 실행」을 눌러 주세요."
      )
    }
  }

  const importSupertonicJsonVoice = async (file: File) => {
    if (!/\.json$/i.test(file.name)) {
      alert("Supertonic Voice Builder JSON 파일만 선택할 수 있습니다.")
      return
    }
    setIsImportingJsonVoice(true)
    setTrainStatusMsg("JSON 목소리를 Supertonic 3에 등록하는 중…")
    try {
      const name = sanitizeSupertonicVoiceName(
        jsonVoiceName.trim() || file.name.replace(/\.json$/i, "")
      )
      const form = new FormData()
      form.append("file", file, file.name)
      form.append("name", name)
      const res = await fetch("/api/supertonic-import", {
        method: "POST",
        body: form,
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        name?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "JSON 목소리 등록에 실패했습니다.")
      }
      const voiceId = String(data.name || name)
      await checkSupertonic()
      setSelectedVoiceId(buildSupertonicVoiceId(voiceId))
      setJsonVoiceName("")
      setTrainStatusMsg(`JSON 목소리 등록 완료: ${voiceId}`)
    } catch (error) {
      console.error("[AiVoice] JSON 목소리 등록 실패:", error)
      setTrainStatusMsg("")
      alert(
        error instanceof Error
          ? error.message
          : "JSON 목소리 등록에 실패했습니다."
      )
    } finally {
      setIsImportingJsonVoice(false)
    }
  }

  useEffect(() => {
    if (provider === "supertonic") void checkSupertonic()
    // 저장된 Supertonic 선택을 복원할 때 로컬 커스텀 목록도 함께 갱신합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const deleteRecordedVoice = async (bareId: string) => {
    if (!isRecordedVoiceId(bareId)) return
    if (!confirm(`「${bareId}」 녹음 보이스를 삭제할까요?`)) return
    setDeletingVoiceId(bareId)
    try {
      const res = await fetch(
        `/api/supertonic-recorded?name=${encodeURIComponent(bareId)}`,
        { method: "DELETE" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        note?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "삭제 실패")
      }
      setRecordedVoiceMeta((prev) => prev.filter((v) => v.id !== bareId))
      setSupertonicVoices((prev) => prev.filter((v) => v.voice_id !== bareId))
      if (selectedVoiceId === buildSupertonicVoiceId(bareId)) {
        setSelectedVoiceId(buildSupertonicVoiceId(SUPERTONIC_BUILTIN_VOICES[0].voice_id))
      }
      if (data.note) {
        /* soft note — serve may still list until restart */
      }
      await checkSupertonic()
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.")
    } finally {
      setDeletingVoiceId(null)
    }
  }

  /** API 응답이 영문 이름만 오더라도 표시/필터용으로 한글·성별 보정 */
  const enrichedTypecastVoices = useMemo(
    () => typecastVoices.map((v) => enrichTypecastVoice(v)),
    [typecastVoices]
  )

  const typecastAges = useMemo(() => {
    const set = new Set<string>()
    for (const v of enrichedTypecastVoices) {
      if (v.age) set.add(v.age)
    }
    return ["child", "teenager", "young_adult", "middle_age", "elder"].filter((a) => set.has(a))
  }, [enrichedTypecastVoices])

  const typecastList = useMemo(() => {
    const q = typecastQuery.trim().toLowerCase()
    const qKo = typecastQuery.trim()
    return enrichedTypecastVoices.filter((v) => {
      if (genderFilter !== "all") {
        const g = typecastResolveGender(v)
        // 성별이 없으면 해당 필터에서 제외 (여성/남성 선택이 의미 있게 나뉨)
        if (g !== genderFilter) return false
      }
      if (typecastAge !== "all" && v.age !== typecastAge) return false
      if (!typecastMatchesCategory(v.use_cases, typecastCategory)) return false
      if (!q) return true
      return (
        v.name.toLowerCase().includes(q) ||
        v.name.includes(qKo) ||
        (v.name_en || "").toLowerCase().includes(q) ||
        v.voice_id.toLowerCase().includes(q) ||
        (v.use_cases || []).some((uc) => {
          const label = typecastUseCaseLabel(uc)
          return label.includes(qKo) || uc.toLowerCase().includes(q)
        })
      )
    })
  }, [enrichedTypecastVoices, genderFilter, typecastAge, typecastCategory, typecastQuery])

  /** 전체일 때 여성/남성 섹션으로 나눔 */
  const typecastGrouped = useMemo(() => {
    const female = typecastList.filter((v) => typecastResolveGender(v) === "female")
    const male = typecastList.filter((v) => typecastResolveGender(v) === "male")
    const unknown = typecastList.filter((v) => typecastResolveGender(v) == null)
    return { female, male, unknown }
  }, [typecastList])

  const voiceCards = useMemo(() => {
    if (provider === "elevenlabs") {
      return ELEVEN_PRESETS.filter(
        (v) => genderFilter === "all" || v.gender === genderFilter
      ).map((v, i) => ({
        key: v.id,
        voiceId: `elevenlabs-${v.id}`,
        name: v.name,
        code: v.gender === "female" ? `F${i + 1}` : `M${i + 1}`,
        gender: v.gender,
        note: "EL",
        thumb: undefined as string | undefined,
      }))
    }
    if (provider === "supertonic") {
      const recordedIds = new Set(recordedVoiceMeta.map((r) => r.id))
      const labelById = new Map(recordedVoiceMeta.map((r) => [r.id, r.label]))
      return supertonicVoices
        .filter((v) => {
          // 녹음 보이스는 아래 전용 섹션에서만 표시
          if (isRecordedVoiceId(v.voice_id) || recordedIds.has(v.voice_id)) return false
          if (isSupertonicVoiceHidden(v.voice_id)) return false
          if (genderFilter === "all") return true
          const g =
            v.gender === "male" || v.gender === "female"
              ? v.gender
              : /^M/i.test(v.voice_id)
                ? "male"
                : /^F/i.test(v.voice_id)
                  ? "female"
                  : "all"
          return g === genderFilter
        })
        .map((v) => {
          const meta = labelSupertonicVoice(v.voice_id, v.kind)
          const gender: "female" | "male" =
            meta.gender === "male" || v.gender === "male" || /^M/i.test(v.voice_id)
              ? "male"
              : "female"
          const short =
            labelById.get(v.voice_id) ||
            meta.name.replace(/\s*·\s*커스텀$/, "").trim() ||
            v.name
          return {
            key: v.voice_id,
            voiceId: buildSupertonicVoiceId(v.voice_id),
            name: short,
            code: short.length <= 3 ? short : v.voice_id.slice(0, 2),
            gender,
            note: meta.custom ? "커스텀" : "로컬",
            thumb: undefined as string | undefined,
            recorded: false as boolean,
            bareId: v.voice_id,
          }
        })
    }
    if (provider === "typecast") return []
    const note = selectedSupertoneStyle || "style"
    return supertoneVoices
      .filter((v) => {
        if (genderFilter === "all") return true
        const g = guessGender(v.name)
        return g === genderFilter || g === "all"
      })
      .map((v, i) => {
        const g = guessGender(v.name)
        const gender: "female" | "male" = g === "male" ? "male" : "female"
        return {
          key: v.voice_id,
          voiceId: `supertone-${v.voice_id}`,
          name: v.name,
          code: gender === "female" ? `F${i + 1}` : `M${i + 1}`,
          gender,
          note,
          thumb: v.thumbnail_image_url,
        }
      })
  }, [
    provider,
    genderFilter,
    supertoneVoices,
    selectedSupertoneStyle,
    supertonicVoices,
    recordedVoiceMeta,
  ])

  /** 학습 녹음으로 추가한 보이스만 (짧은 이름 · 삭제 가능) */
  const recordedVoiceCards = useMemo(() => {
    if (provider !== "supertonic") return []
    const labelById = new Map(recordedVoiceMeta.map((r) => [r.id, r.label]))
    const fromServer = supertonicVoices.filter(
      (v) => isRecordedVoiceId(v.voice_id) || labelById.has(v.voice_id)
    )
    const ids = new Set(fromServer.map((v) => v.voice_id))
    // 레지스트리에만 있고 serve 목록에 아직 있는/없는 경우 모두 포함
    for (const r of recordedVoiceMeta) {
      if (!ids.has(r.id)) {
        fromServer.push({
          voice_id: r.id,
          name: r.label,
          gender: undefined,
          kind: "custom",
        })
      }
    }
    return fromServer
      .filter((v) => {
        if (genderFilter === "all") return true
        const g =
          v.gender === "male" || v.gender === "female"
            ? v.gender
            : guessGender(v.name)
        return g === genderFilter || g === "all"
      })
      .map((v, i) => {
        const label =
          labelById.get(v.voice_id) ||
          labelSupertonicVoice(v.voice_id, "custom").name ||
          `내${i + 1}`
        const gender: "female" | "male" =
          v.gender === "male" || guessGender(label) === "male" ? "male" : "female"
        return {
          key: v.voice_id,
          voiceId: buildSupertonicVoiceId(v.voice_id),
          name: label,
          code: label,
          gender,
          note: "내 녹음",
          thumb: undefined as string | undefined,
          recorded: true as boolean,
          bareId: v.voice_id,
        }
      })
  }, [provider, genderFilter, supertonicVoices, recordedVoiceMeta])

  const selectVoiceCard = (voiceId: string) => {
    if (voiceId.startsWith("supertonic-")) {
      setSelectedVoiceId(voiceId)
      return
    }
    if (voiceId.startsWith("elevenlabs-")) {
      const id = voiceId.replace("elevenlabs-", "")
      setCustomElevenLabsVoiceId(id)
      setSelectedSupertoneVoiceId("")
      setSelectedVoiceId(voiceId)
      return
    }
    if (voiceId.startsWith("typecast-")) {
      const id = voiceId.replace("typecast-", "")
      setSelectedTypecastVoiceId(id)
      setSelectedVoiceId(voiceId)
      const v = typecastVoices.find((x) => x.voice_id === id)
      if (v?.styles?.length) {
        setSelectedTypecastEmotion(
          v.styles.includes("normal") ? "normal" : v.styles[0]
        )
      }
      return
    }
    if (voiceId.startsWith("supertone-")) {
      const id = voiceId.replace("supertone-", "")
      setSelectedSupertoneVoiceId(id)
      setSelectedVoiceId(voiceId)
      const v = supertoneVoices.find((x) => x.voice_id === id)
      if (v?.styles?.length) {
        const neu = v.styles.find((s) => s.toLowerCase().includes("neutral") || s === "중립")
        setSelectedSupertoneStyle(neu || v.styles[0])
      }
    }
  }

  const cleanupRecordingGraph = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    recordStreamRef.current?.getTracks().forEach((t) => t.stop())
    recordStreamRef.current = null
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    setRecordAnalyser(null)
    mediaRecorderLocalRef.current = null
  }

  const startWaveRecording = async () => {
    try {
      setRecordedVoiceUrl("")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      recordStreamRef.current = stream
      recordChunksRef.current = []

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.75
      source.connect(analyser)
      setRecordAnalyser(analyser)

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : ""
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" })
        recordBlobRef.current = blob
        const url = URL.createObjectURL(blob)
        setRecordedVoiceUrl(url)
        const wasTrain = recordModeRef.current === "train"
        cleanupRecordingGraph()
        setLocalRecording(false)
        if (wasTrain) {
          setTrainVoiceName("")
          // 학습용: 녹음 종료 즉시 JSON 변환·등록 (이름은 서버가 내1, 내2…)
          window.setTimeout(() => {
            void registerTrainedVoice(null)
          }, 80)
        }
      }
      mediaRecorderLocalRef.current = mr
      mr.start(100)
      setLocalRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1
          if (recordModeRef.current === "train" && next >= TRAIN_SAMPLE_SECONDS) {
            window.setTimeout(() => stopWaveRecording(), 0)
          }
          return next
        })
      }, 1000)
    } catch (err) {
      console.error("[AiVoice] 마이크 접근 실패:", err)
      alert("마이크 접근에 실패했습니다. 브라우저 권한을 확인해주세요.")
      cleanupRecordingGraph()
      setLocalRecording(false)
    }
  }

  const stopWaveRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    const mr = mediaRecorderLocalRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    else {
      cleanupRecordingGraph()
      setLocalRecording(false)
    }
  }

  const downloadTrainSample = async () => {
    const blob = recordBlobRef.current
    if (!blob && !recordedVoiceUrl) return
    try {
      const src = blob || (await fetch(recordedVoiceUrl).then((r) => r.blob()))
      const wav = await audioBlobToWav(src)
      const a = document.createElement("a")
      a.href = URL.createObjectURL(wav)
      a.download = `${sanitizeSupertonicVoiceName(trainVoiceName || "supertonic-train")}.wav`
      a.click()
    } catch {
      if (!recordedVoiceUrl) return
      const a = document.createElement("a")
      a.href = recordedVoiceUrl
      a.download = `supertonic-train-${Date.now()}.webm`
      a.click()
    }
  }

  /** 학습용 녹음 → JSON 생성 → 로컬 Supertonic 등록 → 선택 */
  const registerTrainedVoice = async (styleFile?: File | null, _nameOverride?: string) => {
    const blob = recordBlobRef.current
    if (!blob && !recordedVoiceUrl) {
      alert("먼저 학습용 녹음을 완료하세요.")
      return
    }
    setIsRegisteringVoice(true)
    setTrainStatusMsg(
      styleFile
        ? "스타일 JSON import 중…"
        : "녹음 → JSON 변환 중… (짧은 이름 자동 부여, 약 20~60초)"
    )
    try {
      // 서버가 n1, n2… 자동 할당 (긴 이름 금지)
      const nextRes = await fetch("/api/supertonic-recorded")
      const nextData = (await nextRes.json().catch(() => ({}))) as {
        nextId?: string
        nextLabel?: string
      }
      const name = nextData.nextId || "n1"
      const label = nextData.nextLabel || "내1"
      setTrainVoiceName(label)

      const src = blob || (await fetch(recordedVoiceUrl).then((r) => r.blob()))
      const wav = await audioBlobToWav(src)
      const form = new FormData()
      form.append("name", name)
      form.append("audio", wav, `${name}.wav`)
      if (styleFile) form.append("styleJson", styleFile, styleFile.name)

      const res = await fetch("/api/supertonic-train", { method: "POST", body: form })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        voice_id?: string
        name?: string
        label?: string
        method?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "보이스 등록 실패")
      }
      const voiceId = data.voice_id || data.name || name
      const shown = data.label || label
      setTrainVoiceName(shown)
      setTrainStatusMsg("등록 완료 · 보이스 목록 갱신 중…")
      await checkSupertonic()
      setSelectedVoiceId(buildSupertonicVoiceId(voiceId))
      setTrainStatusMsg(`등록 완료: ${shown}`)
      alert(`보이스가 등록되었습니다: ${shown}\n이제 「내 녹음」에서 선택·삭제할 수 있습니다.`)
    } catch (err) {
      console.error("[AiVoice] 보이스 등록 실패:", err)
      setTrainStatusMsg("")
      alert(err instanceof Error ? err.message : "보이스 등록에 실패했습니다.")
    } finally {
      setIsRegisteringVoice(false)
    }
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("audio/")) {
      alert("오디오 파일만 업로드 가능합니다.")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const url = String(reader.result || "")
      if (!url) return
      setTtsAudioUrl(url)
      setVoiceRecordings((prev) => ({ ...prev, main: url }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const clearAudio = () => {
    if (!hasAudio) return
    if (!confirm("생성된 AI 음성을 모두 삭제할까요?")) return
    setTtsAudioUrl("")
    setVoiceRecordings({})
  }

  return (
    <Ver2StepShell
      stepLabel="4단계"
      title="AI 음성"
      description="엔진 → 보이스 카드 → 생성. 장면 칩으로 대본을 확인한 뒤 TTS를 만듭니다."
      icon={Mic}
      accent="orange"
      headerRight={
        <>
          <Button
            variant="outline"
            onClick={onBack}
            className="border-white/15 bg-[#151b28] text-zinc-200 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            이전
          </Button>
          <Button
            onClick={onNext}
            disabled={!script.trim()}
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold"
          >
            다음: 이미지
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </>
      }
    >
      {/* 장면 흐름 */}
      <Ver2StepPanel
        eyebrow="Scenes"
        title="장면 대본"
        description={`${sceneItems.length}씬 · S${activeSceneIdx + 1} 선택`}
        right={<Music2 className="h-4 w-4 text-orange-300" />}
      >
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {sceneItems.map((s, idx) => {
            const on = idx === activeSceneIdx
            return (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSceneIdx(idx)}
                  className={`w-[220px] rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    on
                      ? "border-orange-400/60 bg-orange-500/20 ring-1 ring-orange-400/25"
                      : "border-white/12 bg-[#1a1d27] hover:border-orange-400/30 hover:bg-[#1e2230]"
                  }`}
                >
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${
                      on
                        ? "bg-orange-400 text-[#1a1208]"
                        : "bg-white/10 text-orange-200"
                    }`}
                  >
                    {s.label}
                  </span>
                  <p
                    className={`mt-2 text-[13px] leading-snug line-clamp-2 min-h-[2.5rem] ${
                      on ? "text-zinc-50 font-medium" : "text-zinc-300"
                    }`}
                  >
                    {s.body || s.title}
                  </p>
                </button>
                {idx < sceneItems.length - 1 ? (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border border-orange-400/30 bg-[#1a1d27] text-orange-300"
                    aria-hidden
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        {active?.body ? (
          <div className="mt-3 rounded-xl border border-orange-400/20 bg-[#0c0e14] px-4 py-3">
            <p className="text-[11px] font-semibold text-orange-200/90 mb-1.5">
              선택 장면 · {active.label}
            </p>
            <p className="text-[14px] text-zinc-100 leading-relaxed tracking-[-0.01em]">
              {active.body}
            </p>
          </div>
        ) : null}
      </Ver2StepPanel>

      {/* TTS 엔진 카드 */}
      <Ver2StepPanel
        eyebrow="Engine"
        title="TTS 엔진"
        description="SuperTone · Supertonic 3(로컬) · 타입캐스트 · ElevenLabs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PROVIDERS.map((p) => {
            const on = provider === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`relative text-left rounded-xl border px-3.5 py-3.5 transition-all ${
                  on
                    ? "border-emerald-400/55 bg-emerald-500/[0.12] shadow-[0_0_0_1px_rgba(52,211,153,0.15)]"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {on ? (
                  <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[#062016]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
                <div className="flex items-start gap-2.5 pr-6">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      on ? "bg-emerald-400/20 text-emerald-200" : "bg-white/5 text-zinc-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-50">{p.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{p.blurb}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        {provider === "supertone" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-emerald-400/30 text-emerald-100"
              onClick={fetchSupertoneVoices}
              disabled={isLoadingSupertoneVoices}
            >
              {isLoadingSupertoneVoices ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              SuperTone 목록 불러오기
            </Button>
            {selectedSupertoneVoiceId &&
            (supertoneVoices.find((v) => v.voice_id === selectedSupertoneVoiceId)?.styles?.length ||
              0) > 0 ? (
              <select
                value={selectedSupertoneStyle}
                onChange={(e) => setSelectedSupertoneStyle(e.target.value)}
                className="h-8 rounded-md border border-white/15 bg-black/40 px-2 text-[12px] text-zinc-200"
              >
                {supertoneVoices
                  .find((v) => v.voice_id === selectedSupertoneVoiceId)!
                  .styles.map((style) => (
                    <option key={style} value={style}>
                      스타일 · {style}
                    </option>
                  ))}
              </select>
            ) : null}
            <Input
              placeholder="또는 Voice ID 직접 입력"
              value={
                selectedSupertoneVoiceId &&
                !supertoneVoices.find((v) => v.voice_id === selectedSupertoneVoiceId)
                  ? selectedSupertoneVoiceId
                  : ""
              }
              onChange={(e) => {
                const inputId = e.target.value.trim()
                if (!inputId) return
                setSelectedSupertoneVoiceId(inputId)
                setSelectedVoiceId(`supertone-${inputId}`)
                setSelectedSupertoneStyle("neutral")
              }}
              className="h-8 max-w-[220px] bg-black/30 border-white/15 text-xs"
            />
          </div>
        ) : null}
        {provider === "supertonic" ? (
          <div className="space-y-3">
            <SupertonicSetupBar
              onReady={(info) => {
                setSupertonicOnline(info.online)
                if (info.message) setSupertonicHealthMsg(info.message)
                if (info.online) void checkSupertonic()
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={jsonVoiceName}
                onChange={(event) => setJsonVoiceName(event.target.value)}
                placeholder="목소리 ID · 영문/숫자 (선택)"
                disabled={isImportingJsonVoice}
                className="h-8 w-[210px] border-violet-400/25 bg-black/30 text-xs text-zinc-100"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isImportingJsonVoice}
                onClick={() => voiceJsonInputRef.current?.click()}
                className="h-8 border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 hover:text-white"
              >
                {isImportingJsonVoice ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1" />
                )}
                JSON 목소리 추가
              </Button>
              <input
                ref={voiceJsonInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) void importSupertonicJsonVoice(file)
                }}
              />
              <span
                className={`text-[11px] ${
                  supertonicOnline === true
                    ? "text-emerald-300"
                    : supertonicOnline === false
                      ? "text-amber-300"
                      : "text-zinc-500"
                }`}
              >
                {supertonicHealthMsg ||
                  "Supertonic 3 선택 시 설치 안내로 Python·서버를 준비하세요"}
              </span>
            </div>
          </div>
        ) : null}
        {provider === "typecast" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-emerald-400/30 text-emerald-100"
              onClick={fetchTypecastVoices}
              disabled={isLoadingTypecastVoices}
            >
              {isLoadingTypecastVoices ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              타입캐스트 목록 불러오기
            </Button>
            <select
              value={selectedTypecastEmotion}
              onChange={(e) => setSelectedTypecastEmotion(e.target.value)}
              className="h-8 rounded-md border border-white/15 bg-black/40 px-2 text-[12px] text-zinc-200"
            >
              {(
                typecastVoices.find((v) => v.voice_id === selectedTypecastVoiceId)?.styles
                  ?.length
                  ? typecastVoices.find((v) => v.voice_id === selectedTypecastVoiceId)!.styles
                  : TYPECAST_EMOTIONS.map((e) => e.id)
              ).map((emotion) => {
                const label =
                  TYPECAST_EMOTIONS.find((e) => e.id === emotion)?.label || emotion
                return (
                  <option key={emotion} value={emotion}>
                    감정 · {label}
                  </option>
                )
              })}
            </select>
            <Input
              placeholder="또는 Voice ID 직접 입력"
              value={
                selectedTypecastVoiceId &&
                !typecastVoices.find((v) => v.voice_id === selectedTypecastVoiceId)
                  ? selectedTypecastVoiceId
                  : ""
              }
              onChange={(e) => {
                const inputId = e.target.value.trim()
                if (!inputId) return
                setSelectedTypecastVoiceId(inputId)
                setSelectedVoiceId(`typecast-${inputId}`)
                setSelectedTypecastEmotion("normal")
              }}
              className="h-8 max-w-[220px] bg-black/30 border-white/15 text-xs"
            />
          </div>
        ) : null}
        {provider === "elevenlabs" ? (
          <Input
            placeholder="ElevenLabs Voice ID 직접 입력"
            value={customElevenLabsVoiceId}
            onChange={(e) => {
              const voiceId = e.target.value.trim()
              setCustomElevenLabsVoiceId(voiceId)
              if (voiceId) setSelectedVoiceId(`elevenlabs-${voiceId}`)
            }}
            className="h-8 max-w-md bg-black/30 border-white/15 text-xs"
          />
        ) : null}
      </Ver2StepPanel>

      {/* 보이스 목록 — 타입캐스트는 검색/카테고리 리스트, 그 외는 카드 그리드 */}
      <Ver2StepPanel eyebrow="Voices" title="보이스 선택" description="엔진별 목록 · 내 녹음은 별도 구역">
        {provider === "typecast" ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                value={typecastQuery}
                onChange={(e) => setTypecastQuery(e.target.value)}
                placeholder="보이스 이름을 검색하세요."
                className="h-10 border-white/15 bg-black/35 pl-10 text-sm text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setTypecastCategory("all")}
                className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors ${
                  typecastCategory === "all"
                    ? "border-orange-400/50 bg-orange-500/15 text-orange-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                전체
              </button>
              {TYPECAST_CATEGORY_CHIPS.map((cat) => {
                const count = enrichedTypecastVoices.filter((v) =>
                  typecastMatchesCategory(v.use_cases, cat)
                ).length
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTypecastCategory(cat)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors ${
                      typecastCategory === cat
                        ? "border-orange-400/50 bg-orange-500/15 text-orange-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {typecastUseCaseLabel(cat)}
                    {count > 0 ? (
                      <span className="ml-1 opacity-70">{count}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-500">언어</span>
              <span className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] text-zinc-300">
                한국어
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 ml-1">성별</span>
              {(
                [
                  { id: "all", label: "전체" },
                  { id: "female", label: "여성" },
                  { id: "male", label: "남성" },
                ] as const
              ).map((g) => {
                const count =
                  g.id === "all"
                    ? enrichedTypecastVoices.length
                    : enrichedTypecastVoices.filter((v) => typecastResolveGender(v) === g.id)
                        .length
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGenderFilter(g.id)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      genderFilter === g.id
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {g.label}
                    <span className="ml-1 opacity-70">{count}</span>
                  </button>
                )
              })}
              {typecastAges.length > 0 ? (
                <>
                  <span className="text-[11px] font-semibold text-zinc-500 ml-1">연령층</span>
                  <select
                    value={typecastAge}
                    onChange={(e) => setTypecastAge(e.target.value)}
                    className="h-7 rounded-md border border-white/15 bg-black/40 px-2 text-[11px] text-zinc-200"
                  >
                    <option value="all">전체</option>
                    {typecastAges.map((age) => (
                      <option key={age} value={age}>
                        {TYPECAST_AGE_LABELS[age] || age}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">
                보이스 목록
                <span className="ml-1 text-zinc-500 font-medium">({typecastList.length})</span>
              </p>
              {selectedTypecastVoiceId ? (
                <p className="text-[11px] text-emerald-300/90 truncate max-w-[50%]">
                  선택 ·{" "}
                  {enrichedTypecastVoices.find((v) => v.voice_id === selectedTypecastVoiceId)
                    ?.name || selectedTypecastVoiceId}
                </p>
              ) : null}
            </div>

            {enrichedTypecastVoices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-zinc-500">
                「타입캐스트 목록 불러오기」를 눌러 보이스를 가져오세요
              </div>
            ) : typecastList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-zinc-500">
                조건에 맞는 보이스가 없습니다. 검색어·카테고리·성별 필터를 바꿔보세요.
              </div>
            ) : (
              <div className="max-h-[min(52vh,520px)] overflow-y-auto rounded-xl border border-white/10 bg-black/20">
                {(
                  genderFilter === "all"
                    ? ([
                        { key: "female", title: "여성", rows: typecastGrouped.female },
                        { key: "male", title: "남성", rows: typecastGrouped.male },
                        { key: "unknown", title: "기타", rows: typecastGrouped.unknown },
                      ] as const)
                    : ([
                        {
                          key: genderFilter,
                          title: genderFilter === "female" ? "여성" : "남성",
                          rows: typecastList,
                        },
                      ] as const)
                ).map((section) =>
                  section.rows.length === 0 ? null : (
                    <div key={section.key}>
                      <div className="sticky top-0 z-[1] border-b border-white/10 bg-[#141821] px-3 py-1.5">
                        <p className="text-[11px] font-semibold text-zinc-300">
                          {section.title}
                          <span className="ml-1 text-zinc-500">({section.rows.length})</span>
                        </p>
                      </div>
                      <div className="divide-y divide-white/[0.06]">
                        {section.rows.map((v) => {
                          const voiceId = `typecast-${v.voice_id}`
                          const on = selectedVoiceId === voiceId
                          const tag = (v.use_cases || [])[0]
                          const g = typecastResolveGender(v)
                          const genderLabel =
                            g === "male" ? "남성" : g === "female" ? "여성" : ""
                          return (
                            <div
                              key={v.voice_id}
                              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                                on ? "bg-emerald-500/10" : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => selectVoiceCard(voiceId)}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                {v.thumbnail_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={v.thumbnail_image_url}
                                    alt=""
                                    className="h-11 w-11 shrink-0 rounded-lg object-cover border border-white/15"
                                  />
                                ) : (
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-sm font-bold text-orange-100">
                                    {v.name.slice(0, 1)}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold text-zinc-50">
                                    {v.name}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                                    {tag ? (
                                      <span className="text-zinc-400">
                                        #{typecastUseCaseLabel(tag)}
                                      </span>
                                    ) : null}
                                    {genderLabel ? (
                                      <span>
                                        {tag ? " · " : ""}
                                        {genderLabel}
                                      </span>
                                    ) : null}
                                    {v.age ? (
                                      <span>
                                        {" · "}
                                        {TYPECAST_AGE_LABELS[v.age] || v.age}
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                                {on ? (
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#062016]">
                                    <Check className="h-3 w-3" strokeWidth={3} />
                                  </span>
                                ) : null}
                              </button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 border-white/20 bg-zinc-800 text-[11px] text-zinc-100 hover:bg-zinc-700 hover:text-white"
                                disabled={previewingVoiceId === voiceId}
                                onClick={() => {
                                  selectVoiceCard(voiceId)
                                  handlePreviewVoice(voiceId)
                                }}
                              >
                                {previewingVoiceId === voiceId ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Volume2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                미리듣기
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 border-white/20 bg-zinc-800 text-[11px] text-zinc-100 hover:bg-zinc-700 hover:text-white"
                                onClick={() => {
                                  void navigator.clipboard.writeText(v.voice_id)
                                }}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1" />
                                Voice ID
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-zinc-500">성별</span>
                {(
                  [
                    { id: "all", label: "전체" },
                    { id: "female", label: "여성" },
                    { id: "male", label: "남성" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGenderFilter(g.id)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors ${
                      genderFilter === g.id
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
                <span className="text-[11px] text-zinc-600 ml-1">
                  전체 {voiceCards.length + (provider === "supertonic" ? recordedVoiceCards.length : 0)}개
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <UserRound className="h-3.5 w-3.5" />
                보이스 카드
              </div>
            </div>

            {provider === "supertone" && voiceCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-zinc-500">
                「SuperTone 목록 불러오기」를 눌러 보이스를 가져오세요
              </div>
            ) : provider === "supertonic" &&
              voiceCards.length === 0 &&
              recordedVoiceCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-zinc-500">
                Supertonic 보이스가 없습니다. 로컬 서버 연결을 다시 확인해 주세요.
              </div>
            ) : (
              <div className="space-y-4">
                {provider === "supertonic" && recordedVoiceCards.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-violet-200">
                        내 녹음
                        <span className="ml-1 text-zinc-500 font-normal">
                          ({recordedVoiceCards.length})
                        </span>
                      </p>
                      <span className="text-[10px] text-zinc-600">짧은 이름 · 삭제 가능</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      {recordedVoiceCards.map((v) => {
                        const on = selectedVoiceId === v.voiceId
                        const female = v.gender === "female"
                        return (
                          <div
                            key={v.key}
                            className={`relative rounded-xl border p-3 transition-all ${
                              on
                                ? "border-violet-400/55 bg-gradient-to-br from-violet-500/25 to-slate-950/50"
                                : "border-violet-400/20 bg-violet-500/[0.08] hover:border-violet-400/40"
                            }`}
                          >
                            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                              {on ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[#062016]">
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </span>
                              ) : null}
                              <button
                                type="button"
                                title="삭제"
                                disabled={deletingVoiceId === v.bareId}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void deleteRecordedVoice(v.bareId)
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/40 text-zinc-400 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200"
                              >
                                {deletingVoiceId === v.bareId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => selectVoiceCard(v.voiceId)}
                              className="w-full text-left pr-5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-400/25 text-[12px] font-bold text-violet-100">
                                  {v.code}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[14px] font-semibold text-zinc-50 truncate">
                                    {v.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-500 mt-0.5">
                                    {female ? "여성" : "남성"} · 내 녹음
                                  </p>
                                </div>
                              </div>
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2.5 h-7 w-full border-white/15 bg-black/25 text-[11px] text-zinc-200"
                              disabled={previewingVoiceId === v.voiceId}
                              onClick={(e) => {
                                e.stopPropagation()
                                selectVoiceCard(v.voiceId)
                                handlePreviewVoice(v.voiceId)
                              }}
                            >
                              {previewingVoiceId === v.voiceId ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Volume2 className="h-3 w-3 mr-1" />
                              )}
                              미리듣기
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {provider === "supertonic" && voiceCards.length > 0 ? (
                  <p className="text-[12px] font-semibold text-zinc-400">
                    기본 · 커스텀
                    <span className="ml-1 text-zinc-600 font-normal">({voiceCards.length})</span>
                  </p>
                ) : null}

                {voiceCards.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {voiceCards.map((v) => {
                      const on = selectedVoiceId === v.voiceId
                      const female = v.gender === "female"
                      return (
                        <div
                          key={v.key}
                          className={`relative rounded-xl border p-3 transition-all ${
                            on
                              ? female
                                ? "border-rose-400/50 bg-gradient-to-br from-rose-500/25 to-rose-950/40"
                                : "border-sky-400/50 bg-gradient-to-br from-sky-500/20 to-slate-950/50"
                              : female
                                ? "border-rose-400/15 bg-rose-500/[0.07] hover:border-rose-400/35"
                                : "border-sky-400/15 bg-sky-500/[0.07] hover:border-sky-400/35"
                          }`}
                        >
                          {on ? (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[#062016]">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => selectVoiceCard(v.voiceId)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-2">
                              {v.thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={v.thumb}
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover border border-white/15"
                                />
                              ) : (
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                    female
                                      ? "bg-rose-400/25 text-rose-100"
                                      : "bg-sky-400/25 text-sky-100"
                                  }`}
                                >
                                  {String(v.code).slice(0, 2)}
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-zinc-50 truncate">
                                  {v.name}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {female ? "여성" : "남성"}
                                  {v.note ? ` · ${v.note}` : ""}
                                </p>
                              </div>
                            </div>
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2.5 h-7 w-full border-white/15 bg-black/25 text-[11px] text-zinc-200"
                            disabled={previewingVoiceId === v.voiceId}
                            onClick={(e) => {
                              e.stopPropagation()
                              selectVoiceCard(v.voiceId)
                              handlePreviewVoice(v.voiceId)
                            }}
                          >
                            {previewingVoiceId === v.voiceId ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Volume2 className="h-3 w-3 mr-1" />
                            )}
                            미리듣기
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </Ver2StepPanel>

      {/* 생성 옵션 + 결과 + 액션 */}
      <Ver2StepPanel
        eyebrow="Generate"
        title="생성 옵션"
        description="각 장면의 대본을 개별 합성한 뒤 순서대로 연결합니다."
        right={
          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-100">
            {ttsSpeed.toFixed(2)}x · 장면 {sceneItems.length}
          </span>
        }
      >
        <div className="space-y-4">
        <div className="max-w-md space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <Label className="text-zinc-300">배속 (생성·미리듣기)</Label>
            <span className="tabular-nums text-sky-200 font-semibold">
              {ttsSpeed.toFixed(2)}x
            </span>
          </div>
          <Slider
            min={0.5}
            max={2}
            step={0.05}
            value={[ttsSpeed]}
            onValueChange={(v) => setTtsSpeed(Array.isArray(v) ? v[0] : 1.2)}
          />
          <p className="text-[11px] text-zinc-500">
            엔진별 허용 범위로 자동 조정됩니다 (예: ElevenLabs 0.8~1.5)
          </p>
        </div>

        {(isGeneratingTTS || ttsProgress.total > 0) && (
          <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 px-3 py-2.5">
            <div className="flex justify-between text-[11px] text-orange-100 mb-1">
              <span className="font-semibold">GENERATING</span>
              <span className="tabular-nums">
                {ttsProgress.current}/{Math.max(1, ttsProgress.total)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-400 transition-all"
                style={{
                  width: `${
                    ttsProgress.total > 0
                      ? Math.min(100, (ttsProgress.current / ttsProgress.total) * 100)
                      : isGeneratingTTS
                        ? 40
                        : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {!hasAudio ? (
          <div className="rounded-xl border border-dashed border-white/12 bg-black/20 px-4 py-10 text-center">
            <Music2 className="mx-auto h-8 w-8 text-orange-300/70 mb-2" />
            <p className="text-sm text-zinc-300">아직 AI 음성이 없습니다</p>
            <p className="text-xs text-zinc-500 mt-1">
              보이스를 고른 뒤 아래에서 생성하거나 업로드·녹음하세요
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-sm font-semibold text-emerald-100">프리뷰 사용 중</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                onClick={() => {
                  void (async () => {
                    if (!audioSrc) return
                    try {
                      const response = await fetch(audioSrc)
                      if (!response.ok) throw new Error("오디오를 가져오지 못했습니다.")
                      const blob = await response.blob()
                      const mime = (blob.type || "").toLowerCase()
                      const ext = mime.includes("mpeg") || mime.includes("mp3")
                        ? "mp3"
                        : mime.includes("ogg")
                          ? "ogg"
                          : "wav"
                      const objectUrl = URL.createObjectURL(blob)
                      const anchor = document.createElement("a")
                      anchor.href = objectUrl
                      anchor.download = `ai-shopping-tts-${Date.now()}.${ext}`
                      document.body.appendChild(anchor)
                      anchor.click()
                      anchor.remove()
                      URL.revokeObjectURL(objectUrl)
                    } catch (error) {
                      console.error("[AiVoice] TTS 다운로드 실패:", error)
                      alert(
                        error instanceof Error
                          ? error.message
                          : "음성 파일을 컴퓨터에 저장하지 못했습니다."
                      )
                    }
                  })()
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                컴퓨터에 저장
              </Button>
            </div>
            <audio
              ref={resultAudioRef}
              controls
              src={audioSrc}
              className="w-full"
              preload="auto"
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = 1
              }}
            />
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              프로젝트 저장 시 AI 음성은 서버(Supabase)에도 올라갑니다. 업로드가 안 되면 이
              버튼으로 PC에 받아 두세요.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Button
            onClick={handleGenerateTTS}
            disabled={isGeneratingTTS || !script.trim()}
            className="h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold shadow-lg shadow-orange-500/25 sm:col-span-2"
          >
            {isGeneratingTTS ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                생성 중…
              </>
            ) : ttsAudioUrl ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                AI 음성 재생성
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                장면별 AI 음성 생성
              </>
            )}
          </Button>
          <input
            ref={uploadRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 border-white/15 bg-white/[0.03] text-zinc-200"
            onClick={() => uploadRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            음원 업로드
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 border-violet-400/35 bg-violet-500/10 text-violet-100"
            onClick={() => {
              setRecordMode(provider === "supertonic" ? "train" : "narrate")
              setRecordedVoiceUrl("")
              setRecordSeconds(0)
              setShowRecordingDialog(true)
            }}
          >
            <Mic className="w-4 h-4 mr-2" />
            내 목소리 녹음
          </Button>
        </div>

        {provider === "supertonic" ? (
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/[0.08] p-3 space-y-3">
            <div>
              <p className="text-[12px] font-semibold text-violet-100">녹음 2가지</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                ① 학습용 10초 → 자동 JSON·등록 · ② 대본 낭독 → 나레이션으로 사용
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-10 bg-violet-600 hover:bg-violet-500 text-white"
                onClick={() => {
                  setRecordMode("train")
                  setRecordedVoiceUrl("")
                  setRecordSeconds(0)
                  setShowRecordingDialog(true)
                }}
              >
                <Mic className="w-4 h-4 mr-2" />
                학습용 녹음 (10초)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-violet-400/40 bg-violet-500/10 text-violet-100"
                onClick={() => {
                  setRecordMode("narrate")
                  setRecordedVoiceUrl("")
                  setRecordSeconds(0)
                  setShowRecordingDialog(true)
                }}
              >
                <Mic className="w-4 h-4 mr-2" />
                대본 나레이션 녹음
              </Button>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-300/90 hover:text-red-200 hover:bg-red-500/10"
          onClick={clearAudio}
          disabled={!hasAudio}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          전체 삭제
        </Button>
        </div>
      </Ver2StepPanel>

      <Dialog
        open={showRecordingDialog}
        onOpenChange={(open) => {
          setShowRecordingDialog(open)
          if (!open) {
            if (localRecording) stopWaveRecording()
            else if (isRecordingVoice) handleStopRecording()
          }
        }}
      >
        <DialogContent className="bg-[#141518] border-white/10 text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-50">
              <Mic className="w-5 h-5 text-orange-400" />
              {recordMode === "train" ? "학습용 녹음 (10초)" : "대본 나레이션 녹음"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {recordMode === "train"
                ? "조용한 곳에서 약 10초 녹음하면 JSON으로 변환되어 Supertonic 3에 바로 등록됩니다."
                : "대본을 그대로 읽으세요. 완료 후 숏폼 나레이션으로 바로 사용할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "train" as const, label: "학습용 10초" },
                  { id: "narrate" as const, label: "대본 나레이션" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={localRecording}
                  onClick={() => {
                    setRecordMode(m.id)
                    setRecordedVoiceUrl("")
                    setRecordSeconds(0)
                  }}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    recordMode === m.id
                      ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="max-h-36 overflow-y-auto p-3 bg-black/40 rounded-lg border border-white/15 text-sm text-zinc-300 whitespace-pre-wrap">
              {recordMode === "train"
                ? TRAIN_SAMPLE_SCRIPT
                : editedScript || script || "대본이 없습니다."}
            </div>

            {recordMode === "train" ? (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>진행</span>
                  <span>
                    {Math.min(recordSeconds, TRAIN_SAMPLE_SECONDS)} / {TRAIN_SAMPLE_SECONDS}초
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{
                      width: `${Math.min(100, (recordSeconds / TRAIN_SAMPLE_SECONDS) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="relative">
              <VoiceRecordWaveform
                analyser={recordAnalyser}
                audioUrl={!localRecording ? recordedVoiceUrl || undefined : undefined}
                active={localRecording}
              />
              <div className="absolute left-3 top-2 flex items-center gap-2 text-[11px] font-semibold">
                {localRecording ? (
                  <>
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-red-200">
                      REC {formatRecTime(recordSeconds)}
                      {recordMode === "train" ? ` / ${TRAIN_SAMPLE_SECONDS}s` : ""}
                    </span>
                  </>
                ) : recordedVoiceUrl ? (
                  <span className="text-emerald-300">녹음 완료 · 파형 미리보기</span>
                ) : (
                  <span className="text-zinc-500">녹음 대기</span>
                )}
              </div>
            </div>

            {!localRecording ? (
              <Button
                onClick={() => void startWaveRecording()}
                className="w-full bg-red-500 hover:bg-red-600 text-white"
              >
                <Mic className="w-4 h-4 mr-2" />
                {recordMode === "train" ? "10초 학습 녹음 시작" : "나레이션 녹음 시작"}
              </Button>
            ) : (
              <Button
                onClick={stopWaveRecording}
                className="w-full border border-white/20 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              >
                <Square className="w-4 h-4 mr-2" />
                녹음 정지
                {recordMode === "train" ? " (10초면 자동 정지)" : ""}
              </Button>
            )}
            {recordedVoiceUrl && !localRecording ? (
              <div className="space-y-2">
                <audio controls src={recordedVoiceUrl} className="w-full" />
                {recordMode === "train" ? (
                  <>
                    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <p className="text-[11px] text-zinc-400">등록 이름</p>
                      <p className="text-sm font-semibold text-violet-100 mt-0.5">
                        {trainVoiceName || "자동 (내1, 내2 …)"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      disabled={isRegisteringVoice || !recordedVoiceUrl}
                      onClick={() => void registerTrainedVoice()}
                      className="w-full bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      {isRegisteringVoice ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          JSON 변환 · 등록 중…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          JSON 변환 후 보이스 등록
                        </>
                      )}
                    </Button>
                    {trainStatusMsg ? (
                      <p className="text-[11px] text-violet-200/90 leading-relaxed">{trainStatusMsg}</p>
                    ) : (
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        녹음을 JSON 스타일로 변환해 로컬 Supertonic 3에 바로 등록합니다. serve가
                        켜져 있어야 합니다.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isRegisteringVoice}
                        onClick={() => void downloadTrainSample()}
                        className="border-white/20 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        WAV 저장
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isRegisteringVoice}
                        onClick={() => trainJsonInputRef.current?.click()}
                        className="border-white/20 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      >
                        <Upload className="w-4 h-4 mr-1.5" />
                        JSON으로 등록
                      </Button>
                    </div>
                    <input
                      ref={trainJsonInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) void registerTrainedVoice(f)
                      }}
                    />
                  </>
                ) : (
                  <Button
                    onClick={handleSaveRecordedVoice}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    이 녹음을 나레이션으로 사용
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/20 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  disabled={isRegisteringVoice}
                  onClick={() => {
                    setRecordedVoiceUrl("")
                    setRecordSeconds(0)
                    recordBlobRef.current = null
                    setTrainStatusMsg("")
                  }}
                >
                  다시 녹음
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Ver2StepShell>
  )
}

function formatRecTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
