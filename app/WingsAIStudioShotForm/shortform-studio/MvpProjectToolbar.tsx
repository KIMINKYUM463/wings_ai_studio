"use client"

import { FolderOpen, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { studio } from "../components/ShotFormStudioUI"

export type MvpProjectSaveState = "idle" | "saving" | "saved" | "error"

type Props = {
  projectName: string
  onProjectNameChange: (name: string) => void
  onProjectNameCommit: () => void
  saveState: MvpProjectSaveState
  saveError?: string | null
  onSave: () => void
  onBackToProjects: () => void
  className?: string
}

export function MvpProjectToolbar({
  projectName,
  onProjectNameChange,
  onProjectNameCommit,
  saveState,
  saveError,
  onSave,
  onBackToProjects,
  className,
}: Props) {
  return (
    <div className={cn("sticky top-0 z-30 -mx-5 mb-5 sm:-mx-8 lg:-mx-10", className)}>
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/20 bg-slate-950/95 px-5 py-3 backdrop-blur-md sm:px-8 lg:px-10",
      )}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-violet-400/90">저장 중인 프로젝트</p>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onBlur={() => onProjectNameCommit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          maxLength={120}
          aria-label="프로젝트 이름"
          placeholder="예: 홈시어터 스크린 1 (스토리형 대본)"
          title="이름 끝에 공백+1 → 자연스러운 쇼츠 스토리 대본 모드"
          className="mt-0.5 w-full min-w-0 max-w-xs truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-white outline-none transition hover:border-white/15 focus:border-violet-400/40 focus:bg-white/5 placeholder:font-normal placeholder:text-slate-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium",
            saveState === "saving" && "bg-violet-500/15 text-violet-200",
            saveState === "saved" && "bg-emerald-500/15 text-emerald-300",
            saveState === "error" && "bg-red-500/15 text-red-300",
            saveState === "idle" && "bg-white/5 text-slate-400"
          )}
        >
          {saveState === "saving" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              저장 중…
            </span>
          ) : saveState === "saved" ? (
            "저장 완료"
          ) : saveState === "error" ? (
            "저장 실패"
          ) : (
            "편집 시 자동 저장"
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(studio.btnPrimary, "h-9 gap-1.5")}
          disabled={saveState === "saving"}
          onClick={onSave}
        >
          {saveState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          지금 저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(studio.btnSecondary, "h-9 gap-1.5")}
          onClick={onBackToProjects}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          프로젝트 목록
        </Button>
      </div>
    </div>
    {saveError ? (
      <p className="border-b border-red-500/20 bg-red-950/40 px-5 py-2 text-xs text-red-200 sm:px-8 lg:px-10">
        {saveError}
      </p>
    ) : null}
    </div>
  )
}
