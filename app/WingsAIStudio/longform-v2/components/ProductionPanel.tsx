"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import type { LongformV2Project, SceneAsset } from "@/lib/longform-v2/project-storage"
import {
  IMAGE_MODEL_GROUPS,
  STYLE_CATALOG,
  STYLE_CATEGORIES,
  categoryOfStyle,
  findStyleById,
  sceneStyleSampleUrl,
  styleThumbDataUrl,
  type StyleCategory,
  type StyleItem,
} from "@/lib/longform-v2/image-styles"
import { loadApiKeys } from "@/lib/longform-v2/api-keys"
import {
  clearAccountCustomStyle,
  loadAccountCustomStyle,
  resolveLongformAccountId,
  saveAccountCustomStyle,
} from "@/lib/longform-v2/custom-style-account"
import {
  deleteCustomStyleImage,
  getCustomStyleImage,
  putCustomStyleImage,
} from "@/lib/longform-v2/project-media-idb"
import {
  stockSceneIndexes,
  type BatchGeneratePlan,
} from "@/lib/longform-v2/batch-generate"
import {
  applyMosaicToImageUrl,
  formatScenePromptsBatchCopy,
  mapExternalSceneImageFiles,
  type FlowWatermarkMosaicParams,
} from "@/lib/longform-v2/flow-watermark-mosaic"
import type { MotionVideoResolution } from "@/lib/longform-v2/motion-video"
import { BatchGenerateModal } from "./BatchGenerateModal"
import { StockKeywordModal } from "./StockKeywordModal"
import { AiMotionVideoModal } from "./AiMotionVideoModal"
import { AiMotionVideoBatchModal } from "./AiMotionVideoBatchModal"
import { FlowWatermarkMosaicModal } from "./FlowWatermarkMosaicModal"
import { WorkSettingsModal } from "./WorkSettingsModal"
import { estimateNarrationDurationSec } from "@/lib/longform-v2/motion-video"
import { SceneGenerating } from "./SceneGenerating"

type VoiceOption = { id: string; label: string }

type Props = {
  project: LongformV2Project
  voices: VoiceOption[]
  supertonicStatus: string
  batchProgress: string
  /** 일괄 생성 세션이 남아 이어하기 가능 */
  batchCanResume?: boolean
  onPatch: (partial: Partial<LongformV2Project>) => void
  onBatchGenerate: (plan: BatchGeneratePlan) => void
  onResumeBatch?: () => void
  onStopBatch?: () => void
  onMotionVideoBatch?: (
    sceneIndexes: number[],
    resolution: MotionVideoResolution,
    overwrite: boolean
  ) => void
  onGenerateOne: (sceneIndex: number, mode: "tts" | "image" | "both" | "video") => void
  onUpdateScene: (sceneIndex: number, partial: Partial<SceneAsset>) => void
  onBackToScript: () => void
  onNotify?: (message: string, kind?: "info" | "error") => void
  /** Supertonic 자동 연결 성공/실패 시 부모에서 상태·보이스 갱신 */
  onSupertonicReady?: (info: { online: boolean; message?: string }) => void
  /** 설정 모달에서 TTS 엔진 미리보기 전환 */
  onPreviewEngine?: (engine: LongformV2Project["ttsEngine"]) => void
}

/** 카테고리 탭 + NEW 오른쪽 「커스텀」(예전 WingsStudio와 동일 배치) */
type StyleTabId = StyleCategory | "커스텀"

function StyleThumb({ category, style }: { category: StyleCategory; style: StyleItem }) {
  const sample = sceneStyleSampleUrl(category, style.id)
  const fallback = styleThumbDataUrl(style.hue, style.label, style.id)
  const [src, setSrc] = useState(sample)

  useEffect(() => {
    setSrc(sample)
  }, [sample])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="dm-style-thumb"
      src={src}
      alt=""
      onError={() => {
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}

/** 업로드용으로 리사이즈·JPEG 압축 (용량·Gemini 전송) */
function compressImageFile(file: File, maxEdge = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("canvas 지원 없음"))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", quality))
      } catch (e) {
        reject(e instanceof Error ? e : new Error("이미지 압축 실패"))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("이미지를 읽을 수 없습니다."))
    }
    img.src = url
  })
}

export function ProductionPanel({
  project,
  voices,
  supertonicStatus,
  batchProgress,
  batchCanResume = false,
  onPatch,
  onBatchGenerate,
  onResumeBatch,
  onStopBatch,
  onMotionVideoBatch,
  onGenerateOne,
  onUpdateScene,
  onBackToScript,
  onNotify,
  onSupertonicReady,
  onPreviewEngine,
}: Props) {
  const [category, setCategory] = useState<StyleTabId>(() =>
    project.imageStyleId === "custom" ? "커스텀" : categoryOfStyle(project.imageStyleId || "realistic")
  )
  const [workOpen, setWorkOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchMode, setBatchMode] = useState<"resume" | "overwrite">("resume")
  const [stockKwOpen, setStockKwOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<BatchGeneratePlan | null>(null)
  const [motionSceneIndex, setMotionSceneIndex] = useState<number | null>(null)
  const [motionBatchOpen, setMotionBatchOpen] = useState(false)
  const [flowWmOpen, setFlowWmOpen] = useState(false)
  const [flowWmBusy, setFlowWmBusy] = useState(false)
  const [flowWmStatus, setFlowWmStatus] = useState("")
  const [bulkImportBusy, setBulkImportBusy] = useState(false)
  const [bulkImportStatus, setBulkImportStatus] = useState("")
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const bulkImportFileInputRef = useRef<HTMLInputElement>(null)
  const [accountId, setAccountId] = useState("anonymous")
  const [customPreview, setCustomPreview] = useState<string | null>(null)
  const [customBusy, setCustomBusy] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customLabelKo, setCustomLabelKo] = useState(
    () => project.customStyleLabelKo || "커스텀 그림체"
  )
  const [customDescKo, setCustomDescKo] = useState(
    () => project.customStyleDescriptionKo || ""
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const styles = category === "커스텀" ? [] : STYLE_CATALOG[category] || []
  const tab = project.productionTab || "style"
  const isCustomOn = project.imageStyleId === "custom"
  const isCustomTab = category === "커스텀"
  const pipelineBusy = !!batchProgress || bulkImportBusy || flowWmBusy || exportBusy

  const flowWmPreview = useMemo(() => {
    for (const scene of project.scenes) {
      if (scene.imageUrl?.trim()) {
        return {
          index: scene.index,
          src: scene.imageUrl,
          count: project.scenes.filter((s) => s.imageUrl?.trim()).length,
        }
      }
    }
    return null
  }, [project.scenes])

  async function copyAllScenePrompts() {
    const rows = project.scenes
      .map((s) => ({
        label: `#${s.index + 1}`,
        prompt: (s.prompt || "").trim(),
      }))
      .filter((r) => r.prompt)
    if (rows.length === 0) {
      onNotify?.("복사할 장면 프롬프트가 없습니다. 먼저 프롬프트를 생성하세요.", "error")
      return
    }
    const text = formatScenePromptsBatchCopy(rows)
    try {
      await navigator.clipboard.writeText(text)
      onNotify?.(`장면 프롬프트 ${rows.length}개를 클립보드에 복사했습니다.`, "info")
    } catch {
      onNotify?.("클립보드 복사에 실패했습니다.", "error")
    }
  }

  function openBulkImageImport() {
    if (pipelineBusy || project.scenes.length === 0) return
    const el = bulkImportFileInputRef.current
    if (el) {
      el.value = ""
      el.click()
    }
  }

  async function onBulkImageImportPicked(files: FileList | null) {
    if (!files?.length) return
    const mediaFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (mediaFiles.length === 0) {
      onNotify?.("이미지 파일만 선택할 수 있습니다.", "error")
      return
    }
    const assignments = mapExternalSceneImageFiles(mediaFiles, project.scenes.length)
    if (assignments.length === 0) {
      onNotify?.(
        "씬 범위에 맞는 파일이 없습니다. 파일명을 1, 2, 3… 또는 사진(1), 사진(2) 형식으로 맞춰 주세요.",
        "error"
      )
      return
    }
    setBulkImportBusy(true)
    setBulkImportStatus("")
    let applied = 0
    try {
      for (let i = 0; i < assignments.length; i++) {
        const { sceneIndex, file } = assignments[i]!
        setBulkImportStatus(`${i + 1}/${assignments.length} · 장면 ${sceneIndex + 1}`)
        const dataUrl = await compressImageFile(file)
        onUpdateScene(sceneIndex, { imageUrl: dataUrl, error: null })
        applied += 1
      }
      onNotify?.(
        applied < mediaFiles.length
          ? `외부 이미지 ${applied}장을 장면에 넣었습니다. (${mediaFiles.length - applied}장은 제외)`
          : `외부 이미지 ${applied}장을 파일명 순서대로 장면에 넣었습니다.`,
        "info"
      )
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : "일괄 업로드 실패", "error")
    } finally {
      setBulkImportBusy(false)
      setBulkImportStatus("")
    }
  }

  async function onConfirmFlowWatermarkMosaic(params: FlowWatermarkMosaicParams) {
    const targets = project.scenes.filter((s) => s.imageUrl?.trim())
    if (targets.length === 0) {
      onNotify?.("이미지가 있는 장면이 없습니다.", "error")
      return
    }
    setFlowWmBusy(true)
    let applied = 0
    const errors: string[] = []
    try {
      for (let i = 0; i < targets.length; i++) {
        const scene = targets[i]!
        setFlowWmStatus(`모자이크 적용 중… (${i + 1}/${targets.length})`)
        try {
          const nextUrl = await applyMosaicToImageUrl(scene.imageUrl!, params)
          onUpdateScene(scene.index, { imageUrl: nextUrl, error: null })
          applied += 1
        } catch (e) {
          errors.push(`장면 ${scene.index + 1}: ${e instanceof Error ? e.message : "실패"}`)
        }
      }
      setFlowWmOpen(false)
      onNotify?.(
        `모자이크 적용 완료 — ${applied}/${targets.length}장` +
          (errors.length ? ` · 실패 ${errors.length}` : ""),
        applied === 0 ? "error" : "info"
      )
    } finally {
      setFlowWmBusy(false)
      setFlowWmStatus("")
    }
  }

  async function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function fetchAsBlob(url: string): Promise<Blob | null> {
    try {
      if (url.startsWith("data:")) {
        const res = await fetch(url)
        return await res.blob()
      }
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.blob()
    } catch {
      return null
    }
  }

  async function onExport(kind: "tts" | "images" | "videos" | "all") {
    setExportOpen(false)
    setExportBusy(true)
    try {
      const zip = new JSZip()
      let count = 0
      const title = (project.title || "longform").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)
      for (const scene of project.scenes) {
        const n = String(scene.index + 1).padStart(3, "0")
        if ((kind === "images" || kind === "all") && scene.imageUrl) {
          const blob = await fetchAsBlob(scene.imageUrl)
          if (blob) {
            const ext = blob.type.includes("png") ? "png" : "jpg"
            zip.file(`images/scene_${n}.${ext}`, blob)
            count++
          }
        }
        if ((kind === "tts" || kind === "all") && scene.audioUrl) {
          const blob = await fetchAsBlob(scene.audioUrl)
          if (blob) {
            const ext = blob.type.includes("mpeg") || blob.type.includes("mp3") ? "mp3" : "wav"
            zip.file(`tts/scene_${n}.${ext}`, blob)
            count++
          }
        }
        if ((kind === "videos" || kind === "all") && (scene.videoUrl || scene.motionVideoUrl)) {
          const vUrl = scene.videoUrl || scene.motionVideoUrl!
          const blob = await fetchAsBlob(vUrl)
          if (blob) {
            zip.file(`videos/scene_${n}.mp4`, blob)
            count++
          }
        }
      }
      if (count === 0) {
        onNotify?.("다운로드할 파일이 없습니다.", "error")
        return
      }
      const out = await zip.generateAsync({ type: "blob" })
      await downloadBlob(out, `${title}_${kind}.zip`)
      onNotify?.(`${count}개 파일을 ZIP으로 다운로드했습니다.`, "info")
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : "다운로드 실패", "error")
    } finally {
      setExportBusy(false)
    }
  }

  function submitBatchPlan(plan: BatchGeneratePlan) {
    onBatchGenerate({ ...plan, overwrite: batchMode === "overwrite" })
  }

  useEffect(() => {
    if (project.imageStyleId === "custom") {
      setCategory("커스텀")
      return
    }
    setCategory(categoryOfStyle(project.imageStyleId || "realistic"))
  }, [project.imageStyleId])

  /** 계정 단위 커스텀 그림체 자동 로드 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const aid = await resolveLongformAccountId()
      if (cancelled) return
      setAccountId(aid)
      const saved = loadAccountCustomStyle(aid)
      const img = await getCustomStyleImage(aid)
      if (cancelled) return
      if (img) setCustomPreview(img)
      if (saved) {
        setCustomLabelKo(saved.labelKo)
        setCustomDescKo(saved.descriptionKo)
        const needPrompt = !project.customStylePrompt?.trim()
        const onCustom = project.imageStyleId === "custom"
        if (needPrompt || onCustom) {
          onPatch({
            customStylePrompt: saved.styleHint,
            customStyleLabelKo: saved.labelKo,
            customStyleDescriptionKo: saved.descriptionKo,
            ...(onCustom
              ? {
                  styleHint: saved.styleHint,
                  imageStyleLabel: saved.labelKo,
                }
              : {}),
          })
        }
      } else if (project.customStyleLabelKo || project.customStyleDescriptionKo) {
        setCustomLabelKo(project.customStyleLabelKo || "커스텀 그림체")
        setCustomDescKo(project.customStyleDescriptionKo || "")
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  useEffect(() => {
    if (project.customStyleLabelKo) setCustomLabelKo(project.customStyleLabelKo)
    if (project.customStyleDescriptionKo) setCustomDescKo(project.customStyleDescriptionKo)
  }, [project.customStyleLabelKo, project.customStyleDescriptionKo])

  const counts = useMemo(() => {
    const total = project.scenes.length
    const prompt = project.scenes.filter((s) => !!s.prompt).length
    const image = project.scenes.filter((s) => !!s.imageUrl).length
    const tts = project.scenes.filter((s) => !!s.audioUrl).length
    const video = project.scenes.filter((s) => !!s.videoUrl).length
    return { total, prompt, image, tts, video }
  }, [project.scenes])

  const selectStyle = (id: string) => {
    if (category === "커스텀") return
    const item = STYLE_CATALOG[category].find((s) => s.id === id) || findStyleById(id)
    if (!item) return
    onPatch({
      imageStyleId: item.id,
      imageStyleLabel: item.label,
      styleHint: item.hint,
    })
  }

  const selectCustomStyle = () => {
    setCategory("커스텀")
    const account = loadAccountCustomStyle(accountId)
    const styleHint =
      project.customStylePrompt?.trim() || account?.styleHint || ""
    if (!styleHint && !customPreview) {
      fileRef.current?.click()
      return
    }
    const label = customLabelKo || account?.labelKo || "커스텀 그림체"
    const desc = customDescKo || account?.descriptionKo || ""
    onPatch({
      imageStyleId: "custom",
      imageStyleLabel: label,
      styleHint: styleHint || project.styleHint,
      customStylePrompt: styleHint || project.customStylePrompt,
      customStyleLabelKo: label,
      customStyleDescriptionKo: desc,
    })
  }

  const clearCustomStyle = async () => {
    if (!confirm("이 계정에 저장된 커스텀 그림체를 삭제할까요?")) return
    const aid = accountId || (await resolveLongformAccountId())
    await deleteCustomStyleImage(aid)
    clearAccountCustomStyle(aid)
    setCustomPreview(null)
    setCustomError(null)
    setCustomLabelKo("커스텀 그림체")
    setCustomDescKo("")
    const fallback = findStyleById("realistic")
    onPatch({
      imageStyleId: fallback?.id || "realistic",
      imageStyleLabel: fallback?.label || "리얼리스틱 실사",
      styleHint: fallback?.hint || project.styleHint,
      customStylePrompt: "",
      customStyleLabelKo: "",
      customStyleDescriptionKo: "",
    })
  }

  const onCustomFile = async (file: File | null) => {
    if (!file) return
    setCustomError(null)
    const keys = loadApiKeys()
    if (!keys.gemini) {
      setCustomError("Gemini API 키가 필요합니다. 상단 「API 키」에서 설정하세요.")
      return
    }
    setCustomBusy(true)
    try {
      const aid = accountId || (await resolveLongformAccountId())
      setAccountId(aid)
      const dataUrl = await compressImageFile(file)
      const res = await fetch("/api/longform-v2/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, geminiApiKey: keys.gemini }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || "스타일 분석 실패")
      }
      const styleHint = String(data.styleHint || "")
      const labelKo = String(data.labelKo || "커스텀 그림체")
      const descriptionKo = String(data.descriptionKo || "")
      await putCustomStyleImage(aid, dataUrl)
      saveAccountCustomStyle(aid, { styleHint, labelKo, descriptionKo })
      setCustomPreview(dataUrl)
      setCustomLabelKo(labelKo)
      setCustomDescKo(descriptionKo)
      setCategory("커스텀")
      onPatch({
        imageStyleId: "custom",
        imageStyleLabel: labelKo,
        styleHint,
        customStylePrompt: styleHint,
        customStyleLabelKo: labelKo,
        customStyleDescriptionKo: descriptionKo,
      })
    } catch (e) {
      setCustomError(e instanceof Error ? e.message : "커스텀 스타일 업로드 실패")
    } finally {
      setCustomBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.round((n / d) * 100))

  return (
    <div className="dm-style">
      <div className="lfv2-prod-tabs" role="tablist" aria-label="제작 단계">
        <button
          type="button"
          role="tab"
          className={"lfv2-prod-tab" + (tab === "style" ? " lfv2-prod-tab--on" : "")}
          onClick={() => onPatch({ productionTab: "style" })}
        >
          1. 이미지 스타일
        </button>
        <button
          type="button"
          role="tab"
          className={"lfv2-prod-tab" + (tab === "scenes" ? " lfv2-prod-tab--on" : "")}
          onClick={() => onPatch({ productionTab: "scenes" })}
        >
          2. 장면 이미지 생성
        </button>
      </div>

      {tab === "style" && (
        <>
          <h3>이미지 스타일 선택</h3>
          <p className="dm-sub" style={{ margin: "0 0 0.5rem", color: "#8b93a8", fontSize: "0.85rem" }}>
            카테고리 썸네일을 고르거나, NEW 옆 <strong>커스텀</strong>에서 내 그림체를 업로드하세요.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => void onCustomFile(e.target.files?.[0] || null)}
          />

          <div className="dm-style__tabs" role="tablist" aria-label="스타일 카테고리">
            {STYLE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"dm-style__tab" + (category === c.id ? " dm-style__tab--on" : "")}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              className={
                "dm-style__tab dm-style__tab--custom" + (isCustomTab ? " dm-style__tab--on" : "")
              }
              onClick={() => setCategory("커스텀")}
            >
              커스텀
            </button>
          </div>

          {isCustomTab ? (
            <div className="lfv2-custom-style">
              <button
                type="button"
                className={
                  "lfv2-custom-style__card" + (isCustomOn ? " lfv2-custom-style__card--on" : "")
                }
                onClick={selectCustomStyle}
                disabled={customBusy}
              >
                <span className="lfv2-custom-style__thumb">
                  {customPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customPreview} alt="" />
                  ) : (
                    <span className="lfv2-custom-style__plus">+</span>
                  )}
                  {customBusy ? (
                    <span className="lfv2-custom-style__busy">
                      <span className="lfv2-spin" /> 분석 중…
                    </span>
                  ) : null}
                </span>
                <span className="lfv2-custom-style__meta">
                  <strong>{customLabelKo || "커스텀 그림체"}</strong>
                  <span>
                    {customDescKo
                      ? customDescKo
                      : isCustomOn
                        ? "적용 중 — 장면 이미지가 이 스타일을 따릅니다"
                        : customPreview
                          ? "계정에 저장됨 · 클릭해서 이 프로젝트에 적용"
                          : "샘플 이미지를 올리면 Gemini가 그림체를 분석·저장합니다"}
                  </span>
                  {customPreview || project.customStylePrompt ? (
                    <span className="lfv2-custom-style__account">
                      이 카카오 계정에 자동 저장됩니다
                    </span>
                  ) : null}
                </span>
              </button>
              <div className="lfv2-custom-style__actions">
                <button
                  type="button"
                  className="v2sw-btn v2sw-btn--secondary"
                  disabled={customBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {customPreview ? "다른 이미지 업로드" : "그림체 업로드"}
                </button>
                {customPreview || project.customStylePrompt || customDescKo ? (
                  <button
                    type="button"
                    className="v2sw-btn v2sw-btn--danger"
                    disabled={customBusy}
                    onClick={() => void clearCustomStyle()}
                  >
                    커스텀 삭제
                  </button>
                ) : null}
              </div>
              {customError ? <p className="lfv2-custom-style__err">{customError}</p> : null}
              {customDescKo ? (
                <p className="lfv2-custom-style__ko">
                  <strong>한글 설명</strong> — {customDescKo}
                </p>
              ) : null}
              {isCustomOn && project.styleHint ? (
                <p className="lfv2-custom-style__hint" title={project.styleHint}>
                  영문 스타일 힌트: {project.styleHint.slice(0, 160)}
                  {project.styleHint.length > 160 ? "…" : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="dm-style__grid">
              {styles.map((s) => {
                const on = !isCustomOn && project.imageStyleId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={"dm-style__card" + (on ? " dm-style__card--on" : "")}
                    onClick={() => selectStyle(s.id)}
                  >
                    <span className="dm-style-thumb-frame">
                      <StyleThumb category={category} style={s} />
                    </span>
                    <span className="dm-style__label">{s.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="dm-style__models">
            <p className="dm-style__models-title">이미지 모델</p>
            <p className="dm-style__models-hint">
              WingsStudio와 동일한 목록입니다. 선택값은 프로젝트에 저장됩니다.
            </p>
            <div className="dm-img-models">
              {IMAGE_MODEL_GROUPS.map((group) => (
                <div
                  key={group.id}
                  className={
                    "dm-img-models__group" +
                    (group.id === "featured" ? " dm-img-models__group--featured" : "")
                  }
                >
                  <div className="dm-img-models__group-head">
                    <span className="dm-img-models__group-label">{group.label}</span>
                    <span className="dm-muted dm-img-models__group-hint">{group.hint}</span>
                  </div>
                  <div
                    className={
                      "dm-img-models__grid" +
                      (group.id === "featured" ? " dm-img-models__grid--featured" : "")
                    }
                  >
                    {group.models.map((m) => {
                      const on = project.imageModel === m.id
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={"dm-img-model-card" + (on ? " dm-img-model-card--on" : "")}
                          onClick={() => onPatch({ imageModel: m.id })}
                          aria-pressed={on}
                        >
                          <div className="dm-img-model-card__head">
                            <strong>{m.label}</strong>
                            {m.badge ? (
                              <span className="dm-img-model-card__badge">{m.badge}</span>
                            ) : null}
                            {on ? (
                              <span className="dm-img-model-card__check" aria-hidden>
                                ✓
                              </span>
                            ) : null}
                          </div>
                          <p className="dm-img-model-card__desc">{m.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dm-style__foot">
            <button
              type="button"
              className="v2sw-btn v2sw-btn--primary"
              onClick={() => onPatch({ productionTab: "scenes" })}
            >
              장면 생성으로 →
            </button>
            <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onBackToScript}>
              ← 대본으로
            </button>
          </div>
        </>
      )}

      {tab === "scenes" && (
        <>
          <div className="lfv2-prod-toolbar">
            <button type="button" className="dm-btn dm-btn--ghost" onClick={() => setWorkOpen(true)}>
              ⚙ 설정
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--prompt-copy"
              disabled={pipelineBusy || project.scenes.length === 0}
              onClick={() => void copyAllScenePrompts()}
              title="저장된 모든 장면 프롬프트를 한 번에 복사합니다."
            >
              <span className="dm-head-action__icon" aria-hidden>
                📋
              </span>
              프롬프트 일괄 복사
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--bulk-upload"
              disabled={pipelineBusy || project.scenes.length === 0}
              onClick={openBulkImageImport}
              title="1.jpg·2.png 또는 사진(1)·사진(2)처럼 번호가 있는 이미지를 장면에 넣습니다."
            >
              <span className="dm-head-action__icon" aria-hidden>
                🖼
              </span>
              {bulkImportBusy
                ? bulkImportStatus.trim() || "일괄 업로드 중…"
                : "이미지 일괄 업로드"}
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--bulk-upload"
              disabled={pipelineBusy || !flowWmPreview}
              onClick={() => {
                if (!flowWmPreview) {
                  onNotify?.("이미지가 있는 장면이 없습니다. Flow 이미지를 먼저 업로드하세요.", "error")
                  return
                }
                setFlowWmOpen(true)
              }}
              title="첫 이미지로 모자이크 위치·강도를 맞춘 뒤, 나머지 장면에도 같은 비율로 적용합니다."
            >
              <span className="dm-head-action__icon" aria-hidden>
                ▦
              </span>
              {flowWmBusy ? flowWmStatus || "워터마크 처리 중…" : "기존 장면 워터마크 제거"}
            </button>
            <div className="dm-export-wrap">
              <button
                type="button"
                className="dm-head-action dm-head-action--export"
                disabled={exportBusy || project.scenes.length === 0}
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
              >
                <span className="dm-head-action__icon" aria-hidden>
                  ↓
                </span>
                {exportBusy ? "준비 중…" : "전체 다운로드"}
              </button>
              {exportOpen ? (
                <div className="dm-export-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => void onExport("tts")}>
                    🔊 TTS 다운로드
                  </button>
                  <button type="button" role="menuitem" onClick={() => void onExport("images")}>
                    🖼 이미지 다운로드
                  </button>
                  <button type="button" role="menuitem" onClick={() => void onExport("videos")}>
                    🎬 비디오 다운로드
                  </button>
                  <button type="button" role="menuitem" onClick={() => void onExport("all")}>
                    📦 전체 ZIP
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="dm-head-action dm-head-action--batch"
              disabled={pipelineBusy || project.scenes.length === 0}
              onClick={() => {
                setBatchMode("resume")
                setBatchOpen(true)
              }}
            >
              <span className="dm-head-action__icon" aria-hidden>
                ⚡
              </span>
              {batchProgress || "일괄 생성"}
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--motion-batch"
              disabled={pipelineBusy || project.scenes.length === 0 || !onMotionVideoBatch}
              onClick={() => setMotionBatchOpen(true)}
              title="선택한 장면에 AI 영상 생성 후 TTS와 합쳐 최종영상까지 순차 생성"
            >
              <span className="dm-head-action__icon" aria-hidden>
                🎞
              </span>
              AI 영상 일괄
            </button>
            <button
              type="button"
              className="dm-head-action dm-head-action--regenerate"
              disabled={pipelineBusy || project.scenes.length === 0}
              title="완료된 장면도 선택한 항목을 다시 만들어 덮어씁니다"
              onClick={() => {
                setBatchMode("overwrite")
                setBatchOpen(true)
              }}
            >
              <span className="dm-head-action__icon" aria-hidden>
                ↻
              </span>
              재생성
            </button>
            <button type="button" className="dm-head-action dm-head-action--composer" disabled title="영상 편집은 준비 중">
              <span className="dm-head-action__icon" aria-hidden>
                ✂
              </span>
              영상 편집
            </button>
            {batchProgress ? (
              <button
                type="button"
                className="dm-head-action dm-head-action--stop"
                onClick={() => onStopBatch?.()}
                aria-label="일괄 생성 중지"
              >
                중지
              </button>
            ) : batchCanResume ? (
              <button
                type="button"
                className="dm-head-action dm-head-action--resume"
                onClick={() => onResumeBatch?.()}
                aria-label="일괄 생성 이어하기"
              >
                이어하기
              </button>
            ) : null}
            <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onBackToScript}>
              ← 대본으로
            </button>
          </div>
          <input
            ref={bulkImportFileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onBulkImageImportPicked(e.target.files)
              e.target.value = ""
            }}
          />
          <p className="lfv2-disabled-hint">
            빠른 모드와 같이 이미지 스타일을 고른 뒤 장면별 또는 일괄 생성으로 프롬프트·음성·이미지·비디오를
            한 번에 만듭니다. TTS·Supertonic 연결은 「⚙ 설정」에서 바꿉니다.
          </p>
          {batchCanResume && !batchProgress ? (
            <p className="lfv2-batch-done-banner">
              일괄 생성을 마쳤습니다. 실패하거나 남은 장면은 「이어하기」로 계속할 수 있습니다.
            </p>
          ) : null}

          <div className="dm-progress-panel">
            <div className="dm-progress-panel__head">
              <h3>장면 목록</h3>
              <span className="dm-progress-panel__summary">
                총 {counts.total}줄 대본 · 스타일{" "}
                {isCustomOn
                  ? customLabelKo || project.imageStyleLabel || "커스텀 그림체"
                  : project.imageStyleLabel || "미선택"}
              </span>
            </div>
            <ul className="dm-progress-tracks">
              {(
                [
                  ["프롬프트", counts.prompt, "prompt"],
                  ["이미지", counts.image, "image"],
                  ["TTS", counts.tts, "tts"],
                  ["최종영상", counts.video, "video"],
                ] as const
              ).map(([label, n, kind]) => {
                const done = counts.total > 0 && n >= counts.total
                return (
                  <li
                    key={kind}
                    className={
                      "dm-progress-track" + (done ? " dm-progress-track--done" : "")
                    }
                  >
                    <span className="dm-progress-track__label">{label}</span>
                    <div className="dm-progress-track__bar">
                      <span
                        className={`dm-progress-track__fill dm-progress-track__fill--${kind}`}
                        style={{ width: `${pct(n, counts.total)}%` }}
                      />
                    </div>
                    <span className="dm-progress-track__count">
                      {`${n}/${counts.total}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="dm-scene-list">
            {project.scenes.length === 0 ? (
              <p className="v2sw-plan-doc__empty">장면이 없습니다. 대본을 먼저 저장하세요.</p>
            ) : (
              project.scenes.map((scene) => (
                <SceneCard
                  key={scene.index}
                  scene={scene}
                  styleLabel={project.imageStyleLabel}
                  onGenerate={onGenerateOne}
                  onUpdateScene={onUpdateScene}
                  onOpenMotion={() => setMotionSceneIndex(scene.index)}
                />
              ))
            )}
          </div>
        </>
      )}

      <WorkSettingsModal
        open={workOpen}
        onClose={() => setWorkOpen(false)}
        project={project}
        voices={voices}
        supertonicStatus={supertonicStatus}
        onSave={onPatch}
        onSupertonicReady={onSupertonicReady}
        onPreviewEngine={onPreviewEngine}
      />

      <BatchGenerateModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        project={project}
        mode={batchMode}
        onConfirm={(plan) => {
          const withMode = { ...plan, overwrite: batchMode === "overwrite" }
          const stocks = stockSceneIndexes(
            withMode.sceneIndexes,
            withMode.videoBgMode,
            withMode.aiRatioPercent
          )
          if (stocks.length > 0 && (withMode.tasks.image || withMode.tasks.video)) {
            setPendingPlan(withMode)
            setBatchOpen(false)
            setStockKwOpen(true)
            return
          }
          setBatchOpen(false)
          submitBatchPlan(withMode)
        }}
      />

      <StockKeywordModal
        open={stockKwOpen}
        onClose={() => {
          setStockKwOpen(false)
          setPendingPlan(null)
          setBatchOpen(true)
        }}
        scenes={project.scenes}
        stockIndexes={
          pendingPlan
            ? stockSceneIndexes(
                pendingPlan.sceneIndexes,
                pendingPlan.videoBgMode,
                pendingPlan.aiRatioPercent
              )
            : []
        }
        initialKeywords={pendingPlan?.stockKeywords || {}}
        onConfirm={(keywords) => {
          if (!pendingPlan) return
          // 장면에도 검색어 영속 저장 (이어하기·단건 재생성용)
          for (const [idxStr, kw] of Object.entries(keywords)) {
            const idx = Number(idxStr)
            if (!Number.isFinite(idx) || !kw.trim()) continue
            onUpdateScene(idx, { stockSearchKeywordsKo: kw.trim() })
          }
          const plan = { ...pendingPlan, stockKeywords: keywords }
          setStockKwOpen(false)
          setPendingPlan(null)
          submitBatchPlan(plan)
        }}
      />

      <AiMotionVideoBatchModal
        open={motionBatchOpen}
        onClose={() => setMotionBatchOpen(false)}
        scenes={project.scenes}
        onConfirm={(indexes, resolution, overwrite) => {
          setMotionBatchOpen(false)
          onMotionVideoBatch?.(indexes, resolution, overwrite)
        }}
      />

      <FlowWatermarkMosaicModal
        open={flowWmOpen}
        onClose={() => {
          if (!flowWmBusy) setFlowWmOpen(false)
        }}
        imageSrc={flowWmPreview?.src || ""}
        sceneLabel={flowWmPreview ? `장면 ${flowWmPreview.index + 1}` : undefined}
        imageCount={flowWmPreview?.count || 0}
        busy={flowWmBusy}
        statusText={flowWmStatus}
        onConfirm={(params) => void onConfirmFlowWatermarkMosaic(params)}
      />

      {motionSceneIndex != null ? (
        <AiMotionVideoModal
          open
          onClose={() => setMotionSceneIndex(null)}
          sceneIndex={motionSceneIndex}
          sceneText={project.scenes.find((s) => s.index === motionSceneIndex)?.text || ""}
          promptEn={project.scenes.find((s) => s.index === motionSceneIndex)?.prompt}
          imageSrc={project.scenes.find((s) => s.index === motionSceneIndex)?.imageUrl || ""}
          motionVideoSrc={
            project.scenes.find((s) => s.index === motionSceneIndex)?.motionVideoUrl
          }
          ttsDurationSec={
            project.scenes.find((s) => s.index === motionSceneIndex)?.ttsDurationSec ||
            estimateNarrationDurationSec(
              project.scenes.find((s) => s.index === motionSceneIndex)?.text || ""
            )
          }
          onSaved={(result) => {
            onUpdateScene(motionSceneIndex, {
              motionVideoUrl: result.videoUrl,
              // AI 영상을 새로 만들었으면 옛 최종영상은 무효 → 「최종영상」으로 다시 합성
              videoUrl: undefined,
              error: null,
            })
          }}
        />
      ) : null}
    </div>
  )
}

function SceneCard({
  scene,
  styleLabel,
  onGenerate,
  onUpdateScene,
  onOpenMotion,
}: {
  scene: SceneAsset
  styleLabel?: string
  onGenerate: (sceneIndex: number, mode: "tts" | "image" | "both" | "video") => void
  onUpdateScene: (sceneIndex: number, partial: Partial<SceneAsset>) => void
  onOpenMotion: () => void
}) {
  const working = !!scene.busy
  const fileRef = useRef<HTMLInputElement>(null)
  const hasImage = Boolean(scene.imageUrl)
  const hasMotion = Boolean(scene.motionVideoUrl)
  const hasVisual = hasImage || hasMotion
  const hasFinal = Boolean(scene.videoUrl)
  const hasTts = Boolean(scene.audioUrl)
  const hasPrompt = Boolean(scene.prompt)
  const isStockMotion =
    hasMotion &&
    (scene.prompt?.startsWith("stock:pexels-video:") ||
      scene.prompt?.startsWith("stock:pexels:") ||
      scene.prompt?.startsWith("stock:video:"))
  const busyLower = (scene.busy || "").toLowerCase()
  // busy 문자열에 "이미지 프롬프트"가 같이 들어가므로 우선순위로 구분
  const promptLoading = busyLower.includes("프롬프트")
  const videoLoading =
    busyLower.includes("최종") ||
    (busyLower.includes("합성") && !busyLower.includes("프롬프트"))
  const motionLoading =
    busyLower.includes("seedance") ||
    (busyLower.includes("ai 영상") && !busyLower.includes("최종"))
  const imageLoading =
    !promptLoading &&
    !videoLoading &&
    !motionLoading &&
    (busyLower.includes("이미지") ||
      busyLower.includes("스톡") ||
      busyLower.includes("pexels") ||
      busyLower.includes("이미지 준비"))
  const ttsLoading =
    !videoLoading &&
    (busyLower.includes("음성") ||
      busyLower.includes("tts") ||
      busyLower.includes("eleven") ||
      busyLower.includes("superton"))

  const ttsLabel = scene.ttsDurationSec
    ? `0:${String(Math.max(1, Math.round(scene.ttsDurationSec))).padStart(2, "0")}`
    : null

  const showVisualLoading = imageLoading || motionLoading
  const showVisualMedia = (hasMotion || hasImage) && !showVisualLoading

  return (
    <article
      className={
        "dm-scene-card" +
        (working ? " dm-scene-card--working" : "") +
        (hasVisual || hasFinal ? " dm-scene-card--has-media" : "")
      }
    >
      <header className="dm-scene-card__head">
        <span className="dm-scene-badge">장면 {scene.index + 1}</span>
        <div className="dm-scene-status">
          <span className={(hasPrompt ? "on" : "") + (promptLoading ? " loading" : "")}>
            프롬프트
          </span>
          <span
            className={
              (hasVisual ? "on" : "") + (imageLoading || motionLoading ? " loading" : "")
            }
          >
            이미지(영상)
          </span>
          <span className={(hasTts ? "on" : "") + (ttsLoading ? " loading" : "")}>TTS</span>
          <span className={(hasFinal ? "on" : "") + (videoLoading ? " loading" : "")}>
            최종영상
          </span>
        </div>
      </header>

      <div className="dm-scene-actions">
        <button
          type="button"
          className={
            "dm-scene-act dm-scene-act--prompt" + (promptLoading ? " dm-scene-act--busy" : "")
          }
          disabled={working}
          onClick={() => onGenerate(scene.index, "image")}
          title="프롬프트·AI 이미지 생성"
        >
          {promptLoading || imageLoading ? (
            <>
              <span className="dm-scene-act__spinner" aria-hidden />
              생성 중
            </>
          ) : (
            "프롬프트"
          )}
        </button>
        <button
          type="button"
          className={
            "dm-scene-act dm-scene-act--image" +
            (imageLoading || motionLoading ? " dm-scene-act--busy" : "")
          }
          disabled={working}
          onClick={() => onGenerate(scene.index, "image")}
        >
          이미지(영상)
        </button>
        <button
          type="button"
          className={"dm-scene-act dm-scene-act--tts" + (ttsLoading ? " dm-scene-act--busy" : "")}
          disabled={working}
          onClick={() => onGenerate(scene.index, "tts")}
        >
          TTS
        </button>
        <button
          type="button"
          className={
            "dm-scene-act dm-scene-act--video" + (videoLoading ? " dm-scene-act--busy" : "")
          }
          disabled={working || (!hasImage && !hasMotion) || !hasTts}
          title={
            !hasTts || !hasVisual
              ? "이미지(또는 AI영상)와 TTS가 필요합니다"
              : hasMotion
                ? "AI 영상 + TTS로 최종영상 합성 (다시 눌러 재합성)"
                : "최종영상 합성 (다시 눌러 재합성)"
          }
          onClick={() => onGenerate(scene.index, "video")}
        >
          최종영상
        </button>
      </div>

      <div className="dm-scene-block">
        <label htmlFor={`lfv2-scene-script-${scene.index}`}>대본 내용</label>
        <textarea
          id={`lfv2-scene-script-${scene.index}`}
          className="dm-scene-field"
          rows={3}
          value={scene.text}
          disabled={working}
          onChange={(e) => onUpdateScene(scene.index, { text: e.target.value })}
        />
      </div>

      {promptLoading ? (
        <SceneGenerating task="prompt" variant="panel" />
      ) : scene.prompt ? (
        <div className="dm-scene-block">
          <label>프롬프트</label>
          <textarea
            className="dm-scene-prompt"
            rows={2}
            value={scene.prompt}
            disabled={working}
            onChange={(e) => onUpdateScene(scene.index, { prompt: e.target.value })}
          />
          {styleLabel ? (
            <p className="dm-muted" style={{ margin: "0.25rem 0 0", fontSize: 11 }}>
              스타일: {styleLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {scene.error ? <p className="dm-scene-card__err">{scene.error}</p> : null}

      <div className="dm-scene-media-row">
        <div className="dm-scene-media-cell">
          <div className="dm-scene-media-label">
            <label>이미지(영상)</label>
            <div className="dm-scene-media-label__actions">
              {hasMotion ? (
                <span className="dm-scene-media-model">
                  {isStockMotion ? "무료 영상(Pexels)" : "Seedance AI 영상"}
                </span>
              ) : hasImage ? (
                <span className="dm-scene-media-model">AI 이미지</span>
              ) : null}
              <button
                type="button"
                className="dm-scene-media-upload dm-scene-media-upload--motion"
                disabled={working || !hasImage}
                title={
                  !hasImage
                    ? "먼저 AI 이미지를 준비하세요"
                    : "이미지를 움직이는 AI 영상 생성 (Seedance)"
                }
                onClick={onOpenMotion}
              >
                AI영상 생성
              </button>
              <button
                type="button"
                className="dm-scene-media-upload"
                disabled={working}
                onClick={() => fileRef.current?.click()}
              >
                {hasImage ? "교체" : "업로드"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="dm-scene-upload-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = String(reader.result || "")
                    if (dataUrl) onUpdateScene(scene.index, { imageUrl: dataUrl, error: null })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </div>
          </div>
          {showVisualLoading ? (
            <SceneGenerating
              task={motionLoading ? "motionVideo" : "image"}
              variant="media"
              label={
                motionLoading
                  ? "AI 영상 생성 중…"
                  : busyLower.includes("스톡") || busyLower.includes("pexels")
                    ? "Pexels 검색 중…"
                    : undefined
              }
              hint={
                motionLoading
                  ? "Seedance AI 영상"
                  : busyLower.includes("스톡") || busyLower.includes("pexels")
                    ? "스톡 영상 다운로드 중"
                    : undefined
              }
            />
          ) : showVisualMedia && hasMotion ? (
            <video
              className="dm-scene-video"
              controls
              src={scene.motionVideoUrl}
              playsInline
              preload="metadata"
            />
          ) : showVisualMedia && hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="dm-scene-img" src={scene.imageUrl} alt={`장면 ${scene.index + 1}`} />
          ) : (
            <div className="dm-scene-media-placeholder">이미지·영상 대기</div>
          )}
        </div>

        <div className="dm-scene-media-cell">
          <div className="dm-scene-media-label">
            <label>최종영상</label>
            <div className="dm-scene-media-label__actions">
              {hasFinal ? (
                <span className="dm-scene-media-model">
                  {hasMotion ? "AI영상+TTS" : "이미지+TTS"}
                </span>
              ) : null}
              <button
                type="button"
                className="dm-scene-media-upload"
                disabled={working || !hasVisual || !hasTts}
                title={
                  hasMotion
                    ? "AI 영상 + TTS → 최종 mp4 (다시 누르면 재합성)"
                    : "이미지 + TTS → 최종 mp4 (다시 누르면 재합성)"
                }
                onClick={() => onGenerate(scene.index, "video")}
              >
                {hasFinal ? "다시 합성" : "TTS 합성"}
              </button>
            </div>
          </div>
          {videoLoading ? (
            <SceneGenerating task="video" variant="media" label="최종영상 생성 중…" />
          ) : hasFinal ? (
            <video
              className="dm-scene-video"
              controls
              src={scene.videoUrl}
              playsInline
              preload="metadata"
            />
          ) : hasVisual && hasTts ? (
            <div className="dm-scene-media-placeholder">
              {hasMotion
                ? "「최종영상」을 누르면 AI영상+TTS로 합성합니다"
                : "「TTS 합성」으로 최종영상을 만드세요"}
            </div>
          ) : (
            <div className="dm-scene-media-placeholder">최종영상 대기</div>
          )}
        </div>
      </div>

      {ttsLoading ? (
        <SceneGenerating task="tts" variant="panel" />
      ) : hasTts ? (
        <div className="dm-scene-tts-bar">
          <div className="dm-scene-tts-bar__head">
            <span>TTS</span>
            {ttsLabel ? <span className="dm-muted dm-scene-tts-bar__dur">{ttsLabel}</span> : null}
          </div>
          <audio
            controls
            src={scene.audioUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              if (Number.isFinite(d) && d > 0 && scene.ttsDurationSec !== d) {
                onUpdateScene(scene.index, { ttsDurationSec: Number(d.toFixed(2)) })
              }
            }}
          />
        </div>
      ) : null}
    </article>
  )
}
