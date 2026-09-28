"use client"

import { useEffect, useState } from "react"
import type { LongformV2Project } from "@/lib/longform-v2/project-storage"
import { useTitleDesc } from "./useTitleDesc"
import { ThumbnailTemplateStudioModal } from "../thumbnail-studio/ThumbnailTemplateStudioModal"

type Props = {
  project: LongformV2Project
  onPatch: (partial: Partial<LongformV2Project>) => void
  onNotify?: (message: string, kind?: "info" | "error") => void
  onBackToProduction: () => void
}

type SubStep = "title" | "thumb"

/**
 * WingsStudio YoutubeUploadPanel 대응 —
 * 좌측 03 · 썸네일 · 제목/설명 생성
 */
export function YoutubeMetaPanel({ project, onPatch, onNotify, onBackToProduction }: Props) {
  const [sub, setSub] = useState<SubStep>("title")
  const [thumbOpen, setThumbOpen] = useState(false)

  // mediaApi.saveProjectThumbnail → 프로젝트 저장 훅
  useEffect(() => {
    if (!thumbOpen) return
    const g = globalThis as unknown as { __lfv2SaveThumbnail?: (url: string) => void }
    g.__lfv2SaveThumbnail = (url: string) => {
      onPatch({ thumbnailUrl: url })
      onNotify?.("썸네일을 프로젝트에 저장했습니다.", "info")
    }
    return () => {
      delete g.__lfv2SaveThumbnail
    }
  }, [thumbOpen, onPatch, onNotify])

  const titleDesc = useTitleDesc({
    script: project.scriptText || "",
    onInfo: (msg) => onNotify?.(msg, "info"),
    onError: (msg) => {
      if (msg) onNotify?.(msg, "error")
    },
    onSaveMeta: (payload) => onPatch(payload),
  })

  const hasScript = Boolean(project.scriptText?.trim())
  const savedTitle = project.youtubeTitle?.trim() || ""
  const savedDesc = project.youtubeDescription?.trim() || ""
  const thumbUrl = project.thumbnailUrl?.trim() || ""

  return (
    <div className="lfv2-yt-meta">
      <header className="lfv2-yt-meta__head">
        <div>
          <h2 className="lfv2-yt-meta__h1">썸네일 · 제목/설명 생성</h2>
          <p className="lfv2-yt-meta__sub">
            대본으로 유튜브 제목·설명·태그를 만들고, CTR 패키지로 썸네일을 준비합니다.
          </p>
        </div>
        <button type="button" className="v2sw-btn v2sw-btn--secondary" onClick={onBackToProduction}>
          ← 02 장면으로
        </button>
      </header>

      <nav className="lfv2-yt-meta__steps" aria-label="생성 단계">
        <button
          type="button"
          className={"lfv2-yt-meta__pill" + (sub === "title" ? " lfv2-yt-meta__pill--on" : "")}
          onClick={() => setSub("title")}
        >
          <span className="lfv2-yt-meta__pill-icon" aria-hidden>
            ✨
          </span>
          <span>
            <strong>제목/설명</strong>
            <em>자동 생성</em>
          </span>
        </button>
        <button
          type="button"
          className={"lfv2-yt-meta__pill" + (sub === "thumb" ? " lfv2-yt-meta__pill--on" : "")}
          onClick={() => setSub("thumb")}
        >
          <span className="lfv2-yt-meta__pill-icon" aria-hidden>
            🖼
          </span>
          <span>
            <strong>썸네일</strong>
            <em>CTR 생성</em>
          </span>
        </button>
      </nav>

      {!hasScript ? (
        <p className="lfv2-yt-meta__warn">
          저장된 대본이 없습니다. 01 · AI대본에서 대본을 만든 뒤 다시 오세요.
        </p>
      ) : null}

      {sub === "title" ? (
        <section className="lfv2-yt-meta__card">
          <div className="lfv2-yt-meta__card-head">
            <span className="lfv2-yt-meta__badge">1단계</span>
            <h3>제목 · 설명 · 태그</h3>
          </div>
          <p className="lfv2-yt-meta__muted">
            Gemini가 대본을 참고해 제목 후보를 만듭니다. 카드를 누르면 설명·해시태그·업로드 태그가
            채워지고 프로젝트에 저장됩니다.
          </p>
          <div className="lfv2-yt-meta__actions">
            <button
              type="button"
              className="dm-btn dm-btn--accent"
              disabled={!hasScript || titleDesc.busy}
              onClick={() => {
                if (titleDesc.items.length > 0) titleDesc.openModal()
                else titleDesc.startGenerate()
              }}
            >
              {titleDesc.busy
                ? "생성 중…"
                : titleDesc.items.length > 0
                  ? "✨ 제목/설명 다시 열기"
                  : "✨ 제목/설명 생성"}
            </button>
          </div>

          {savedTitle ? (
            <div className="lfv2-yt-meta__saved">
              <h4>저장된 업로드 메타</h4>
              <p className="lfv2-yt-meta__saved-title">{savedTitle}</p>
              {savedDesc ? (
                <pre className="lfv2-yt-meta__saved-desc">{savedDesc.slice(0, 800)}{savedDesc.length > 800 ? "…" : ""}</pre>
              ) : null}
              {project.youtubeHashtags ? (
                <p className="lfv2-yt-meta__saved-tags">{project.youtubeHashtags}</p>
              ) : null}
              {project.youtubeUploadTags?.length ? (
                <p className="lfv2-yt-meta__saved-tags">
                  업로드 태그: {project.youtubeUploadTags.join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="lfv2-yt-meta__muted">아직 저장된 제목·설명이 없습니다.</p>
          )}
        </section>
      ) : null}

      {sub === "thumb" ? (
        <section className="lfv2-yt-meta__card">
          <div className="lfv2-yt-meta__card-head">
            <span className="lfv2-yt-meta__badge">2단계</span>
            <h3>썸네일</h3>
          </div>
          <p className="lfv2-yt-meta__muted">
            Wings Studio와 동일한 썸네일 편집기(템플릿·레이어·텍스트·AI)를 엽니다.
          </p>
          <div className="lfv2-yt-meta__actions">
            <button
              type="button"
              className="dm-btn dm-btn--accent"
              disabled={!hasScript}
              onClick={() => setThumbOpen(true)}
            >
              🖼 썸네일 편집기 열기
            </button>
          </div>
          {thumbUrl ? (
            <div className="lfv2-yt-meta__thumb-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="저장된 썸네일" />
              <p className="lfv2-yt-meta__muted">프로젝트에 저장된 썸네일</p>
            </div>
          ) : (
            <p className="lfv2-yt-meta__muted">아직 저장된 썸네일이 없습니다.</p>
          )}
        </section>
      ) : null}

      {titleDesc.TitleDescModalEl}

      <ThumbnailTemplateStudioModal
        open={thumbOpen}
        onClose={() => setThumbOpen(false)}
        projectId={project.id}
        script={project.scriptText || ""}
        topic={project.topicDirection || project.title}
        titleHint={project.youtubeTitle || project.title}
        downloadFileBaseName={project.title || "thumbnail"}
        onSaved={(url) => {
          onPatch({ thumbnailUrl: url })
          onNotify?.("썸네일을 프로젝트에 저장했습니다.", "info")
        }}
      />
    </div>
  )
}
