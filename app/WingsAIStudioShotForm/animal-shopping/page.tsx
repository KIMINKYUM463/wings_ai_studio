"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  Film,
  FolderOpen,
  Home,
  ImagePlus,
  Loader2,
  Mic2,
  PawPrint,
  Plus,
  Save,
  ScrollText,
  ShoppingBag,
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
import { AnimalImagesPanel } from "./AnimalImagesPanel"
import { AnimalPreviewStudioPanel } from "./AnimalPreviewStudioPanel"
import { AnimalProductPanel } from "./AnimalProductPanel"
import { AnimalScriptPanel } from "./AnimalScriptPanel"
import { AnimalStudioVoicePanel } from "./AnimalStudioVoicePanel"
import { AnimalVideosPanel } from "./AnimalVideosPanel"
import { migrateAnimalActiveStep, type AnimalLiveActiveStep } from "./animal-studio-steps"
import { cloneAnimalBrief, type AnimalShoppingBrief } from "./animal-studio-types"
import { briefFromProjectData, flatFieldsFromBrief } from "./animal-studio-utils"
import {
  createShoppingProject,
  deleteShoppingProject,
  getShoppingProject,
  getShoppingProjects,
  updateShoppingProject,
  type ShoppingProject,
} from "./project-actions"
import "./animal-shopping-theme.css"

const STEPS: Array<{
  id: AnimalLiveActiveStep
  label: string
  description: string
  icon: typeof ShoppingBag
}> = [
  { id: "product", label: "캐릭터·제품", description: "쇼퍼 + 쿠팡", icon: ShoppingBag },
  { id: "script", label: "대본", description: "길이별 다씬", icon: ScrollText },
  { id: "voice", label: "AI 음성", description: "TTS 나레이션", icon: Mic2 },
  { id: "images", label: "이미지", description: "씬별 컷", icon: ImagePlus },
  { id: "videos", label: "영상", description: "씬별 클립", icon: Film },
  { id: "preview", label: "미리보기", description: "재생·내보내기", icon: Check },
]

export default function AnimalShoppingPage() {
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
  const [activeStep, setActiveStep] = useState<AnimalLiveActiveStep>("product")
  const [brief, setBrief] = useState<AnimalShoppingBrief>(cloneAnimalBrief)

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
    setBrief(briefFromProjectData(project.data))
    setActiveStep(migrateAnimalActiveStep(project.data?.activeStep))
    setError("")
  }

  const createProject = async () => {
    if (!userId || !projectName.trim()) return
    setIsCreating(true)
    setError("")
    try {
      const initialBrief = cloneAnimalBrief()
      const created = await createShoppingProject(
        userId,
        projectName.trim(),
        projectDescription.trim() || undefined,
        {
          activeStep: "product",
          animalBrief: initialBrief,
          appVariant: "animal",
          ...flatFieldsFromBrief(initialBrief),
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
      if (project.data?.appVariant !== "animal") {
        throw new Error("AI 동물 쇼핑 프로젝트가 아닙니다.")
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
          appVariant: "animal",
          activeStep,
          animalBrief: brief,
          ...flatFieldsFromBrief(brief),
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
        setBrief(cloneAnimalBrief())
        setActiveStep("product")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제에 실패했습니다.")
    }
  }

  const stepIndex = STEPS.findIndex((step) => step.id === activeStep)

  if (!currentProject) {
    return (
      <div className="animal-shopping-dark min-h-screen text-[#fff6ee]">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(125,211,168,0.14),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(255,143,171,0.1),_transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <Link
                href="/WingsAIStudioShotForm"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-[#9aa89c] hover:text-[#fff6ee]"
              >
                <ArrowLeft className="h-4 w-4" />
                숏폼 홈
              </Link>
              <h1 className="animal-display flex items-center gap-3 text-3xl font-bold tracking-tight">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7dd3a8] to-[#ff8fab]">
                  <PawPrint className="h-5 w-5 text-[#0d1a14]" />
                </span>
                AI 동물 쇼핑 숏폼
              </h1>
              <p className="mt-2 text-sm text-[#9aa89c]">
                동물 쇼퍼 + 쿠팡 제품 → 대본 · 음성 · 장면 · 영상 → 숏폼 미리보기
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="animal-cta-cute rounded-full font-bold"
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
            <div className="flex items-center justify-center py-20 text-[#9aa89c]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              불러오는 중…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[rgba(255,246,238,0.2)] bg-black/20 px-6 py-16 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-[#6b7a6e]" />
              <p className="mt-4 text-[#9aa89c]">아직 프로젝트가 없습니다.</p>
              <Button
                type="button"
                className="animal-mint-btn mt-6 rounded-full font-bold"
                onClick={() => setShowCreateDialog(true)}
              >
                첫 프로젝트 만들기
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                const projectBrief = briefFromProjectData(project.data)
                return (
                  <div
                    key={project.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-[rgba(255,246,238,0.12)] bg-black/25 p-4"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void openProject(project.id)}
                    >
                      <p className="truncate font-semibold text-[#fff6ee]">{project.name}</p>
                      <p className="mt-1 truncate text-xs text-[#9aa89c]">
                        {projectBrief.character.name}
                        {projectBrief.productName ? ` · ${projectBrief.productName}` : " · 제품 미선택"}
                      </p>
                      <p className="mt-2 text-[11px] text-[#6b7a6e]">
                        {new Date(project.updated_at).toLocaleString("ko-KR")}
                      </p>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-[#6b7a6e] hover:text-red-300"
                      onClick={() => void removeProject(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="border-[rgba(255,246,238,0.12)] bg-[#1a2a26] text-[#fff6ee]">
            <DialogHeader>
              <DialogTitle className="animal-display">새 동물 쇼핑 프로젝트</DialogTitle>
              <DialogDescription className="text-[#9aa89c]">
                캐릭터와 쿠팡 제품을 매장에서 시연하는 바이럴 숏폼을 만듭니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>프로젝트 이름</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/40"
                  placeholder="예: 강아지 이어폰 리뷰 숏폼"
                />
              </div>
              <div>
                <Label>설명 (선택)</Label>
                <Textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="mt-1 border-[rgba(243,235,224,0.12)] bg-black/40"
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
                className="animal-cta-cute rounded-full"
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
    <div className="animal-shopping-dark min-h-screen text-[#fff6ee]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(125,211,168,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(255,143,171,0.08),_transparent_50%)]" />

      <header className="sticky top-0 z-30 border-b border-[rgba(255,246,238,0.08)] bg-[#101c1a]/90 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#9aa89c]">
              <Link href="/WingsAIStudioShotForm" className="hover:text-[#fff6ee]">
                <Home className="h-3.5 w-3.5" />
              </Link>
              <span>/</span>
              <button
                type="button"
                className="hover:text-[#fff6ee]"
                onClick={() => {
                  setCurrentProject(null)
                  setBrief(cloneAnimalBrief())
                  setActiveStep("product")
                }}
              >
                프로젝트
              </button>
              <span>/</span>
              <span className="truncate text-[#d7e0d8]">{currentProject.name}</span>
            </div>
            <h1 className="animal-display mt-1 truncate text-lg font-bold">{currentProject.name}</h1>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => void saveProject()}
            className="rounded-full"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            저장
          </Button>
        </div>

        <div className="relative mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 md:px-6">
          {STEPS.map((step, index) => {
            const done = index < stepIndex
            const active = step.id === activeStep
            const Icon = step.icon
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex min-w-[132px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-[#7dd3a8]/60 bg-[#7dd3a8]/15"
                    : done
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-[rgba(255,246,238,0.1)] bg-black/20"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    active ? "bg-[#7dd3a8] text-[#0d1a14]" : "bg-white/5 text-[#9aa89c]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-[#fff6ee]">{step.label}</span>
                  <span className="block text-[10px] text-[#6b7a6e]">{step.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {activeStep === "product" ? (
          <AnimalProductPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("script")}
          />
        ) : null}
        {activeStep === "script" ? (
          <AnimalScriptPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("voice")}
          />
        ) : null}
        {activeStep === "voice" ? (
          <AnimalStudioVoicePanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("images")}
          />
        ) : null}
        {activeStep === "images" ? (
          <AnimalImagesPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("videos")}
          />
        ) : null}
        {activeStep === "videos" ? (
          <AnimalVideosPanel
            brief={brief}
            onChange={setBrief}
            onContinue={() => setActiveStep("preview")}
          />
        ) : null}
        {activeStep === "preview" ? (
          <AnimalPreviewStudioPanel brief={brief} onChange={setBrief} />
        ) : null}
      </main>
    </div>
  )
}
