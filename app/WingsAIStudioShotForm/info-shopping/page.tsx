"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Link2,
  Loader2,
  Mic2,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Play,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const STEP_ICON = { source: Link2, script: Newspaper, images: ImagePlus, voice: Mic2, preview: Play }

// 이 화면은 light-remap 대상이라 팔레트 유틸 대신 hex 임의값만 쓴다 (재매핑되지 않음)
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#1f6fe0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f6fa]"
const PRIMARY_BTN = `h-11 rounded-full bg-[#0e1016] px-5 font-bold text-[#ffffff] hover:bg-[#262a33] disabled:bg-[#9aa0ad] ${FOCUS}`
const GHOST_BTN = `h-11 rounded-full border border-[#e3e6ec] bg-[#ffffff] px-5 font-semibold text-[#0e1016] hover:bg-[#eef0f5] ${FOCUS}`
const DIALOG = "light-keep rounded-[24px] border-[#e3e6ec] bg-[#ffffff] text-[#0e1016] shadow-[0_24px_64px_-24px_rgba(14,16,22,0.35)]"
const FIELD = `mt-1.5 rounded-[12px] border-[#e3e6ec] bg-[#f5f6fa] text-[#0e1016] placeholder:text-[#9aa0ad] ${FOCUS}`

const cloneBrief = (): InfoShoppingBrief => ({
  ...EMPTY_INFO_BRIEF,
  products: [],
})

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

function projectCover(project: ShoppingProject): string | undefined {
  const brief = project.data?.infoBrief
  return (
    brief?.generatedCards?.slides?.find((slide) => slide.imageUrl?.trim())?.imageUrl ||
    brief?.selectedProduct?.productImage ||
    project.data?.productImage ||
    undefined
  )
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mb-6 rounded-[16px] border border-[#f3c4c0] bg-[#fdf1f0] px-4 py-3 text-sm font-medium text-[#b42318]"
    >
      {message}
    </p>
  )
}

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
  const [renameTarget, setRenameTarget] = useState<ShoppingProject | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShoppingProject | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const renameProject = async () => {
    const name = renameValue.trim()
    if (!renameTarget || !name) return
    setIsRenaming(true)
    setError("")
    try {
      const updated = await updateShoppingProject(renameTarget.id, { name })
      setProjects((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item))
      )
      setRenameTarget(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이름을 바꾸지 못했습니다.")
    } finally {
      setIsRenaming(false)
    }
  }

  const removeProject = async (projectId: string) => {
    setIsDeleting(true)
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
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const stepIndex = STEPS.findIndex((step) => step.id === activeStep)

  if (!currentProject) {
    return (
      <div className="light-keep min-h-screen bg-[#f5f6fa] text-[#0e1016] antialiased">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:px-8">
          <Link
            href="/WingsAIStudioShotForm"
            className={`inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-[#5c6170] hover:text-[#0e1016] ${FOCUS}`}
          >
            <ArrowLeft className="h-4 w-4" />
            숏폼 홈
          </Link>

          {/* 마스트헤드 — 신문 1면 느낌 */}
          <header className="mt-6 border-t-[3px] border-[#0e1016] pt-3">
            <div className="flex items-center justify-between border-b border-[#e3e6ec] pb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#5c6170]">
              <span>Wings · Card News Desk</span>
              <span className="hidden sm:inline">
                {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
              </span>
            </div>

            <div className="grid items-end gap-10 py-10 md:grid-cols-[1fr_auto] md:py-14">
              <div>
                <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.2em] text-[#1f6fe0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1f6fe0]" aria-hidden />
                  정보형 쇼핑숏폼
                </p>
                <h1 className="mt-4 text-[44px] font-black leading-[0.98] tracking-[-0.045em] sm:text-[64px]">
                  AI 카드뉴스
                  <br />
                  쇼핑숏폼
                </h1>
                <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#5c6170]">
                  잘 된 영상을 벤치마킹해 쿠팡 상품과 매칭하고, 꿀팁·리뷰 카드뉴스 슬라이드로 바로
                  엮습니다.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => setShowCreateDialog(true)} className={PRIMARY_BTN}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    새 프로젝트
                  </Button>
                  <span className="text-[13px] text-[#9aa0ad]">URL 하나면 시작할 수 있어요</span>
                </div>
              </div>

              {/* 쌓인 카드 모티프 */}
              <div className="relative mx-auto hidden h-[260px] w-[220px] md:block" aria-hidden>
                <div className="absolute inset-x-6 top-6 h-[220px] -rotate-[8deg] rounded-[20px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_8px_24px_-12px_rgba(14,16,22,0.18)]" />
                <div className="absolute inset-x-6 top-3 h-[220px] rotate-[5deg] rounded-[20px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_8px_24px_-12px_rgba(14,16,22,0.18)]" />
                <div className="absolute inset-x-6 top-0 flex h-[220px] flex-col rounded-[20px] border border-[#e3e6ec] bg-[#ffffff] p-4 shadow-[0_18px_40px_-16px_rgba(14,16,22,0.28)]">
                  <span className="w-fit rounded-full bg-[#1f6fe0] px-2 py-0.5 text-[10px] font-black tracking-wider text-[#ffffff]">
                    BREAKING
                  </span>
                  <span className="mt-3 h-3 w-[85%] rounded bg-[#0e1016]" />
                  <span className="mt-1.5 h-3 w-[60%] rounded bg-[#0e1016]" />
                  <span className="mt-4 flex-1 rounded-[12px] bg-[#eef0f5]" />
                  <span className="mt-3 h-2 w-full rounded bg-[#e3e6ec]" />
                  <span className="mt-1.5 h-2 w-[70%] rounded bg-[#e3e6ec]" />
                </div>
              </div>
            </div>

            {/* 제작 흐름 — 지면 목차 */}
            <ol className="grid grid-cols-2 border-y border-[#e3e6ec] sm:grid-cols-5">
              {STEPS.map((step, index) => (
                <li
                  key={step.id}
                  className="border-[#e3e6ec] px-3 py-4 [&:not(:last-child)]:border-r max-sm:[&:nth-child(2n)]:border-r-0"
                >
                  <span className="text-[12px] font-black tabular-nums text-[#1f6fe0]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-[14px] font-bold">{step.label}</span>
                  <span className="block text-[12px] text-[#9aa0ad]">{step.description}</span>
                </li>
              ))}
            </ol>
          </header>

          <section className="mt-12">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-[22px] font-black tracking-[-0.03em]">내 프로젝트</h2>
              {!isLoadingProjects && projects.length > 0 ? (
                <span className="text-[13px] font-medium text-[#9aa0ad]">{projects.length}개</span>
              ) : null}
            </div>

            <ErrorBanner message={error} />

            {isLoadingProjects ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="불러오는 중">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="overflow-hidden rounded-[24px] border border-[#e3e6ec] bg-[#ffffff]">
                    <div className="aspect-[16/10] animate-pulse bg-[#eef0f5] motion-reduce:animate-none" />
                    <div className="space-y-2.5 p-5">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[#eef0f5] motion-reduce:animate-none" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-[#eef0f5] motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#cfd3dc] bg-[#ffffff] px-6 py-16 text-center">
                <Newspaper className="mx-auto h-9 w-9 text-[#9aa0ad]" />
                <p className="mt-4 text-[17px] font-bold">아직 발행한 카드뉴스가 없어요</p>
                <p className="mt-1 text-sm text-[#5c6170]">
                  잘 된 영상 URL로 첫 프로젝트를 만들어 보세요.
                </p>
                <Button type="button" className={`mt-6 ${PRIMARY_BTN}`} onClick={() => setShowCreateDialog(true)}>
                  첫 프로젝트 만들기
                </Button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => {
                  const cover = projectCover(project)
                  const current = STEPS.findIndex(
                    (step) => step.id === migrateInfoActiveStep(project.data?.activeStep)
                  )
                  return (
                    <article
                      key={project.id}
                      className="group relative overflow-hidden rounded-[24px] border border-[#e3e6ec] bg-[#ffffff] shadow-[0_1px_2px_rgba(14,16,22,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(14,16,22,0.25)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <button
                        type="button"
                        className={`block w-full rounded-[24px] text-left ${FOCUS}`}
                        onClick={() => void openProject(project.id)}
                      >
                        <div className="relative aspect-[16/10] overflow-hidden bg-[#eef0f5]">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full flex-col justify-end bg-[repeating-linear-gradient(0deg,#eef0f5_0,#eef0f5_11px,#e3e6ec_11px,#e3e6ec_12px)] p-5">
                              <Newspaper className="h-6 w-6 text-[#9aa0ad]" />
                            </div>
                          )}
                          <span className="absolute left-3 top-3 rounded-full bg-[#ffffff] px-2.5 py-1 text-[12px] font-bold text-[#0e1016] shadow-sm">
                            {String(current + 1).padStart(2, "0")} · {STEPS[current]?.label}
                          </span>
                        </div>
                        <div className="p-5">
                          <p className="truncate text-[17px] font-black tracking-[-0.02em]">{project.name}</p>
                          <p className="mt-1 truncate text-[13px] text-[#5c6170]">
                            {project.data?.infoBrief?.selectedProduct?.productName ||
                              project.description ||
                              "제품 미선택"}
                          </p>
                          <div className="mt-4 flex gap-1" aria-label={`${STEPS.length}단계 중 ${current + 1}단계`}>
                            {STEPS.map((step, index) => (
                              <span
                                key={step.id}
                                className={`h-1 flex-1 rounded-full ${
                                  index < current ? "bg-[#0e1016]" : index === current ? "bg-[#1f6fe0]" : "bg-[#e3e6ec]"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="mt-3 text-[12px] text-[#9aa0ad]">
                            <time dateTime={project.updated_at} title={new Date(project.updated_at).toLocaleString("ko-KR")}>
                              {relativeTime(project.updated_at)} 수정
                            </time>
                          </p>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="프로젝트 메뉴"
                            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#ffffff]/95 text-[#5c6170] shadow-sm hover:bg-[#ffffff] hover:text-[#0e1016] ${FOCUS}`}
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="light-keep min-w-[140px] rounded-[14px] border-[#e3e6ec] bg-[#ffffff] p-1 text-[#0e1016]"
                        >
                          <DropdownMenuItem
                            className="rounded-[10px] text-[14px] focus:bg-[#eef0f5] focus:text-[#0e1016]"
                            onSelect={() => {
                              setRenameValue(project.name)
                              setRenameTarget(project)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-[10px] text-[14px] text-[#b42318] focus:bg-[#fdf1f0] focus:text-[#b42318]"
                            onSelect={() => setDeleteTarget(project)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className={DIALOG}>
            <DialogHeader>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#1f6fe0]">New Issue</p>
              <DialogTitle className="text-[24px] font-black tracking-[-0.03em]">
                새 카드뉴스 쇼핑숏폼
              </DialogTitle>
              <DialogDescription className="text-[#5c6170]">
                URL 하나로 쿠팡 제품을 찾아 카드뉴스 쇼핑숏폼을 만듭니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="info-project-name" className="text-[13px] font-bold text-[#0e1016]">
                  프로젝트 이름
                </Label>
                <Input
                  id="info-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) void createProject()
                  }}
                  className={FIELD}
                  placeholder="예: 무선이어폰 꿀팁 숏폼"
                />
              </div>
              <div>
                <Label htmlFor="info-project-desc" className="text-[13px] font-bold text-[#0e1016]">
                  설명 <span className="font-normal text-[#9aa0ad]">(선택)</span>
                </Label>
                <Textarea
                  id="info-project-desc"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className={FIELD}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" className={GHOST_BTN} onClick={() => setShowCreateDialog(false)}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isCreating || !projectName.trim()}
                onClick={() => void createProject()}
                className={PRIMARY_BTN}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "만들기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
          <DialogContent className={DIALOG}>
            <DialogHeader>
              <DialogTitle className="text-[22px] font-black tracking-[-0.03em]">이름 변경</DialogTitle>
              <DialogDescription className="text-[#5c6170]">프로젝트 목록에 보이는 이름이에요.</DialogDescription>
            </DialogHeader>
            <Input
              aria-label="새 프로젝트 이름"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void renameProject()
              }}
              className={FIELD}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" className={GHOST_BTN} onClick={() => setRenameTarget(null)}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isRenaming || !renameValue.trim()}
                onClick={() => void renameProject()}
                className={PRIMARY_BTN}
              >
                {isRenaming ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className={DIALOG}>
            <DialogHeader>
              <DialogTitle className="text-[22px] font-black tracking-[-0.03em]">프로젝트를 삭제할까요?</DialogTitle>
              <DialogDescription className="text-[#5c6170]">
                <span className="font-semibold text-[#0e1016]">{deleteTarget?.name}</span> 프로젝트가
                삭제되며 되돌릴 수 없어요.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" className={GHOST_BTN} onClick={() => setDeleteTarget(null)}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={() => deleteTarget && void removeProject(deleteTarget.id)}
                className={`h-11 rounded-full bg-[#d92d20] px-5 font-bold text-[#ffffff] hover:bg-[#b42318] ${FOCUS}`}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="light-keep sticky top-0 z-30 border-b border-[#e3e6ec] bg-[#f5f6fa]/90 text-[#0e1016] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-4 md:px-8">
          <div className="min-w-0">
            <nav aria-label="경로" className="flex items-center gap-2 text-[12px] font-medium text-[#9aa0ad]">
              <Link href="/WingsAIStudioShotForm" className={`rounded hover:text-[#0e1016] ${FOCUS}`}>
                숏폼 홈
              </Link>
              <span aria-hidden>/</span>
              <button
                type="button"
                className={`rounded hover:text-[#0e1016] ${FOCUS}`}
                onClick={() => {
                  setCurrentProject(null)
                  setBrief(cloneBrief())
                  setActiveStep("source")
                }}
              >
                카드뉴스 프로젝트
              </button>
            </nav>
            <h1 className="mt-0.5 truncate text-[22px] font-black tracking-[-0.03em]">{currentProject.name}</h1>
          </div>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void saveProject()}
            className={`${PRIMARY_BTN} h-10 shrink-0`}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            저장
          </Button>
        </div>

        <nav aria-label="제작 단계" className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-8">
          <ol className="flex min-w-max gap-1 pt-3">
            {STEPS.map((step, index) => {
              const done = index < stepIndex
              const active = step.id === activeStep
              const Icon = done ? Check : STEP_ICON[step.id]
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => setActiveStep(step.id)}
                    className={`group flex items-center gap-2.5 rounded-t-[12px] border-b-[3px] px-3 pb-3 pt-1.5 text-left transition-colors motion-reduce:transition-none ${FOCUS} ${
                      active ? "border-[#1f6fe0]" : "border-transparent hover:border-[#cfd3dc]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ${
                        active
                          ? "bg-[#1f6fe0] text-[#ffffff]"
                          : done
                            ? "bg-[#0e1016] text-[#ffffff]"
                            : "border border-[#e3e6ec] bg-[#ffffff] text-[#9aa0ad]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className={`block text-[13px] font-bold ${active || done ? "text-[#0e1016]" : "text-[#5c6170]"}`}>
                        <span className="mr-1 tabular-nums text-[#9aa0ad]">{String(index + 1).padStart(2, "0")}</span>
                        {step.label}
                      </span>
                      <span className="block text-[12px] text-[#9aa0ad]">{step.description}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="light-keep">
          <ErrorBanner message={error} />
        </div>

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
        {activeStep === "preview" ? <InfoPreviewPanel brief={brief} onChange={setBrief} /> : null}

        {stepIndex > 0 ? (
          <div className="light-keep mt-10 flex justify-start">
            <button
              type="button"
              onClick={() => setActiveStep(STEPS[stepIndex - 1].id)}
              className={`inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold text-[#5c6170] hover:text-[#0e1016] ${FOCUS}`}
            >
              <ArrowLeft className="h-4 w-4" />
              이전 단계 · {STEPS[stepIndex - 1].label}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
