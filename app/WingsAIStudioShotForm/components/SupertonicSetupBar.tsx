"use client"

import { useEffect, useState } from "react"
import { Loader2, Power, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { fetchSupertonicHealth } from "@/lib/supertonic-runtime-client"
import { SupertonicSetupWizard } from "../ai-shopping/SupertonicSetupWizard"

type Props = {
  /** 연결 성공 시 (보이스 목록 다시 불러오기 등) */
  onReady?: (info: { online: boolean; message?: string }) => void
  disabled?: boolean
  className?: string
}

/**
 * 버튼 한 번으로 이 PC에서
 * `supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3`
 * 를 자동 실행합니다. (터미널을 직접 열 필요 없음)
 */
export function SupertonicSetupBar({ onReady, disabled, className = "" }: Props) {
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)
  const [healthMsg, setHealthMsg] = useState("")
  const [online, setOnline] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

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
          "꺼져 있습니다. 아래 「Supertonic 자동 실행」을 누르세요."
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
  }, [busy])

  /** 핵심: 터미널 없이 serve 자동 기동 */
  const autoStart = async () => {
    setBusy(true)
    setOnline(false)
    setHealthMsg(
      "Supertonic 자동 실행 중…\n(supertonic serve --host 127.0.0.1 --port 7788 --model supertonic-3)"
    )
    try {
      const ensured = await ensureSupertonicReady({
        onProgress: (s) => {
          if (s.message) {
            setHealthMsg(
              s.online
                ? s.message
                : `${s.message}\n→ serve 자동 기동 진행 중`
            )
          }
        },
      })
      const isOnline = Boolean(ensured.online)
      setOnline(isOnline)
      const message = isOnline
        ? ensured.message ||
          `실행 완료 · ${ensured.model || "supertonic-3"} · ${ensured.baseUrl || "127.0.0.1:7788"}`
        : `${ensured.message || ensured.error || "자동 실행에 실패했습니다."}\n\n대안: 아래 「실행 파일 받기」를 더블클릭하세요.`
      setHealthMsg(message)
      onReady?.({ online: isOnline, message })
      if (isOnline) {
        window.setTimeout(() => void refreshHealth(), 500)
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Supertonic 자동 실행 실패"
      setOnline(false)
      setHealthMsg(
        `${message}\n\n대안: 아래 「실행 파일 받기」를 더블클릭하세요.`
      )
      onReady?.({ online: false, message })
    } finally {
      setBusy(false)
    }
  }

  /** 원클릭 실패 시 — 더블클릭만 하면 되는 .cmd (터미널 명령 입력 불필요) */
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

  return (
    <div className={`space-y-2.5 rounded-2xl border p-3 ${borderClass} ${className}`}>
      <Button
        type="button"
        size="lg"
        className="h-11 w-full bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
        disabled={disabled || busy}
        onClick={() => void autoStart()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Power className="mr-2 h-4 w-4" />
        )}
        {online === true
          ? "Supertonic 다시 연결"
          : busy
            ? "자동 실행 중…"
            : "Supertonic 자동 실행"}
      </Button>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        마냥 기다리는 게 아니라 아래를 확인하세요. (1) ShotForm Local Agent 창이
        열려 있고 3847 표시 (2) 그 PC에 Python 3 + PATH (3) 상태 문구가
        installing → starting → ready 로 바뀜. 최초 1회만 pip·모델로 수 분 걸릴
        수 있습니다. 문구가 안 바뀌면 에이전트를 최신 .cmd로 다시 실행하세요.
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
          onClick={() => setSetupWizardOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          처음 설치 안내
        </button>
        {online === false ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={downloadStarter}
            className="text-[10px] text-amber-200/80 underline-offset-2 hover:text-amber-100 hover:underline disabled:opacity-50"
          >
            실행 파일 받기 (.cmd)
          </button>
        ) : null}
      </div>

      <SupertonicSetupWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        onReady={(info) => {
          setOnline(Boolean(info.online))
          if (info.message) setHealthMsg(info.message)
          onReady?.(info)
        }}
      />
    </div>
  )
}
