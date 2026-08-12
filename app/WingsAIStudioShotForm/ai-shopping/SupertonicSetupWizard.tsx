"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  Loader2,
  PlugZap,
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
  downloadLocalAgentStarter,
  probeLocalCompanion,
  resolveLocalCompanionUrl,
} from "@/lib/shotform-local-companion-client"
import {
  detectShotformClientOs,
  localAgentStarterHint,
  localAgentStarterLabel,
} from "@/lib/shotform-client-os"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { isBrowserOnDeployedHost } from "@/lib/supertonic-runtime-client"

const PYTHON_DOWNLOAD_URL = "https://www.python.org/downloads/"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReady?: (info: { online: boolean; message?: string }) => void
  /** 자동 실행 실패 시 강조 이유 */
  failReason?: string | null
}

type CheckState = "idle" | "checking" | "ok" | "fail"

function StatusIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
  if (state === "fail") return <XCircle className="h-5 w-5 shrink-0 text-rose-400" />
  if (state === "checking")
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-400" />
  return <Circle className="h-5 w-5 shrink-0 text-zinc-600" />
}

export function SupertonicSetupWizard({
  open,
  onOpenChange,
  onReady,
  failReason,
}: Props) {
  const deployed = isBrowserOnDeployedHost()
  const [agentState, setAgentState] = useState<CheckState>("idle")
  const [agentMsg, setAgentMsg] = useState("")
  const [pythonState, setPythonState] = useState<CheckState>("idle")
  const [pythonMsg, setPythonMsg] = useState("")
  const [stState, setStState] = useState<CheckState>("idle")
  const [stMsg, setStMsg] = useState("")
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setAgentState("idle")
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

  const runChecklist = useCallback(async () => {
    setBusy(true)
    setAgentState("checking")
    setAgentMsg("에이전트(3847) 확인 중…")
    setPythonState("idle")
    setPythonMsg("")
    setStState("idle")
    setStMsg("")

    try {
      // ── 1) Agent ──
      if (!deployed) {
        setAgentState("ok")
        setAgentMsg("로컬 개발 환경 — 에이전트 생략 가능")
      } else {
        const probed = await probeLocalCompanion()
        if (probed.ok) {
          setAgentState("ok")
          setAgentMsg("실행 중 (http://127.0.0.1:3847) — 검은 창 유지")
        } else {
          setAgentState("fail")
          setAgentMsg(
            "에이전트가 꺼져 있습니다. 아래 「에이전트 받기」→ 더블클릭 후 「다시 확인」을 누르세요."
          )
          setPythonState("fail")
          setPythonMsg("에이전트가 먼저 필요합니다.")
          return
        }
      }

      // ── 2) Python ──
      setPythonState("checking")
      setPythonMsg("Python 설치 여부 확인 중…")

      if (!deployed) {
        setPythonState("ok")
        setPythonMsg("로컬 환경 — 아래 설치 단계로 진행하세요.")
      } else {
        const base = resolveLocalCompanionUrl().replace(/\/$/, "")
        const res = await fetch(`${base}/supertonic/prereq`, { cache: "no-store" })
        if (res.status === 404) {
          setPythonState("fail")
          setPythonMsg(
            "에이전트가 오래되었습니다. 검은 창을 닫고 「에이전트 받기」로 최신 실행 파일을 받은 뒤 「다시 확인」하세요."
          )
          return
        }
        const json = (await res.json().catch(() => ({}))) as {
          python?: boolean
          pythonVersion?: string
          tip?: string
          supertonic?: boolean
        }

        if (json.supertonic) {
          setPythonState("ok")
          setPythonMsg(json.pythonVersion || "Python 확인됨")
          setStState("ok")
          setStMsg("Supertonic이 이미 실행 중입니다.")
          onReady?.({ online: true, message: "이미 연결됨" })
          return
        }

        if (json.python) {
          setPythonState("ok")
          setPythonMsg(`${json.pythonVersion || "Python 감지됨"} — 다음 단계로 진행하세요.`)
        } else {
          setPythonState("fail")
          setPythonMsg(
            detectShotformClientOs() === "mac"
              ? "새 Terminal에서는 Python이 보여도, 에이전트 창이 예전 PATH로 떠 있으면 실패합니다.\n" +
                  "지금 할 일:\n" +
                  "① 에이전트 Terminal 창을 완전히 닫기\n" +
                  "② Python이 되는 Terminal에서 아래 실행:\n" +
                  '   ~/Library/Application\\ Support/ShotForm/local-agent/run-agent.sh\n' +
                  "③ 창에 Python: 3.x... 가 보이면 Wings에서 「다시 확인」\n" +
                  "④ 더블클릭으로만 안 되면 PC 재시작 후 에이전트 다시 실행"
              : "새 CMD에서는 Python이 보여도, 에이전트 창이 예전 PATH로 떠 있으면 실패합니다.\n" +
                  "지금 할 일:\n" +
                  "① 에이전트 검은 창을 완전히 닫기\n" +
                  "② Python이 되는 그 CMD 창에서 아래 실행:\n" +
                  '   "%LOCALAPPDATA%\\ShotForm\\local-agent\\run-agent.cmd"\n' +
                  "③ 창에 Python: 3.14... 가 보이면 Wings에서 「다시 확인」\n" +
                  "④ 더블클릭으로만 안 되면 PC 재시작 후 에이전트 다시 실행"
          )
          return
        }
      }

      // ── 3) Supertonic already? ──
      // Python OK — leave step 3 for user button (or auto if failReason was only python and now ok)
    } catch (e) {
      setPythonState("fail")
      setPythonMsg(e instanceof Error ? e.message : "확인 실패")
    } finally {
      setBusy(false)
    }
  }, [deployed, onReady])

  useEffect(() => {
    if (open) void runChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 1회
  }, [open])

  const launchAgent = () => {
    downloadLocalAgentStarter()
    setAgentMsg(localAgentStarterHint())
    setAgentState("fail")
  }

  const installSupertonic = async () => {
    if (pythonState !== "ok") {
      setStMsg("먼저 1·2단계를 완료하고 「다시 확인」을 누르세요.")
      setStState("fail")
      return
    }
    setBusy(true)
    setStState("checking")
    setStMsg("Supertonic 3 설치·기동 중… (최초 1회 pip·모델 수 분 소요)")
    try {
      if (deployed) {
        const health = await connectLocalAgent({
          requireFfmpeg: false,
          onProgress: (m) => setStMsg(m),
        })
        if (!health.ok) {
          setStState("fail")
          setStMsg(health.error || "에이전트 연결 실패")
          setAgentState("fail")
          return
        }
        setAgentState("ok")
      }
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
      if (ensured.error === "python_missing" || /Python/i.test(ensured.message || "")) {
        setPythonState("fail")
        setPythonMsg(
          ensured.message ||
            "Python이 아직 안 보입니다. PATH 체크 후 에이전트 창을 다시 열어 「다시 확인」하세요."
        )
        setStState("fail")
        setStMsg("Python 준비 후 다시 시도하세요.")
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

  const highlightPython =
    Boolean(failReason && /python/i.test(failReason)) || pythonState === "fail"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Supertonic 3 준비 체크리스트
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            아래를 순서대로 확인하세요. 완료된 항목에 ✓ 가 붙습니다.
          </DialogDescription>
        </DialogHeader>

        {failReason ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
            {failReason}
          </p>
        ) : null}

        {/* Step 1: Agent */}
        <section
          className={`mt-1 space-y-3 rounded-xl border p-4 ${
            agentState === "ok"
              ? "border-emerald-500/25 bg-emerald-500/5"
              : agentState === "fail"
                ? "border-rose-500/30 bg-rose-500/5"
                : "border-white/10 bg-black/35"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">1. 로컬 에이전트 (3847)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                ShotForm Local Agent 검은 창이 열려 있어야 합니다.
              </p>
            </div>
            <StatusIcon state={agentState} />
          </div>
          {deployed && agentState !== "ok" ? (
            <Button
              type="button"
              size="sm"
              className="bg-amber-500 font-semibold text-zinc-900 hover:bg-amber-400"
              onClick={launchAgent}
            >
              <PlugZap className="mr-1.5 h-3.5 w-3.5" />
              {localAgentStarterLabel()}
            </Button>
          ) : null}
          {agentMsg ? (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                agentState === "ok" ? "text-emerald-300" : "text-amber-100/90"
              }`}
            >
              {agentMsg}
            </p>
          ) : null}
        </section>

        {/* Step 2: Python */}
        <section
          className={`mt-3 space-y-3 rounded-xl border p-4 ${
            highlightPython
              ? "border-amber-400/40 bg-amber-500/10 ring-1 ring-amber-400/20"
              : pythonState === "ok"
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-white/10 bg-black/35"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">2. Python 3 설치</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                설치 시{" "}
                <span className="font-semibold text-amber-200">
                  Add python.exe to PATH
                </span>{" "}
                를 반드시 체크하세요. 설치 후에는{" "}
                <span className="text-amber-200">에이전트 창을 닫고 다시</span> 열어야
                PATH가 반영됩니다.
              </p>
            </div>
            <StatusIcon state={pythonState} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-sky-600 font-semibold text-white hover:bg-sky-500"
              onClick={() =>
                window.open(PYTHON_DOWNLOAD_URL, "_blank", "noopener,noreferrer")
              }
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
              onClick={() => void runChecklist()}
              className="font-semibold"
            >
              {busy && (agentState === "checking" || pythonState === "checking") ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              다시 확인
            </Button>
          </div>

          {pythonMsg ? (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                pythonState === "ok"
                  ? "text-emerald-300"
                  : pythonState === "fail"
                    ? "text-amber-100"
                    : "text-zinc-400"
              }`}
            >
              {pythonMsg}
            </p>
          ) : null}
        </section>

        {/* Step 3: Supertonic */}
        <section
          className={`mt-3 space-y-3 rounded-xl border p-4 ${
            pythonState === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-white/10 bg-black/20 opacity-70"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">3. Supertonic 3 설치·기동</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                1·2가 ✓ 이면 이 버튼으로 pip 설치와 서버 기동을 진행합니다.
              </p>
            </div>
            <StatusIcon state={stState} />
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
            {stState === "ok" ? "설치 완료" : "Supertonic 3 설치·기동"}
          </Button>

          {stMsg ? (
            <p
              className={`whitespace-pre-line text-[11px] leading-relaxed ${
                stState === "ok"
                  ? "text-emerald-300"
                  : stState === "fail"
                    ? "text-amber-100"
                    : "text-zinc-400"
              }`}
            >
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
