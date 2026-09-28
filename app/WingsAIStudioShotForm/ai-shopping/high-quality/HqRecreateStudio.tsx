"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Sparkles,
  UserRound,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HQ_AVATAR_AGE_LABEL,
  HQ_AVATAR_AGE_ORDER,
  HQ_DEFAULT_AVATAR_ID,
  getHqAvatarById,
  groupHqAvatarsByAge,
  type HqShoppingAvatar,
} from "@/lib/hq-shopping-avatars"
import {
  getShoppingProject,
  updateShoppingProject,
  type ShoppingProject,
} from "../project-actions"
import {
  clampHqDurationSec,
  HQ_DEFAULT_DURATION_SEC,
  HQ_DURATION_OPTIONS,
  type HqDurationSec,
} from "@/lib/hq-shopping-duration"
import {
  generateHqShoppingScript,
  recreateHqShoppingVideo,
  uploadHqShoppingAsset,
} from "../hq-actions"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."))
    reader.readAsDataURL(file)
  })
}

export default function HqShoppingRecreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId") || ""

  const [userId, setUserId] = useState("")
  const [project, setProject] = useState<ShoppingProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [productPublicUrl, setProductPublicUrl] = useState<string | null>(null)
  const [avatarId, setAvatarId] = useState(HQ_DEFAULT_AVATAR_ID)
  const [productName, setProductName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [durationSec, setDurationSec] = useState<HqDurationSec>(HQ_DEFAULT_DURATION_SEC)
  const [script, setScript] = useState("")
  const [scriptJustGenerated, setScriptJustGenerated] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [progressLogs, setProgressLogs] = useState<string[]>([])
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  /** 아바타 확대 미리보기 (호버 확대 버튼) */
  const [zoomAvatar, setZoomAvatar] = useState<HqShoppingAvatar | null>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const scriptSectionRef = useRef<HTMLDivElement>(null)
  const progressEndRef = useRef<HTMLDivElement>(null)

  const selectedAvatar = useMemo(() => getHqAvatarById(avatarId), [avatarId])
  const avatarsByAge = useMemo(() => groupHqAvatarsByAge(), [])

  const pushLog = useCallback((message: string) => {
    const stamp = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setProgressLogs((prev) => [...prev.slice(-40), `[${stamp}] ${message}`])
    setStatusText(message)
  }, [])

  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [progressLogs])

  useEffect(() => {
    if (!scriptJustGenerated) return
    scriptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    const t = window.setTimeout(() => setScriptJustGenerated(false), 2500)
    return () => window.clearTimeout(t)
  }, [scriptJustGenerated, script])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/kakao/user")
        if (response.ok) {
          const data = await response.json()
          if (data?.user) {
            const id = data.user.email || `kakao_${data.user.id}`
            if (!cancelled) setUserId(id)
            return
          }
        }
      } catch {
        /* fall through */
      }
      const stored =
        localStorage.getItem("user_id") ||
        localStorage.getItem("user_email") ||
        "anonymous"
      if (!cancelled) setUserId(stored)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const loaded = await getShoppingProject(projectId)
        if (cancelled) return
        if (!loaded || loaded.data?.qualityMode !== "high") {
          alert("고퀄리티 AI 쇼핑숏폼 프로젝트가 아닙니다.")
          router.replace("/WingsAIStudioShotForm/ai-shopping")
          return
        }
        setProject(loaded)
        setAvatarId(loaded.data.hqAvatarId || HQ_DEFAULT_AVATAR_ID)
        setProductName(loaded.data.productName || "")
        setEditDescription(loaded.data.hqEditDescription || "")
        setDurationSec(
          clampHqDurationSec(loaded.data.hqDurationSec || loaded.data.videoDuration || HQ_DEFAULT_DURATION_SEC)
        )
        setScript(loaded.data.hqScript || loaded.data.script || "")
        setProductPreview(loaded.data.hqProductImageUrl || null)
        setProductPublicUrl(loaded.data.hqProductImageUrl || null)
        setPreviewImageUrl(loaded.data.hqPreviewImageUrl || null)
        setVideoUrl(loaded.data.hqVideoUrl || loaded.data.videoUrl || null)
      } catch (error) {
        console.error(error)
        alert("프로젝트를 불러오지 못했습니다.")
        router.replace("/WingsAIStudioShotForm/ai-shopping")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, router])

  const persistHqFields = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!project) return
      const nextData = {
        ...project.data,
        qualityMode: "high" as const,
        appVariant: "ver2" as const,
        ...patch,
      }
      const updated = await updateShoppingProject(project.id, { data: nextData })
      setProject(updated)
    },
    [project]
  )

  const onPickProduct = async (file: File | null) => {
    if (!file || !project || !userId) return
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.")
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setProductPreview(dataUrl)
      pushLog("제품 사진 업로드 중…")
      const publicUrl = await uploadHqShoppingAsset(
        userId,
        project.id,
        dataUrl,
        "product"
      )
      setProductPublicUrl(publicUrl)
      setProductPreview(publicUrl)
      await persistHqFields({ hqProductImageUrl: publicUrl })
      pushLog("제품 사진 업로드 완료")
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "제품 사진 업로드 실패")
      pushLog("제품 사진 업로드 실패")
    }
  }

  const onSelectAvatar = async (avatar: HqShoppingAvatar) => {
    setAvatarId(avatar.id)
    setAvatarDialogOpen(false)
    try {
      await persistHqFields({ hqAvatarId: avatar.id })
    } catch (error) {
      console.error(error)
    }
  }

  const handleGenerateScript = async () => {
    const imageForScript = productPublicUrl || productPreview
    if (!imageForScript) {
      alert("대본 생성 전에 제품 사진을 먼저 업로드해주세요. 이미지를 보고 제품 종류를 파악합니다.")
      return
    }
    setIsGeneratingScript(true)
    pushLog("제품 이미지 분석 중…")
    pushLog(
      productName.trim()
        ? `「${productName.trim()}」 ${durationSec}초 대본 생성 중…`
        : `${durationSec}초 분량 대본 생성 중…`
    )
    try {
      const openaiApiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key")?.trim() || undefined
          : undefined
      const next = await generateHqShoppingScript({
        durationSec,
        editDescription,
        avatarId,
        productName,
        productImageUrl: imageForScript,
        openaiApiKey,
      })
      // 서버 저장보다 먼저 화면에 즉시 반영
      setScript(next)
      setScriptJustGenerated(true)
      pushLog(`대본 생성 완료 (${next.length}자)`)
      await persistHqFields({
        productName: productName.trim() || undefined,
        hqScript: next,
        script: next,
        hqDurationSec: durationSec,
        videoDuration: durationSec,
      })
      pushLog("대본 저장 완료")
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : "대본 생성에 실패했습니다."
      pushLog(`대본 생성 실패: ${msg}`)
      alert(msg)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleDurationChange = async (next: HqDurationSec) => {
    setDurationSec(next)
    pushLog(`영상 길이 ${next}초로 변경`)
    try {
      await persistHqFields({ hqDurationSec: next, videoDuration: next })
    } catch (error) {
      console.error(error)
    }
  }

  const handleRecreate = async () => {
    if (!project) return
    if (isGenerating) {
      pushLog("이미 생성 중입니다. 끝날 때까지 기다려 주세요.")
      return
    }
    if (!productPublicUrl && !productPreview) {
      alert("제품 사진(Required)을 업로드해주세요.")
      return
    }
    setIsGenerating(true)
    setProgressLogs([])
    pushLog("Recreate 시작")
    try {
      let productUrl = productPublicUrl
      if (!productUrl && productPreview?.startsWith("data:") && userId) {
        pushLog("제품 사진 업로드 중…")
        productUrl = await uploadHqShoppingAsset(
          userId,
          project.id,
          productPreview,
          "product"
        )
        setProductPublicUrl(productUrl)
        pushLog("제품 사진 업로드 완료")
      }
      if (!productUrl) throw new Error("제품 사진 URL이 없습니다.")

      const replicateApiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_replicate_api_key")?.trim() ||
            localStorage.getItem("replicate_api_key")?.trim() ||
            undefined
          : undefined
      const openaiApiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key")?.trim() || undefined
          : undefined

      if (!replicateApiKey) {
        throw new Error(
          "Replicate API 키가 없습니다. Wings AI 스튜디오 설정에서 Replicate 키를 저장한 뒤 다시 시도해주세요."
        )
      }

      let scriptForVideo = script.trim()
      if (!scriptForVideo) {
        pushLog(
          productName.trim()
            ? `「${productName.trim()}」 ${durationSec}초 대본 작성 중…`
            : `${durationSec}초 대본 자동 작성 중…`
        )
        scriptForVideo = await generateHqShoppingScript({
          durationSec,
          editDescription,
          avatarId,
          productName,
          productImageUrl: productUrl,
          openaiApiKey,
        })
        setScript(scriptForVideo)
        setScriptJustGenerated(true)
        pushLog(`대본 준비 완료: ${scriptForVideo.slice(0, 36)}${scriptForVideo.length > 36 ? "…" : ""}`)
        // 다음 페인트에서 대본이 보이도록 잠깐 양보
        await new Promise((r) => setTimeout(r, 50))
      } else {
        pushLog("기존 대본 사용")
      }

      pushLog(
        `페르소나「${getHqAvatarById(avatarId).personaKo}」텍스트 + 제품 형상 보존으로 Seedance 2.5 멀티샷 생성 중…`
      )
      pushLog(
        durationSec <= 5
          ? "방식: Seedance 2.5 한 요청에 Shot1→2→3 컷 (5초) · 얼굴 이미지 미사용"
          : "방식: Seedance 2.5 한 요청 멀티샷 우선 → 실패 시 샷별 생성 후 이어붙이기 · 얼굴 이미지 미사용"
      )

      pushLog(
        "샘플 얼굴은 UI 참고용입니다. API에는 얼굴 사진을 넣지 않고 페르소나 텍스트만 보냅니다."
      )

      const result = await recreateHqShoppingVideo({
        productImageUrl: productUrl,
        avatarId,
        editDescription,
        productName,
        script: scriptForVideo,
        durationSec,
        replicateApiKey,
        openaiApiKey,
        projectId: project.id,
      })

      for (const line of result.attemptLog || []) {
        pushLog(line)
      }

      setPreviewImageUrl(result.previewImageUrl)
      setVideoUrl(result.videoUrl)
      setScript(result.script)
      setDurationSec(clampHqDurationSec(result.durationSec))
      if (result.multiShotMode === "seedance25-per-shot") {
        pushLog(
          result.hasNarration
            ? "멀티샷 완료: 제품/소개/특징 클립을 이어붙였습니다 (음성 포함)"
            : "멀티샷 완료(대체 모델): 클립 이어붙임 — 음성 없을 수 있음"
        )
      } else if (result.hasNarration) {
        pushLog(`Seedance 2.5 나레이션 멀티샷 완료 (${result.usedEngine})`)
      } else if (result.usedFallback) {
        pushLog(
          `필터 회피 후 대체 경로(${result.usedEngine})로 영상 생성 — 음성이 없을 수 있음`
        )
      } else {
        pushLog(`영상 생성 완료 (${result.usedEngine || "unknown"})`)
      }
      pushLog("저장 중…")
      await persistHqFields({
        productName: productName.trim() || undefined,
        hqAvatarId: result.avatarId,
        hqEditDescription: editDescription,
        hqProductImageUrl: productUrl,
        hqPreviewImageUrl: result.previewImageUrl,
        hqVideoUrl: result.videoUrl,
        hqScript: result.script,
        hqDurationSec: result.durationSec,
        script: result.script,
        videoUrl: result.videoUrl,
        videoDuration: result.durationSec,
        activeStep: "preview",
      })
      pushLog("완료! 왼쪽 미리보기에서 확인하세요.")
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : "영상 생성에 실패했습니다."
      pushLog(`실패: ${msg}`)
      alert(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  if (!projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b0d] px-4 text-zinc-200">
        <div className="max-w-md space-y-4 text-center">
          <p>프로젝트 ID가 없습니다. AI 쇼핑숏폼에서 고퀄리티 프로젝트를 먼저 만들어주세요.</p>
          <Link href="/WingsAIStudioShotForm/ai-shopping">
            <Button className="bg-lime-600 text-black hover:bg-lime-500">목록으로</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b0d] text-zinc-300">
        <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:px-6 lg:h-screen lg:flex-row lg:gap-0 lg:px-0 lg:py-0">
        {/* 미리보기 */}
        <section className="relative flex flex-1 items-center justify-center bg-black lg:min-h-screen">
          <div className="absolute left-4 top-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-white/10 bg-black/50 text-zinc-200 hover:bg-white/10"
              onClick={() => router.push("/WingsAIStudioShotForm/ai-shopping")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              프로젝트 목록
            </Button>
          </div>
          <div className="relative aspect-[9/16] h-[min(82vh,720px)] overflow-hidden rounded-sm bg-[#111] shadow-2xl shadow-black/60">
            {videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
                className="h-full w-full object-cover"
                controls
                playsInline
                poster={previewImageUrl || undefined}
              />
            ) : previewImageUrl || productPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImageUrl || productPreview || ""}
                alt="미리보기"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-zinc-500">
                <Sparkles className="h-8 w-8 text-lime-500/70" />
                <p className="text-sm leading-relaxed">
                  제품 사진을 올리면
                  <br />
                  15초 제품 소개 영상이 여기에 표시됩니다
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 우측 패널 — Higgsfield Recreate 스타일 */}
        <aside className="flex w-full flex-col border-t border-white/10 bg-[#121212] lg:h-screen lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                High Quality · Seedance 2.5
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-wide text-white">
                RECREATE TEMPLATE
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                {project?.name || "고퀄리티 AI 쇼핑숏폼"}
              </p>
            </div>
            <button
              type="button"
              aria-label="닫기"
              className="rounded-full p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
              onClick={() => router.push("/WingsAIStudioShotForm/ai-shopping")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => productInputRef.current?.click()}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-3 text-center transition hover:border-lime-400/50 hover:bg-white/[0.05]"
              >
                <span className="absolute right-2 top-2 rounded bg-zinc-700/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                  Required
                </span>
                {productPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productPreview}
                    alt="제품"
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <Plus className="h-7 w-7 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-300">Upload product</span>
                    <span className="text-[10px] text-zinc-500">제품 사진</span>
                  </>
                )}
              </button>
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickProduct(e.target.files?.[0] || null)}
              />

              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-3 text-center transition hover:border-lime-400/50 hover:bg-white/[0.05]"
              >
                <span className="absolute right-2 top-2 z-10 rounded bg-zinc-700/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                  Optional
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAvatar.previewSrc}
                  alt={selectedAvatar.nameKo}
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                />
                <div className="relative z-10 rounded-full bg-black/55 px-2 py-1">
                  <UserRound className="mx-auto mb-1 h-5 w-5 text-white" />
                  <span className="block text-xs font-medium text-white">
                    {selectedAvatar.nameKo}
                  </span>
                  <span className="block text-[10px] text-zinc-300">
                    {selectedAvatar.personaKo}
                  </span>
                </div>
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              샘플 얼굴은 선택 참고용입니다. 생성 영상 속{" "}
              <span className="text-zinc-300">인물 얼굴은 다를 수 있습니다</span>
              (Seedance에는 얼굴 사진 대신「{selectedAvatar.personaKo}」같은 페르소나 텍스트만 전달).
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">제품명</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onBlur={() => {
                  void persistHqFields({
                    productName: productName.trim() || undefined,
                  }).catch(console.error)
                }}
                placeholder="예: 스탠리 텀블러, 수분크림"
                className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
              />
              <p className="text-[11px] text-zinc-500">
                대본 생성 시 제품명을 대사에 자연스럽게 넣습니다.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">영상 길이</Label>
              <div className="flex flex-wrap gap-2">
                {HQ_DURATION_OPTIONS.map((sec) => {
                  const active = durationSec === sec
                  return (
                    <button
                      key={sec}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => void handleDurationChange(sec)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "border-lime-400/60 bg-lime-500/15 text-lime-200"
                          : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                      }`}
                    >
                      {sec}초
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-500">
                Seedance 2.5가 <span className="text-zinc-300">한 요청으로 제품샷→소개샷→특징샷</span> 컷을
                만듭니다. 막히면 샷을 나눠 생성해 이어붙입니다.{" "}
                <span className="text-zinc-300">8초 이상</span> 권장 (음성·멀티샷).
              </p>
            </div>

            <div ref={scriptSectionRef} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium text-zinc-300">
                  대본 (대사)
                  {script.trim() ? (
                    <span className="ml-2 text-[10px] font-normal text-lime-400">
                      {script.length}자
                    </span>
                  ) : null}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGenerating || isGeneratingScript}
                  onClick={() => void handleGenerateScript()}
                  className="h-8 border-white/15 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/10"
                >
                  {isGeneratingScript ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      생성 중
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                      {durationSec}초 대본 생성
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder={
                  productName.trim()
                    ? `「${productName.trim()}」 ${durationSec}초 대본이 여기에 표시됩니다.`
                    : `비워 두면 Recreate 시 ${durationSec}초 대본을 자동 생성합니다.`
                }
                rows={5}
                className={`resize-none bg-black/40 text-zinc-100 placeholder:text-zinc-600 transition ${
                  scriptJustGenerated
                    ? "border-lime-400/70 ring-2 ring-lime-400/30"
                    : "border-white/10"
                }`}
              />
              <p className="text-[11px] text-zinc-500">
                제품 사진을 보고 품목(텀블러/화장품 등)을 파악한 뒤 대본을 만듭니다. OpenAI 키가 설정에 있어야 합니다.
              </p>
              {scriptJustGenerated ? (
                <p className="text-[11px] font-medium text-lime-300">대본이 생성되어 위에 반영되었습니다.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">Describe your edit</Label>
              <div className="relative">
                <Wand2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What do you want to change? 예: 욕실에서 사용감 있게, 밝은 톤으로"
                  rows={3}
                  className="resize-none border-white/10 bg-black/40 pl-10 text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-zinc-300">작업 로그</Label>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-400">
                {progressLogs.length === 0 ? (
                  <p className="text-zinc-600">대본 생성·Recreate 진행 상황이 여기에 실시간으로 표시됩니다.</p>
                ) : (
                  progressLogs.map((line, idx) => (
                    <p
                      key={`${idx}-${line.slice(0, 12)}`}
                      className={
                        line.includes("완료") || line.includes("반영")
                          ? "text-lime-300/90"
                          : line.includes("실패")
                            ? "text-red-300/90"
                            : undefined
                      }
                    >
                      {line}
                    </p>
                  ))
                )}
                <div ref={progressEndRef} />
              </div>
              {statusText ? (
                <p className="flex items-center gap-2 text-xs text-lime-300/90">
                  {isGenerating || isGeneratingScript ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {statusText}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 px-5 py-4">
            <Button
              onClick={() => void handleRecreate()}
              disabled={isGenerating || !productPreview}
              className="h-12 w-full rounded-xl bg-[#9CAF3E] text-base font-semibold text-black hover:bg-[#b0c44a] disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  Recreate
                  <Sparkles className="ml-2 h-4 w-4" />
                  <span className="ml-1 text-sm opacity-80">{durationSec}s</span>
                </>
              )}
            </Button>
            {videoUrl ? (
              <a
                href={videoUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm text-zinc-300 hover:bg-white/5"
              >
                <Download className="h-4 w-4" />
                영상 다운로드
              </a>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#141518] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>한국 인물 페르소나 선택</DialogTitle>
            <DialogDescription className="text-zinc-400">
              샘플 얼굴은 참고용이며, 생성 영상 속 인물 얼굴은 다를 수 있습니다.
              Seedance에는「30대 여성 주부」같은 페르소나 텍스트만 전달됩니다. 기본값은 20대 여성(지우)입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {HQ_AVATAR_AGE_ORDER.map((age) => (
              <div key={age} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {HQ_AVATAR_AGE_LABEL[age]}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {avatarsByAge[age].map((avatar) => {
                    const selected = avatar.id === avatarId
                    return (
                      <div
                        key={avatar.id}
                        className={`group/card relative flex items-center gap-3 rounded-xl border p-2 transition ${
                          selected
                            ? "border-lime-400/60 bg-lime-500/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatar.previewSrc}
                            alt={avatar.nameKo}
                            className="h-full w-full object-cover transition duration-200 group-hover/card:scale-105"
                          />
                          <button
                            type="button"
                            aria-label={`${avatar.nameKo} 확대 보기`}
                            className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition group-hover/card:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setZoomAvatar(avatar)
                            }}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-lg">
                              <ZoomIn className="h-4 w-4" />
                            </span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onSelectAvatar(avatar)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-zinc-50">
                            {avatar.nameKo}
                            {avatar.id === HQ_DEFAULT_AVATAR_ID ? (
                              <span className="ml-1 text-[10px] font-medium text-lime-400">
                                DEFAULT
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] font-medium text-zinc-300">
                            {avatar.personaKo}
                          </p>
                          <p className="truncate text-[11px] text-zinc-500">{avatar.blurbKo}</p>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 인물 확대 미리보기 */}
      <Dialog open={Boolean(zoomAvatar)} onOpenChange={(open) => !open && setZoomAvatar(null)}>
        <DialogContent className="border-white/10 bg-[#0c0d10] p-0 text-zinc-100 sm:max-w-md overflow-hidden">
          {zoomAvatar ? (
            <>
              <DialogHeader className="space-y-1 border-b border-white/10 px-5 py-4 text-left">
                <DialogTitle className="text-lg">
                  {zoomAvatar.nameKo}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {zoomAvatar.personaKo}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-zinc-500">
                  샘플 얼굴은 참고용입니다. 생성 영상 속 인물 얼굴은 다를 수 있습니다.
                  <br />
                  {zoomAvatar.blurbKo}
                </DialogDescription>
              </DialogHeader>
              <div className="bg-black px-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zoomAvatar.previewSrc}
                  alt={zoomAvatar.nameKo}
                  className="mx-auto max-h-[min(70vh,520px)] w-full rounded-xl object-contain"
                />
              </div>
              <div className="flex gap-2 border-t border-white/10 px-4 py-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/10"
                  onClick={() => setZoomAvatar(null)}
                >
                  닫기
                </Button>
                <Button
                  className="flex-1 bg-[#9CAF3E] font-semibold text-black hover:bg-[#b0c44a]"
                  onClick={() => {
                    const picked = zoomAvatar
                    setZoomAvatar(null)
                    void onSelectAvatar(picked)
                  }}
                >
                  이 인물 선택
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
