"use client"

import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import {
  Check,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Volume2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_STORY_FRAME_SETTINGS,
  STORY_FRAME_TEMPLATES,
  StoryChannelFrame,
} from "./StoryChannelFrame"
import type {
  StoryFrameSettings,
  StoryFrameTemplateId,
  StoryShoppingBrief,
} from "./story-types"

export function StoryTemplateSelectionPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
}) {
  const scenes = brief.generatedStory?.scenes || []
  const [selectedSceneId, setSelectedSceneId] = useState(scenes[0]?.id || "")
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isRecommendingTitles, setIsRecommendingTitles] = useState(false)
  const [titleError, setTitleError] = useState("")
  const settings: StoryFrameSettings = {
    ...DEFAULT_STORY_FRAME_SETTINGS,
    videoTitle: brief.generatedStory?.title || DEFAULT_STORY_FRAME_SETTINGS.videoTitle,
    ...brief.frameSettings,
  }
  const selectedScene =
    scenes.find((scene) => scene.id === selectedSceneId) || scenes[0]
  const selectedAsset = brief.sceneAssets?.find(
    (asset) => asset.sceneId === selectedScene?.id
  )
  const selectedTrack = brief.voiceData?.tracks.find(
    (track) => track.sceneId === selectedScene?.id
  )
  const selectedTemplate =
    STORY_FRAME_TEMPLATES.find((template) => template.id === settings.templateId) ||
    STORY_FRAME_TEMPLATES[0]

  const patchSettings = (patch: Partial<StoryFrameSettings>) => {
    onChange((current) => ({
      ...current,
      frameSettings: {
        ...DEFAULT_STORY_FRAME_SETTINGS,
        videoTitle:
          current.generatedStory?.title || DEFAULT_STORY_FRAME_SETTINGS.videoTitle,
        ...current.frameSettings,
        ...patch,
      },
    }))
  }

  const recommendTitles = async () => {
    if (!brief.generatedStory) return
    setIsRecommendingTitles(true)
    setTitleError("")
    try {
      const response = await fetch(
        "/api/shotform/story-shopping/recommend-frame-titles",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: brief.productName,
            templateName: brief.generatedStory.templateName,
            hook: brief.generatedStory.hook,
            script: brief.generatedStory.script,
            apiKey:
              typeof window !== "undefined"
                ? localStorage.getItem("shotform_openai_api_key") || undefined
                : undefined,
          }),
        }
      )
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "후킹 제목 추천에 실패했습니다.")
      patchSettings({ titleSuggestions: payload.titles || [] })
    } catch (reason) {
      setTitleError(
        reason instanceof Error ? reason.message : "후킹 제목 추천에 실패했습니다."
      )
    } finally {
      setIsRecommendingTitles(false)
    }
  }

  if (!selectedScene) {
    return (
      <div className="rounded-[28px] border border-dashed border-white/15 py-24 text-center text-zinc-400">
        스토리 대본을 먼저 생성해주세요.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-amber-400/20 bg-[#0d0c09] p-5 md:p-6">
        <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-amber-300">
          <LayoutTemplate className="h-4 w-4" />
          STORY CHANNEL TEMPLATE
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">이야기 채널 화면을 먼저 정하세요.</h2>
        <p className="mt-2 text-xs leading-6 text-zinc-400">
          선택한 디자인이 모든 장면에 공통 적용되고, 장면별 대본·TTS·이미지·영상은
          같은 장면 ID로 자동 연결됩니다.
        </p>

        <button
          type="button"
          onClick={() => setIsTemplateDialogOpen(true)}
          className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-amber-300/40 bg-amber-500/[0.08] p-4 text-left transition hover:border-amber-200/70 hover:bg-amber-500/[0.12]"
        >
          <span
            className="h-10 w-10 shrink-0 rounded-xl border border-white/15"
            style={{ backgroundColor: selectedTemplate.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-black tracking-[0.15em] text-amber-300">
              현재 선택
            </span>
            <span className="mt-1 block text-sm font-black text-white">
              {selectedTemplate.name}
            </span>
            <span className="mt-1 block truncate text-[10px] text-zinc-400">
              {selectedTemplate.description}
            </span>
          </span>
          <span className="shrink-0 rounded-xl bg-amber-300 px-4 py-2 text-[10px] font-black text-amber-950">
            템플릿 선택
          </span>
        </button>

        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-h-[94vh] w-[96vw] max-w-[1400px] overflow-y-auto border-white/15 bg-[#0b0a08] p-7 text-white sm:max-w-[min(96vw,1400px)]">
            <DialogHeader>
              <DialogTitle className="text-2xl">이야기 채널 템플릿 선택</DialogTitle>
              <DialogDescription className="text-sm text-zinc-400">
                선택한 디자인은 모든 장면에 공통으로 적용됩니다.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {STORY_FRAME_TEMPLATES.map((template) => {
                const active = settings.templateId === template.id
                const previewSettings = { ...settings, templateId: template.id }
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      patchSettings({
                        templateId: template.id as StoryFrameTemplateId,
                      })
                      setIsTemplateDialogOpen(false)
                    }}
                    className={`group rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-amber-300/70 bg-amber-500/10 shadow-[0_0_28px_rgba(251,191,36,.1)]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl">
                      <StoryChannelFrame
                        settings={previewSettings}
                        scene={selectedScene}
                        asset={selectedAsset}
                        fallbackMediaUrl={brief.productImage}
                      />
                      {active ? (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-300 p-1.5 text-amber-950 shadow-lg">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-white">{template.name}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {template.description}
                        </p>
                      </div>
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-white/20"
                        style={{ backgroundColor: template.color }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </section>

      <section className="grid gap-5 rounded-[28px] border border-white/10 bg-[#0c0c0b] p-5 xl:grid-cols-[380px_1fr]">
        <div>
          <p className="text-[9px] font-black tracking-[0.18em] text-amber-300">
            LIVE TEMPLATE PREVIEW
          </p>
          <div className="mx-auto mt-4 max-w-[340px] overflow-hidden rounded-[24px] border border-white/10">
            <StoryChannelFrame
              settings={settings}
              scene={selectedScene}
              asset={selectedAsset}
              fallbackMediaUrl={brief.productImage}
            />
          </div>
          {selectedTrack ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-cyan-200">
                <Volume2 className="h-4 w-4" />
                장면 {selectedScene.order} TTS
              </div>
              <div className="space-y-2">
                <audio controls src={selectedTrack.audioUrl} className="h-8 w-full" />
                <p className="text-[9px] text-cyan-100/50">장면 통 TTS · 자막 단위만 표시</p>
                {(selectedTrack.lineTracks?.length
                  ? selectedTrack.lineTracks
                  : [{ lineIndex: 0, text: selectedScene.narration }]
                ).map((lineTrack) => (
                  <div key={`${selectedTrack.sceneId}-${lineTrack.lineIndex}`}>
                    <p className="text-[9px] text-cyan-100/70">
                      자막 {lineTrack.lineIndex + 1} · {lineTrack.text}
                    </p>
                    {lineTrack.audioUrl && lineTrack.audioUrl !== selectedTrack.audioUrl ? (
                      <audio controls src={lineTrack.audioUrl} className="mt-1 h-8 w-full" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 py-3 text-center text-[10px] text-zinc-500">
              이 장면의 TTS가 아직 생성되지 않았습니다.
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-black text-white">채널 정보 설정</h3>
          <p className="mt-1 text-[10px] leading-5 text-zinc-500">
            입력한 정보는 모든 장면 상단에 동일하게 표시됩니다.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="채널명">
              <Input
                value={settings.channelName}
                onChange={(event) => patchSettings({ channelName: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
            <Field label="영상 제목">
              <Input
                value={settings.videoTitle}
                onChange={(event) => patchSettings({ videoTitle: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
            <Field label="작성자 표시">
              <Input
                value={settings.authorLabel}
                onChange={(event) => patchSettings({ authorLabel: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
            <Field label="조회수 표시">
              <Input
                value={settings.viewCountLabel}
                onChange={(event) => patchSettings({ viewCountLabel: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
            <Field label="좋아요 표시">
              <Input
                value={settings.likeCountLabel}
                onChange={(event) => patchSettings({ likeCountLabel: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
            <Field label="댓글 표시">
              <Input
                value={settings.commentCountLabel}
                onChange={(event) => patchSettings({ commentCountLabel: event.target.value })}
                className="border-white/10 bg-black/25 text-white"
              />
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.05] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.14em] text-fuchsia-300">
                  <Sparkles className="h-4 w-4" />
                  AI HOOK TITLE
                </div>
                <p className="mt-1 text-xs font-black text-white">
                  대본을 분석해 클릭을 부르는 제목을 추천합니다.
                </p>
              </div>
              <Button
                type="button"
                onClick={recommendTitles}
                disabled={isRecommendingTitles}
                className="bg-fuchsia-500 font-black text-white hover:bg-fuchsia-400"
              >
                {isRecommendingTitles ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {settings.titleSuggestions?.length
                  ? "제목 다시 추천"
                  : "후킹 제목 추천"}
              </Button>
            </div>
            {titleError ? (
              <p className="mt-3 text-[10px] text-red-300">{titleError}</p>
            ) : null}
            {settings.titleSuggestions?.length ? (
              <div className="mt-4 grid gap-2">
                {settings.titleSuggestions.map((title, index) => {
                  const selected = settings.videoTitle === title
                  return (
                    <button
                      key={`${title}-${index}`}
                      type="button"
                      onClick={() => patchSettings({ videoTitle: title })}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-fuchsia-300/60 bg-fuchsia-500/15"
                          : "border-white/10 bg-black/20 hover:border-fuchsia-300/30"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-[10px] font-black text-fuchsia-200">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-xs font-bold text-zinc-100">
                        {title}
                      </span>
                      {selected ? (
                        <Check className="h-4 w-4 text-fuchsia-300" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <Label className="text-xs font-bold text-zinc-200">장면별 연결 확인</Label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {scenes.map((scene) => {
                const asset = brief.sceneAssets?.find((item) => item.sceneId === scene.id)
                const track = brief.voiceData?.tracks.find((item) => item.sceneId === scene.id)
                const active = scene.id === selectedScene.id
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-amber-300/50 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-amber-200">
                        SCENE {scene.order}
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        대본 ✓ · TTS {track ? "✓" : "—"} · 소재 {asset ? "✓" : "—"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-zinc-400">
                      {scene.narration}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-zinc-400">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  )
}
