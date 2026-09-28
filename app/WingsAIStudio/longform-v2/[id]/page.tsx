"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import "../longform-v2.css"
import { ApiKeyStatusCard, LongformV2ApiSettingsModal } from "../ApiSettingsModal"
import { ScriptWorkspacePanel } from "../components/ScriptWorkspacePanel"
import { ProductionPanel } from "../components/ProductionPanel"
import { loadApiKeys, type LongformV2ApiKeys } from "@/lib/longform-v2/api-keys"
import { splitScriptIntoSceneLines } from "@/lib/longform-v2/script-utils"
import {
  loadProject,
  loadProjectAsync,
  migrateProjectMediaOutOfLocalStorage,
  saveProject,
  type LongformV2Project,
  type SceneAsset,
  type StepId,
} from "@/lib/longform-v2/project-storage"
import { SUPERTONIC_BUILTIN_VOICES } from "@/lib/supertonic-local"
import {
  fetchSupertonicHealth,
  fetchSupertonicTts,
  fetchSupertonicVoices,
} from "@/lib/supertonic-runtime-client"

type VoiceOption = { id: string; label: string }

const ELEVEN_FALLBACK: VoiceOption[] = [
  { id: "jB1Cifc2UQbq1gR3wnb0", label: "한국어 · 기본" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
]

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<LongformV2ApiKeys>(() => loadApiKeys())
  const [voices, setVoices] = useState<VoiceOption[]>(
    SUPERTONIC_BUILTIN_VOICES.map((v) => ({ id: v.voice_id, label: v.name }))
  )
  const [supertonicStatus, setSupertonicStatus] = useState<string>("확인 중…")

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
    const keys = loadApiKeys()
    let cancelled = false
    async function loadVoices() {
      try {
        if (project!.ttsEngine === "supertonic") {
          const health = await fetchSupertonicHealth()
          if (cancelled) return
          setSupertonicStatus(
            health.online
              ? `연결됨 · ${health.model || "supertonic-3"} · ${health.baseUrl || "127.0.0.1:7788"}`
              : health.message ||
                  "꺼져 있습니다. 「Supertonic 자동 연결」을 누르면 Mac/Windows에 맞게 설치·기동합니다."
          )
          const res = await fetchSupertonicVoices()
          const data = await res.json().catch(() => ({}))
          if (cancelled) return
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
        if (project!.ttsEngine === "supertone") {
          if (!keys.supertone) {
            setVoices([{ id: "default", label: "Supertone 키 필요" }])
            return
          }
          const res = await fetch(`/api/supertone-voices?apiKey=${encodeURIComponent(keys.supertone)}`)
          const data = await res.json()
          if (cancelled) return
          const list = (data.voices || data.data || [])
            .map((v: { id?: string; voice_id?: string; name?: string }) => ({
              id: String(v.id || v.voice_id || ""),
              label: String(v.name || v.id || "voice"),
            }))
            .filter((v: VoiceOption) => v.id)
          setVoices(list.length ? list : [{ id: "default", label: "음성 목록 없음" }])
          return
        }
        if (!keys.elevenlabs) {
          setVoices(ELEVEN_FALLBACK)
          return
        }
        const res = await fetch(`/api/elevenlabs-voices?apiKey=${encodeURIComponent(keys.elevenlabs)}`)
        const data = await res.json()
        if (cancelled) return
        const list = (data.voices || [])
          .map((v: { voice_id?: string; voiceId?: string; name?: string }) => ({
            id: String(v.voice_id || v.voiceId || ""),
            label: String(v.name || v.voice_id || "voice"),
          }))
          .filter((v: VoiceOption) => v.id)
        setVoices(list.length ? list : ELEVEN_FALLBACK)
      } catch {
        if (!cancelled) {
          if (project!.ttsEngine === "supertonic") {
            setVoices(SUPERTONIC_BUILTIN_VOICES.map((v) => ({ id: v.voice_id, label: v.name })))
            setSupertonicStatus("상태 확인 실패 — 로컬 serve가 켜져 있는지 확인하세요.")
          } else {
            setVoices(ELEVEN_FALLBACK)
          }
        }
      }
    }
    void loadVoices()
    return () => {
      cancelled = true
    }
  }, [project?.ttsEngine, settingsOpen])

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
    const lines = splitScriptIntoSceneLines(project.benchmarkText)
    patch({
      scriptText: project.benchmarkText,
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

  async function composeSceneVideo(sceneIndex: number, imageUrl: string, audioUrl: string) {
    const form = new FormData()
    // http 이미지는 URL로, data URL은 파일로 보내 body 크기·서버 다운로드를 나눔
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      form.append("imageUrl", imageUrl)
    } else {
      const imgBlob = await (await fetch(imageUrl)).blob()
      form.append("image", imgBlob, "still.png")
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
    return videoUrl
  }

  async function generateOneScene(sceneIndex: number, mode: "tts" | "image" | "both" | "video") {
    if (!project) return
    const k = loadApiKeys()
    setApiKeys(k)
    setError(null)
    const scene = project.scenes.find((s) => s.index === sceneIndex)
    if (!scene) return

    const updateScene = (partial: Partial<SceneAsset>) => {
      setProject((prev) => {
        if (!prev) return prev
        const scenes = prev.scenes.map((s) => (s.index === sceneIndex ? { ...s, ...partial } : s))
        return persist({ ...prev, scenes })
      })
    }

    try {
      let latestImage = scene.imageUrl
      let latestAudio = scene.audioUrl

      if (mode === "tts" || mode === "both") {
        const engine = project.ttsEngine || "supertonic"
        if (engine === "supertonic") {
          updateScene({ busy: "Supertonic 3 음성 생성…", error: null })
          const bare = String(project.voiceId || "F1").replace(/^supertonic-/, "")
          const ttsRes = await fetchSupertonicTts({
            text: scene.text,
            voiceId: bare,
            lang: project.ttsLanguage === "English" ? "en" : project.ttsLanguage === "日本語" ? "ja" : "ko",
            speed: project.ttsSpeed ?? 1.05,
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
            busy: mode === "both" ? "이미지 준비…" : null,
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
              voiceId: project.voiceId,
              apiKey: k.supertone,
              language: "ko",
            }),
          })
          const ttsData = await ttsRes.json()
          if (!ttsRes.ok || ttsData.success === false) throw new Error(ttsData.error || "Supertone TTS 실패")
          const audioUrl = ttsData.audioUrl || ttsData.url
          if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
          latestAudio = audioUrl
          updateScene({ audioUrl, busy: mode === "both" ? "이미지 준비…" : null })
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
              voiceId: project.voiceId,
              apiKey: k.elevenlabs,
              speed: project.ttsSpeed ?? 1.0,
            }),
          })
          const ttsData = await ttsRes.json()
          if (!ttsRes.ok || ttsData.success === false) throw new Error(ttsData.error || "ElevenLabs TTS 실패")
          const audioUrl = ttsData.audioUrl
          if (!audioUrl) throw new Error("TTS 응답에 audioUrl이 없습니다.")
          latestAudio = audioUrl
          updateScene({ audioUrl, busy: mode === "both" ? "이미지 준비…" : null })
        }
      }

      if (mode === "image" || mode === "both") {
        if (!k.gemini) {
          openSettings()
          throw new Error("Gemini API 키가 필요합니다.")
        }
        if (!k.replicate) {
          openSettings()
          throw new Error("Replicate API 키가 필요합니다.")
        }
        updateScene({ busy: "이미지 프롬프트 작성…", error: null })
        const promptRes = await fetch("/api/longform-v2/scene-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneText: scene.text,
            styleHint: project.styleHint,
            geminiApiKey: k.gemini,
          }),
        })
        const promptData = await promptRes.json()
        if (!promptRes.ok || !promptData.success) throw new Error(promptData.error || "프롬프트 실패")

        updateScene({ prompt: promptData.prompt, busy: "이미지 생성 중…" })
        const imgController = new AbortController()
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
            throw new Error("이미지 생성 시간이 너무 오래 걸립니다(3분). Replicate 상태·키를 확인하세요.")
          }
          throw e
        } finally {
          window.clearTimeout(imgTimer)
        }
        const imgData = await imgRes.json()
        if (!imgRes.ok || !imgData.success) throw new Error(imgData.error || "이미지 생성 실패")
        latestImage = imgData.imageUrl
        updateScene({
          imageUrl: imgData.imageUrl,
          prompt: imgData.prompt || promptData.prompt,
          busy: mode === "both" ? "최종영상 합성…" : null,
        })
      }

      const needVideo =
        mode === "video" ||
        mode === "both" ||
        ((mode === "tts" || mode === "image") && !!(latestImage && latestAudio))

      if (needVideo) {
        if (!latestImage || !latestAudio) {
          if (mode === "video") {
            throw new Error("최종영상은 이미지와 음성이 모두 있어야 합니다.")
          }
        } else {
          updateScene({ busy: "최종영상 합성…", error: null })
          const videoUrl = await composeSceneVideo(sceneIndex, latestImage, latestAudio)
          updateScene({ videoUrl, busy: null })
        }
      } else {
        updateScene({ busy: null })
      }
    } catch (e) {
      updateScene({ busy: null, error: e instanceof Error ? e.message : "생성 실패" })
    }
  }

  async function batchGenerate(limit = 8) {
    if (!project) return
    setError(null)
    const targets = project.scenes.slice(0, limit)
    for (let i = 0; i < targets.length; i++) {
      setBatchProgress(`일괄 생성 ${i + 1}/${targets.length}`)
      await generateOneScene(targets[i].index, "both")
    }
    setBatchProgress("")
    setInfo(`앞 ${targets.length}개 장면 완료`)
  }

  const bannerText = error || batchProgress || busy || info
  const bannerKind = error ? "err" : busy || batchProgress ? "busy" : "info"
  const stepTitle =
    project.step === "overview"
      ? "프로젝트 홈"
      : project.step === "script"
        ? "AI대본 기획 및 생성"
        : "AI 음성·이미지 생성"

  const goStep = (step: StepId) => {
    if (step === "voice-image") {
      goVoiceImage()
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
            onPatch={patch}
            onBatchGenerate={(limit) => void batchGenerate(limit)}
            onGenerateOne={(idx, mode) => void generateOneScene(idx, mode)}
            onBackToScript={() => patch({ step: "script", scriptSub: "script" })}
            onSupertonicReady={(info) => {
              setSupertonicStatus(
                info.online
                  ? info.message || "연결됨"
                  : info.message || "로컬 Supertonic이 꺼져 있습니다."
              )
              if (info.online) {
                void (async () => {
                  const res = await fetchSupertonicVoices()
                  const data = await res.json().catch(() => ({}))
                  const list = (data.voices || [])
                    .map((v: { voice_id?: string; id?: string; name?: string }) => ({
                      id: String(v.voice_id || v.id || ""),
                      label: String(v.name || v.voice_id || "voice"),
                    }))
                    .filter((v: VoiceOption) => v.id)
                  if (list.length) setVoices(list)
                })()
              }
            }}
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
    </div>
  )
}
