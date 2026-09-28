"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import "./longform-v2.css"
import { ApiKeyStatusCard, LongformV2ApiSettingsModal } from "./ApiSettingsModal"
import { loadApiKeys, type LongformV2ApiKeys } from "@/lib/longform-v2/api-keys"
import {
  createProject,
  deleteProject,
  listProjects,
  migrateLegacySingleProject,
  type ProjectListItem,
} from "@/lib/longform-v2/project-storage"

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch {
    return iso
  }
}

export default function LongformV2ProjectsPage() {
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<LongformV2ApiKeys>(loadApiKeys())

  const refresh = () => setProjects(listProjects())

  useEffect(() => {
    migrateLegacySingleProject()
    refresh()
    setApiKeys(loadApiKeys())
    setHydrated(true)
  }, [])

  const handleCreate = () => {
    const p = createProject(newTitle)
    setNewOpen(false)
    setNewTitle("")
    refresh()
    router.push(`/WingsAIStudio/longform-v2/${p.id}`)
  }

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`「${title}」 프로젝트를 삭제할까요?`)) return
    deleteProject(id)
    refresh()
  }

  if (!hydrated) {
    return (
      <div className="lfv2-list-app" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="lfv2-spin" style={{ margin: "40vh auto" }} />
      </div>
    )
  }

  return (
    <div className="lfv2-list-app">
      <header className="lfv2-list-top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="lfv2-brand__mark">W</div>
          <div>
            <div className="lfv2-brand__text">신규 롱폼</div>
            <div className="lfv2-brand__sub">WingsStudio v2 · 웹</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm" onClick={() => router.push("/WingsAIStudio")}>
            ← 홈
          </button>
          <button type="button" className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm" onClick={() => setSettingsOpen(true)}>
            API 키 설정
          </button>
          <button type="button" className="lfv2-btn lfv2-btn--primary lfv2-btn--sm" onClick={() => setNewOpen(true)}>
            + 새 프로젝트
          </button>
        </div>
      </header>

      <div className="lfv2-list-body">
        <div className="lfv2-list-head">
          <div>
            <h1>프로젝트</h1>
            <p>프로젝트를 만든 뒤 AI 대본 기획 · 음성·이미지 생성을 진행합니다.</p>
          </div>
          <button type="button" className="lfv2-btn lfv2-btn--primary" onClick={() => setNewOpen(true)}>
            + 새 프로젝트
          </button>
        </div>

        <div style={{ marginBottom: 18, maxWidth: 420 }}>
          <ApiKeyStatusCard keys={apiKeys} />
        </div>

        {projects.length === 0 ? (
          <div className="lfv2-empty">
            <p className="lfv2-empty__title">아직 프로젝트가 없습니다</p>
            <p className="lfv2-empty__hint">
              <strong>새 프로젝트</strong>로 이름을 정해 시작하면,
              <br />
              AI대본 기획 → AI 음성·이미지 생성 순서로 작업합니다.
            </p>
            <button type="button" className="lfv2-btn lfv2-btn--primary" onClick={() => setNewOpen(true)}>
              새 프로젝트
            </button>
          </div>
        ) : (
          <div className="lfv2-project-grid">
            {projects.map((p) => (
              <div key={p.id} className="lfv2-project-card">
                <h2 className="lfv2-project-card__title">{p.title}</h2>
                <p className="lfv2-project-card__meta">수정 {formatDate(p.updatedAt)}</p>
                <div className="lfv2-project-card__badges">
                  <span className={"lfv2-pill" + (p.hasScript ? " lfv2-pill--ok" : "")}>
                    대본 {p.hasScript ? "✓" : "—"}
                  </span>
                  <span className={"lfv2-pill" + (p.hasTTS ? " lfv2-pill--ok" : "")}>
                    음성 {p.hasTTS ? "✓" : "—"}
                  </span>
                  <span className={"lfv2-pill" + (p.hasImages ? " lfv2-pill--ok" : "")}>
                    이미지 {p.hasImages ? "✓" : "—"}
                  </span>
                </div>
                <div className="lfv2-project-card__actions">
                  <button
                    type="button"
                    className="lfv2-btn lfv2-btn--primary lfv2-btn--sm"
                    onClick={() => router.push(`/WingsAIStudio/longform-v2/${p.id}`)}
                  >
                    열기
                  </button>
                  <button
                    type="button"
                    className="lfv2-btn lfv2-btn--secondary lfv2-btn--sm"
                    onClick={() => handleDelete(p.id, p.title)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {newOpen && (
        <div
          className="wnp-root"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewOpen(false)
          }}
        >
          <div className="wnp-card" role="dialog" aria-modal="true">
            <p className="wnp-eyebrow">Create</p>
            <h2 className="wnp-title">새 프로젝트 만들기</h2>
            <p className="wnp-lead">이름을 정하면 바로 작업 화면으로 이동합니다.</p>
            <form
              className="wnp-form"
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate()
              }}
            >
              <label className="wnp-label" htmlFor="wnp-name">
                프로젝트 이름
              </label>
              <input
                id="wnp-name"
                className="wnp-input"
                placeholder="프로젝트 이름을 입력하세요"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                maxLength={120}
                autoComplete="off"
              />
              <div className="wnp-actions">
                <button type="button" className="wnp-btn wnp-btn--ghost" onClick={() => setNewOpen(false)}>
                  취소
                </button>
                <button type="submit" className="wnp-btn wnp-btn--primary">
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LongformV2ApiSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(keys) => setApiKeys(keys)}
      />
    </div>
  )
}
