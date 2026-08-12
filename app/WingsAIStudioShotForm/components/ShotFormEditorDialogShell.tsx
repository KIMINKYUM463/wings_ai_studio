"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ArrowLeft, Download, Loader2, Maximize2, Minimize2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ChromeSlotCtx = {
  setChromeExtra: (node: ReactNode | null) => void
  chromeRevealed: boolean
  autoHideChrome: boolean
}

const EditorChromeSlotContext = createContext<ChromeSlotCtx | null>(null)

/** 팝업 상단 자동숨김 영역에 단계 탭 등을 꽂을 때 사용합니다. */
export function useEditorChromeSlot() {
  return useContext(EditorChromeSlotContext)
}

type Props = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  detailMode: boolean
  onDetailModeChange: (enabled: boolean) => void
  onSave?: () => void | Promise<unknown>
  saving?: boolean
  onDownload?: () => void | Promise<unknown>
  downloading?: boolean
  /** 다운로드 중 버튼에 표시할 상태 문구 */
  downloadingLabel?: string
  backLabel?: string
  closeLabel?: string
  theme?: "light" | "dark"
  headerActions?: ReactNode
  keepMounted?: boolean
  /** 상단 헤더(·추가 크롬)를 기본 숨기고, 위쪽을 가리키면 표시 */
  autoHideChrome?: boolean
}

export function ShotFormEditorDialogShell({
  open,
  title,
  children,
  onClose,
  detailMode,
  onDetailModeChange,
  onSave,
  saving = false,
  onDownload,
  downloading = false,
  downloadingLabel,
  backLabel = "이전 단계",
  closeLabel = "영상 편집기 닫기",
  theme = "light",
  headerActions,
  keepMounted = false,
  autoHideChrome = false,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCloseRef = useRef(onClose)
  const detailModeRef = useRef(detailMode)
  const onDetailModeChangeRef = useRef(onDetailModeChange)
  onCloseRef.current = onClose
  detailModeRef.current = detailMode
  onDetailModeChangeRef.current = onDetailModeChange

  const [chromeExtra, setChromeExtra] = useState<ReactNode | null>(null)
  const [chromeRevealed, setChromeRevealed] = useState(!autoHideChrome)

  const revealChrome = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    setChromeRevealed(true)
  }, [])

  const scheduleHideChrome = useCallback(() => {
    if (!autoHideChrome) return
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setChromeRevealed(false)
      hideTimerRef.current = null
    }, 180)
  }, [autoHideChrome])

  useEffect(() => {
    if (!autoHideChrome) {
      setChromeRevealed(true)
      return
    }
    setChromeRevealed(false)
  }, [autoHideChrome, open])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      const activeDialog = target?.closest('[role="dialog"]')
      if (activeDialog && activeDialog !== shellRef.current) return
      event.preventDefault()
      if (detailModeRef.current) {
        onDetailModeChangeRef.current(false)
      } else {
        onCloseRef.current()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    const focusFrame = requestAnimationFrame(() => shellRef.current?.focus())
    return () => {
      cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [open])

  const setChromeExtraStable = useCallback((node: ReactNode | null) => {
    setChromeExtra(node)
  }, [])

  const chromeSlotValue = useMemo(
    () => ({
      setChromeExtra: setChromeExtraStable,
      chromeRevealed,
      autoHideChrome,
    }),
    [setChromeExtraStable, chromeRevealed, autoHideChrome]
  )

  if (!open) {
    return keepMounted ? (
      <div className="hidden" aria-hidden="true">
        {children}
      </div>
    ) : null
  }

  const dark = theme === "dark"

  const headerBar = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between border-b transition-[height,padding]",
        detailMode ? "h-10 px-2" : "h-14 px-4",
        dark ? "border-white/10 bg-[#111114]" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className={cn(
            detailMode ? "h-8 px-2" : "h-9",
            dark
              ? "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          <ArrowLeft className={cn("h-4 w-4", !detailMode && "mr-2")} />
          <span className={detailMode ? "sr-only" : ""}>{backLabel}</span>
        </Button>
        <div className={cn(detailMode && "hidden", "min-w-0")}>
          <p className={cn("truncate text-sm font-black", dark ? "text-white" : "text-slate-900")}>
            {title}
          </p>
          <p className={cn("hidden text-[10px] sm:block", dark ? "text-slate-500" : "text-slate-400")}>
            {autoHideChrome
              ? "상단을 터치하거나 가리키면 메뉴가 나타납니다 · Esc로 닫기"
              : "Esc를 눌러 닫을 수 있습니다."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {headerActions}
        <Button
          type="button"
          variant="outline"
          aria-pressed={detailMode}
          onClick={() => onDetailModeChange(!detailMode)}
          className={cn(
            detailMode ? "h-8" : "h-9",
            dark
              ? "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          )}
        >
          {detailMode ? (
            <Minimize2 className="mr-2 h-4 w-4" />
          ) : (
            <Maximize2 className="mr-2 h-4 w-4" />
          )}
          {detailMode ? "디테일 종료" : "디테일"}
          <span className="sr-only">
            {detailMode ? "디테일 작업 모드 종료" : "디테일 작업 모드"}
          </span>
        </Button>
        {onDownload ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDownload()}
            disabled={downloading || saving}
            className={cn(
              detailMode ? "h-8" : "h-9",
              dark
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4 shrink-0" />
            )}
            <span className="max-w-[220px] truncate">
              {downloading
                ? downloadingLabel?.trim() || "다운로드 중"
                : "다운로드"}
            </span>
          </Button>
        ) : null}
        {onSave ? (
          <Button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || downloading}
            className={cn(
              detailMode ? "h-8" : "h-9",
              dark
                ? "bg-violet-600 text-white hover:bg-violet-500"
                : "bg-blue-600 text-white hover:bg-blue-500"
            )}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            저장
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={closeLabel}
          onClick={onClose}
          className={cn(
            detailMode ? "h-8 w-8" : "h-9 w-9",
            dark
              ? "text-slate-400 hover:bg-white/10 hover:text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        "fixed inset-0 z-[100] h-[100dvh] max-h-[100dvh]",
        detailMode || autoHideChrome ? "p-0" : "p-0 sm:p-2 md:p-4",
        dark ? "bg-black/70 backdrop-blur-[2px]" : "bg-[#f7f8fa]"
      )}
      onWheel={(event) => event.stopPropagation()}
      onTouchStart={autoHideChrome ? revealChrome : undefined}
    >
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden border",
          detailMode || autoHideChrome ? "rounded-none shadow-none" : "rounded-xl shadow-2xl",
          dark ? "border-white/10 bg-[#09090b]" : "border-slate-200 bg-[#f7f8fa]"
        )}
      >
        <EditorChromeSlotContext.Provider value={chromeSlotValue}>
          {autoHideChrome ? (
            <>
              {/* 좌측 상단만 가리키면 메뉴 표시 — 우측(미리보기 등)은 건드리지 않음 */}
              <div
                className="absolute left-0 top-0 z-[80] h-5 w-1/2"
                onMouseEnter={revealChrome}
                aria-hidden
              />
              <div
                className={cn(
                  "absolute inset-x-0 top-0 z-[70] shadow-md transition-transform duration-200 ease-out",
                  chromeRevealed ? "translate-y-0" : "-translate-y-full pointer-events-none"
                )}
                onMouseEnter={revealChrome}
                onMouseLeave={scheduleHideChrome}
              >
                {headerBar}
                {chromeExtra ? (
                  <div
                    className={cn(
                      "border-b px-3 py-2",
                      dark ? "border-white/10 bg-[#111114]" : "border-slate-200 bg-white"
                    )}
                  >
                    {chromeExtra}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            headerBar
          )}
          <div className="min-h-0 flex-1">{children}</div>
        </EditorChromeSlotContext.Provider>
      </div>
    </div>
  )
}
