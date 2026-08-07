"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { SupertonicSetupWizard } from "../ai-shopping/SupertonicSetupWizard"

type Props = {
  /** 연결 성공 시 (보이스 목록 다시 불러오기 등) */
  onReady?: (info: { online: boolean; message?: string }) => void
  disabled?: boolean
  className?: string
}

/**
 * Supertonic 3를 쓰는 모든 음성 UI에 공통으로 붙이는
 * 「설치 안내·연결 확인」+「빠른 연결」바
 */
export function SupertonicSetupBar({ onReady, disabled, className = "" }: Props) {
  const [setupWizardOpen, setSetupWizardOpen] = useState(false)
  const [healthMsg, setHealthMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const quickConnect = async () => {
    setBusy(true)
    setHealthMsg("연결 확인 중…")
    try {
      const ensured = await ensureSupertonicReady({
        onProgress: (s) => {
          if (s.message) setHealthMsg(s.message)
        },
      })
      const message = ensured.online
        ? ensured.message || "Supertonic 연결됨"
        : ensured.message || "연결 실패 — 설치 안내를 열어 주세요."
      setHealthMsg(message)
      onReady?.({ online: Boolean(ensured.online), message })
    } catch (e) {
      const message = e instanceof Error ? e.message : "연결 확인 실패"
      setHealthMsg(message)
      onReady?.({ online: false, message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`space-y-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-3 ${className}`}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
          disabled={disabled || busy}
          onClick={() => setSetupWizardOpen(true)}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          설치 안내·연결 확인
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 border-emerald-400/30 text-emerald-100"
          disabled={disabled || busy}
          onClick={() => void quickConnect()}
        >
          {busy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          빠른 연결
        </Button>
      </div>
      <p className="text-[10px] text-zinc-500">
        Python 다운로드 → 새로고침 확인 → Supertonic 3 설치
      </p>
      {healthMsg ? (
        <p className="text-[11px] leading-relaxed text-emerald-200/90">{healthMsg}</p>
      ) : null}
      <SupertonicSetupWizard
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        onReady={(info) => {
          if (info.message) setHealthMsg(info.message)
          onReady?.(info)
        }}
      />
    </div>
  )
}
