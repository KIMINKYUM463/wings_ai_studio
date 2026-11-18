"use client"

import { useEffect, useRef, useState } from "react"

/** 윙즈 Flow 도우미 확장(extensions/wings-flow-helper)과 window.postMessage 로 주고받는다. */
type Props = {
  sceneIndex: number
  imageUrl?: string
  prompt: string
  onVideo: (sceneIndex: number, file: File) => void
}

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function FlowExtensionBridge({ sceneIndex, imageUrl, prompt, onVideo }: Props) {
  const [installed, setInstalled] = useState(false)
  const [status, setStatus] = useState("")
  const sentJobs = useRef(new Set<string>())
  const onVideoRef = useRef(onVideo)
  onVideoRef.current = onVideo

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      const data = event.data
      if (!data || data.source !== "wings-flow-helper") return
      if (data.type === "hello") setInstalled(true)
      else if (data.type === "job-accepted") setStatus("Flow 탭을 열었어요. 확장 패널에서 'Flow에 넣기'를 눌러 주세요.")
      else if (data.type === "job-error") setStatus(`확장 오류: ${data.error || "알 수 없음"}`)
      else if (data.type === "video-result") {
        // 이 화면에서 보낸 작업의 결과만 받는다
        if (!sentJobs.current.has(data.jobId) || !(data.videoBuffer instanceof ArrayBuffer)) return
        const mime = typeof data.mime === "string" && data.mime.startsWith("video/") ? data.mime : "video/mp4"
        const file = new File([data.videoBuffer], `flow_scene_${data.sceneIndex + 1}.mp4`, { type: mime })
        onVideoRef.current(Number(data.sceneIndex), file)
        setStatus(`장면 ${Number(data.sceneIndex) + 1}에 Flow 영상을 붙였어요.`)
      }
    }
    window.addEventListener("message", onMessage)
    window.postMessage({ source: "wings-app", type: "ping" }, window.location.origin)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  const send = async () => {
    if (!imageUrl) return
    const jobId = `flow_${Date.now()}_${sceneIndex}`
    setStatus("이미지 준비 중…")
    let imageDataUrl = ""
    try {
      imageDataUrl = await toDataUrl(imageUrl)
    } catch {
      // CORS 등으로 못 읽으면 주소만 넘긴다
    }
    sentJobs.current.add(jobId)
    window.postMessage(
      {
        source: "wings-app",
        type: "flow-job",
        job: { jobId, sceneIndex, imageDataUrl, imageUrl: imageDataUrl ? "" : imageUrl, prompt, aspect: "9:16" },
      },
      window.location.origin
    )
    setStatus("확장으로 보냈어요…")
  }

  if (!installed) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-[#e3e6ec] bg-[#ffffff] p-3 text-[12px] text-[#5c6170]">
        <p className="font-semibold text-[#0e1016]">확장 프로그램 설치 방법</p>
        <p className="mt-1">
          chrome://extensions → 개발자 모드 → 압축해제된 확장 프로그램 로드 →{" "}
          <code className="rounded bg-[#f5f6fa] px-1">extensions/wings-flow-helper</code> 폴더 선택 후 이 페이지를 새로고침하세요.
          (안내: extensions/wings-flow-helper/README.md)
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#e3e6ec] bg-[#ffffff] p-3 text-[12px]">
      <span className="rounded-full bg-[#eef0fb] px-2 py-0.5 text-[11px] font-bold text-[#2f3beb]">Flow 확장 연결됨</span>
      <button
        type="button"
        disabled={!imageUrl}
        onClick={() => void send()}
        className="rounded-lg bg-[#2f3beb] px-2.5 py-1 font-semibold text-[#ffffff] hover:bg-[#4350ff] disabled:opacity-40"
      >
        Flow 확장으로 보내기
      </button>
      {status ? <p className="w-full text-[#5c6170]" aria-live="polite">{status}</p> : null}
    </div>
  )
}
