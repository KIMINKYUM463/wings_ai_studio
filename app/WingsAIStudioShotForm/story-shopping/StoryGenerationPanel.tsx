"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRightLeft,
  BrainCircuit,
  BadgeCheck,
  Check,
  CircleSlash,
  Clock,
  Dices,
  Factory,
  Flag,
  FlaskConical,
  Flame,
  Gift,
  Globe,
  GraduationCap,
  HeartHandshake,
  LifeBuoy,
  Lightbulb,
  Loader2,
  Megaphone,
  MessageSquareQuote,
  Rocket,
  RotateCcw,
  Scale,
  ScanSearch,
  Search,
  Siren,
  Smartphone,
  Sparkles,
  Swords,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  STORY_SCRIPT_TEMPLATES,
  STORY_SCRIPT_TEMPLATE_IDS,
  type StoryScriptTemplateGroup,
} from "./story-script-catalog"
import {
  type StoryGeneratedScript,
  type StoryNarrationStyle,
  type StoryScriptTemplateId,
  type StoryShoppingBrief,
} from "./story-types"
import { DEFAULT_STORY_FRAME_SETTINGS } from "./StoryChannelFrame"
import {
  DEFAULT_STORY_NARRATION_STYLE,
  storyTargetCharacters,
  storyTargetSceneCount,
} from "./story-script-pace"

const NARRATION_STYLES: Array<{ id: StoryNarrationStyle; label: string; hint: string }> = [
  { id: "ssul", label: "썰 채널형", hint: "~했음·~버림 빠른 음슴체 (선물가게·신사들 스타일)" },
  { id: "polite", label: "존댓말형", hint: "~했어요 차분한 구어체" },
]

/** 참고 영상 자막은 문체·구조 참고용 — 실패해도 대본 생성은 계속 */
async function fetchReferenceTranscript(videoId?: string) {
  if (!videoId) return ""
  try {
    const response = await fetch("/api/youmaker/get-video-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    })
    const data = await response.json()
    return String(data.transcript || "")
  } catch {
    return ""
  }
}

const TEMPLATE_VISUALS: Record<StoryScriptTemplateId, { icon: typeof Flame; accent: string }> = {
  origin: { icon: Flame, accent: "from-orange-500/20 to-amber-500/5" },
  inventor: { icon: Lightbulb, accent: "from-yellow-400/20 to-lime-500/5" },
  competition: { icon: Swords, accent: "from-red-500/20 to-orange-500/5" },
  "unexpected-use": { icon: Sparkles, accent: "from-cyan-500/20 to-blue-500/5" },
  "hidden-truth": { icon: Search, accent: "from-violet-500/20 to-fuchsia-500/5" },
  "heartwarming-true": { icon: HeartHandshake, accent: "from-pink-500/20 to-rose-500/5" },
  "review-twist": { icon: MessageSquareQuote, accent: "from-emerald-500/20 to-teal-500/5" },
  "problem-solution": { icon: Wrench, accent: "from-blue-500/20 to-cyan-500/5" },
  "before-after": { icon: ArrowRightLeft, accent: "from-teal-500/20 to-emerald-500/5" },
  "challenge-test": { icon: FlaskConical, accent: "from-indigo-500/20 to-blue-500/5" },
  "mistake-warning": { icon: AlertTriangle, accent: "from-amber-500/20 to-red-500/5" },
  "expert-tip": { icon: GraduationCap, accent: "from-sky-500/20 to-violet-500/5" },
  comparison: { icon: Scale, accent: "from-slate-400/20 to-blue-500/5" },
  "time-saving": { icon: Clock, accent: "from-lime-500/20 to-green-500/5" },
  "gift-reaction": { icon: Gift, accent: "from-rose-500/20 to-pink-500/5" },
  "trend-discovery": { icon: TrendingUp, accent: "from-fuchsia-500/20 to-purple-500/5" },
  "underdog-comeback": { icon: Rocket, accent: "from-orange-500/25 to-yellow-500/5" },
  "consumer-revolt": { icon: Megaphone, accent: "from-red-500/25 to-rose-500/5" },
  "maker-panic": { icon: Factory, accent: "from-sky-500/25 to-cyan-500/5" },
  "foreigner-reaction": { icon: Globe, accent: "from-emerald-500/25 to-sky-500/5" },
  "country-gap": { icon: Flag, accent: "from-indigo-500/25 to-red-500/5" },
  "viral-to-product": { icon: Smartphone, accent: "from-fuchsia-500/25 to-pink-500/5" },
  "accident-hit": { icon: Dices, accent: "from-amber-500/25 to-lime-500/5" },
  "rescue-story": { icon: LifeBuoy, accent: "from-teal-500/25 to-emerald-500/5" },
  "habit-breaker": { icon: CircleSlash, accent: "from-violet-500/25 to-indigo-500/5" },
  "quiet-change": { icon: ScanSearch, accent: "from-slate-400/25 to-sky-500/5" },
  "controversy-flip": { icon: Siren, accent: "from-red-600/25 to-amber-500/5" },
}

const TEMPLATES = STORY_SCRIPT_TEMPLATE_IDS.map((id) => ({
  id,
  ...STORY_SCRIPT_TEMPLATES[id],
  ...TEMPLATE_VISUALS[id],
}))

const TEMPLATE_GROUPS: Array<{ id: StoryScriptTemplateGroup; label: string; hint: string }> = [
  { id: "ssul", label: "썰채널 인기 공식", hint: "조회수 높은 썰쇼핑 채널 대본에서 뽑은 전개" },
  { id: "classic", label: "기본 스토리 공식", hint: "어떤 제품에도 쓰기 쉬운 기본 전개" },
]

export function StoryGenerationPanel({
  brief,
  onChange,
}: {
  brief: StoryShoppingBrief
  onChange: Dispatch<SetStateAction<StoryShoppingBrief>>
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<StoryScriptTemplateId>(
    brief.generatedStory?.templateId ||
      brief.storyTemplateRecommendation?.templateId ||
      "origin"
  )
  const [narrationStyle, setNarrationStyle] = useState<StoryNarrationStyle>(
    brief.generatedStory?.narrationStyle || DEFAULT_STORY_NARRATION_STYLE
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRecommending, setIsRecommending] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const recommendationStartedRef = useRef("")
  const latestProductKeyRef = useRef("")
  const generationRunRef = useRef(0)
  const productKey = `${brief.productName.trim()}::${brief.selectedProductSource || ""}::${
    brief.collectorData?.collectedAt || ""
  }`
  latestProductKeyRef.current = productKey
  const recommendation =
    brief.storyTemplateRecommendation?.productKey === productKey
      ? brief.storyTemplateRecommendation
      : undefined
  const orderedTemplates = useMemo(() => {
    if (!recommendation) return TEMPLATES
    return [...TEMPLATES].sort((a, b) => {
      if (a.id === recommendation.templateId) return -1
      if (b.id === recommendation.templateId) return 1
      return 0
    })
  }, [recommendation])
  const currentTemplate =
    TEMPLATES.find((template) => template.id === selectedTemplate) || TEMPLATES[0]
  const CurrentTemplateIcon = currentTemplate.icon

  useEffect(() => {
    if (
      !brief.productName.trim() ||
      recommendation ||
      recommendationStartedRef.current === productKey
    ) return
    recommendationStartedRef.current = productKey
    const recommend = async () => {
      setIsRecommending(true)
      try {
        const response = await fetch("/api/shotform/story-shopping/recommend-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: brief.productName,
            productDescription: brief.productDescription,
            collectorData: brief.collectorData,
            apiKey:
              typeof window !== "undefined"
                ? localStorage.getItem("shotform_openai_api_key") || undefined
                : undefined,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "추천 유형을 분석하지 못했습니다.")
        if (latestProductKeyRef.current !== productKey) return
        const templateId = payload.recommendation.templateId as StoryScriptTemplateId
        setSelectedTemplate(templateId)
        onChange((current) => ({
          ...current,
          storyTemplateRecommendation: {
            templateId,
            reason: String(payload.recommendation.reason || ""),
            productKey,
            recommendedAt: new Date().toISOString(),
          },
        }))
      } catch (reason) {
        if (latestProductKeyRef.current === productKey) {
          setError(reason instanceof Error ? reason.message : "추천 유형을 분석하지 못했습니다.")
        }
      } finally {
        if (latestProductKeyRef.current === productKey) setIsRecommending(false)
      }
    }
    void recommend()
  }, [brief, onChange, productKey, recommendation])

  const generate = async () => {
    const runId = generationRunRef.current + 1
    generationRunRef.current = runId
    const requestProductKey = productKey
    const requestId = `story_${Date.now()}_${runId}`
    const baseRevision = brief.generatedStory?.generationContext?.responseRevision
    setIsGenerating(true)
    setError("")
    try {
      const reference = brief.winningContent
      const referenceTranscript = await fetchReferenceTranscript(reference?.videoId)
      const response = await fetch("/api/shotform/story-shopping/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          narrationStyle,
          productName: brief.productName,
          productDescription: brief.productDescription,
          priceBenefit: brief.priceBenefit,
          targetSeconds: brief.durationSec,
          collectorData: brief.collectorData,
          referenceTitle: reference?.title,
          referenceTranscript,
          referenceVideos: brief.referenceVideos.map((video) => ({
            title: video.title,
            description: video.description,
            viewCount: video.viewCount,
            durationSec: video.durationSec,
            format: video.format,
            hookPattern: video.hookPattern,
            performanceScore: video.performanceScore,
          })),
          requestId,
          baseRevision,
          apiKey:
            typeof window !== "undefined"
              ? localStorage.getItem("shotform_openai_api_key") || undefined
              : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "스토리 생성에 실패했습니다.")
      if (
        generationRunRef.current !== runId ||
        latestProductKeyRef.current !== requestProductKey ||
        payload.requestId !== requestId ||
        payload.baseRevision !== baseRevision
      ) {
        return
      }
      const generatedStory = payload.story as StoryGeneratedScript
      onChange((current) => {
        const currentProductKey = `${current.productName.trim()}::${
          current.selectedProductSource || ""
        }::${current.collectorData?.collectedAt || ""}`
        if (
          currentProductKey !== requestProductKey ||
          current.generatedStory?.generationContext?.responseRevision !== baseRevision
        ) {
          return current
        }
        return {
          ...current,
          generatedStory,
          frameSettings: {
            ...DEFAULT_STORY_FRAME_SETTINGS,
            ...current.frameSettings,
            videoTitle: generatedStory.title,
            // 표지는 새 제목을 두 줄로 자동 분할 — 이전 대본의 수동 표지 문구는 비움
            coverTitleTop: "",
            coverTitleAccent: "",
          },
          voiceData: undefined,
          sceneAssets: undefined,
        }
      })
    } catch (reason) {
      if (generationRunRef.current === runId) {
        setError(reason instanceof Error ? reason.message : "스토리 생성에 실패했습니다.")
      }
    } finally {
      if (generationRunRef.current === runId) setIsGenerating(false)
    }
  }

  const patchScene = (
    sceneId: string,
    patch: Partial<StoryGeneratedScript["scenes"][number]>
  ) => {
    onChange((current) => {
      if (!current.generatedStory) return current
      const scenes = current.generatedStory.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, ...patch } : scene
      )
      return {
        ...current,
        generatedStory: {
          ...current.generatedStory,
          scenes,
          script: scenes.map((scene) => scene.narration.trim()).filter(Boolean).join("\n\n"),
        },
      }
    })
  }

  const changeDuration = (durationSec: number) => {
    onChange((current) => ({
      ...current,
      durationSec,
      generatedStory: undefined,
      voiceData: undefined,
      sceneAssets: undefined,
    }))
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-violet-400/20 bg-[#f7f5fe] p-5 md:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.2em] text-violet-300">
              <BrainCircuit className="h-4 w-4" />
              STORY ENGINE
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">제품보다 이야기를 먼저 만듭니다.</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-300">
              흥미로운 이야기에서 시작해 갈등과 궁금증을 만든 뒤, 해결의 순간에 제품을
              자연스럽게 공개합니다.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
            <p className="text-[9px] text-zinc-500">선택 상품</p>
            <p className="mt-1 max-w-[260px] truncate text-sm font-bold text-white">
              {brief.productName || "상품을 먼저 선택해주세요"}
            </p>
          </div>
        </div>

        <div className="relative mt-6 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-500/[0.09] to-orange-500/[0.04] p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black tracking-[0.18em] text-amber-300">
                01 · SCRIPT LENGTH
              </p>
              <h3 className="mt-1 text-base font-black text-white">먼저 대본 길이를 선택하세요.</h3>
              <p className="mt-1 text-[10px] text-zinc-400">
                선택한 시간에 맞춰 대본 분량과 장면 수를 조절합니다.
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black tabular-nums text-amber-200">
                {brief.durationSec}
              </span>
              <span className="ml-1 text-sm font-bold text-amber-300">초</span>
              <p className="mt-1 text-[9px] text-zinc-500">
                약 {storyTargetCharacters(brief.durationSec, narrationStyle)}자 · 장면{" "}
                {storyTargetSceneCount(brief.durationSec, narrationStyle)}개
              </p>
            </div>
          </div>
          <Slider
            min={10}
            max={60}
            step={1}
            value={[brief.durationSec]}
            onValueChange={([value]) => changeDuration(value)}
            className="mt-5"
          />
          <div className="mt-4 grid grid-cols-5 gap-2">
            {[15, 20, 30, 40, 60].map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => changeDuration(seconds)}
                className={`rounded-lg border py-2 text-[10px] font-black transition ${
                  brief.durationSec === seconds
                    ? "border-amber-300 bg-amber-400 text-amber-950"
                    : "border-white/10 bg-black/20 text-zinc-400 hover:border-amber-300/40 hover:text-amber-100"
                }`}
              >
                {seconds}초
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {NARRATION_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setNarrationStyle(style.id)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  narrationStyle === style.id
                    ? "border-amber-300 bg-amber-400 text-amber-950"
                    : "border-white/10 bg-black/20 text-zinc-400 hover:border-amber-300/40 hover:text-amber-100"
                }`}
              >
                <span className="block text-[11px] font-black">{style.label}</span>
                <span className="block text-[9px] opacity-75">{style.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-5">
          <p className="text-[9px] font-black tracking-[0.18em] text-violet-300">
            02 · STORY TEMPLATE
          </p>
          <h3 className="mt-1 text-base font-black text-white">제품에 맞는 스토리를 선택하세요.</h3>
        </div>

        <div className="relative mt-3 rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-4">
          {isRecommending ? (
            <div className="flex items-center gap-3 text-xs text-violet-100">
              <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              제품 정보와 수집 리뷰를 분석해 가장 잘 맞는 스토리를 찾는 중입니다.
            </div>
          ) : recommendation ? (
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <p className="text-xs font-black text-violet-100">
                  AI 추천 1순위 ·{" "}
                  {TEMPLATES.find((item) => item.id === recommendation.templateId)?.name}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-zinc-300">
                  {recommendation.reason}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">추천 스토리 유형을 확인하고 있습니다.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsTemplateDialogOpen(true)}
          className="relative mt-4 flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-violet-300/50 bg-violet-500/10 p-4 text-left transition hover:border-violet-200 hover:bg-violet-500/15"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${currentTemplate.accent}`} />
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">
            <CurrentTemplateIcon className="h-5 w-5 text-white" />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[9px] font-bold tracking-[0.15em] text-violet-300">
              현재 선택
            </span>
            <span className="mt-1 block text-sm font-black text-white">
              {currentTemplate.name}
            </span>
            <span className="mt-1 block truncate text-[10px] text-zinc-400">
              {currentTemplate.flow}
            </span>
          </span>
          <span className="relative shrink-0 rounded-lg bg-violet-300 px-3 py-2 text-[10px] font-black text-violet-950">
            템플릿 선택
          </span>
        </button>

        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-h-[88vh] w-[min(96vw,80rem)] max-w-[calc(100%-2rem)] overflow-y-auto border-white/15 bg-[#f7f5fe] text-white sm:max-w-7xl">
            <DialogHeader>
              <DialogTitle>스토리 템플릿 선택</DialogTitle>
              <DialogDescription className="text-zinc-400">
                제품의 이야기를 가장 효과적으로 전달할 템플릿을 선택하세요.
              </DialogDescription>
            </DialogHeader>
            {TEMPLATE_GROUPS.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-black text-white">{group.label}</h3>
                  <span className="text-[10px] text-zinc-500">{group.hint}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {orderedTemplates
                    .filter((item) => item.group === group.id)
                    .map((item, index) => {
                      const Icon = item.icon
                      const selected = selectedTemplate === item.id
                      const recommended = recommendation?.templateId === item.id
                      return (
                        <motion.button
                          key={item.id}
                          type="button"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => {
                            setSelectedTemplate(item.id)
                            setIsTemplateDialogOpen(false)
                          }}
                          className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-violet-300/70 bg-violet-500/15 shadow-[0_0_30px_rgba(139,92,246,0.12)]"
                              : "border-white/10 bg-white/[0.025] hover:border-white/25"
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                          <div className="relative">
                            <div className="flex items-start justify-between">
                              <Icon className="h-5 w-5 text-white" />
                              <div className="flex items-center gap-2">
                                {recommended ? (
                                  <span className="rounded-full border border-violet-200/30 bg-violet-300 px-2 py-1 text-[8px] font-black text-violet-950">
                                    AI 추천 1순위
                                  </span>
                                ) : null}
                                {selected ? (
                                  <span className="rounded-full bg-violet-300 p-1 text-violet-950">
                                    <Check className="h-3 w-3" />
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-3 text-sm font-black text-white">{item.name}</p>
                            <p className="mt-1 text-[8px] font-bold tracking-[0.16em] text-zinc-500">
                              {item.english}
                            </p>
                            <p className="mt-3 text-xs leading-5 text-zinc-300">{item.description}</p>
                            <p className="mt-3 rounded-lg bg-black/20 px-2.5 py-2 text-[10px] text-zinc-400">
                              {item.flow}
                            </p>
                          </div>
                        </motion.button>
                      )
                    })}
                </div>
              </section>
            ))}
          </DialogContent>
        </Dialog>

        {error ? (
          <p className="relative mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </p>
        ) : null}

        <Button
          onClick={generate}
          disabled={isGenerating || !brief.productName}
          className="relative mt-5 h-12 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-black text-white hover:from-violet-400 hover:to-fuchsia-400"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              수집 근거로 {brief.durationSec}초 스토리 구성 중
            </>
          ) : (
            <>
              {brief.generatedStory ? (
                <RotateCcw className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {brief.generatedStory ? "선택 템플릿으로 다시 생성" : "스토리 대본 생성"}
              <span className="ml-2 text-[10px] opacity-75">· {brief.durationSec}초</span>
            </>
          )}
        </Button>
      </section>

      {brief.generatedStory ? (
        <section className="rounded-[30px] border border-white/10 bg-[#f7f7f5] p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black tracking-[0.18em] text-fuchsia-300">
                GENERATED STORY
              </p>
              <h3 className="mt-1 text-xl font-black text-white">
                {brief.generatedStory.title}
              </h3>
            </div>
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold text-violet-200">
              {brief.generatedStory.templateName} ·{" "}
              {brief.generatedStory.targetDurationSec || brief.durationSec}초
            </span>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[9px] font-bold text-zinc-500">이 유형을 추천한 이유</p>
            <p className="mt-2 text-xs leading-6 text-zinc-300">
              {brief.generatedStory.typeReason}
            </p>
          </div>
          <div className="mt-4">
            <label className="text-xs font-bold text-zinc-200">전체 대본 미리보기</label>
            <Textarea
              value={brief.generatedStory.scenes
                .map((scene) => scene.narration)
                .join("\n\n")}
              readOnly
              className="mt-2 min-h-[220px] border-white/10 bg-black/30 leading-7 text-zinc-300"
            />
            <p className="mt-2 text-[10px] text-zinc-500">
              아래 장면별 대본을 수정하면 전체 대본에도 자동 반영됩니다.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {brief.generatedStory.scenes.map((scene, index) => (
              <div
                key={scene.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="ml-4 mt-4 rounded-lg bg-violet-500/15 px-2.5 py-1 text-[10px] font-black text-violet-200">
                    SCENE {index + 1}
                  </span>
                  <span className="mr-4 mt-4 text-[10px] font-bold text-zinc-500">
                    {scene.durationSec}초
                  </span>
                </div>

                <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="border-t border-cyan-400/15 bg-cyan-500/[0.045] p-4 lg:border-r">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.7)]" />
                      <span className="text-[10px] font-black tracking-[0.14em] text-cyan-200">
                        장면 대본 · 내레이션
                      </span>
                    </div>
                    <Textarea
                      value={scene.narration}
                      onChange={(event) =>
                        patchScene(scene.id, { narration: event.target.value })
                      }
                      className="min-h-[105px] border-cyan-400/20 bg-black/25 text-sm leading-6 text-cyan-50 focus-visible:ring-cyan-400/40"
                    />
                    <p className="mt-2 text-[9px] leading-4 text-cyan-200/55">
                      이 장면에서 AI 음성이 실제로 읽는 대본입니다.
                    </p>
                  </div>

                  <div className="border-t border-violet-400/15 bg-violet-500/[0.04] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,.7)]" />
                      <span className="text-[10px] font-black tracking-[0.14em] text-amber-200">
                        화면 자막
                      </span>
                    </div>
                    <Textarea
                      value={scene.caption}
                      onChange={(event) => patchScene(scene.id, { caption: event.target.value })}
                      className="min-h-[66px] resize-none border-amber-400/20 bg-amber-500/[0.04] text-sm font-bold text-amber-50 focus-visible:ring-amber-400/40"
                    />
                    <div className="mt-4 border-t border-white/[0.06] pt-3">
                      <p className="text-[10px] font-black tracking-[0.14em] text-violet-200">
                        화면 연출
                      </p>
                      <Textarea
                        value={scene.visualPrompt}
                        onChange={(event) =>
                          patchScene(scene.id, { visualPrompt: event.target.value })
                        }
                        className="mt-2 min-h-[66px] border-violet-400/20 bg-violet-500/[0.04] text-[11px] leading-5 text-violet-100 focus-visible:ring-violet-400/40"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
