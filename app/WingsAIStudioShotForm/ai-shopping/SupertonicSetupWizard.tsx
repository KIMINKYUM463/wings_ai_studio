"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  connectLocalAgent,
  resolveLocalCompanionUrl,
} from "@/lib/shotform-local-companion-client"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { isBrowserOnDeployedHost } from "@/lib/supertonic-runtime-client"

const PYTHON_DOWNLOAD_URL = "https://www.python.org/downloads/"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReady?: (info: { online: boolean; message?: string }) => void
}

type CheckState = "idle" | "checking" | "ok" | "fail"

export function SupertonicSetupWizard({ open, onOpenChange, onReady }: Props) {
  const deployed = isBrowserOnDeployedHost()
  const [agentOk, setAgentOk] = useState(false)
  const [agentMsg, setAgentMsg] = useState("")
  const [pythonState, setPythonState] = useState<CheckState>("idle")
  const [pythonMsg, setPythonMsg] = useState("")
  const [stState, setStState] = useState<CheckState>("idle")
  const [stMsg, setStMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setAgentOk(false)
    setAgentMsg("")
    setPythonState("idle")
    setPythonMsg("")
    setStState("idle")
    setStMsg("")
    setBusy(false)
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  const ensureAgent = useCallback(async () => {
    setBusy(true)
    setAgentMsg("로컬 에이전트 연결 중…")
    try {
      if (!deployed) {
        setAgentOk(true)
        setAgentMsg("로컬 개발 환경 — 에이전트 생략 가능")
        return true
      }
      const health = await connectLocalAgent({
        requireFfmpeg: false,
        onProgress: (m) => setAgentMsg(m),
      })
      if (health.ok) {
        setAgentOk(true)
        setAgentMsg("에이전트 연결됨 (http://127.0.0.1:3847)")
        return true
      }
      setAgentOk(false)
      setAgentMsg(
        health.error ||
          "에이전트가 필요합니다. 쿠팡 수집기의 「에이전트 연결」을 먼저 눌러 주세요."
      )
      return false
    } finally {
      setBusy(false)
    }
  }, [deployed])

  const checkPython = useCallback(async () => {
    setBusy(true)
    setPythonState("checking")
    setPythonMsg("Python 설치 여부 확인 중…")
    try {
      const ready = agentOk || (await ensureAgent())
      if (!ready && deployed) {
        setPythonState("fail")
        setPythonMsg("에이전트 연결 후 다시 「새로고침」해 주세요.")
        return false
      }

      if (!deployed) {
        // 로컬 Next: ensure 단계에서 Python을 쓰므로, 여기서는 안내만
        setPythonState("ok")
        setPythonMsg("로컬 환경입니다. 아래 「Supertonic 3 설치」를 눌러 주세요.")
        return true
      }

      const base = resolveLocalCompanionUrl().replace(/\/$/, "")
      const res = await fetch(`${base}/supertonic/prereq`, { cache: "no-store" })
      const json = (await res.json().catch(() => ({}))) as {
        python?: boolean
        pythonVersion?: string
        tip?: string
        supertonic?: boolean
      }

      if (json.supertonic) {
        setPythonState("ok")
        setPythonMsg(json.pythonVersion || "Python 확인됨 (Supertonic도 이미 실행 중)")
        setStState("ok")
        setStMsg("Supertonic이 이미 실행 중입니다.")
        onReady?.({ online: true, message: "이미 연결됨" })
        return true
      }

      if (json.python) {
        setPythonState("ok")
        setPythonMsg(
          `${json.pythonVersion || "Python 감지됨"} — 설치 완료. 다음 단계로 진행하세요.`
        )
        return true
      }

      setPythonState("fail")
      setPythonMsg(
        "아직 Python이 없습니다.\n1) 아래 버튼으로 python.org에서 다운로드\n2) 설치 시 「Add python.exe to PATH」 체크\n3) 설치 후 이 창에서 「새로고침」"
      )
      return false
    } catch (e) {
      setPythonState("fail")
      setPythonMsg(e instanceof Error ? e.message : "확인 실패")
      return false
    } finally {
      setBusy(false)
    }
  }, [agentOk, deployed, ensureAgent, onReady])

  useEffect(() => {
    if (open) void checkPython()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 1회
  }, [open])

  const installSupertonic = async () => {
    if (pythonState !== "ok") {
      setStMsg("먼저 Python 설치를 완료하고 「새로고침」으로 확인해 주세요.")
      setStState("fail")
      return
    }
    setBusy(true)
    setStState("checking")
    setStMsg("Supertonic 3 다운로드·설치·서버 기동 중… (최초는 수 분 걸릴 수 있음)")
    try {
      const ensured = await ensureSupertonicReady({
        onProgress: (s) => {
          if (s.message) setStMsg(s.message)
        },
      })
      if (ensured.online) {
        setStState("ok")
        setStMsg(ensured.message || "Supertonic 3 연결 완료")
        onReady?.({ online: true, message: ensured.message })
        return
      }
      setStState("fail")
      setStMsg(
        ensured.message ||
          ensured.error ||
          "설치에 실패했습니다. Python PATH와 인터넷을 확인한 뒤 다시 시도하세요."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Supertonic 3 준비
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            ① Python 설치 → ② 새로고침으로 확인 → ③ Supertonic 설치
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Python */}
        <section className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">1. Python 설치</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                python.org에서 받은 뒤, 설치 화면에서{" "}
                <span className="text-amber-200/90">Add python.exe to PATH</span> 를 꼭
                체크하세요.
              </p>
            </div>
            {pythonState === "ok" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : pythonState === "fail" ? (
              <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
            ) : pythonState === "checking" ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-400" />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-sky-600 font-semibold text-white hover:bg-sky-500"
              onClick={() => window.open(PYTHON_DOWNLOAD_URL, "_blank", "noopener,noreferrer")}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Python 다운로드
              <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void checkPython()}
              className="font-semibold"
            >
              {busy && pythonState === "checking" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              새로고침 (설치 확인)
            </Button>
          </div>

          {pythonMsg ? (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                pythonState === "ok"
                  ? "text-emerald-300"
                  : pythonState === "fail"
                    ? "text-amber-200/90"
                    : "text-zinc-400"
              }`}
            >
              {pythonState === "ok" ? "완료 — " : ""}
              {pythonMsg}
            </p>
          ) : null}

          {deployed && agentMsg ? (
            <p className="text-[10px] text-zinc-600">에이전트: {agentMsg}</p>
          ) : null}
        </section>

        {/* Step 2: Supertonic */}
        <section
          className={`mt-3 space-y-3 rounded-xl border p-4 ${
            pythonState === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-white/10 bg-black/20 opacity-70"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">2. Supertonic 3 설치</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                버튼을 누르면 이 PC에 자동으로 받아서 설치하고 서버를 켭니다.
              </p>
            </div>
            {stState === "ok" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : stState === "fail" ? (
              <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
            ) : stState === "checking" ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-400" />
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            disabled={busy || pythonState !== "ok" || stState === "ok"}
            onClick={() => void installSupertonic()}
            className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {stState === "checking" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {stState === "ok" ? "설치 완료" : "Supertonic 3 설치"}
          </Button>

          {stMsg ? (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                stState === "ok"
                  ? "text-emerald-300"
                  : stState === "fail"
                    ? "text-amber-200/90"
                    : "text-zinc-400"
              }`}
            >
              {stState === "ok" ? "완료 — " : ""}
              {stMsg}
            </p>
          ) : null}
        </section>

        <div className="mt-4 flex justify-end gap-2">
          {stState === "ok" ? (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-sky-600 font-semibold text-white hover:bg-sky-500"
            >
              완료 · 닫기
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
