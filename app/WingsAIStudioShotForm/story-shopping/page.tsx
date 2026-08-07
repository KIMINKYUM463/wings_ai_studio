"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileDown,
  FolderOpen,
  Home,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  WandSparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ShotFormEditorDialogShell } from "../components/ShotFormEditorDialogShell"
import { SsulPreview } from "./components/SsulPreview"
import { StoryProductSearchPanel } from "./StoryProductSearchPanel"
import { StoryWinningContentPanel } from "./StoryWinningContentPanel"
import { StoryGenerationPanel } from "./StoryGenerationPanel"
import { StoryVoicePanel } from "./StoryVoicePanel"
import { StoryTemplateSelectionPanel } from "./StoryTemplateSelectionPanel"
import {
  StoryEditorWorkspace,
  type StoryEditorHandle,
} from "./StoryEditorWorkspace"
import type { StoryPublishMeta } from "./StoryPublishMetaPanel"
import type { StoryExportProgress } from "./story-export-video"
import {
  createShoppingProject,
  deleteShoppingProject,
  getShoppingProject,
  getShoppingProjects,
  updateShoppingProject,
  type ShoppingProject,
  type SsulTemplateId,
} from "./project-actions"
import { generateStoryShoppingBlueprint } from "./story-blueprint-actions"
import {
  EMPTY_STORY_BRIEF,
  type StoryShoppingBlueprint,
  type StoryShoppingBrief,
  type StoryShoppingScene,
  type StoryTone,
  type StoryWinningContent,
} from "./story-types"
import {
  migrateStoryActiveStep,
  type StoryLiveActiveStep,
} from "./story-steps"

const STEPS: Array<{
  id: StoryLiveActiveStep
  label: string
  description: string
}> = [
  { id: "content", label: "콘텐츠 발굴", description: "채널 성과 분석" },
  { id: "product", label: "상품 서칭", description: "영상 제품 분석" },
  { id: "story", label: "스토리 생성", description: "6개 서사 템플릿" },
  { id: "voice", label: "AI 음성", description: "장면별 TTS" },
  { id: "template", label: "이야기 템플릿", description: "채널 화면 선택" },
  { id: "edit", label: "영상 편집", description: "클립·게시 정보" },
]

const TONES: Array<{ id: StoryTone; label: string; description: string }> = [
  { id: "reversal", label: "반전형", description: "결과를 먼저 보여주고 이유를 뒤집습니다." },
  { id: "confession", label: "고백형", description: "실제 경험을 털어놓는 커뮤니티 톤입니다." },
  { id: "curiosity", label: "호기심형", description: "정보를 조금씩 공개해 완주를 유도합니다." },
  { id: "warning", label: "경고형", description: "손실과 실수를 먼저 보여줍니다." },
  { id: "heartwarming", label: "공감형", description: "감정과 관계를 중심으로 해결합니다." },
]

const BEAT_LABELS: Record<StoryShoppingScene["beat"], string> = {
  hook: "0~3초 훅",
  setup: "상황 설정",
  conflict: "갈등 확대",
  product: "상품 발견",
  proof: "증거·시연",
  cta: "해결·CTA",
}

const cloneEmptyBrief = (): StoryShoppingBrief => ({ ...EMPTY_STORY_BRIEF })

const statusStyle = {
  pass: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  blocked: "border-red-400/30 bg-red-500/10 text-red-200",
} as const

export default function StoryShoppingPage() {
  const [userId, setUserId] = useState("")
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDetailWorkMode, setIsDetailWorkMode] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<StoryExportProgress | null>(
    null
  )
  const [error, setError] = useState("")
  const editorRef = useRef<StoryEditorHandle | null>(null)

  const [activeStep, setActiveStep] = useState<StoryLiveActiveStep>("content")
  const [brief, setBrief] = useState<StoryShoppingBrief>(cloneEmptyBrief)
  const [blueprint, setBlueprint] = useState<StoryShoppingBlueprint | null>(null)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0)
  const [template, setTemplate] = useState<SsulTemplateId>("ssul-white")
  const [postTime, setPostTime] = useState("14:25")
  const [publishMeta, setPublishMeta] = useState<StoryPublishMeta>({
    youtubeTitle: "",
    youtubeDescription: "",
    youtubeTags: [],
  })

  const loadProjects = useCallback(async (id: string) => {
    setIsLoadingProjects(true)
    try {
      setProjects(await getShoppingProjects(id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로젝트 목록을 불러오지 못했습니다.")
    } finally {
      setIsLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    const resolveUser = async () => {
      try {
        const response = await fetch("/api/kakao/user")
        const data = await response.json()
        const id =
          data.loggedIn && data.user
            ? data.user.email || `kakao_${data.user.id}`
            : localStorage.getItem("user_id") ||
              localStorage.getItem("user_email") ||
              "anonymous"
        setUserId(id)
        await loadProjects(id)
      } catch {
        const id =
          localStorage.getItem("user_id") ||
          localStorage.getItem("user_email") ||
          "anonymous"
        setUserId(id)
        await loadProjects(id)
      }
    }
    void resolveUser()
  }, [loadProjects])

  const hydrateProject = (project: ShoppingProject) => {
    const data = project.data || {}
    setCurrentProject(project)
    setBrief(
      data.storyBrief
        ? { ...cloneEmptyBrief(), ...data.storyBrief }
        : {
            ...cloneEmptyBrief(),
            productName: data.productName || "",
            productDescription: data.productDescription || "",
          }
    )
    const restoredBlueprint = data.storyBlueprint || null
    setBlueprint(restoredBlueprint)
    setTemplate(data.ssulTemplate || "ssul-white")
    setPostTime(data.postTime || "14:25")
    setPublishMeta({
      youtubeTitle: data.youtubeTitle || "",
      youtubeDescription: data.youtubeDescription || "",
      youtubeTags: Array.isArray(data.youtubeTags) ? data.youtubeTags : [],
    })
    setSelectedSceneIndex(0)
    const restoredStep = migrateStoryActiveStep(data.activeStep)
    setActiveStep(restoredStep)
    setError("")
  }

  const createProject = async () => {
    if (!userId || !projectName.trim()) return
    setIsCreating(true)
    setError("")
    try {
      const created = await createShoppingProject(
        userId,
        projectName.trim(),
        projectDescription.trim() || undefined,
        {
          activeStep: "content",
          storyBrief: cloneEmptyBrief(),
          appVariant: "story",
        }
      )
      setProjects((previous) => [created, ...previous])
      hydrateProject(created)
      setShowCreateDialog(false)
      setProjectName("")
      setProjectDescription("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로젝트를 만들지 못했습니다.")
    } finally {
      setIsCreating(false)
    }
  }

  const openProject = async (projectId: string) => {
    setError("")
    try {
      const project = await getShoppingProject(projectId)
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.")
      if (project.data?.appVariant !== "story") {
        throw new Error("AI 스토리 쇼핑 프로젝트가 아닙니다.")
      }
      hydrateProject(project)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로젝트를 불러오지 못했습니다.")
    }
  }

  const saveProject = async () => {
    if (!currentProject) return
    setIsSaving(true)
    setError("")
    try {
      const updated = await updateShoppingProject(currentProject.id, {
        data: {
          ...currentProject.data,
          appVariant: "story",
          activeStep,
          storyBrief: brief,
          storyBlueprint: blueprint || undefined,
          productName: brief.productName,
          productDescription: brief.productDescription,
          productImage: brief.productImage || undefined,
          ssulTemplate: template,
          hookTitle: blueprint?.hookTitle,
          channelLabel: blueprint?.channelLabel,
          postTime,
          storyScenes: blueprint?.scenes.map((scene) => ({
            id: scene.id,
            narration: scene.narration,
            mediaUrl: scene.mediaUrl,
            mediaType: scene.mediaType,
            durationSec: Math.max(1, scene.endSec - scene.startSec),
          })),
          script: brief.generatedStory?.script || "",
          editedScript: brief.generatedStory?.script || "",
          youtubeTitle: publishMeta.youtubeTitle,
          youtubeDescription: publishMeta.youtubeDescription,
          youtubeTags: publishMeta.youtubeTags,
          selectedVoiceId: brief.voiceData?.voiceId,
          imageUrls: brief.sceneAssets
            ?.filter((asset) => asset.mediaType === "image")
            .map((asset) => asset.mediaUrl),
          convertedVideoUrls: brief.sceneAssets
            ?.filter((asset) => asset.mediaType === "video")
            .map((asset, index) => ({ index, videoUrl: asset.mediaUrl })),
        },
      })
      setCurrentProject(updated)
      setProjects((previous) =>
        previous.map((project) => (project.id === updated.id ? updated : project))
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로젝트 저장에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const downloadVideo = async () => {
    if (isDownloading) return
    if (!brief.generatedStory?.scenes?.length) {
      setError("먼저 스토리를 생성한 뒤 영상 편집에서 다운로드하세요.")
      return
    }
    if (activeStep !== "edit") {
      setActiveStep("edit")
      // 편집기 마운트 대기
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
    setIsDownloading(true)
    setError("")
    try {
      if (!editorRef.current) {
        throw new Error("편집기를 준비하지 못했습니다. 영상 편집 화면에서 다시 눌러주세요.")
      }
      await editorRef.current.downloadVideo()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "영상 다운로드에 실패했습니다."
      )
    } finally {
      setIsDownloading(false)
    }
  }

  const removeProject = async (project: ShoppingProject) => {
    if (!confirm(`"${project.name}" 프로젝트를 삭제할까요?`)) return
    try {
      await deleteShoppingProject(project.id)
      setProjects((previous) => previous.filter((item) => item.id !== project.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "프로젝트 삭제에 실패했습니다.")
    }
  }

  const generateBlueprint = async () => {
    if (!brief.assetRightsConfirmed) {
      setError("사용할 이미지·영상·후기의 이용 권리를 먼저 확인해주세요.")
      return
    }
    setIsGenerating(true)
    setError("")
    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("shotform_openai_api_key") || undefined
          : undefined
      const generated = await generateStoryShoppingBlueprint(brief, apiKey)
      setBlueprint(generated)
      setSelectedSceneIndex(0)
      setActiveStep("story")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 기획 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  const selectWinningContent = (content: StoryWinningContent) => {
    setBrief((previous) => {
      const channelReference = {
        id: content.videoId,
        title: content.title,
        description: content.description,
        channelTitle: content.channelTitle,
        publishedAt: content.publishedAt,
        thumbnailUrl: content.thumbnailUrl,
        viewCount: content.viewCount,
        likeCount: content.likeCount,
        duration: "",
        durationSec: 0,
        url: `https://www.youtube.com/watch?v=${content.videoId}`,
        embedUrl: `https://www.youtube.com/embed/${content.videoId}`,
        region: "channel" as const,
      }
      return {
        ...previous,
        winningContent: content,
        referenceVideos: [
          channelReference,
          ...previous.referenceVideos.filter((video) => video.id !== content.videoId),
        ].slice(0, 5),
      }
    })
    setActiveStep("product")
  }

  const patchScene = (index: number, patch: Partial<StoryShoppingScene>) => {
    setBlueprint((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        scenes: previous.scenes.map((scene, sceneIndex) =>
          sceneIndex === index ? { ...scene, ...patch } : scene
        ),
      }
    })
  }

  const uploadSceneMedia = (index: number, file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      patchScene(index, {
        mediaUrl: String(reader.result || ""),
        mediaType: file.type.startsWith("video/") ? "video" : "image",
      })
    }
    reader.readAsDataURL(file)
  }

  const downloadPlan = () => {
    if (!blueprint || !currentProject) return
    const blob = new Blob(
      [
        JSON.stringify(
          {
            project: currentProject.name,
            generatedAt: new Date().toISOString(),
            brief,
            blueprint,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${currentProject.name}_스토리쇼핑_기획서.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const selectedScene = blueprint?.scenes[selectedSceneIndex] || null
  const blockedCount =
    blueprint?.safetyChecks.filter((check) => check.status === "blocked").length || 0
  const progress = blueprint
    ? Math.round(
        (blueprint.scenes.filter(
          (scene) => scene.narration.trim() && scene.caption.trim() && scene.visualDirection.trim()
        ).length /
          blueprint.scenes.length) *
          100
      )
    : 0
  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep)
  const legacyStep = activeStep as string

  if (!currentProject) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#080706] px-4 py-8 text-zinc-100 md:px-8">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-40 -top-52 h-[520px] w-[520px] rounded-full bg-orange-600/10 blur-[120px]"
            animate={{ x: [0, 80, 0], y: [0, 45, 0], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-48 top-52 h-[480px] w-[480px] rounded-full bg-rose-700/10 blur-[130px]"
            animate={{ x: [0, -70, 0], y: [0, -55, 0], opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:56px_56px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/WingsAIStudioShotForm">
              <Button
                type="button"
                variant="ghost"
                className="border border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
              >
                <Home className="mr-2 h-4 w-4" />
                메인화면
              </Button>
            </Link>
            <span className="text-[9px] font-black tracking-[0.18em] text-orange-400/70">
              AI STORY SHOPPING
            </span>
          </div>
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 overflow-hidden rounded-[32px] border border-white/10 bg-[#11100e]/80 shadow-2xl shadow-black/50"
          >
            <div className="grid min-h-[310px] lg:grid-cols-[1fr_340px]">
              <div className="flex flex-col justify-between p-7 md:p-10">
                <div>
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-[10px] font-black tracking-[0.15em] text-orange-200"
                  >
                    <motion.span
                      className="h-2 w-2 rounded-full bg-orange-400"
                      animate={{ scale: [1, 1.7, 1], opacity: [1, 0.45, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    AI 스토리 쇼핑 숏폼
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28, duration: 0.6 }}
                    className="mt-6 max-w-2xl text-4xl font-black leading-[1.08] tracking-[-0.045em] text-white md:text-6xl"
                  >
                    사연이 끝나는 순간,
                    <br />
                    <span className="bg-gradient-to-r from-orange-300 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                      구매가 시작됩니다.
                    </span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.6 }}
                    className="mt-5 max-w-xl text-sm leading-7 text-zinc-500"
                  >
                    문제·반전·증거를 하나의 이야기로 설계하고 상품을 해결의 순간에
                    자연스럽게 연결하는 AI 스토리 커머스 스튜디오입니다.
                  </motion.p>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.5 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="mt-7 h-12 w-fit rounded-xl bg-orange-500 px-6 font-black text-white shadow-[0_0_32px_rgba(249,115,22,.28)] hover:bg-orange-400"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    AI 스토리 쇼핑 숏폼 만들기
                  </Button>
                </motion.div>
              </div>
              <div className="relative hidden overflow-hidden border-l border-white/10 bg-black/25 lg:block">
                <motion.div
                  className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[70px]"
                  animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.45, 0.9, 0.45] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative flex h-full items-center justify-center p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, rotate: -3 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0, y: [0, -7, 0] }}
                    transition={{
                      opacity: { delay: 0.35, duration: 0.5 },
                      scale: { delay: 0.35, duration: 0.5 },
                      rotate: { delay: 0.35, duration: 0.5 },
                      y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    }}
                    className="relative h-[270px] w-[152px] overflow-hidden rounded-[24px] border-4 border-zinc-700/80 bg-[#0c0b0a] shadow-[0_30px_80px_rgba(0,0,0,.65)]"
                  >
                    <div className="absolute left-1/2 top-1.5 h-3 w-12 -translate-x-1/2 rounded-full bg-black" />
                    <div className="absolute inset-x-2 top-7 rounded-md bg-amber-400 px-2 py-2 text-center text-[9px] font-black text-black">
                      결국 이걸 샀습니다
                    </div>
                    <div className="absolute inset-x-2 bottom-14 top-[62px] overflow-hidden rounded-lg bg-gradient-to-br from-orange-950 via-zinc-900 to-black">
                      <motion.div
                        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(249,115,22,.35),transparent_45%)]"
                        animate={{ scale: [1, 1.18, 1] }}
                        transition={{ duration: 3.2, repeat: Infinity }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          animate={{ rotate: [-5, 5, -5], y: [0, -3, 0] }}
                          transition={{ duration: 2.4, repeat: Infinity }}
                          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/15 shadow-[0_0_30px_rgba(249,115,22,.2)]"
                        >
                          <ShoppingBag className="h-7 w-7 text-orange-300" />
                        </motion.span>
                        <p className="mt-3 text-[8px] font-bold text-zinc-400">문제 → 반전 → 상품 발견</p>
                      </div>
                      <motion.div
                        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent shadow-[0_0_10px_#fb923c]"
                        animate={{ top: ["8%", "92%", "8%"] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div className="absolute inset-x-2 bottom-5 rounded-md border border-white/10 bg-white/[0.06] px-2 py-2 text-center text-[8px] font-black text-white">
                      처음엔 광고인 줄 알았는데...
                    </div>
                    <div className="absolute bottom-1.5 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-zinc-600" />
                  </motion.div>

                  {[
                    { label: "STOP", copy: "3초 훅", top: "17%", left: "8%", delay: 0 },
                    { label: "STAY", copy: "스토리", top: "45%", right: "5%", delay: 0.7 },
                    { label: "SHOP", copy: "상품 발견", bottom: "15%", left: "6%", delay: 1.4 },
                  ].map((item) => (
                    <motion.div
                      key={item.label}
                      className="absolute rounded-xl border border-white/10 bg-[#171512]/90 px-3 py-2 shadow-xl backdrop-blur"
                      style={{
                        top: item.top,
                        bottom: item.bottom,
                        left: item.left,
                        right: item.right,
                      }}
                      animate={{ y: [0, -5, 0], opacity: [0.65, 1, 0.65] }}
                      transition={{
                        duration: 2.8,
                        delay: item.delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <p className="text-[8px] font-black tracking-[0.16em] text-orange-400">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[8px] font-bold text-zinc-400">{item.copy}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="mb-5 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-orange-400">
                RECENT PROJECTS
              </p>
              <h2 className="mt-1 text-xl font-black text-white">스토리 작업실</h2>
            </div>
            <p className="text-xs text-zinc-600">{projects.length}개의 프로젝트</p>
          </motion.div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {isLoadingProjects ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
            </div>
          ) : projects.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.72 + index * 0.08, duration: 0.45 }}
                  whileHover={{ y: -5 }}
                >
                <Card
                  className="group relative h-full overflow-hidden rounded-2xl border-white/10 bg-[#12100e]/90 transition duration-300 hover:border-orange-400/35 hover:shadow-2xl hover:shadow-orange-950/20"
                >
                  <div className="absolute right-4 top-2 font-mono text-5xl font-black text-white/[0.025]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base text-zinc-100">
                          {project.name}
                        </CardTitle>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          {project.description || "새 AI 스토리 쇼핑 프로젝트"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeProject(project)}
                        className="rounded-md p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        {project.data.storyBlueprint
                          ? `${project.data.storyBlueprint.scenes.length}개 장면`
                          : "기획 전"}
                      </span>
                      <span>{new Date(project.updated_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                    <Button
                      onClick={() => void openProject(project.id)}
                      className="w-full bg-white/5 text-zinc-200 hover:bg-orange-500 hover:text-white"
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      프로젝트 열기
                    </Button>
                  </CardContent>
                </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-20 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-zinc-700" />
              <p className="mt-4 font-semibold text-zinc-300">아직 프로젝트가 없습니다.</p>
              <p className="mt-1 text-sm text-zinc-600">첫 스토리 쇼핑 숏폼을 시작해보세요.</p>
            </div>
          )}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="border-white/10 bg-[#12151c] text-zinc-100">
            <DialogHeader>
              <DialogTitle>새 스토리 쇼핑 프로젝트</DialogTitle>
              <DialogDescription className="text-zinc-500">
                프로젝트를 만든 뒤 소재와 상품 정보를 설계합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>프로젝트 이름</Label>
                <Input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="예: 세안제 반전 사용기"
                  className="border-white/10 bg-black/30 text-zinc-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label>설명</Label>
                <Textarea
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="어떤 스토리와 상품을 다룰지 간단히 적어주세요."
                  className="border-white/10 bg-black/30 text-zinc-100"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="border-white/20 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
              >
                취소
              </Button>
              <Button
                onClick={() => void createProject()}
                disabled={isCreating || !projectName.trim()}
                className="bg-orange-500 text-white hover:bg-orange-400"
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                프로젝트 생성
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    )
  }

  return (
    <main
      className={`relative min-h-screen overflow-hidden ${
        activeStep === "edit" ? "bg-[#f7f8fa] text-slate-900" : "bg-[#080706] text-zinc-100"
      }`}
    >
      <div className={`pointer-events-none fixed inset-0 ${activeStep === "edit" ? "hidden" : ""}`}>
        <div className="absolute -left-48 top-10 h-[480px] w-[480px] rounded-full bg-orange-700/[0.08] blur-[130px]" />
        <div className="absolute -right-52 top-[520px] h-[520px] w-[520px] rounded-full bg-rose-700/[0.07] blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>
      <header
        className={`sticky top-0 z-40 h-[61px] border-b backdrop-blur-2xl ${
          activeStep === "edit"
            ? "border-slate-200 bg-white/95"
            : "border-white/[0.07] bg-[#080706]/85"
        }`}
      >
        <div className={`mx-auto flex h-full items-center justify-between gap-3 px-4 md:px-8 ${
          activeStep === "edit" ? "max-w-none" : "max-w-[1440px]"
        }`}>
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/WingsAIStudioShotForm"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${
                activeStep === "edit"
                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              홈
            </Link>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                setCurrentProject(null)
                void loadProjects(userId)
              }}
              className={activeStep === "edit" ? "text-slate-500 hover:text-slate-900" : "text-zinc-400 hover:text-white"}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              <div className={`hidden h-8 w-px sm:block ${activeStep === "edit" ? "bg-slate-200" : "bg-white/10"}`} />
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${activeStep === "edit" ? "text-slate-900" : ""}`}>{currentProject.name}</p>
                <p className={`text-[9px] font-bold tracking-[0.18em] ${
                  activeStep === "edit" ? "text-blue-500" : "text-orange-400/70"
                }`}>
                  {activeStep === "edit" ? "VIDEO EDITOR" : "NARRATIVE COMMERCE"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeStep === "edit" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep("template")}
                className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                템플릿
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadVideo()}
              disabled={isDownloading || isSaving || !brief.generatedStory}
              className={`rounded-xl px-4 ${
                activeStep === "edit"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
              }`}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading
                ? downloadProgress?.message || "다운로드 중"
                : "다운로드"}
            </Button>
            <Button
              type="button"
              onClick={() => void saveProject()}
              disabled={isSaving || isDownloading}
              className={`rounded-xl px-5 text-white ${
                activeStep === "edit"
                  ? "bg-blue-600 hover:bg-blue-500"
                  : "bg-orange-500 shadow-[0_0_24px_rgba(249,115,22,.2)] hover:bg-orange-400"
              }`}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              저장
            </Button>
          </div>
        </div>
      </header>

      <div className={`relative ${
        activeStep === "edit"
          ? "h-[calc(100vh-61px)] max-w-none p-0"
          : "mx-auto max-w-[1440px] px-4 py-7 md:px-8"
      }`}>
        <div className={`relative mb-7 rounded-2xl border border-white/[0.07] bg-[#11100e]/80 px-3 py-3 md:px-5 ${
          activeStep === "edit" ? "hidden" : ""
        }`}>
          <div className="relative grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          {STEPS.map((step, index) => {
            const active = activeStep === step.id
            const complete = index < activeStepIndex
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id === "product" && !brief.winningContent) return
                  if (
                    step.id === "story" &&
                    (!brief.productName.trim() ||
                      brief.selectedProductVideoId !== brief.winningContent?.videoId)
                  ) return
                  if (
                    (step.id === "voice" ||
                      step.id === "template" ||
                      step.id === "edit") &&
                    !brief.generatedStory
                  ) return
                  setActiveStep(step.id)
                }}
                className={`group rounded-xl border p-3 text-left transition duration-300 lg:border-transparent lg:bg-transparent ${
                  active
                    ? "!border-orange-400/30 !bg-orange-500/10"
                    : complete
                      ? "!border-emerald-400/15 !bg-emerald-500/[0.04]"
                      : "border-white/[0.06] bg-black/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-black shadow-xl ${
                      active
                        ? "border-orange-300/50 bg-orange-500 text-white shadow-orange-950/50"
                        : complete
                          ? "border-emerald-400/30 bg-emerald-500 text-white"
                          : "border-white/15 bg-[#191714] text-zinc-300"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <div>
                    <span className={`text-sm font-black ${active ? "text-white" : "text-zinc-400"}`}>
                      {step.label}
                    </span>
                    <p className="mt-0.5 text-[9px] font-medium text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
          </div>
        </div>

        {error ? (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {activeStep === "content" ? (
          <StoryWinningContentPanel
            userId={userId}
            selected={brief.winningContent}
            onSelect={selectWinningContent}
          />
        ) : null}

        {activeStep === "product" ? (
          <div className="space-y-4">
            <StoryProductSearchPanel brief={brief} onChange={setBrief} />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveStep("content")}
                className="flex-1 border-white/10 bg-white/[0.03] text-zinc-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                콘텐츠 다시 선택
              </Button>
              <Button
                type="button"
                onClick={() => setActiveStep("story")}
                disabled={
                  !brief.productName.trim() ||
                  brief.selectedProductVideoId !== brief.winningContent?.videoId
                }
                className="flex-1 bg-orange-500 font-black text-white hover:bg-orange-400"
              >
                {brief.selectedProductVideoId === brief.winningContent?.videoId
                  ? "선택 상품으로 스토리 생성"
                  : "상품을 먼저 선택하세요"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === "story" ? (
          <div className="space-y-4">
            <StoryGenerationPanel brief={brief} onChange={setBrief} />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setActiveStep("product")}
                className="flex-1 border-white/10 bg-white/[0.03] text-zinc-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                상품 서칭
              </Button>
              <Button
                onClick={() => setActiveStep("voice")}
                disabled={!brief.generatedStory}
                className="flex-1 bg-violet-500 font-black text-white hover:bg-violet-400"
              >
                AI 음성으로 이동
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === "voice" ? (
          <div className="space-y-4">
            <StoryVoicePanel
              brief={brief}
              onChange={setBrief}
              userId={userId}
              projectId={currentProject.id}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActiveStep("story")} className="flex-1 border-white/10 bg-white/[0.03] text-zinc-300">
                <ArrowLeft className="mr-2 h-4 w-4" />
                스토리 생성
              </Button>
              <Button onClick={() => setActiveStep("template")} className="flex-1 bg-cyan-500 font-black text-black hover:bg-cyan-300">
                이야기 템플릿 선택
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === "template" ? (
          <div className="space-y-4">
            <StoryTemplateSelectionPanel brief={brief} onChange={setBrief} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActiveStep("voice")} className="flex-1 border-white/10 bg-white/[0.03] text-zinc-300">
                <ArrowLeft className="mr-2 h-4 w-4" />
                AI 음성
              </Button>
              <Button onClick={() => setActiveStep("edit")} className="flex-1 bg-orange-500 font-black text-white hover:bg-orange-400">
                영상 편집으로 이동
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        <ShotFormEditorDialogShell
          open={activeStep === "edit"}
          title="영상 편집"
          onClose={() => setActiveStep("template")}
          detailMode={isDetailWorkMode}
          onDetailModeChange={setIsDetailWorkMode}
          onSave={saveProject}
          saving={isSaving}
          onDownload={() => void downloadVideo()}
          downloading={isDownloading}
          keepMounted
        >
          <StoryEditorWorkspace
            ref={editorRef}
            brief={brief}
            onChange={setBrief}
            detailMode={isDetailWorkMode}
            projectId={currentProject.id}
            onDownloadProgress={setDownloadProgress}
            publishMeta={publishMeta}
            onPublishMetaChange={setPublishMeta}
          />
        </ShotFormEditorDialogShell>

        {legacyStep === "brief" ? (
          <>
            <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <Card className="overflow-hidden rounded-[24px] border-white/[0.08] bg-[#12100e]/95 shadow-2xl shadow-black/20">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
                  <div>
                    <p className="text-[9px] font-black tracking-[0.2em] text-orange-400">
                      01 · STORY SOURCE
                    </p>
                    <CardTitle className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                      광고가 아닌, 사건을 입력하세요.
                    </CardTitle>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      상품은 주인공이 아니라 문제를 해결하는 결정적 장치로 등장합니다.
                    </p>
                  </div>
                  <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10 md:flex">
                    <Target className="h-5 w-5 text-orange-400" />
                  </span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                {brief.trendSource ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-orange-400/20 bg-orange-500/[0.07] p-3 md:col-span-2">
                    {brief.productImage ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                        <img
                          src={brief.productImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                        <TrendingUp className="h-5 w-5 text-orange-400" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black tracking-[0.14em] text-orange-400">
                        TREND SELECTED
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {brief.productName}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                        {brief.trendSource} · 해외 참고 영상 {brief.referenceVideos.length}개
                      </p>
                    </div>
                  </div>
                ) : null}
                <Field label="상품명">
                  <Input
                    value={brief.productName}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, productName: event.target.value }))
                    }
                    placeholder="예: 저자극 클렌징폼"
                    className="border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="타깃 시청자">
                  <Input
                    value={brief.targetAudience}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, targetAudience: event.target.value }))
                    }
                    placeholder="예: 세안 후 당김이 고민인 20~30대"
                    className="border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="상품 특징·사실" wide>
                  <Textarea
                    value={brief.productDescription}
                    onChange={(event) =>
                      setBrief((previous) => ({
                        ...previous,
                        productDescription: event.target.value,
                      }))
                    }
                    placeholder="성분, 사용법, 특징 등 확인 가능한 정보만 입력하세요."
                    className="min-h-24 border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="시청자가 겪는 문제" wide>
                  <Textarea
                    value={brief.problem}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, problem: event.target.value }))
                    }
                    placeholder="불편·실패·손해가 구체적일수록 좋은 이야기가 나옵니다."
                    className="min-h-24 border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="이야기 소재·실제 경험·후기" wide>
                  <Textarea
                    value={brief.storySource}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, storySource: event.target.value }))
                    }
                    placeholder="처음의 오해, 실패한 방법, 예상 밖의 계기와 결과를 적어주세요."
                    className="min-h-32 border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="증빙 가능한 변화">
                  <Input
                    value={brief.proof}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, proof: event.target.value }))
                    }
                    placeholder="예: 사용 전후 시간 비교"
                    className="border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="가격·할인·배송">
                  <Input
                    value={brief.priceBenefit}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, priceBenefit: event.target.value }))
                    }
                    placeholder="확정된 정보만 입력"
                    className="border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
                <Field label="CTA" wide>
                  <Input
                    value={brief.cta}
                    onChange={(event) =>
                      setBrief((previous) => ({ ...previous, cta: event.target.value }))
                    }
                    className="border-white/10 bg-black/30 text-zinc-100"
                  />
                </Field>
              </CardContent>
            </Card>

            <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <Card className="overflow-hidden rounded-[24px] border-white/[0.08] bg-[#12100e]/95">
                <CardHeader>
                  <p className="text-[9px] font-black tracking-[0.2em] text-orange-400">
                    DIRECTING TONE
                  </p>
                  <CardTitle className="mt-1 text-lg font-black text-white">
                    시청자가 느낄 감정
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setBrief((previous) => ({ ...previous, tone: tone.id }))}
                      className={`group w-full rounded-xl border p-3 text-left transition ${
                        brief.tone === tone.id
                          ? "border-orange-400/40 bg-orange-500/10 shadow-[inset_3px_0_0_#f97316]"
                          : "border-white/[0.07] bg-black/20 hover:border-white/15"
                      }`}
                    >
                      <p className="text-xs font-bold text-zinc-200">{tone.label}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">{tone.description}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
              <Card className="overflow-hidden rounded-[24px] border-orange-400/15 bg-gradient-to-b from-orange-500/[0.08] to-[#12100e]">
                <CardContent className="space-y-4 pt-5">
                  <div>
                    <Label className="text-xs text-zinc-400">목표 길이</Label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([30, 45, 60] as const).map((duration) => (
                        <button
                          key={duration}
                          type="button"
                          onClick={() =>
                            setBrief((previous) => ({ ...previous, durationSec: duration }))
                          }
                          className={`rounded-lg border py-2 text-xs font-bold ${
                            brief.durationSec === duration
                              ? "border-orange-400 bg-orange-500 text-white"
                              : "border-white/10 text-zinc-500"
                          }`}
                        >
                          {duration}초
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-3">
                    <Checkbox
                      checked={brief.assetRightsConfirmed}
                      onCheckedChange={(checked) =>
                        setBrief((previous) => ({
                          ...previous,
                          assetRightsConfirmed: checked === true,
                        }))
                      }
                    />
                    <span className="text-[11px] leading-relaxed text-zinc-400">
                      사용할 이미지·영상·후기의 소유권 또는 이용 허가를 확인했습니다.
                    </span>
                  </label>
                  <Button
                    onClick={() => void generateBlueprint()}
                    disabled={
                      isGenerating ||
                      !brief.productName.trim() ||
                      !brief.problem.trim() ||
                      !brief.storySource.trim()
                    }
                    className="h-12 w-full bg-gradient-to-r from-orange-500 to-rose-500 font-black text-white"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <WandSparkles className="mr-2 h-5 w-5" />
                    )}
                    {isGenerating ? "스토리 기획 중…" : "AI 스토리 기획 생성"}
                  </Button>
                </CardContent>
              </Card>
            </div>
            </div>
          </>
        ) : null}

        {legacyStep === "blueprint" && blueprint ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <Card className="border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-[#12151c]">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-orange-300">STORY COMMERCE SCORE</p>
                    <p className="mt-2 text-6xl font-black text-white">{blueprint.scores.total}</p>
                    <p className="mt-1 text-xs text-zinc-500">100점 만점</p>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[
                      ["상품 적합성", blueprint.scores.productFit],
                      ["시각적 증거", blueprint.scores.visualProof],
                      ["스토리 힘", blueprint.scores.storyPower],
                      ["첫 3초 훅", blueprint.scores.hookPower],
                      ["구매 전환", blueprint.scores.conversion],
                    ].map(([label, score]) => (
                      <div key={String(label)}>
                        <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
                          <span>{label}</span>
                          <span>{score}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#12151c]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-orange-300">AI 추천 기획</p>
                      <CardTitle className="mt-1 text-xl text-white">
                        {blueprint.conceptTitle}
                      </CardTitle>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {blueprint.conceptSummary}
                      </p>
                    </div>
                    <Sparkles className="h-6 w-6 text-orange-400" />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="상단 훅 제목">
                    <Input
                      value={blueprint.hookTitle}
                      onChange={(event) =>
                        setBlueprint((previous) =>
                          previous ? { ...previous, hookTitle: event.target.value } : previous
                        )
                      }
                      className="border-white/10 bg-black/30 text-zinc-100"
                    />
                  </Field>
                  <Field label="훅 아래 설명">
                    <Input
                      value={blueprint.subTitle}
                      onChange={(event) =>
                        setBlueprint((previous) =>
                          previous ? { ...previous, subTitle: event.target.value } : previous
                        )
                      }
                      className="border-white/10 bg-black/30 text-zinc-100"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-zinc-400">후킹 후보</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {blueprint.openingHooks.map((hook) => (
                        <button
                          key={hook}
                          type="button"
                          onClick={() =>
                            setBlueprint((previous) =>
                              previous ? { ...previous, hookTitle: hook } : previous
                            )
                          }
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-orange-400/40 hover:text-orange-200"
                        >
                          {hook}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/10 bg-[#12151c]">
              <CardHeader>
                <CardTitle className="text-base text-zinc-100">
                  {blueprint.scenes.length}개 장면 스토리 흐름
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {blueprint.scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 md:grid-cols-[110px_1fr_1fr]"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-orange-300">
                        {BEAT_LABELS[scene.beat]}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">
                        {scene.startSec.toFixed(1)}–{scene.endSec.toFixed(1)}s
                      </p>
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-300">{scene.narration}</p>
                    <p className="text-xs font-bold text-white">“{scene.caption}”</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActiveStep("story")} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                입력 수정
              </Button>
              <Button
                onClick={() => setActiveStep("edit")}
                className="flex-1 bg-orange-500 text-white hover:bg-orange-400"
              >
                영상 편집
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {legacyStep === "frames" && blueprint && selectedScene ? (
          <div className="grid gap-5 xl:grid-cols-[310px_1fr]">
            <Card className="border-white/10 bg-[#12151c] xl:sticky xl:top-24 xl:self-start">
              <CardHeader>
                <CardTitle className="text-sm text-zinc-100">이야기 채널 프레임</CardTitle>
              </CardHeader>
              <CardContent>
                <SsulPreview
                  template={template}
                  onTemplateChange={setTemplate}
                  hookTitle={blueprint.hookTitle}
                  onHookTitleChange={(value) =>
                    setBlueprint((previous) =>
                      previous ? { ...previous, hookTitle: value } : previous
                    )
                  }
                  channelLabel={blueprint.channelLabel}
                  onChannelLabelChange={(value) =>
                    setBlueprint((previous) =>
                      previous ? { ...previous, channelLabel: value } : previous
                    )
                  }
                  postTime={postTime}
                  onPostTimeChange={setPostTime}
                  narration={selectedScene.caption || selectedScene.narration}
                  mediaUrl={
                    selectedScene.mediaType === "image" ? selectedScene.mediaUrl : undefined
                  }
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {blueprint.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setSelectedSceneIndex(index)}
                    className={`min-w-32 rounded-xl border p-3 text-left ${
                      index === selectedSceneIndex
                        ? "border-orange-400/50 bg-orange-500/15"
                        : "border-white/10 bg-[#12151c]"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-orange-300">장면 {index + 1}</p>
                    <p className="mt-1 truncate text-xs text-zinc-300">{scene.caption}</p>
                  </button>
                ))}
              </div>

              <Card className="border-white/10 bg-[#12151c]">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-orange-300">
                        {BEAT_LABELS[selectedScene.beat]}
                      </p>
                      <CardTitle className="mt-1 text-base text-zinc-100">
                        장면 {selectedSceneIndex + 1}
                      </CardTitle>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
                      <ImagePlus className="mr-1.5 h-4 w-4" />
                      이미지·영상 추가
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(event) =>
                          uploadSceneMedia(selectedSceneIndex, event.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="나레이션" wide>
                    <Textarea
                      value={selectedScene.narration}
                      onChange={(event) =>
                        patchScene(selectedSceneIndex, { narration: event.target.value })
                      }
                      className="min-h-24 border-white/10 bg-black/30 text-zinc-100"
                    />
                  </Field>
                  <Field label="화면 한 줄 자막">
                    <Input
                      value={selectedScene.caption}
                      onChange={(event) =>
                        patchScene(selectedSceneIndex, {
                          caption: event.target.value.slice(0, 24),
                        })
                      }
                      className="border-white/10 bg-black/30 text-zinc-100"
                    />
                    <p className="mt-1 text-[10px] text-zinc-600">
                      공백 제외 8~12자를 권장합니다.
                    </p>
                  </Field>
                  <Field label="상품 노출 방식">
                    <Input
                      value={selectedScene.productPlacement}
                      onChange={(event) =>
                        patchScene(selectedSceneIndex, {
                          productPlacement: event.target.value,
                        })
                      }
                      className="border-white/10 bg-black/30 text-zinc-100"
                    />
                  </Field>
                  <Field label="화면 연출" wide>
                    <Textarea
                      value={selectedScene.visualDirection}
                      onChange={(event) =>
                        patchScene(selectedSceneIndex, {
                          visualDirection: event.target.value,
                        })
                      }
                      className="min-h-20 border-white/10 bg-black/30 text-zinc-100"
                    />
                  </Field>
                  <Field label="AI 이미지·영상 프롬프트" wide>
                    <Textarea
                      value={selectedScene.imagePrompt}
                      onChange={(event) =>
                        patchScene(selectedSceneIndex, { imagePrompt: event.target.value })
                      }
                      className="min-h-24 border-white/10 bg-black/30 font-mono text-xs text-zinc-100"
                    />
                  </Field>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveStep("story")}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  AI 기획
                </Button>
                <Button
                  onClick={() => setActiveStep("edit")}
                  className="flex-1 bg-orange-500 text-white hover:bg-orange-400"
                >
                  최종 점검
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {legacyStep === "review" && blueprint ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="border-white/10 bg-[#12151c]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    게시 전 안전 점검
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {blueprint.safetyChecks.map((check) => (
                    <div
                      key={check.key}
                      className={`rounded-xl border p-3 ${statusStyle[check.status]}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold">{check.label}</p>
                        <span className="text-[9px] font-black uppercase">{check.status}</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed opacity-75">{check.note}</p>
                    </div>
                  ))}
                  {!blueprint.safetyChecks.length ? (
                    <p className="py-8 text-center text-xs text-zinc-600">
                      자동 점검 결과가 없습니다.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#12151c]">
                <CardHeader>
                  <CardTitle className="text-base text-zinc-100">제작 준비도</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className="text-5xl font-black text-white">{progress}%</p>
                    <p className="text-xs text-zinc-500">
                      {blueprint.scenes.length}개 장면 · {brief.durationSec}초
                    </p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-6 space-y-2 text-xs text-zinc-400">
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      첫 3초 훅과 열린 결말 구성
                    </p>
                    <p className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      장면별 나레이션·자막·연출 분리
                    </p>
                    <p className="flex items-center gap-2">
                      {blockedCount ? (
                        <TriangleAlert className="h-4 w-4 text-red-400" />
                      ) : (
                        <Check className="h-4 w-4 text-emerald-400" />
                      )}
                      차단 항목 {blockedCount}개
                    </p>
                  </div>
                  <Button
                    onClick={downloadPlan}
                    className="mt-6 w-full bg-orange-500 text-white hover:bg-orange-400"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    스토리 기획서 다운로드
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/10 bg-[#12151c]">
              <CardHeader>
                <CardTitle className="text-base text-zinc-100">최종 장면 목록</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {blueprint.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => {
                      setSelectedSceneIndex(index)
                      setActiveStep("edit")
                    }}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:border-orange-400/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-black text-orange-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-zinc-200">{scene.caption}</p>
                      <p className="mt-1 truncate text-[10px] text-zinc-600">
                        {BEAT_LABELS[scene.beat]} · {scene.startSec.toFixed(1)}–
                        {scene.endSec.toFixed(1)}초
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-700" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  )
}

function Field({
  label,
  wide,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <Label className="text-xs text-zinc-400">{label}</Label>
      {children}
    </div>
  )
}
