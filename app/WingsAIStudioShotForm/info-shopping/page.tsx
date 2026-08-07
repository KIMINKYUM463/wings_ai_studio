"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  FolderOpen,
  Home,
  ImagePlus,
  Link2,
  Loader2,
  Mic2,
  Newspaper,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { InfoImagesPanel } from "./InfoImagesPanel"
import { InfoPreviewPanel } from "./InfoPreviewPanel"
import { InfoScriptPanel } from "./InfoScriptPanel"
import { InfoSourcePanel } from "./InfoSourcePanel"
import { InfoVoicePanel } from "./InfoVoicePanel"
import { migrateInfoActiveStep, type InfoLiveActiveStep } from "./info-steps"
import { EMPTY_INFO_BRIEF, type InfoShoppingBrief } from "./info-types"
import {
  createShoppingProject,
  deleteShoppingProject,
  getShoppingProject,
  getShoppingProjects,
  updateShoppingProject,
  type ShoppingProject,
} from "./project-actions"

const STEPS: Array<{ id: InfoLiveActiveStep; label: string; description: string }> = [
  { id: "source", label: "소스·제품", description: "URL → 쿠팡 매칭" },
  { id: "script", label: "카드 대본", description: "꿀팁·리뷰 카드" },
  { id: "images", label: "이미지", description: "제품·AI 컷" },
  { id: "voice", label: "AI 음성", description: "슬라이드 TTS" },
  { id: "preview", label: "미리보기", description: "재생·내보내기" },
]

const cloneBrief = (): InfoShoppingBrief => ({
  ...EMPTY_INFO_BRIEF,
  products: [],
})

export default function InfoShoppingPage() {
  const [userId, setUserId] = useState("")
  const [projects, setProjects] = useState<ShoppingProject[]>([])
  const [currentProject, setCurrentProject] = useState<ShoppingProject | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")
  const [activeStep, setActiveStep] = useState<InfoLiveActiveStep>("source")
  const [brief, setBrief] = useState<InfoShoppingBrief>(cloneBrief)

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
    setCurrentProject(project)
    setBrief(
      project.data?.infoBrief
        ? { ...cloneBrief(), ...project.data.infoBrief }
        : cloneBrief()
    )
    setActiveStep(migrateInfoActiveStep(project.data?.activeStep))
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
          activeStep: "source",
          infoBrief: cloneBrief(),
          appVariant: "info",
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
      if (project.data?.appVariant !== "info") {
        throw new Error("AI 카드뉴스 쇼핑숏폼 프로젝트가 아닙니다.")
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
          appVariant: "info",
          activeStep,
          infoBrief: brief,
          productName: brief.selectedProduct?.productName,
          productDescription: brief.analysis?.productDescription,
          productImage: brief.selectedProduct?.productImage,
          productUrl: brief.selectedProduct?.productUrl,
        },
      })
      setCurrentProject(updated)
      setProjects((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  const removeProject = async (projectId: string) => {
    if (!confirm("이 프로젝트를 삭제할까요?")) return
    try {
      await deleteShoppingProject(projectId)
      setProjects((previous) => previous.filter((item) => item.id !== projectId))
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setBrief(cloneBrief())
        setActiveStep("source")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제에 실패했습니다.")
    }
  }

  const stepIndex = STEPS.findIndex((step) => step.id === activeStep)

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <Link
                href="/WingsAIStudioShotForm"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
              >
                <ArrowLeft className="h-4 w-4" />
                숏폼 홈
              </Link>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500">
                  <Newspaper className="h-5 w-5 text-white" />
                </span>
                AI 카드뉴스 쇼핑숏폼
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                벤치마크 URL → 쿠팡 제품 → 꿀팁·리뷰 카드뉴스 쇼핑숏폼
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="bg-sky-500 font-bold text-white hover:bg-sky-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              새 프로젝트
            </Button>
          </div>

          {error ? (
            <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-20 text-zinc-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              불러오는 중…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-zinc-600" />
              <p className="mt-4 text-zinc-400">아직 프로젝트가 없습니다.</p>
              <Button
                type="button"
                className="mt-6 bg-sky-500 font-bold text-white hover:bg-sky-400"
                onClick={() => setShowCreateDialog(true)}
              >
                첫 프로젝트 만들기
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void openProject(project.id)}
                  >
                    <p className="truncate font-semibold text-white">{project.name}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {project.data?.infoBrief?.selectedProduct?.productName ||
                        project.description ||
                        "제품 미선택"}
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-600">
                      {new Date(project.updated_at).toLocaleString("ko-KR")}
                    </p>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-zinc-500 hover:text-red-300"
                    onClick={() => void removeProject(project.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="border-white/10 bg-[#141518] text-zinc-100">
            <DialogHeader>
              <DialogTitle>새 카드뉴스 쇼핑숏폼 프로젝트</DialogTitle>
              <DialogDescription className="text-zinc-400">
                URL 하나로 쿠팡 제품을 찾아 카드뉴스 쇼핑숏폼을 만듭니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>프로젝트 이름</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 border-white/10 bg-black/40"
                  placeholder="예: 무선이어폰 꿀팁 숏폼"
                />
              </div>
              <div>
                <Label>설명 (선택)</Label>
                <Textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="mt-1 border-white/10 bg-black/40"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isCreating || !projectName.trim()}
                onClick={() => void createProject()}
                className="bg-sky-500 text-white hover:bg-sky-400"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "만들기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0b0d]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/WingsAIStudioShotForm" className="hover:text-zinc-300">
                <Home className="h-3.5 w-3.5" />
              </Link>
              <span>/</span>
              <button
                type="button"
                className="hover:text-zinc-300"
                onClick={() => {
                  setCurrentProject(null)
                  setBrief(cloneBrief())
                  setActiveStep("source")
                }}
              >
                프로젝트
              </button>
              <span>/</span>
              <span className="truncate text-zinc-300">{currentProject.name}</span>
            </div>
            <h1 className="mt-1 truncate text-lg font-bold">{currentProject.name}</h1>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => void saveProject()}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            저장
          </Button>
        </div>

        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 md:px-6">
          {STEPS.map((step, index) => {
            const done = index < stepIndex
            const active = step.id === activeStep
            const Icon =
              step.id === "source"
                ? Link2
                : step.id === "script"
                  ? Newspaper
                  : step.id === "images"
                    ? ImagePlus
                    : step.id === "voice"
                      ? Mic2
                      : Check
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex min-w-[140px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-sky-400/60 bg-sky-500/15"
                    : done
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    active ? "bg-sky-500 text-white" : "bg-white/5 text-zinc-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-white">{step.label}</span>
                  <span className="block text-[10px] text-zinc-500">{step.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {activeStep === "source" ? (
          <InfoSourcePanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("script")}
          />
        ) : null}
        {activeStep === "script" ? (
          <InfoScriptPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("images")}
          />
        ) : null}
        {activeStep === "images" ? (
          <InfoImagesPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("voice")}
          />
        ) : null}
        {activeStep === "voice" ? (
          <InfoVoicePanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("preview")}
          />
        ) : null}
        {activeStep === "preview" ? <InfoPreviewPanel brief={brief} /> : null}
      </main>
    </div>
  )
}
