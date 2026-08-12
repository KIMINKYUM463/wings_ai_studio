"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  PlugZap,
  Sparkles,
  Terminal,
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
import { localAgentStarterFilename } from "@/lib/shotform-client-os"
import { ensureSupertonicReady } from "@/lib/supertonic-ensure-client"
import { isBrowserOnDeployedHost } from "@/lib/supertonic-runtime-client"

const NODE_URL = "https://nodejs.org/en/download"
const PYTHON_URL = "https://www.python.org/downloads/"
const BREW_NODE = "brew install node"
const BREW_PYTHON = "brew install python"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReady?: (info: { online: boolean; message?: string }) => void
  failReason?: string | null
}

type StepId = 1 | 2 | 3 | 4 | 5

const STEPS: { id: StepId; title: string }[] = [
  { id: 1, title: "Node.js" },
  { id: 2, title: "Python 3" },
  { id: 3, title: "에이전트" },
  { id: 4, title: "Supertonic" },
  { id: 5, title: "완료" },
]

/**
 * Mac 전용 — 화면에 나온 순서대로만 따라하면 되도록 한 단계씩 안내.
 * Windows의 「자동 실행」과 달리, 더블클릭·Gatekeeper·Terminal 유지를 명시적으로 안내한다.
 */
export function SupertonicMacSetupGuide({
  open,
  onOpenChange,
  onReady,
  failReason,
}: Props) {
  const deployed = isBrowserOnDeployedHost()
  const filename = localAgentStarterFilename("mac")
  const [step, setStep] = useState<StepId>(1)
  const [busy, setBusy] = useState(false)
  const [agentOk, setAgentOk] = useState(false)
  const [agentMsg, setAgentMsg] = useState("")
  const [pythonOk, setPythonOk] = useState(false)
  const [pythonMsg, setPythonMsg] = useState("")
  const [stOk, setStOk] = useState(false)
  const [stMsg, setStMsg] = useState("")

  const reset = () => {
    setStep(1)
    setBusy(false)
    setAgentOk(false)
    setAgentMsg("")
    setPythonOk(false)
    setPythonMsg("")
    setStOk(false)
    setStMsg("")
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  /** 열릴 때 이미 에이전트·Supertonic이 살아 있으면 해당 단계로 점프 */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      if (!deployed) {
        setAgentOk(true)
        setPythonOk(true)
        return
      }
      const probed = await probeLocalCompanion()
      if (cancelled) return
      if (!probed.ok) return
      setAgentOk(true)
      setAgentMsg("에이전트가 이미 실행 중입니다. (http://127.0.0.1:3847)")
      try {
        const base = resolveLocalCompanionUrl().replace(/\/$/, "")
        const res = await fetch(`${base}/supertonic/prereq`, { cache: "no-store" })
        if (cancelled || !res.ok) return
        const json = (await res.json().catch(() => ({}))) as {
          python?: boolean
          pythonVersion?: string
          supertonic?: boolean
        }
        if (json.python) {
          setPythonOk(true)
          setPythonMsg(json.pythonVersion || "Python 확인됨")
        }
        if (json.supertonic) {
          setStOk(true)
          setStMsg("Supertonic이 이미 실행 중입니다.")
          setStep(5)
          onReady?.({ online: true, message: "이미 연결됨" })
          return
        }
        if (json.python) setStep(4)
        else setStep(3)
      } catch {
        setStep(3)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 1회
  }, [open])

  const verifyAgent = useCallback(async () => {
    setBusy(true)
    setAgentMsg("에이전트(3847) 확인 중…")
    try {
      if (!deployed) {
        setAgentOk(true)
        setAgentMsg("로컬 개발 환경 — 에이전트 생략 가능")
        setStep(4)
        return
      }
      let health = await probeLocalCompanion()
      if (!health.ok) {
        health = await connectLocalAgent({
          requireFfmpeg: false,
          forceLaunch: false,
          onProgress: (m) => setAgentMsg(m),
        })
      }
      if (health.ok) {
        setAgentOk(true)
        setAgentMsg(
          "연결됨 · Terminal에 Starting agent 가 보이면 정상입니다.\n그 Terminal 창은 닫지 마세요."
        )
        // Python 사전 확인
        try {
          const base = resolveLocalCompanionUrl().replace(/\/$/, "")
          const res = await fetch(`${base}/supertonic/prereq`, { cache: "no-store" })
          const json = (await res.json().catch(() => ({}))) as {
            python?: boolean
            pythonVersion?: string
            tip?: string
          }
          if (json.python) {
            setPythonOk(true)
            setPythonMsg(json.pythonVersion || "Python 확인됨")
            setStep(4)
          } else {
            setPythonOk(false)
            setPythonMsg(
              "에이전트는 OK지만 Python이 아직 안 보입니다.\n2단계로 돌아가 Python을 설치한 뒤, 에이전트 Terminal을 닫고 .command를 다시 실행하세요."
            )
            setStep(2)
          }
        } catch {
          setStep(4)
        }
      } else {
        setAgentOk(false)
        setAgentMsg(
          health.error ||
            `${filename} 를 더블클릭한 뒤, Terminal에 Found: …/node 가 보이면 「다시 확인」을 누르세요.`
        )
      }
    } finally {
      setBusy(false)
    }
  }, [deployed, filename])

  const installSupertonic = async () => {
    setBusy(true)
    setStMsg("Supertonic 3 설치·기동 중… (최초 1회는 수 분 걸릴 수 있습니다)")
    try {
      if (deployed && !agentOk) {
        await verifyAgent()
      }
      const ensured = await ensureSupertonicReady({
        onProgress: (s) => {
          if (s.message) setStMsg(s.message)
        },
      })
      if (ensured.online) {
        setStOk(true)
        setAgentOk(true)
        setPythonOk(true)
        setStMsg(ensured.message || "Supertonic 3 연결 완료")
        setStep(5)
        onReady?.({ online: true, message: ensured.message })
        return
      }
      if (ensured.error === "python_missing" || /Python/i.test(ensured.message || "")) {
        setPythonOk(false)
        setPythonMsg(
          ensured.message ||
            "Python이 필요합니다. 2단계에서 설치한 뒤 에이전트를 다시 켜세요."
        )
        setStMsg("Python 준비 후 다시 시도하세요.")
        setStep(2)
        return
      }
      if (/에이전트|3847|agent/i.test(ensured.message || ensured.error || "")) {
        setAgentOk(false)
        setAgentMsg(ensured.message || "에이전트가 필요합니다.")
        setStep(3)
        return
      }
      setStMsg(
        ensured.message ||
          ensured.error ||
          "설치에 실패했습니다. Terminal 창 오류와 인터넷을 확인한 뒤 다시 시도하세요."
      )
    } finally {
      setBusy(false)
    }
  }

  const downloadAgent = () => {
    downloadLocalAgentStarter()
    setAgentMsg(
      `「${filename}」를 받았습니다.\n` +
        "① Finder → 다운로드 폴더\n" +
        "② 파일을 더블클릭 (Terminal이 열림)\n" +
        "③ 「열 수 없음」이면 파일을 우클릭 → 열기 → 열기\n" +
        "④ Found: …/node · Starting agent 가 보이면 아래 「확인」"
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Terminal className="h-5 w-5 text-sky-400" />
            Mac 준비 가이드
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Windows와 달리 Mac은 아래 순서를 그대로 따라 주세요. 한 단계씩 진행합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 진행 표시 */}
        <ol className="mt-1 flex flex-wrap gap-1.5">
          {STEPS.map((s) => {
            const done =
              (s.id === 1 && step > 1) ||
              (s.id === 2 && (pythonOk || step > 2)) ||
              (s.id === 3 && agentOk) ||
              (s.id === 4 && stOk) ||
              (s.id === 5 && stOk)
            const current = step === s.id
            return (
              <li
                key={s.id}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                  current
                    ? "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40"
                    : done
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-white/5 text-zinc-500"
                }`}
              >
                {s.id}. {s.title}
              </li>
            )
          })}
        </ol>

        {failReason ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
            {failReason}
          </p>
        ) : null}

        {/* Step 1: Node */}
        {step === 1 ? (
          <section className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/35 p-4">
            <p className="text-sm font-bold text-white">1. Node.js 설치</p>
            <p className="text-[12px] leading-relaxed text-zinc-400">
              로컬 에이전트가 Node로 동작합니다. 이미 있으면 바로 다음으로 가도 됩니다.
            </p>
            <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-zinc-300">
              <li>
                방법 A:{" "}
                <button
                  type="button"
                  className="font-semibold text-sky-300 underline-offset-2 hover:underline"
                  onClick={() => window.open(NODE_URL, "_blank", "noopener,noreferrer")}
                >
                  nodejs.org
                </button>
                에서 LTS 설치
              </li>
              <li>
                방법 B (Homebrew): Terminal에{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">
                  {BREW_NODE}
                </code>
              </li>
              <li>설치 후 Terminal을 한 번 닫았다가 다시 여세요.</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="bg-sky-600 font-semibold text-white hover:bg-sky-500"
                onClick={() => window.open(NODE_URL, "_blank", "noopener,noreferrer")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Node.js 받기
                <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                onClick={() => setStep(2)}
              >
                설치했거나 이미 있음
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        ) : null}

        {/* Step 2: Python */}
        {step === 2 ? (
          <section className="mt-2 space-y-3 rounded-xl border border-white/10 bg-black/35 p-4">
            <p className="text-sm font-bold text-white">2. Python 3 설치</p>
            <p className="text-[12px] leading-relaxed text-zinc-400">
              Supertonic 엔진이 Python으로 돌아갑니다. 설치 후{" "}
              <span className="font-semibold text-amber-200">에이전트는 나중에 다시</span>{" "}
              켜야 PATH가 반영됩니다.
            </p>
            <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-zinc-300">
              <li>
                방법 A:{" "}
                <button
                  type="button"
                  className="font-semibold text-sky-300 underline-offset-2 hover:underline"
                  onClick={() => window.open(PYTHON_URL, "_blank", "noopener,noreferrer")}
                >
                  python.org
                </button>
                에서 macOS용 설치
              </li>
              <li>
                방법 B:{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">
                  {BREW_PYTHON}
                </code>
              </li>
              <li>
                Terminal에서{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-amber-100">
                  python3 --version
                </code>{" "}
                이 보이면 OK
              </li>
            </ul>
            {pythonMsg ? (
              <p
                className={`whitespace-pre-line text-[11px] leading-relaxed ${
                  pythonOk ? "text-emerald-300" : "text-amber-100"
                }`}
              >
                {pythonMsg}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                이전
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-sky-600 font-semibold text-white hover:bg-sky-500"
                onClick={() => window.open(PYTHON_URL, "_blank", "noopener,noreferrer")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Python 받기
                <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                onClick={() => {
                  setPythonOk(true)
                  setStep(3)
                }}
              >
                설치했거나 이미 있음
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        ) : null}

        {/* Step 3: Agent */}
        {step === 3 ? (
          <section className="mt-2 space-y-3 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
            <p className="text-sm font-bold text-white">3. 로컬 에이전트 실행</p>
            <p className="text-[12px] leading-relaxed text-zinc-400">
              Chrome은 Mac에서 실행 파일을 자동으로 켤 수 없습니다.{" "}
              <span className="font-semibold text-amber-100">직접 더블클릭</span>해야
              합니다.
            </p>
            <ol className="list-decimal space-y-2 pl-4 text-[11px] leading-relaxed text-zinc-300">
              <li>
                아래 버튼으로{" "}
                <code className="rounded bg-white/10 px-1 text-amber-100">{filename}</code>{" "}
                받기
              </li>
              <li>Finder → 다운로드에서 파일 더블클릭 → Terminal 창이 열림</li>
              <li>
                「개발자를 확인할 수 없습니다」→ 파일{" "}
                <span className="font-semibold text-amber-100">우클릭 → 열기 → 열기</span>
              </li>
              <li>
                창에 <span className="text-emerald-300">Found: …/node</span> 와{" "}
                <span className="text-emerald-300">Starting agent</span> 확인
              </li>
              <li>그 Terminal 창은 끄지 말고, 아래 「확인」 누르기</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                이전
              </Button>
              {deployed ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-500 font-semibold text-zinc-900 hover:bg-amber-400"
                  onClick={downloadAgent}
                >
                  <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                  {filename} 받기
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                onClick={() => void verifyAgent()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                켰어요 · 확인
              </Button>
            </div>
            {agentMsg ? (
              <p
                className={`whitespace-pre-line text-[11px] leading-relaxed ${
                  agentOk ? "text-emerald-300" : "text-amber-100"
                }`}
              >
                {agentMsg}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Step 4: Supertonic */}
        {step === 4 ? (
          <section className="mt-2 space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <p className="text-sm font-bold text-white">4. Supertonic 설치·기동</p>
            <p className="text-[12px] leading-relaxed text-zinc-400">
              에이전트 Terminal이 열린 상태에서 버튼을 누르면, 이 Mac에 Supertonic 3을
              설치하고 서버를 켭니다.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-zinc-400">
              <li>최초 1회: pip·모델 다운로드로 수 분 걸릴 수 있습니다.</li>
              <li>에이전트 Terminal 창은 계속 켜 두세요.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setStep(3)}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                이전
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || stOk}
                className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                onClick={() => void installSupertonic()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {stOk ? "설치 완료" : "Supertonic 설치·기동"}
              </Button>
            </div>
            {stMsg ? (
              <p
                className={`whitespace-pre-line text-[11px] leading-relaxed ${
                  stOk ? "text-emerald-300" : "text-amber-100"
                }`}
              >
                {stMsg}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Step 5: Done */}
        {step === 5 ? (
          <section className="mt-2 space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <p className="text-sm font-bold text-white">5. 준비 완료</p>
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-300">
              Supertonic이 연결되었습니다. 이제 Wings에서 음성을 생성할 수 있습니다.
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Terminal에 에이전트가 떠 있는 동안만 동작합니다. PC를 재시작하거나 창을
              닫으면 이 가이드의 3단계부터 다시 하면 됩니다.
            </p>
            {stMsg ? (
              <p className="text-[11px] text-emerald-300">{stMsg}</p>
            ) : null}
            <Button
              type="button"
              className="w-full bg-sky-600 font-semibold text-white hover:bg-sky-500"
              onClick={() => onOpenChange(false)}
            >
              완료 · 닫기
            </Button>
          </section>
        ) : null}

        {step !== 5 ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              나중에
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
