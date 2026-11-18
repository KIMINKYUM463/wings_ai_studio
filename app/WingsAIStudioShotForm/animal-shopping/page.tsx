"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  Film,
  FolderOpen,
  ImagePlus,
  Loader2,
  Mic2,
  MoreHorizontal,
  PawPrint,
  Pencil,
  Plus,
  Save,
  ScrollText,
  ShoppingBag,
  ShoppingCart,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const DIALOG_CLASS =
  "rounded-[24px] border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] shadow-[0_30px_80px_rgba(14,16,22,0.18)]"
const DIALOG_FIELD_CLASS =
  "mt-1.5 rounded-[14px] border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] placeholder:text-[#9aa0ad] focus-visible:border-[#0e1016] focus-visible:ring-[#0e1016]/10"
const PRIMARY_BTN =
  "rounded-full bg-[#0e1016] px-5 font-bold text-[#ffffff] hover:bg-[#262a35] disabled:bg-[#c9ccd4] disabled:text-[#ffffff]"

function relativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (!Number.isFinite(diffSec)) return ""
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" })
  const abs = Math.abs(diffSec)
  if (abs < 60) return "방금 전"
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day")
  return new Date(iso).toLocaleDateString("ko-KR")
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mb-6 rounded-[16px] border border-[#ffd4cf] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#b42318]"
    >
      {message}
    </p>
  )
}

/** Hero motif: a paw trail walking into a shopping cart. */
function PawTrail() {
  const paws = [
    { x: "left-0 top-14", rot: "-18deg" },
    { x: "left-9 top-6", rot: "-8deg" },
    { x: "left-[4.75rem] top-11", rot: "6deg" },
    { x: "left-[7.25rem] top-2", rot: "14deg" },
  ]
  return (
    <div aria-hidden className="relative hidden h-28 w-56 shrink-0 md:block">
      <div className="animal-paw-trail absolute inset-0">
        {paws.map((paw) => (
          <PawPrint
            key={paw.x}
            className={`absolute ${paw.x} h-6 w-6 text-[#ff8a3d]`}
            style={{ "--paw-rot": paw.rot, transform: `rotate(${paw.rot})` } as CSSProperties}
          />
        ))}
      </div>
      <span className="absolute right-0 top-3 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#0e1016] shadow-[0_18px_40px_rgba(14,16,22,0.25)]">
        <ShoppingCart className="h-9 w-9 text-[#ff8a3d]" strokeWidth={2.2} />
      </span>
    </div>
  )
}

function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#e3e6ec] bg-[#ffffff]">
      <div className="aspect-[16/10] animate-pulse bg-[#eef0f4]" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#eef0f4]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[#eef0f4]" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-[#eef0f4]" />
      </div>
    </div>
  )
}

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
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ShoppingProject | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ShoppingProject | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

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
    setSavedAt(null)
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
      setSavedAt(updated.updated_at || new Date().toISOString())
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : ""
      setError(
        /body exceeded|body size|too large/i.test(message)
          ? "프로젝트 용량이 너무 커서 저장하지 못했습니다. 음성·영상 단계에서 다시 생성하면 파일이 저장소로 올라가 용량이 줄어듭니다."
          : message || "저장에 실패했습니다."
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Confirmation now happens in the delete dialog (replaces window.confirm).
  const removeProject = async (projectId: string) => {
    setIsDeleting(true)
    try {
      await deleteShoppingProject(projectId)
      setProjects((previous) => previous.filter((item) => item.id !== projectId))
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setBrief(cloneAnimalBrief())
        setActiveStep("product")
      }
      setPendingDelete(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "삭제에 실패했습니다.")
      setPendingDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const renameProject = async () => {
    const name = renameValue.trim()
    if (!renameTarget || !name) return
    setIsRenaming(true)
    try {
      const updated = await updateShoppingProject(renameTarget.id, { name })
      setProjects((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      )
      setRenameTarget(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이름을 바꾸지 못했습니다.")
      setRenameTarget(null)
    } finally {
      setIsRenaming(false)
    }
  }

  const stepIndex = STEPS.findIndex((step) => step.id === activeStep)

  const projectDialogs = (
    <>
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className={`${DIALOG_CLASS} sm:max-w-md`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-[-0.03em]">
              프로젝트를 삭제할까요?
            </DialogTitle>
            <DialogDescription className="text-[#5c6170]">
              「{pendingDelete?.name}」의 대본·음성·이미지·영상 정보가 모두 삭제되며 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-full text-[#0e1016] hover:bg-[#f5f6fa]"
              onClick={() => setPendingDelete(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={() => pendingDelete && void removeProject(pendingDelete.id)}
              className="rounded-full bg-[#d92d20] px-5 font-bold text-[#ffffff] hover:bg-[#b42318]"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className={`${DIALOG_CLASS} sm:max-w-md`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-[-0.03em]">이름 변경</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void renameProject()
            }}
          >
            <Label htmlFor="animal-rename" className="text-sm font-semibold text-[#0e1016]">
              프로젝트 이름
            </Label>
            <Input
              id="animal-rename"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={DIALOG_FIELD_CLASS}
            />
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full text-[#0e1016] hover:bg-[#f5f6fa]"
                onClick={() => setRenameTarget(null)}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isRenaming || !renameValue.trim()}
                className={PRIMARY_BTN}
              >
                {isRenaming ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!currentProject) {
    return (
      <div className="animal-shopping-dark min-h-screen bg-[#f5f6fa] text-[#0e1016]">
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-8 md:pt-10">
          <Link
            href="/WingsAIStudioShotForm"
            className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-[#5c6170] hover:text-[#0e1016]"
          >
            <ArrowLeft className="h-4 w-4" />
            숏폼 홈
          </Link>

          {/* Hero */}
          <section className="animal-stage-hero mt-6 overflow-hidden rounded-[32px] border border-[#e3e6ec] bg-[#ffffff] px-6 py-8 shadow-[0_1px_2px_rgba(14,16,22,0.04),0_20px_50px_rgba(14,16,22,0.06)] md:px-10 md:py-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="animal-bubble-chip px-3 py-1 text-xs">
                  <PawPrint className="h-3.5 w-3.5" />
                  PET MART SHORTS
                </p>
                <h1 className="mt-5 text-[2.5rem] font-black leading-[1.05] tracking-[-0.045em] md:text-[3.5rem]">
                  동물 친구가
                  <br />
                  대신 <span className="text-[#ff8a3d]">장 보는</span> 숏폼
                </h1>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-[#5c6170]">
                  의인화된 동물 쇼퍼가 마트에서 쿠팡 상품을 고르고, 써보고, 반하는 이야기.
                  제품 하나로 대본 · 음성 · 장면 · 영상까지 이어서 만듭니다.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => setShowCreateDialog(true)}
                    className={`${PRIMARY_BTN} h-12 px-6 text-base`}
                  >
                    <Plus className="mr-1.5 h-5 w-5" />
                    새 프로젝트
                  </Button>
                  <span className="text-sm text-[#747a88]">
                    캐릭터·제품 → 대본 → 음성 → 이미지 → 영상 → 미리보기
                  </span>
                </div>
              </div>
              <PawTrail />
            </div>
          </section>

          <div className="mt-12 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.035em]">내 프로젝트</h2>
              {!isLoadingProjects && projects.length > 0 ? (
                <p className="mt-1 text-sm text-[#5c6170]">{projects.length}개</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <ErrorBanner message={error} />

            {isLoadingProjects ? (
              <div
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label="프로젝트 불러오는 중"
              >
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d3d7e0] bg-[#ffffff] px-6 py-16 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#fff1e7]">
                  <FolderOpen className="h-6 w-6 text-[#b8500e]" />
                </span>
                <p className="mt-5 text-lg font-bold tracking-[-0.02em]">아직 프로젝트가 없어요</p>
                <p className="mt-1 text-sm text-[#5c6170]">
                  첫 동물 쇼퍼와 함께 장보기 숏폼을 시작해 보세요.
                </p>
                <Button
                  type="button"
                  className={`${PRIMARY_BTN} mt-6 h-11`}
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />첫 프로젝트 만들기
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => {
                  const projectBrief = briefFromProjectData(project.data)
                  const cover =
                    projectBrief.imageUrls?.find(Boolean) ||
                    projectBrief.productImage ||
                    projectBrief.selectedProduct?.productImage ||
                    ""
                  const projectStep = Math.max(
                    0,
                    STEPS.findIndex(
                      (step) => step.id === migrateAnimalActiveStep(project.data?.activeStep)
                    )
                  )
                  const hasVideo = Boolean(projectBrief.mergedVideoUrl)
                  return (
                    <article
                      key={project.id}
                      className="group relative overflow-hidden rounded-[24px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_1px_2px_rgba(14,16,22,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(14,16,22,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <button
                        type="button"
                        className="block w-full rounded-[24px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e1016]"
                        onClick={() => void openProject(project.id)}
                        aria-label={`${project.name} 열기`}
                      >
                        <div className="relative aspect-[16/10] overflow-hidden bg-[#f5f6fa]">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <PawPrint className="h-10 w-10 text-[#d3d7e0]" />
                            </div>
                          )}
                          {hasVideo ? (
                            <span className="absolute bottom-3 left-3 rounded-full bg-[#0e1016] px-2.5 py-1 text-xs font-bold text-[#ffffff]">
                              영상 완성
                            </span>
                          ) : null}
                        </div>
                        <div className="p-5">
                          <p className="truncate text-base font-bold tracking-[-0.02em] text-[#0e1016]">
                            {project.name}
                          </p>
                          <p className="mt-1 truncate text-sm text-[#5c6170]">
                            {projectBrief.character.name}
                            {projectBrief.productName
                              ? ` · ${projectBrief.productName}`
                              : " · 제품 미선택"}
                          </p>
                          <div className="mt-4 flex gap-1" aria-hidden>
                            {STEPS.map((step, index) => (
                              <span
                                key={step.id}
                                className={`h-1.5 flex-1 rounded-full ${
                                  index < projectStep
                                    ? "bg-[#0e1016]"
                                    : index === projectStep
                                      ? "bg-[#ff8a3d]"
                                      : "bg-[#e3e6ec]"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="mt-2.5 flex items-center justify-between text-xs text-[#747a88]">
                            <span>
                              {projectStep + 1}/{STEPS.length} · {STEPS[projectStep].label}
                            </span>
                            <time dateTime={project.updated_at}>{relativeTime(project.updated_at)}</time>
                          </p>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${project.name} 메뉴`}
                            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#ffffff]/90 text-[#0e1016] shadow-[0_2px_8px_rgba(14,16,22,0.12)] backdrop-blur hover:bg-[#ffffff] focus-visible:outline-2 focus-visible:outline-[#0e1016]"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[10rem] rounded-[14px] border-[#e3e6ec] bg-[#ffffff] p-1.5 text-[#0e1016] shadow-[0_18px_40px_rgba(14,16,22,0.14)]"
                        >
                          <DropdownMenuItem
                            className="rounded-[10px] text-sm focus:bg-[#f5f6fa] focus:text-[#0e1016]"
                            onSelect={() => void openProject(project.id)}
                          >
                            <FolderOpen className="h-4 w-4" />
                            열기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-[10px] text-sm focus:bg-[#f5f6fa] focus:text-[#0e1016]"
                            onSelect={() => {
                              setRenameValue(project.name)
                              setRenameTarget(project)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#e3e6ec]" />
                          <DropdownMenuItem
                            className="rounded-[10px] text-sm text-[#d92d20] focus:bg-[#fff4f2] focus:text-[#b42318]"
                            onSelect={() => setPendingDelete(project)}
                          >
                            <Trash2 className="h-4 w-4 text-current" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className={`${DIALOG_CLASS} sm:max-w-lg`}>
            <DialogHeader>
              <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff1e7]">
                <PawPrint className="h-5 w-5 text-[#b8500e]" />
              </span>
              <DialogTitle className="text-2xl font-black tracking-[-0.035em]">
                새 동물 쇼핑 프로젝트
              </DialogTitle>
              <DialogDescription className="text-[#5c6170]">
                동물 캐릭터가 마트에서 쿠팡 제품을 시연하는 바이럴 숏폼을 만듭니다.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void createProject()
              }}
            >
              <div>
                <Label htmlFor="animal-project-name" className="text-sm font-semibold text-[#0e1016]">
                  프로젝트 이름
                </Label>
                <Input
                  id="animal-project-name"
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={DIALOG_FIELD_CLASS}
                  placeholder="예: 강아지 이어폰 리뷰 숏폼"
                />
              </div>
              <div>
                <Label htmlFor="animal-project-desc" className="text-sm font-semibold text-[#0e1016]">
                  설명 <span className="font-normal text-[#747a88]">(선택)</span>
                </Label>
                <Textarea
                  id="animal-project-desc"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className={DIALOG_FIELD_CLASS}
                  rows={3}
                />
              </div>
              <DialogFooter className="items-center pt-2">
                {!projectName.trim() ? (
                  <span className="mr-auto text-xs text-[#747a88]">이름을 입력하면 만들 수 있어요</span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full text-[#0e1016] hover:bg-[#f5f6fa]"
                  onClick={() => setShowCreateDialog(false)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !projectName.trim()}
                  className={PRIMARY_BTN}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "만들기"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {projectDialogs}
      </div>
    )
  }

  const storageScope = { userId, projectId: currentProject.id }

  return (
    <div className="animal-shopping-dark min-h-screen bg-[#f5f6fa] text-[#0e1016]">
      <header className="sticky top-0 z-30 border-b border-[#e3e6ec] bg-[#ffffff]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="min-w-0">
            <nav aria-label="경로" className="flex items-center gap-1.5 text-xs text-[#747a88]">
              <Link href="/WingsAIStudioShotForm" className="rounded hover:text-[#0e1016]">
                숏폼 홈
              </Link>
              <span aria-hidden>/</span>
              <button
                type="button"
                className="rounded hover:text-[#0e1016]"
                onClick={() => {
                  setCurrentProject(null)
                  setBrief(cloneAnimalBrief())
                  setActiveStep("product")
                }}
              >
                동물 쇼핑 프로젝트
              </button>
            </nav>
            <h1 className="mt-0.5 flex items-center gap-2 truncate text-xl font-black tracking-[-0.035em]">
              <PawPrint className="h-4 w-4 shrink-0 text-[#ff8a3d]" aria-hidden />
              <span className="truncate">{currentProject.name}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {savedAt && !isSaving ? (
              <span className="hidden text-xs text-[#747a88] sm:inline" aria-live="polite">
                저장됨 · {relativeTime(savedAt)}
              </span>
            ) : null}
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void saveProject()}
              className={`${PRIMARY_BTN} h-10`}
            >
              {isSaving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              저장
            </Button>
          </div>
        </div>

        <ol className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-3 md:px-8">
          {STEPS.map((step, index) => {
            const done = index < stepIndex
            const active = step.id === activeStep
            return (
              <li key={step.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full min-w-[128px] items-center gap-2.5 rounded-[14px] border px-3 py-2 text-left transition ${
                    active
                      ? "border-[#0e1016] bg-[#0e1016] text-[#ffffff]"
                      : "border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] hover:border-[#c9ccd4]"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      active
                        ? "bg-[#ff8a3d] text-[#0e1016]"
                        : done
                          ? "bg-[#fff1e7] text-[#b8500e]"
                          : "bg-[#f5f6fa] text-[#747a88]"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{step.label}</span>
                    <span
                      className={`block truncate text-xs ${active ? "text-[#c9ccd4]" : "text-[#747a88]"}`}
                    >
                      {step.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <ErrorBanner message={error} />

        <div>
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
              storageScope={storageScope}
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
              storageScope={storageScope}
            />
          ) : null}
          {activeStep === "preview" ? (
            <AnimalPreviewStudioPanel brief={brief} onChange={setBrief} />
          ) : null}
        </div>
      </main>
      {projectDialogs}
    </div>
  )
}
