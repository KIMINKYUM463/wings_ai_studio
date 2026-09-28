export type SceneGenTask = "prompt" | "image" | "tts" | "video" | "motionVideo"

const LABELS: Record<SceneGenTask, string> = {
  prompt: "프롬프트 생성 중",
  image: "이미지(영상) 생성 중",
  tts: "TTS 생성 중",
  video: "최종영상 생성 중",
  motionVideo: "AI 영상 생성 중",
}

const HINTS: Record<SceneGenTask, string> = {
  prompt: "대본 분석 · 스토리보드 · 영어 프롬프트 작성",
  image: "AI 이미지 · Pexels 스톡 · 업로드",
  tts: "음성 합성 중",
  video: "이미지(영상) 소스와 TTS를 최종 mp4로 합성 중",
  motionVideo: "Seedance AI 움직임 영상 생성",
}

type Props = {
  task: SceneGenTask
  label?: string
  hint?: string
  /** 미디어 셀(16:9) vs 블록(프롬프트/TTS) */
  variant?: "panel" | "media"
}

/** WingsStudio DetailSceneGenerating 과 동일한 오비털 로딩 패널 */
export function SceneGenerating({ task, label, hint, variant = "panel" }: Props) {
  const cssTask = task === "motionVideo" ? "motionVideo" : task
  return (
    <div
      className={`dm-gen-panel dm-gen-panel--${cssTask} dm-gen-panel--${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="dm-gen-panel__shimmer" aria-hidden />
      <div className="dm-gen-panel__body">
        <div className="dm-gen-panel__orb" aria-hidden>
          <span className="dm-gen-panel__ring" />
          <span className="dm-gen-panel__ring dm-gen-panel__ring--delay" />
          <span className="dm-gen-panel__core" />
        </div>
        <div className="dm-gen-panel__copy">
          <span className="dm-gen-panel__label">{label ?? LABELS[task]}</span>
          <span className="dm-gen-panel__hint">{hint ?? HINTS[task]}</span>
          <span className="dm-gen-panel__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  )
}
