"use client"

import { useEffect, useState } from "react"
import { Loader2, Power, Sparkles, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadLocalAgentStarter } from "@/lib/shotform-local-companion-client"
import {
  detectShotformClientOs,
  localAgentStarterHint,
  localAgentStarterLabel,
} from "@/lib/shotform-client-os"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import {
  fetchSupertonicHealth,
  isBrowserOnDeployedHost,
} from "@/lib/supertonic-runtime-client"
import { SupertonicSetupWizard } from "../ai-shopping/SupertonicSetupWizard"
import { SupertonicMacSetupGuide } from "../ai-shopping/SupertonicMacSetupGuide"

type Props = {
  /** 연결 성공 시 (보이스 목록 다시 불러오기 등) */
  onReady?: (info: { online: boolean; message?: string }) => void
  disabled?: boolean
  className?: string
}

/**
 * OS(Mac/Windows)를 브라우저에서 감지한 뒤,
 * 「연결」 한 번으로 Supertonic 3 설치·기동(ensure)을 시도합니다.
 * 실패 시에만 OS별 체크리스트/가이드를 엽니다.
 */
export function SupertonicSetupBar({ onReady, disabled, className = "" }: Props) {
  const isMac = detectShotformClientOs() === "mac"
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)
  const [wizardFailReason, setWizardFailReason] = useState<string | null>(null)
  const [healthMsg, setHealthMsg] = useState("")
  const [online, setOnline] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const openChecklist = (reason?: string) => {
    setWizardFailReason(reason?.trim() || null)
    setSetupWizardOpen(true)
  }

  const refreshHealth = async () => {
    const data = await fetchSupertonicHealth()
    setOnline(data.online)
    if (data.online) {
      setHealthMsg(
        `실행 중 · ${data.model || "supertonic-3"} · ${data.baseUrl || "127.0.0.1:7788"}`
      )
    } else if (!busy) {
      setHealthMsg(
        data.error ||
          data.message ||
          "꺼져 있습니다. 아래 「Supertonic 자동 연결」을 누르면 OS에 맞게 설치·기동합니다."
      )
    }
    return data.online
  }

  useEffect(() => {
    void refreshHealth()
    const id = window.setInterval(() => {
      if (!busy) void refreshHealth()
    }, 12000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, isMac])

  /** Mac·Windows 공통: OS 감지된 에이전트/스크립트로 설치·기동 */
  const autoStart = async () => {
    setBusy(true)
    setOnline(false)
    setHealthMsg(
      isMac
        ? "Mac 감지 · Supertonic 자동 설치·실행 중…\n(필요 시 에이전트 .command 다운로드 → 더블클릭)"
        : "Windows 감지 · Supertonic 자동 실행 중…\n(supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3)"
    )
    try {
      const ensured = await ensureSupertonicReady({
        onProgress: (s) => {
          if (s.message) {
            setHealthMsg(
              s.online
                ? s.message
                : `${s.message}\n→ ${isMac ? "Mac" : "Windows"} 자동 설치·기동 진행 중`
            )
          }
        },
      })
      const isOnline = Boolean(ensured.online)
      setOnline(isOnline)
      const failText =
        ensured.message || ensured.error || "자동 연결에 실패했습니다."
      const message = isOnline
        ? ensured.message ||
          `실행 완료 · ${ensured.model || "supertonic-3"} · ${ensured.baseUrl || "127.0.0.1:7788"}`
        : failText
      setHealthMsg(message)
      onReady?.({ online: isOnline, message })
      if (isOnline) {
        window.setTimeout(() => void refreshHealth(), 500)
      } else {
        openChecklist(failText)
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Supertonic 자동 연결 실패"
      setOnline(false)
      setHealthMsg(message)
      onReady?.({ online: false, message })
      openChecklist(message)
    } finally {
      setBusy(false)
    }
  }

  const onPrimaryClick = () => {
    void autoStart()
  }

  /** Windows 전용 fallback .cmd — Mac은 가이드에서 .command 처리 */
  const downloadStarter = () => {
    const body = `@echo off
chcp 65001 >nul
title Supertonic 3
echo Supertonic 서버를 시작합니다...
echo.
supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3
echo.
echo 서버가 종료되었습니다. 창을 닫아도 됩니다.
pause
`
    const blob = new Blob([body], { type: "application/x-bat;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "start-supertonic.cmd"
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    setHealthMsg(
      "start-supertonic.cmd 를 다운로드했습니다. 파일을 더블클릭하면 서버가 켜집니다."
    )
  }

  const borderClass =
    online === true
      ? "border-emerald-400/30 bg-emerald-500/5"
      : "border-amber-400/35 bg-amber-500/5"
  const msgClass =
    online === true ? "text-emerald-200/95" : "text-amber-50/95"

  const primaryLabel = (() => {
    if (online === true) return "Supertonic 다시 연결"
    if (busy) return "자동 연결 중…"
    return isMac ? "Supertonic 자동 연결 (Mac)" : "Supertonic 자동 연결 (Windows)"
  })()

  return (
    <div className={`space-y-2.5 rounded-2xl border p-3 ${borderClass} ${className}`}>
      <Button
        type="button"
        size="lg"
        className="h-11 w-full bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
        disabled={disabled || busy}
        onClick={onPrimaryClick}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Power className="mr-2 h-4 w-4" />
        )}
        {primaryLabel}
      </Button>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        {isMac
          ? "Mac으로 감지했습니다. 버튼을 누르면 Python·Supertonic 설치와 serve 기동을 자동으로 시도합니다. 배포 사이트에서는 에이전트(.command)가 필요할 수 있습니다 — 그때만 다운로드 안내가 뜹니다. Terminal/에이전트 창은 닫지 마세요."
          : "Windows로 감지했습니다. 에이전트 창이 이미 열려 있으면 실행 파일을 다시 받지 않고 설치·기동만 진행합니다. (1) 3847 창 유지 (2) Python 3 + PATH (3) installing → starting → ready."}
      </p>

      {healthMsg ? (
        <p className={`whitespace-pre-wrap text-[11px] leading-relaxed ${msgClass}`}>
          {healthMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => openChecklist()}
          className="inline-flex items-center gap-1 text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
        >
          {isMac ? (
            <>
              <Terminal className="h-3 w-3" />
              Mac 준비 가이드
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              준비 체크리스트
            </>
          )}
        </button>
        {isBrowserOnDeployedHost() ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              downloadLocalAgentStarter()
              setHealthMsg(localAgentStarterHint())
            }}
            className="text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
          >
            {localAgentStarterLabel().replace("에이전트 받기", "에이전트 업데이트")}
          </button>
        ) : null}
        {!isMac && online === false ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={downloadStarter}
            className="text-[10px] text-amber-200/80 underline-offset-2 hover:text-amber-100 hover:underline disabled:opacity-50"
          >
            Supertonic 실행파일 (.cmd)
          </button>
        ) : null}
      </div>

      {isMac ? (
        <SupertonicMacSetupGuide
          open={setupWizardOpen}
          onOpenChange={(open) => {
            setSetupWizardOpen(open)
            if (!open) setWizardFailReason(null)
          }}
          failReason={wizardFailReason}
          onReady={(info) => {
            setOnline(Boolean(info.online))
            if (info.message) setHealthMsg(info.message)
            onReady?.(info)
            if (info.online) {
              setSetupWizardOpen(false)
              setWizardFailReason(null)
            }
          }}
        />
      ) : (
        <SupertonicSetupWizard
          open={setupWizardOpen}
          onOpenChange={(open) => {
            setSetupWizardOpen(open)
            if (!open) setWizardFailReason(null)
          }}
          failReason={wizardFailReason}
          onReady={(info) => {
            setOnline(Boolean(info.online))
            if (info.message) setHealthMsg(info.message)
            onReady?.(info)
            if (info.online) {
              setSetupWizardOpen(false)
              setWizardFailReason(null)
            }
          }}
        />
      )}
    </div>
  )
}
