"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import "../longform-v2.css"
import { ApiKeyStatusCard, LongformV2ApiSettingsModal } from "../ApiSettingsModal"
import { ScriptWorkspacePanel } from "../components/ScriptWorkspacePanel"
import { ProductionPanel } from "../components/ProductionPanel"
import { YoutubeMetaPanel } from "../components/YoutubeMetaPanel"
import { AnalyzeLoadingOverlay } from "../components/AnalyzeLoadingOverlay"
import { loadApiKeys, type LongformV2ApiKeys } from "@/lib/longform-v2/api-keys"
import { enforceV2ScriptLineFormat, splitScriptIntoSceneLines } from "@/lib/longform-v2/script-utils"
import {
  loadProject,
  loadProjectAsync,
  migrateProjectMediaOutOfLocalStorage,
  saveProject,
  type LongformV2Project,
  type SceneAsset,
  type StepId,
} from "@/lib/longform-v2/project-storage"
import {
  assignSceneBgKinds,
  batchHasPendingWork,
  sceneHasPendingBatchWork,
  type BatchGeneratePlan,
} from "@/lib/longform-v2/batch-generate"
import {
  estimateNarrationDurationSec,
  type MotionVideoResolution,
} from "@/lib/longform-v2/motion-video"
import { elevenlabsVoiceOptions } from "@/lib/longform-v2/voice-personas"
import { SUPERTONIC_BUILTIN_VOICES } from "@/lib/supertonic-local"
import {
  fetchSupertonicHealth,
  fetchSupertonicTts,
  fetchSupertonicVoices,
} from "@/lib/supertonic-runtime-client"

type VoiceOption = { id: string; label: string }

const ELEVEN_FALLBACK: VoiceOption[] = elevenlabsVoiceOptions()

export default function LongformV2WorkspacePage() {
  const params = useParams()
  const id = String(params?.id || "")
  const router = useRouter()

  const [project, setProject] = useState<LongformV2Project | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState("")
  const [batchSession, setBatchSession] = useState<BatchGeneratePlan | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<LongformV2ApiKeys>(() => loadApiKeys())
  const [voices, setVoices] = useState<VoiceOption[]>(
    SUPERTONIC_BUILTIN_VOICES.map((v) => ({ id: v.voice_id, label: v.name }))
  )
  const [supertonicStatus, setSupertonicStatus] = useState<string>("확인 중…")
  const projectRef = useRef<LongformV2Project | null>(null)
  const batchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    projectRef.current = project
  }, [project])

  const batchCanResume = useMemo(() => {
    if (!batchSession || !project || batchProgress) return false
    return batchHasPendingWork(project.scenes, batchSession)
  }, [batchSession, project, batchProgress])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      // 예전 저장본에 data URL이 들어 있으면 IndexedDB로 옮김
      const migrated = await migrateProjectMediaOutOfLocalStorage(id)
      const p = migrated || (await loadProjectAsync(id)) || loadProject(id)
      if (cancelled) return
      if (!p) {
        setMissing(true)
        return
      }
      setProject(p)
      setApiKeys(loadApiKeys())
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!project) return
    let cancelled = false
    void loadVoicesForEngine(project.ttsEngine, () => cancelled)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.ttsEngine, settingsOpen])

  async function loadVoicesForEngine(
    engine: LongformV2Project["ttsEngine"],
    isCancelled?: () => boolean
  ) {
    const keys = loadApiKeys()
    const cancelled = () => isCancelled?.() === true
    try {
      if (engine === "supertonic") {
        const health = await fetchSupertonicHealth()
        if (cancelled()) return
        setSupertonicStatus(
          health.online
            ? `연결됨 · ${health.model || "supertonic-3"} · ${health.baseUrl || "127.0.0.1:7788"}`
            : health.message ||
                "꺼져 있습니다. 「Supertonic 자동 연결」을 누르면 Mac/Windows에 맞게 설치·기동합니다."
        )
        const res = await fetchSupertonicVoices()
        const data = await res.json().catch(() => ({}))
        if (cancelled()) return
        const list = (data.voices || [])
          .map((v: { voice_id?: string; id?: string; name?: string }) => ({
            id: String(v.voice_id || v.id || ""),
            label: String(v.name || v.voice_id || "voice"),
          }))
          .filter((v: VoiceOption) => v.id)
        setVoices(
          list.length
            ? list
            : SUPERTONIC_BUILTIN_VOICES.map((v) => ({ id: v.voice_id, label: v.name }))
        )
        return
      }
      setSupertonicStatus("")
      if (engine === "supertone") {
        if (!keys.supertone) {
          setVoices([{ id: "default", label: "Supertone 키 필요" }])
          return
        }
        const res = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(keys.supertone)}`)
        const data = await res.json()
        if (cancelled()) return
        const list = (data.voices || data.data || [])
          .map(
            (v: {
              id?: string
              voice_id?: string
              name?: string
              gender?: string
            }) => ({
              id: String(v.id || v.voice_id || ""),
              label: String(v.name || v.id || "voice"),
            })
          )
          .filter((v: VoiceOption) => v.id)
        setVoices(list.length ? list : [{ id: "default", label: "음성 목록 없음" }])
        return
      }
      // elevenlabs
      if (!keys.elevenlabs) {
        setVoices(ELEVEN_FALLBACK)
        return
      }
      const res = await fetch(`/api/elevenlabs-voices?apiKey=${encodeURIComponent(keys.elevenlabs)}`)
      const data = await res.json()
      if (cancelled()) return
      const list = (data.voices || [])
        .map((v: { voice_id?: string; voiceId?: string; name?: string }) => ({
          id: String(v.voice_id || v.voiceId || ""),
          label: String(v.name || v.voice_id || "voice"),
        }))
        .filter((v: VoiceOption) => v.id)
      // 샘플 추천 보이스를 앞에 두고 API 목록과 합침
      if (list.length) {
        const seen = new Set(list.map((v: VoiceOption) => v.id))
        setVoices([...ELEVEN_FALLBACK.filter((s) => !seen.has(s.id)), ...list])
      } else {
        setVoices(ELEVEN_FALLBACK)
      }
    } catch {
      if (cancelled()) return
      if (engine === "supertonic") {
        setVoices(SUPERTONIC_BUILTIN_VOICES.map((v) => ({ id: v.voice_id, label: v.name })))
        setSupertonicStatus("상태 확인 실패 — 로컬 serve가 켜져 있는지 확인하세요.")
      } else if (engine === "supertone") {
        setVoices([{ id: "default", label: "Supertone 목록 로드 실패" }])
      } else {
        setVoices(ELEVEN_FALLBACK)
      }
    }
  }

  const persist = useCallback((next: LongformV2Project) => {
    const saved = saveProject(next)
    setProject(saved)
    return saved
  }, [])

  const patch = useCallback(
    (partial: Partial<LongformV2Project>) => {
      setProject((prev) => {
        if (!prev) return prev
        return persist({ ...prev, ...partial })
      })
    },
    [persist]
  )

  const openSettings = () => {
    setApiKeys(loadApiKeys())
    setSettingsOpen(true)
  }

  if (missing) {
    return (
      <div
        className="lfv2-app"
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p style={{ color: "#a1a1aa" }}>프로젝트를 찾을 수 없습니다.</p>
        <button
          type="button"
          className="lfv2-btn lfv2-btn--primary"
          onClick={() => router.push("/WingsAIStudio/longform-v2")}
        >
          목록으로
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="lfv2-app" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="lfv2-spin" />
      </div>
    )
  }

  async function runAnalyzeAndPlan() {
    if (!project) return
    setError(null)
    setInfo(null)
    const geminiApiKey = loadApiKeys().gemini
    if (!geminiApiKey) {
      setError("Gemini API 키가 필요합니다. (WingsStudio와 동일)")
      openSettings()
      return
    }
    if (project.benchmarkText.trim().length < 200) {
      setError("벤치마킹 대본을 최소 200자 이상 붙여넣어 주세요.")
      return
    }

    setBusy("벤치마킹 대본 분석 중…")
    try {
      const analyzeRes = await fetch("/api/longform-v2/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benchmarkScript: project.benchmarkText, geminiApiKey }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok || !analyzeData.success) throw new Error(analyzeData.error || "분석 실패")

      setBusy("AI 기획안 작성 중…")
      const planRes = await fetch("/api/longform-v2/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benchmarkScript: project.benchmarkText,
          analysis: analyzeData.analysis,
          topicDirection: project.topicDirection,
          targetChars: project.targetChars,
          geminiApiKey,
        }),
      })
      const planData = await planRes.json()
      if (!planRes.ok || !planData.success) throw new Error(planData.error || "기획 실패")

      patch({
        analysis: analyzeData.analysis,
        planMarkdown: planData.planMarkdown || "",
        scriptSub: "plan",
        step: "script",
      })
      setInfo("기획안이 준비되었습니다.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "기획 실패")
    } finally {
      setBusy(null)
    }
  }

  async function runGenerateScript() {
    if (!project) return
    setError(null)
    setInfo(null)
    const geminiApiKey = loadApiKeys().gemini
    if (!geminiApiKey) {
      setError("Gemini API 키가 필요합니다.")
      openSettings()
      return
    }
    if (!project.planMarkdown.trim()) {
      setError("기획안이 없습니다.")
      return
    }

    setBusy("AI 대본 생성 중…")
    try {
      const res = await fetch("/api/longform-v2/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          benchmarkScript: project.benchmarkText,
          planMarkdown: project.planMarkdown,
          analysis: project.analysis,
          topicDirection: project.topicDirection,
          targetChars: project.targetChars,
          geminiApiKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "대본 생성 실패")

      const lines = splitScriptIntoSceneLines(data.script)
      patch({
        scriptText: data.script,
        scriptSub: "script",
        scenes: lines.map((text, index) => ({ index, text })),
        step: "script",
      })
      setInfo(`대본 생성 완료 · ${Number(data.charCount || data.script.length).toLocaleString()}자`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "대본 생성 실패")
    } finally {
      setBusy(null)
    }
  }

  function applyExternalScript() {
    if (!project?.benchmarkText.trim()) {
      setError("대본을 붙여넣은 뒤 사용할 수 있습니다.")
      return
    }
    const formatted = enforceV2ScriptLineFormat(project.benchmarkText)
    const lines = splitScriptIntoSceneLines(formatted)
    patch({
      benchmarkText: formatted,
      scriptText: formatted,
      scriptSub: "script",
      scenes: lines.map((text, index) => ({ index, text })),
      step: "script",
    })
    setInfo("외부 대본을 저장했습니다.")
    setError(null)
  }

  function goVoiceImage() {
    if (!project?.scriptText.trim()) {
      setError("저장된 대본이 없습니다. 「프로젝트에 저장」또는 「대본 저장」을 먼저 하세요.")
      return
    }
    const lines = splitScriptIntoSceneLines(project.scriptText)
    const scenes = lines.map((text, index) => {
      const prev = project.scenes.find((s) => s.index === index)
      return prev ? { ...prev, text } : { index, text }
    })
    patch({ step: "voice-image", scenes, productionTab: project.productionTab || "style" })
    setError(null)
    setInfo(`장면 ${scenes.length}개`)
  }

  async function composeSceneVideo(
    sceneIndex: number,
    opts: { imageUrl?: string; motionVideoUrl?: string; audioUrl: string },
  ) {
    const form = new FormData()
    const motion = (opts.motionVideoUrl || "").trim()
    const image = (opts.imageUrl || "").trim()
    const audioUrl = opts.audioUrl

    if (motion) {
      if (motion.startsWith("http://") || motion.startsWith("https://")) {
        form.append("videoUrl", motion)
      } else {
        const vBlob = await (await fetch(motion)).blob()
        form.append("video", vBlob, "motion.mp4")
      }
    } else if (image) {
      if (image.startsWith("http://") || image.startsWith("https://")) {
        form.append("imageUrl", image)
      } else {
        const imgBlob = await (await fetch(image)).blob()
        form.append("image", imgBlob, "still.png")
      }
    } else {
      throw new Error("최종영상 합성에 이미지 또는 AI 영상이 필요합니다.")
    }

    if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
      form.append("audioUrl", audioUrl)
    } else {
      const audBlob = await (await fetch(audioUrl)).blob()
      form.append("audio", audBlob, "voice.wav")
    }

    const res = await fetch("/api/longform-v2/compose-scene", {
      method: "POST",
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      throw new Error(data.error || "최종영상 합성 실패")
    }
    const videoUrl = String(data.videoUrl || "")
    if (!videoUrl) throw new Error("최종영상 URL이 없습니다.")
    void sceneIndex
    return videoUrl
  }

  async function generateOneScene(
    sceneIndex: number,
    mode: "tts" | "image" | "both" | "video",
    opts?: {
      imageKind?: "ai" | "stock"
      stockKeyword?: string
      /** 세분화된 작업 플래그 (있으면 mode보다 우선) */
      tasks?: BatchGeneratePlan["tasks"]
      /** true면 기존 자산도 다시 생성 */
      overwrite?: boolean
      signal?: AbortSignal
    }
  ) {
    const live = projectRef.current
    if (!live) return
    const k = loadApiKeys()
    setApiKeys(k)
    setError(null)
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const scene = live.scenes.find((s) => s.index === sceneIndex)
    if (!scene) return

    const tasks = opts?.tasks
    const overwrite = !!opts?.overwrite
    let doTts = tasks ? tasks.tts : mode === "tts" || mode === "both"
    let doImage = tasks ? tasks.image : mode === "image" || mode === "both"
    let doPrompt = tasks ? tasks.prompt || (tasks.image && opts?.imageKind !== "stock") : doImage
    /** 단건「최종영상」클릭은 항상 재합성. 그 외는 both/tts/image 후 자동 합성 */
    let wantVideo =
      mode === "video"
        ? true
        : tasks
          ? tasks.video
          : mode === "both" || mode === "tts" || mode === "image"

    // 이어하기: 이미 있는 자산은 건너뜀 (단, mode=video 는 최종영상 강제 재합성)
    if (!overwrite) {
      if (doTts && scene.audioUrl) doTts = false
      if (doPrompt && scene.prompt?.trim() && !doImage) doPrompt = false
      if (doImage && scene.imageUrl) {
        doImage = false
        doPrompt = false
      }
      if (wantVideo && scene.videoUrl && mode !== "video") wantVideo = false
    }

    if (!doTts && !doImage && !doPrompt && !wantVideo) {
      return
    }

    const updateScene = (partial: Partial<SceneAsset>) => {
      setProject((prev) => {
        if (!prev) return prev
        const scenes = prev.scenes.map((s) => (s.index === sceneIndex ? { ...s, ...partial } : s))
        const next = persist({ ...prev, scenes })
        projectRef.current = next
        return next
      })
    }

    try {
      let latestImage = scene.imageUrl
      let latestAudio = scene.audioUrl
      let latestPrompt = scene.prompt
      const imageKind = opts?.imageKind || "ai"
      const proj = projectRef.current || live

      if (doTts) {
        const engine = proj.ttsEngine || "supertonic"
        if (engine === "supertonic") {
          updateScene({ busy: "Supertonic 3 음성 생성…", error: null })
          const bare = String(proj.voiceId || "F1").replace(/^supertonic-/, "")
          const ttsRes = await fetchSupertonicTts({
            text: scene.text,
            voiceId: bare,
            lang: proj.ttsLanguage === "English" ? "en" : proj.ttsLanguage === "日本語" ? "ja" : "ko",
            speed: proj.ttsSpeed ?? 1.05,
          })
          const ttsData = await ttsRes.json()
          if (!ttsRes.ok || ttsData.success === false) {
            throw new Error(
              ttsData.error ||
                "Supertonic TTS 실패. 로컬에서 `supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3` 를 실행하세요."
            )
          }
          const audioUrl = ttsData.audioUrl || ttsData.url
          if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
          latestAudio = audioUrl
          updateScene({
            audioUrl,
            ttsDurationSec: estimateNarrationDurationSec(scene.text),
            busy: doImage || doPrompt ? "이미지 준비…" : null,
          })
        } else if (engine === "supertone") {
          if (!k.supertone) {
            openSettings()
            throw new Error("Supertone(클라우드) API 키가 필요합니다.")
          }
          updateScene({ busy: "Supertone 음성 생성…", error: null })
          const ttsRes = await fetch("/api/supertone-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: scene.text,
              voiceId: proj.voiceId,
              apiKey: k.supertone,
              language: "ko",
            }),
          })
          const ttsData = await ttsRes.json()
          if (!ttsRes.ok || ttsData.success === false) throw new Error(ttsData.error || "Supertone TTS 실패")
          const audioUrl = ttsData.audioUrl || ttsData.url
          if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
          latestAudio = audioUrl
          updateScene({
            audioUrl,
            ttsDurationSec: estimateNarrationDurationSec(scene.text),
            busy: doImage || doPrompt ? "이미지 준비…" : null,
          })
        } else {
          if (!k.elevenlabs) {
            openSettings()
            throw new Error("ElevenLabs API 키가 필요합니다.")
          }
          updateScene({ busy: "ElevenLabs 음성 생성…", error: null })
          const ttsRes = await fetch("/api/elevenlabs-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: scene.text,
              voiceId: proj.voiceId,
              apiKey: k.elevenlabs,
              speed: proj.ttsSpeed ?? 1.0,
            }),
          })
          const ttsData = await ttsRes.json()
          if (!ttsRes.ok || ttsData.success === false) throw new Error(ttsData.error || "ElevenLabs TTS 실패")
          const audioUrl = ttsData.audioUrl
          if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
          latestAudio = audioUrl
          updateScene({
            audioUrl,
            ttsDurationSec: estimateNarrationDurationSec(scene.text),
            busy: doImage || doPrompt ? "이미지 준비…" : null,
          })
        }
      }

      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError")

      if (doImage && imageKind === "stock") {
        const query =
          (opts?.stockKeyword || "").trim() ||
          (scene.stockSearchKeywordsKo || "").trim() ||
          ""
        if (!query) throw new Error("실사 장면 스톡 검색어가 없습니다.")
        if (!k.pexels) {
          openSettings()
          throw new Error("Pexels API 키가 필요합니다. API 설정에서 등록하세요.")
        }
        updateScene({
          busy: "Pexels 실사 스톡 영상 검색… (검색어 자동 조정)",
          error: null,
          stockSearchKeywordsKo: query,
        })
        const excludeVideoIds = (projectRef.current?.scenes || [])
          .map((s) => {
            const m =
              /^stock:pexels-video:(\d+)/.exec(s.prompt || "") ||
              /^stock:pexels:(\d+)/.exec(s.prompt || "")
            return m ? Number(m[1]) : NaN
          })
          .filter((n) => Number.isFinite(n))
        const stockRes = await fetch("/api/longform-v2/stock-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, apiKey: k.pexels, excludeVideoIds }),
        })
        const stockData = await stockRes.json()
        if (!stockRes.ok || !stockData.success) {
          throw new Error(stockData.error || "스톡 영상 검색 실패")
        }
        const stockVideoUrl = String(stockData.videoUrl || "").trim()
        const stockPoster = String(
          stockData.thumbnailUrl || stockData.imageUrl || "",
        ).trim()
        if (!stockVideoUrl) {
          throw new Error("Pexels 스톡 영상 URL이 없습니다.")
        }
        latestImage = stockPoster || stockVideoUrl
        const videoId =
          stockData.videoId != null
            ? Number(stockData.videoId)
            : stockData.photoId != null
              ? Number(stockData.photoId)
              : null
        const effectiveQuery =
          typeof stockData.usedVariant === "string" && stockData.usedVariant.trim()
            ? stockData.usedVariant.trim()
            : query
        latestPrompt =
          videoId != null && Number.isFinite(videoId)
            ? `stock:pexels-video:${videoId}:${effectiveQuery}`
            : `stock:video:${effectiveQuery}`
        updateScene({
          imageUrl: stockPoster || undefined,
          motionVideoUrl: stockVideoUrl,
          // 새 스톡 영상이면 옛 최종영상 무효
          videoUrl: undefined,
          prompt: latestPrompt,
          stockSearchKeywordsKo: effectiveQuery,
          error: null,
          busy: wantVideo ? "스톡영상+TTS 최종영상 합성…" : null,
        })
      } else if (doImage || (doPrompt && imageKind === "ai")) {
        if (doImage || doPrompt) {
          if (!k.gemini) {
            openSettings()
            throw new Error("Gemini API 키가 필요합니다.")
          }
        }
        if (doImage && !k.replicate) {
          openSettings()
          throw new Error("Replicate API 키가 필요합니다.")
        }

        if (doPrompt || doImage) {
          updateScene({ busy: "이미지 프롬프트 작성…", error: null })
          const promptRes = await fetch("/api/longform-v2/scene-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sceneText: scene.text,
              styleHint: proj.styleHint,
              geminiApiKey: k.gemini,
            }),
            signal: opts?.signal,
          })
          const promptData = await promptRes.json()
          if (!promptRes.ok || !promptData.success) throw new Error(promptData.error || "프롬프트 실패")
          latestPrompt = promptData.prompt
          updateScene({ prompt: promptData.prompt, busy: doImage ? "이미지 생성 중…" : null })

          if (doImage) {
            const imgController = new AbortController()
            const onAbort = () => imgController.abort()
            opts?.signal?.addEventListener("abort", onAbort)
            const imgTimer = window.setTimeout(() => imgController.abort(), 180_000)
            let imgRes: Response
            try {
              imgRes = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  scriptText: scene.text,
                  customPrompt: promptData.prompt,
                  replicateApiKey: k.replicate,
                }),
                signal: imgController.signal,
              })
            } catch (e) {
              if (e instanceof Error && e.name === "AbortError") {
                if (opts?.signal?.aborted) throw e
                throw new Error("이미지 생성 시간이 너무 오래 걸립니다(3분). Replicate 상태·키를 확인하세요.")
              }
              throw e
            } finally {
              window.clearTimeout(imgTimer)
              opts?.signal?.removeEventListener("abort", onAbort)
            }
            const imgData = await imgRes.json()
            if (!imgRes.ok || !imgData.success) throw new Error(imgData.error || "이미지 생성 실패")
            latestImage = imgData.imageUrl
            updateScene({
              imageUrl: imgData.imageUrl,
              prompt: imgData.prompt || promptData.prompt,
              busy: wantVideo ? "최종영상 합성…" : null,
            })
          }
        }
      }

      if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError")

      const latestMotion =
        projectRef.current?.scenes.find((s) => s.index === sceneIndex)?.motionVideoUrl ||
        scene.motionVideoUrl
      const hasVisualForVideo = !!(latestMotion || latestImage)
      const needVideo = wantVideo && hasVisualForVideo && !!latestAudio

      if (needVideo) {
        updateScene({
          busy: latestMotion
            ? "AI영상+TTS 최종영상 합성…"
            : "최종영상 합성…",
          error: null,
          // 재합성 중에는 옛 최종영상을 숨겨 UI가 바뀌는 걸 보이게
          ...(mode === "video" ? { videoUrl: undefined } : {}),
        })
        const videoUrl = await composeSceneVideo(sceneIndex, {
          motionVideoUrl: latestMotion,
          imageUrl: latestImage,
          audioUrl: latestAudio!,
        })
        updateScene({ videoUrl, busy: null })
        if (mode === "video") {
          setInfo(
            latestMotion
              ? `장면 ${sceneIndex + 1}: AI 영상 + TTS를 최종영상으로 합성했습니다.`
              : `장면 ${sceneIndex + 1}: 이미지 + TTS를 최종영상으로 합성했습니다.`,
          )
        }
      } else if (wantVideo && mode === "video" && !tasks) {
        throw new Error(
          latestAudio
            ? "최종영상은 이미지 또는 AI 영상이 필요합니다."
            : "최종영상은 TTS(음성)와 이미지(또는 AI 영상)가 모두 있어야 합니다.",
        )
      } else {
        updateScene({ busy: null })
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        updateScene({ busy: null })
        throw e
      }
      updateScene({ busy: null, error: e instanceof Error ? e.message : "생성 실패" })
    }
  }

  async function batchGenerate(plan: BatchGeneratePlan) {
    if (!projectRef.current) return
    setError(null)
    setBatchSession(plan)
    const overwrite = !!plan.overwrite
    const kinds = assignSceneBgKinds(plan.sceneIndexes, plan.videoBgMode, plan.aiRatioPercent)
    const targets = plan.sceneIndexes
    const ac = new AbortController()
    batchAbortRef.current?.abort()
    batchAbortRef.current = ac
    let aborted = false
    try {
      for (let i = 0; i < targets.length; i++) {
        if (ac.signal.aborted) {
          aborted = true
          break
        }
        const sceneIndex = targets[i]!
        const live = projectRef.current
        const scene = live?.scenes.find((s) => s.index === sceneIndex)
        if (
          scene &&
          !overwrite &&
          !sceneHasPendingBatchWork(scene, plan.tasks, false)
        ) {
          continue
        }
        setBatchProgress(
          `${overwrite ? "재생성" : "일괄 생성"} ${i + 1}/${targets.length} · 장면 ${sceneIndex + 1}`
        )
        const imageKind = kinds.get(sceneIndex) || "ai"
        await generateOneScene(sceneIndex, "both", {
          tasks: plan.tasks,
          imageKind,
          stockKeyword: plan.stockKeywords[sceneIndex],
          overwrite,
          signal: ac.signal,
        })
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        aborted = true
      } else {
        setError(e instanceof Error ? e.message : "일괄 생성 실패")
      }
    } finally {
      batchAbortRef.current = null
      setBatchProgress("")
      const final = projectRef.current
      if (final && batchHasPendingWork(final.scenes, plan)) {
        setInfo(
          aborted
            ? "일괄 생성을 중지했습니다. 완료된 장면까지 저장되어 있습니다. 「이어하기」로 계속할 수 있습니다."
            : overwrite
              ? "일괄 재생성을 마쳤습니다. 실패하거나 남은 장면은 「이어하기」로 계속할 수 있습니다."
              : "일괄 생성을 마쳤습니다. 실패하거나 남은 장면은 「이어하기」로 계속할 수 있습니다."
        )
      } else {
        setBatchSession(null)
        setInfo(
          aborted
            ? "일괄 생성을 중지했습니다."
            : overwrite
              ? "일괄 재생성이 완료되었습니다."
              : "일괄 생성이 완료되었습니다."
        )
      }
    }
  }

  function resumeBatchGenerate() {
    if (!batchSession) return
    void batchGenerate({ ...batchSession, overwrite: false })
  }

  function stopBatchGenerate() {
    batchAbortRef.current?.abort()
  }

  async function batchMotionVideos(
    sceneIndexes: number[],
    resolution: MotionVideoResolution,
    overwrite: boolean
  ) {
    if (!projectRef.current) return
    const k = loadApiKeys()
    if (!k.replicate) {
      openSettings()
      setError("Replicate API 키가 필요합니다.")
      return
    }
    const ac = new AbortController()
    batchAbortRef.current?.abort()
    batchAbortRef.current = ac
    setError(null)
    try {
      for (let i = 0; i < sceneIndexes.length; i++) {
        if (ac.signal.aborted) break
        const sceneIndex = sceneIndexes[i]!
        const live = projectRef.current
        const scene = live?.scenes.find((s) => s.index === sceneIndex)
        if (!scene?.imageUrl) continue
        if (scene.motionVideoUrl && !overwrite) continue

        setBatchProgress(`AI 영상 ${i + 1}/${sceneIndexes.length} · 장면 ${sceneIndex + 1}`)
        setProject((prev) => {
          if (!prev) return prev
          const scenes = prev.scenes.map((s) =>
            s.index === sceneIndex ? { ...s, busy: "Seedance AI 영상 생성…", error: null } : s
          )
          const next = persist({ ...prev, scenes })
          projectRef.current = next
          return next
        })

        const res = await fetch("/api/longform-v2/motion-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: scene.imageUrl,
            sceneText: scene.text,
            promptEn: scene.prompt,
            replicateApiKey: k.replicate,
            geminiApiKey: k.gemini,
            ttsDurationSec:
              scene.ttsDurationSec || estimateNarrationDurationSec(scene.text || ""),
            resolution,
          }),
          signal: ac.signal,
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || `장면 ${sceneIndex + 1} AI 영상 실패`)
        }
        const motionUrl = String(data.videoUrl || "")
        if (!motionUrl) throw new Error("AI 영상 URL이 없습니다.")

        setProject((prev) => {
          if (!prev) return prev
          const scenes = prev.scenes.map((s) =>
            s.index === sceneIndex
              ? {
                  ...s,
                  motionVideoUrl: motionUrl,
                  videoUrl: undefined,
                  busy: "TTS·최종영상 준비…",
                  error: null,
                }
              : s
          )
          const next = persist({ ...prev, scenes })
          projectRef.current = next
          return next
        })

        // TTS 없으면 생성, 있으면 AI영상(있으면)+TTS 최종 합성
        const after = projectRef.current?.scenes.find((s) => s.index === sceneIndex)
        if (!after?.audioUrl) {
          await generateOneScene(sceneIndex, "tts", { overwrite: false, signal: ac.signal })
        }
        const withAudio = projectRef.current?.scenes.find((s) => s.index === sceneIndex)
        if (withAudio?.audioUrl && (withAudio.motionVideoUrl || withAudio.imageUrl)) {
          setBatchProgress(`최종영상 ${i + 1}/${sceneIndexes.length} · 장면 ${sceneIndex + 1}`)
          const videoUrl = await composeSceneVideo(sceneIndex, {
            motionVideoUrl: withAudio.motionVideoUrl,
            imageUrl: withAudio.imageUrl,
            audioUrl: withAudio.audioUrl,
          })
          setProject((prev) => {
            if (!prev) return prev
            const scenes = prev.scenes.map((s) =>
              s.index === sceneIndex ? { ...s, videoUrl, busy: null, error: null } : s
            )
            const next = persist({ ...prev, scenes })
            projectRef.current = next
            return next
          })
        } else {
          setProject((prev) => {
            if (!prev) return prev
            const scenes = prev.scenes.map((s) =>
              s.index === sceneIndex ? { ...s, busy: null } : s
            )
            const next = persist({ ...prev, scenes })
            projectRef.current = next
            return next
          })
        }
      }
      setInfo(
        ac.signal.aborted
          ? "AI 영상 일괄 생성을 중지했습니다."
          : `AI 영상→최종영상 일괄 생성을 완료했습니다. (${sceneIndexes.length}개 장면 요청)`
      )
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "AI 영상 일괄 실패")
      } else {
        setInfo("AI 영상 일괄 생성을 중지했습니다.")
      }
    } finally {
      batchAbortRef.current = null
      setBatchProgress("")
    }
  }

  const bannerText = error || batchProgress || busy || info
  const bannerKind = error ? "err" : busy || batchProgress ? "busy" : "info"
  const stepTitle =
    project.step === "overview"
      ? "프로젝트 홈"
      : project.step === "script"
        ? "AI대본 기획 및 생성"
        : project.step === "youtube-meta"
          ? "썸네일 · 제목/설명 생성"
          : "AI 음성·이미지 생성"

  const goStep = (step: StepId) => {
    if (step === "voice-image") {
      goVoiceImage()
      return
    }
    if (step === "youtube-meta" && !project.scriptText?.trim()) {
      setError("대본이 없습니다. 01 · AI대본에서 먼저 대본을 저장하세요.")
      return
    }
    patch({ step })
  }

  return (
    <div className="lfv2-app">
      <aside className="lfv2-sidebar">
        <div className="lfv2-brand">
          <div className="lfv2-brand__mark">W</div>
          <div>
            <div className="lfv2-brand__text">WingsStudio v2</div>
            <div className="lfv2-brand__sub">신규 롱폼 · 웹</div>
          </div>
        </div>

        <div className="lfv2-project-chip">
          <input
            value={project.title}
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="프로젝트 제목"
          />
        </div>

        <div className="lfv2-section-label">초안</div>
        <button
          type="button"
          className={"lfv2-nav-btn" + (project.step === "overview" ? " lfv2-nav-btn--on" : "")}
          onClick={() => goStep("overview")}
        >
          프로젝트 홈
        </button>
        <button
          type="button"
          className={"lfv2-nav-btn" + (project.step === "script" ? " lfv2-nav-btn--on" : "")}
          onClick={() => goStep("script")}
        >
          {!!project.scriptText && project.step !== "script" && (
            <span className="lfv2-nav-btn__check">✓</span>
          )}
          01 · AI대본 기획 및 생성
        </button>

        <div className="lfv2-section-label">제작</div>
        <button
          type="button"
          className={"lfv2-nav-btn" + (project.step === "voice-image" ? " lfv2-nav-btn--on" : "")}
          onClick={() => goStep("voice-image")}
        >
          {project.scenes.some((s) => s.audioUrl && s.imageUrl) && project.step !== "voice-image" && (
            <span className="lfv2-nav-btn__check">✓</span>
          )}
          02 · AI 음성·이미지 생성
        </button>
        <button
          type="button"
          className={"lfv2-nav-btn" + (project.step === "youtube-meta" ? " lfv2-nav-btn--on" : "")}
          onClick={() => goStep("youtube-meta")}
        >
          {(project.youtubeTitle || project.thumbnailUrl) && project.step !== "youtube-meta" && (
            <span className="lfv2-nav-btn__check">✓</span>
          )}
          03 · 썸네일 · 제목/설명
        </button>

        <div className="lfv2-sidebar__bottom">
          <ApiKeyStatusCard keys={apiKeys} />
          <button type="button" className="lfv2-side-btn" onClick={openSettings}>
            ⚙ API 키 설정
          </button>
          <button
            type="button"
            className="lfv2-side-btn"
            onClick={() => router.push("/WingsAIStudio/longform-v2")}
          >
            ← 프로젝트 목록
          </button>
        </div>
      </aside>

      <main className="lfv2-main">
        <div className="lfv2-main__top">
          <div>
            <h1 className="lfv2-main__title">{stepTitle}</h1>
            <p className="lfv2-main__lead">프로젝트: {project.title}</p>
          </div>
          <div className="lfv2-toolbar">
            <button
              type="button"
              className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm"
              onClick={() => {
                persist(project)
                setInfo("저장했습니다.")
              }}
            >
              작업 저장
            </button>
            <button
              type="button"
              className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm"
              onClick={openSettings}
            >
              API 키
            </button>
          </div>
        </div>

        {bannerText && (
          <div className={"lfv2-banner lfv2-banner--" + bannerKind}>
            {(busy || batchProgress) && <span className="lfv2-spin" />}
            {bannerText}
          </div>
        )}

        {project.step === "overview" && (
          <div className="lfv2-overview">
            <div className="lfv2-overview-card">
              <h3>시작하기</h3>
              <p>
                Gemini로 대본을 만들고, Supertonic 3(로컬)·ElevenLabs/Supertone으로 음성 · Replicate로
                이미지를 생성합니다.
              </p>
              <ul className="lfv2-checklist">
                <li>
                  <span className={project.scriptText ? "ok" : "wait"}>
                    {project.scriptText ? "✓" : "○"}
                  </span>
                  AI대본 기획 및 생성
                </li>
                <li>
                  <span className={project.scenes.some((s) => s.audioUrl) ? "ok" : "wait"}>
                    {project.scenes.some((s) => s.audioUrl) ? "✓" : "○"}
                  </span>
                  AI 음성 (Supertonic 3 / ElevenLabs / Supertone)
                </li>
                <li>
                  <span className={project.scenes.some((s) => s.imageUrl) ? "ok" : "wait"}>
                    {project.scenes.some((s) => s.imageUrl) ? "✓" : "○"}
                  </span>
                  AI 이미지 (Replicate)
                </li>
              </ul>
              <div className="lfv2-actions">
                <button
                  type="button"
                  className="lfv2-btn lfv2-btn--primary"
                  onClick={() => patch({ step: "script" })}
                >
                  AI대본 기획 시작 →
                </button>
                {!!project.scriptText && (
                  <button type="button" className="lfv2-btn lfv2-btn--secondary" onClick={goVoiceImage}>
                    음성·이미지로 이동
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {project.step === "script" && (
          <ScriptWorkspacePanel
            project={project}
            busy={busy}
            onPatch={patch}
            onPersist={() => {
              persist(project)
              setInfo("작업 내용을 저장했습니다.")
            }}
            onAnalyzeAndPlan={() => void runAnalyzeAndPlan()}
            onGenerateScript={() => void runGenerateScript()}
            onApplyExternalScript={applyExternalScript}
            onFormatFixed={() => setInfo("도입부는 문장마다, 본문은 줄 단위로 자동 맞췄습니다.")}
            onGoVoiceImage={goVoiceImage}
          />
        )}

        {project.step === "voice-image" && (
          <ProductionPanel
            project={project}
            voices={voices}
            supertonicStatus={supertonicStatus}
            batchProgress={batchProgress}
            batchCanResume={batchCanResume}
            onPatch={patch}
            onBatchGenerate={(plan) => void batchGenerate(plan)}
            onResumeBatch={resumeBatchGenerate}
            onStopBatch={stopBatchGenerate}
            onMotionVideoBatch={(indexes, resolution, overwrite) =>
              void batchMotionVideos(indexes, resolution, overwrite)
            }
            onGenerateOne={(idx, mode) => void generateOneScene(idx, mode)}
            onUpdateScene={(idx, partial) => {
              setProject((prev) => {
                if (!prev) return prev
                const scenes = prev.scenes.map((s) =>
                  s.index === idx ? { ...s, ...partial } : s
                )
                const next = persist({ ...prev, scenes })
                projectRef.current = next
                return next
              })
            }}
            onNotify={(message, kind) => {
              if (kind === "error") {
                setError(message)
                setInfo(null)
              } else {
                setInfo(message)
                setError(null)
              }
            }}
            onBackToScript={() => patch({ step: "script", scriptSub: "script" })}
            onSupertonicReady={(info) => {
              setSupertonicStatus(
                info.online
                  ? info.message || "연결됨"
                  : info.message || "로컬 Supertonic이 꺼져 있습니다."
              )
              if (info.online) void loadVoicesForEngine("supertonic")
            }}
            onPreviewEngine={(engine) => {
              void loadVoicesForEngine(engine)
            }}
          />
        )}

        {project.step === "youtube-meta" && (
          <YoutubeMetaPanel
            project={project}
            onPatch={patch}
            onNotify={(message, kind) => {
              if (kind === "error") {
                setError(message)
                setInfo(null)
              } else {
                setInfo(message)
                setError(null)
              }
            }}
            onBackToProduction={() => goStep("voice-image")}
          />
        )}
      </main>

      <LongformV2ApiSettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          setApiKeys(loadApiKeys())
        }}
        onSaved={(keys) => setApiKeys(keys)}
      />

      <AnalyzeLoadingOverlay busy={busy} />
    </div>
  )
}
