"use client"

import { useCallback, useEffect, useState } from "react"
import {
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { StudioPageCard, StudioPageHeader, studio } from "../components/ShotFormStudioUI"
import { MvpTestView } from "./MvpTestView"
import {
  createMvpTestProject,
  deleteMvpTestProject,
  deleteMvpTestProjects,
  getMvpTestProject,
  getMvpTestProjects,
} from "./project-actions"
import type { MvpTestProject } from "./project-types"

function defaultProjectName(): string {
  const d = new Date()
  return `프로젝트 ${d.toLocaleDateString("ko-KR")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatProjectError(e: unknown): string {
  if (e instanceof Error) return e.message
  return "프로젝트 작업에 실패했습니다."
}

export function MvpProjectManager() {
  const [userId, setUserId] = useState("")
  const [projects, setProjects] = useState<MvpTestProject[]>([])
  const [currentProject, setCurrentProject] = useState<MvpTestProject | null>(null)
  const [showProjectList, setShowProjectList] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectSearchQuery, setProjectSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creating, setCreating] = useState(false)
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null)
  const [listErr, setListErr] = useState<string | null>(null)
  const [userIdReady, setUserIdReady] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/kakao/user")
        const data = (await res.json()) as {
          loggedIn?: boolean
          user?: { id?: string | number; email?: string }
        }
        if (data.loggedIn && data.user) {
          setUserId(data.user.email || `kakao_${data.user.id}`)
        } else {
          setUserId(
            localStorage.getItem("user_id") ||
              localStorage.getItem("user_email") ||
              "anonymous"
          )
        }
      } catch {
        setUserId(localStorage.getItem("user_id") || "anonymous")
      } finally {
        setUserIdReady(true)
      }
    })()
  }, [])

  const loadProjects = useCallback(async () => {
    if (!userId) return
    setIsLoadingProjects(true)
    setListErr(null)
    try {
      const list = await getMvpTestProjects(userId)
      setProjects(list)
    } catch (e) {
      setListErr(formatProjectError(e))
    } finally {
      setIsLoadingProjects(false)
    }
  }, [userId])

  useEffect(() => {
    if (userId && showProjectList) void loadProjects()
  }, [userId, showProjectList, loadProjects])

  const handleCreateProject = async () => {
    if (!userIdReady) {
      setListErr("계정 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.")
      return
    }
    if (!userId) {
      setListErr("저장할 계정 ID를 확인할 수 없습니다. 카카오 로그인 후 다시 시도해 주세요.")
      return
    }
    const name = newProjectName.trim() || defaultProjectName()
    setCreating(true)
    try {
      const project = await createMvpTestProject(userId, name)
      setProjects((prev) => [project, ...prev])
      setCurrentProject(project)
      setShowProjectList(false)
      setShowCreateDialog(false)
      setNewProjectName("")
    } catch (e) {
      setListErr(formatProjectError(e))
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("이 프로젝트를 삭제할까요?")) return
    try {
      await deleteMvpTestProject(projectId)
      setSelectedProjectIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
      await loadProjects()
    } catch (e) {
      setListErr(formatProjectError(e))
    }
  }

  const handleDeleteSelectedProjects = async () => {
    const ids = [...selectedProjectIds]
    if (!ids.length) return
    if (!confirm(`선택한 프로젝트 ${ids.length}개를 삭제할까요?`)) return
    setBulkDeleting(true)
    setListErr(null)
    try {
      await deleteMvpTestProjects(ids)
      if (currentProject && ids.includes(currentProject.id)) {
        setCurrentProject(null)
        setShowProjectList(true)
      }
      setSelectedProjectIds(new Set())
      await loadProjects()
    } catch (e) {
      setListErr(formatProjectError(e))
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleProjectSelected = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(projectId)
      else next.delete(projectId)
      return next
    })
  }

  const handleOpenProject = async (project: MvpTestProject) => {
    setOpeningProjectId(project.id)
    setListErr(null)
    try {
      const fresh = await getMvpTestProject(project.id)
      const opened = fresh ?? project
      setCurrentProject(opened)
      setProjects((prev) => prev.map((p) => (p.id === opened.id ? opened : p)))
      setShowProjectList(false)
    } catch (e) {
      setListErr(formatProjectError(e))
    } finally {
      setOpeningProjectId(null)
    }
  }

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(projectSearchQuery.toLowerCase())
  )

  const filteredIds = filteredProjects.map((p) => p.id)
  const selectedInFiltered = filteredIds.filter((id) => selectedProjectIds.has(id)).length
  const allFilteredSelected =
    filteredProjects.length > 0 && selectedInFiltered === filteredProjects.length
  const someFilteredSelected =
    selectedInFiltered > 0 && selectedInFiltered < filteredProjects.length

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  if (!showProjectList && currentProject) {
    return (
      <MvpTestView
        key={currentProject.id}
        project={currentProject}
        userId={userId}
        onBackToProjects={() => {
          setShowProjectList(true)
          void loadProjects()
        }}
        onProjectUpdated={(updated) => {
          setCurrentProject(updated)
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }}
      />
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <StudioPageHeader
        icon={Zap}
        title="프로젝트"
        actions={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(studio.btnPrimary, "h-9 gap-1.5 px-4")}
            disabled={!userIdReady}
            onClick={() => {
              setNewProjectName(defaultProjectName())
              setShowCreateDialog(true)
            }}
          >
            <Plus className="h-4 w-4" />
            새 프로젝트
          </Button>
        }
      />

      {listErr ? <p className="text-sm text-red-300">{listErr}</p> : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={projectSearchQuery}
          onChange={(e) => setProjectSearchQuery(e.target.value)}
          placeholder="프로젝트 검색…"
          className="border-white/10 bg-black/30 pl-9 text-white placeholder:text-slate-500"
        />
      </div>

      {isLoadingProjects ? (
        <StudioPageCard className="flex min-h-[200px] items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          프로젝트 불러오는 중…
        </StudioPageCard>
      ) : filteredProjects.length === 0 ? (
        <StudioPageCard className="py-12 text-center">
          <p className="text-sm text-slate-400">저장된 프로젝트가 없습니다.</p>
          <Button
            type="button"
            variant="ghost"
            className={cn(studio.btnPrimary, "mt-4 gap-1.5")}
            onClick={() => {
              setNewProjectName(defaultProjectName())
              setShowCreateDialog(true)
            }}
          >
            <Plus className="h-4 w-4" />
            첫 프로젝트 만들기
          </Button>
        </StudioPageCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <Checkbox
                checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                onCheckedChange={(v) => toggleSelectAllFiltered(v === true)}
              />
              전체 선택
              {projectSearchQuery.trim() ? (
                <span className="text-xs text-slate-500">(검색 결과)</span>
              ) : null}
            </label>
            <span className="text-xs text-slate-500">
              {selectedProjectIds.size > 0
                ? `${selectedProjectIds.size}개 선택됨`
                : "프로젝트를 선택하세요"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(studio.btnDanger, "ml-auto h-8 gap-1.5 px-3")}
              disabled={selectedProjectIds.size === 0 || bulkDeleting}
              onClick={() => void handleDeleteSelectedProjects()}
            >
              {bulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              선택 삭제
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, index) => {
            const d = project.data || {}
            const pickCount = d.editPicks?.length ?? 0
            const hasSource = Boolean(
              d.sourceResult &&
                (d.sourceResult.douyin.videos.length > 0 || d.sourceResult.xhs.videos.length > 0)
            )
            const isSelected = selectedProjectIds.has(project.id)
            return (
              <StudioPageCard
                key={project.id}
                className={cn(
                  "relative transition hover:border-violet-500/40",
                  index === 0 && "border-violet-500/30 ring-1 ring-violet-500/20",
                  isSelected && "border-violet-400/50 ring-1 ring-violet-400/30"
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => toggleProjectSelected(project.id, v === true)}
                    />
                    <span className="sr-only">{project.name} 선택</span>
                  </label>
                  {index === 0 ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", studio.badgeAccent)}>
                      최근
                    </span>
                  ) : null}
                </div>
                <p className="text-base font-semibold text-white">{project.name}</p>
                {project.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {d.keywordText ? (
                    <span className="rounded-md bg-white/5 px-2 py-0.5">{d.keywordText.slice(0, 24)}</span>
                  ) : null}
                  {hasSource ? <span className="text-emerald-400/90">소스 검색됨</span> : null}
                  {pickCount > 0 ? <span className="text-violet-300">선택 {pickCount}개</span> : null}
                  {d.postEditResult ? <span className="text-emerald-300">짜집기 완료</span> : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600">
                  <span>수정 {new Date(project.updated_at).toLocaleString("ko-KR")}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(studio.btnSecondary, "h-9 flex-1 gap-1.5")}
                    disabled={openingProjectId === project.id}
                    onClick={() => void handleOpenProject(project)}
                  >
                    {openingProjectId === project.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FolderOpen className="h-3.5 w-3.5" />
                    )}
                    열기
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(studio.btnDanger, "h-9 w-9 p-0")}
                    onClick={() => void handleDeleteProject(project.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </StudioPageCard>
            )
          })}
          </div>
        </>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="border-white/10 bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-white">새 프로젝트</DialogTitle>
            <DialogDescription className="text-slate-400">
              키워드·소스·짜집기·TTS 작업이 이 프로젝트에 자동 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={defaultProjectName()}
            className="border-white/10 bg-black/40 text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateProject()
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)}>
              취소
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(studio.btnPrimary, "rounded-lg")}
              disabled={creating}
              onClick={() => void handleCreateProject()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "만들기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

