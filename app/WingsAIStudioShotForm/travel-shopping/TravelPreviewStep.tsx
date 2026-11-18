"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Music,
  Pause,
  Play,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRAVEL_AFFILIATE_DISCLOSURE } from "@/lib/travel-shorts/ai-client";
import {
  REPLICATE_KEY_MISSING,
  animateTravelPhotos,
  shotformReplicateKey,
} from "@/lib/travel-shorts/animate";
import {
  TRAVEL_CANVAS_H,
  TRAVEL_CANVAS_W,
  buildTravelSrt,
  disposeTravelVideos,
  drawTravelFrame,
  drawTravelThumbnail,
  estimateTravelTimeline,
  loadTravelImages,
  loadTravelVideos,
  recordTravelVideo,
  type TravelFrameInput,
  type TravelTimeline,
} from "@/lib/travel-shorts/render";
import {
  selectedTravelScript,
  travelScriptKey,
} from "@/lib/travel-shorts/types";
import {
  ErrorNote,
  StepCard,
  btnGhost,
  btnInk,
  btnPrimary,
  downloadBlob,
  type TravelStepProps,
} from "./travel-ui";

const PREVIEW_W = 360;

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="rounded-2xl border border-[#e3e6ec] bg-[#f8f9fb] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-[#5c6170]">
          {label}
        </span>
        <button
          type="button"
          aria-label={`${label} 복사`}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e6ec] bg-white px-2.5 text-[13px] font-semibold text-[#0a7c86] hover:border-[#0a7c86] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1500);
            });
          }}
        >
          {done ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {done ? "복사됨" : "복사"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#0e1016]">
        {text}
      </p>
    </div>
  );
}

export function TravelPreviewStep({
  project,
  update,
}: Omit<TravelStepProps, "onNext">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef(0);
  const [images, setImages] = useState<Map<string, ImageBitmap> | null>(null);
  const [videos, setVideos] = useState<Map<string, HTMLVideoElement>>(
    new Map(),
  );
  /** 멈춘 화면에서 클립 탐색(seek)이 끝나면 다시 그리기 위한 신호 */
  const [seekTick, setSeekTick] = useState(0);
  const [animating, setAnimating] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const variant = selectedTravelScript(project);
  const audio =
    project.audio && project.audio.scriptKey === travelScriptKey(variant)
      ? project.audio
      : null;
  const photoKey = project.photos.map((p) => p.id).join(",");
  const photosRef = useRef(project.photos);
  photosRef.current = project.photos;

  useEffect(() => {
    let alive = true;
    let loaded: Map<string, ImageBitmap> | null = null;
    void loadTravelImages(photosRef.current).then((map) => {
      if (alive) {
        loaded = map;
        setImages(map);
      } else map.forEach((b) => b.close());
    });
    return () => {
      alive = false;
      loaded?.forEach((b) => b.close());
    };
  }, [photoKey]);

  const videoKey = project.photos
    .map((p) => `${p.id}:${p.video?.size ?? 0}`)
    .join(",");
  useEffect(() => {
    let alive = true;
    let loaded: Map<string, HTMLVideoElement> | null = null;
    void loadTravelVideos(photosRef.current).then((map) => {
      if (!alive) return disposeTravelVideos(map);
      loaded = map;
      map.forEach((video) =>
        video.addEventListener("seeked", () => setSeekTick((n) => n + 1)),
      );
      setVideos(map);
    });
    return () => {
      alive = false;
      if (loaded) disposeTravelVideos(loaded);
    };
  }, [videoKey]);

  const audioUrl = useMemo(
    () => (audio ? URL.createObjectURL(audio.blob) : ""),
    [audio],
  );
  useEffect(
    () => () => (audioUrl ? URL.revokeObjectURL(audioUrl) : undefined),
    [audioUrl],
  );

  const timeline: TravelTimeline | null = useMemo(() => {
    if (!variant) return null;
    return audio
      ? { scenes: audio.sceneTimes, durationSec: audio.durationSec }
      : estimateTravelTimeline(variant);
  }, [variant, audio]);

  const frameInput: TravelFrameInput | null = useMemo(
    () =>
      variant && images && timeline
        ? {
            variant,
            images,
            videos,
            timeline,
            info: project.info,
            adLabel: project.adLabel,
            commentKeyword: project.publish?.commentKeyword ?? "",
          }
        : null,
    [
      variant,
      images,
      videos,
      timeline,
      project.info,
      project.adLabel,
      project.publish?.commentKeyword,
    ],
  );

  const draw = useCallback(
    (t: number, live = false) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && frameInput) drawTravelFrame(ctx, frameInput, t, live);
    },
    [frameInput],
  );

  useEffect(() => {
    if (!playing) draw(time);
  }, [draw, playing, time, seekTick]);

  /** 재생 중에는 오디오 시계(없으면 실제 시간)를 기준으로 매 프레임 그림 */
  useEffect(() => {
    if (!playing || !timeline) return;
    const el = audioRef.current;
    const startedAt = performance.now() - time * 1000;
    const tick = () => {
      const t =
        el && audio ? el.currentTime : (performance.now() - startedAt) / 1000;
      if (t >= timeline.durationSec) {
        setPlaying(false);
        setTime(0);
        return;
      }
      draw(t, true);
      setTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (el && audio) {
      el.currentTime = time;
      void el.play();
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      el?.pause();
    };
  }, [playing]);

  const exportVideo = async () => {
    if (!frameInput) return;
    setError("");
    setPlaying(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(0);
    try {
      const { blob, ext } = await recordTravelVideo({
        input: frameInput,
        audioBlob: audio?.blob ?? null,
        onProgress: (r) => setExporting(Math.min(1, r)),
        signal: controller.signal,
      });
      downloadBlob(blob, `${project.name || "travel-shorts"}.${ext}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(e instanceof Error ? e.message : "영상 저장 실패");
    } finally {
      setExporting(null);
      abortRef.current = null;
    }
  };

  const usedPhotos = variant
    ? project.photos.filter((p) =>
        variant.scenes.some((s) => s.photoId === p.id),
      )
    : [];
  const clipCount = usedPhotos.filter((p) => p.video).length;

  const animatePhotos = async () => {
    if (!variant || !timeline) return;
    if (!shotformReplicateKey()) return setError(REPLICATE_KEY_MISSING);
    setError("");
    setPlaying(false);
    const total = usedPhotos.filter((p) => !p.video).length;
    let finished = 0;
    setAnimating(`0/${total}`);
    const sceneSec = new Map(
      variant.scenes.map((s, i) => {
        const [start, end] = timeline.scenes[i] ?? [0, 4];
        return [s.photoId, end - start] as const;
      }),
    );
    try {
      const { failed } = await animateTravelPhotos(
        usedPhotos,
        sceneSec,
        (photoId, video) => {
          finished += 1;
          setAnimating(`${finished}/${total}`);
          update((p) => ({
            ...p,
            photos: p.photos.map((ph) =>
              ph.id === photoId ? { ...ph, video } : ph,
            ),
          }));
        },
      );
      if (failed.length)
        setError(`${failed.length}장은 영상으로 만들지 못했어요: ${failed[0]}`);
    } finally {
      setAnimating("");
    }
  };

  const clearClips = () =>
    update((p) => ({
      ...p,
      photos: p.photos.map(({ video: _video, ...ph }) => ph),
    }));

  const exportThumbnail = () => {
    if (!frameInput) return;
    const canvas = document.createElement("canvas");
    canvas.width = TRAVEL_CANVAS_W;
    canvas.height = TRAVEL_CANVAS_H;
    drawTravelThumbnail(canvas.getContext("2d")!, frameInput);
    canvas.toBlob(
      (blob) =>
        blob && downloadBlob(blob, `${project.name || "travel"}-thumbnail.png`),
      "image/png",
    );
  };

  if (!variant || !timeline) {
    return (
      <StepCard eyebrow="Step 05 · 완성" title="미리보기">
        <p className="text-[15px] text-[#5c6170]">
          대본을 먼저 만들어 주세요. 3단계에서 AI로 만들거나 직접 쓸 수 있어요.
        </p>
      </StepCard>
    );
  }

  const pub = project.publish;
  const hashtags = pub?.hashtags.map((h) => `#${h}`).join(" ") ?? "";
  const postText = [pub?.caption, hashtags, TRAVEL_AFFILIATE_DISCLOSURE]
    .filter(Boolean)
    .join("\n\n");
  const dmReply = project.info.bookingUrl.trim()
    ? `문의 주셔서 감사해요! 말씀하신 숙소 예약 링크예요 👉 ${project.info.bookingUrl.trim()}\n(제휴 링크로 예약 시 소정의 수수료를 받을 수 있어요)`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="lg:sticky lg:top-44 lg:self-start">
        <StepCard
          eyebrow="Step 05 · 완성"
          title="미리보기"
          description={
            audio
              ? "음성에 맞춰 재생됩니다."
              : "음성이 없어 예상 길이로 재생합니다."
          }
        >
          {/* 폰 프레임 */}
          <div
            className="mx-auto w-full rounded-[44px] bg-[#0e1016] p-2.5 shadow-[0_30px_60px_-30px_rgba(14,16,22,0.6)]"
            style={{ maxWidth: PREVIEW_W + 20 }}
          >
            <div className="relative">
              <span
                aria-hidden
                className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0e1016]"
              />
              <canvas
                ref={canvasRef}
                width={PREVIEW_W * 2}
                height={(PREVIEW_W * 2 * TRAVEL_CANVAS_H) / TRAVEL_CANVAS_W}
                style={{
                  width: "100%",
                  aspectRatio: `${TRAVEL_CANVAS_W} / ${TRAVEL_CANVAS_H}`,
                }}
                className="block rounded-[34px] bg-[#1b1e27]"
                aria-label="숏폼 미리보기 화면"
              />
            </div>
          </div>
          {audioUrl ? (
            <audio ref={audioRef} src={audioUrl} preload="auto" />
          ) : null}
          <div
            className="mx-auto mt-5 flex w-full items-center gap-3"
            style={{ maxWidth: PREVIEW_W + 20 }}
          >
            <Button
              type="button"
              size="icon"
              disabled={!frameInput || exporting !== null}
              onClick={() => setPlaying((v) => !v)}
              className={`${btnPrimary} h-11 w-11 shrink-0 rounded-full px-0`}
              aria-label={playing ? "일시정지" : "재생"}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={timeline.durationSec}
              step={0.05}
              value={time}
              disabled={playing}
              onChange={(e) => setTime(Number(e.target.value))}
              className="w-full accent-[#0a7c86] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25"
              aria-label="재생 위치"
            />
            <span className="w-20 shrink-0 text-right text-[13px] tabular-nums text-[#5c6170]">
              {time.toFixed(1)}/{timeline.durationSec.toFixed(1)}s
            </span>
          </div>
          <label
            className="mx-auto mt-4 flex w-full cursor-pointer items-center gap-2.5 text-sm text-[#2a2e38]"
            style={{ maxWidth: PREVIEW_W + 20 }}
          >
            <input
              type="checkbox"
              checked={project.adLabel}
              onChange={(e) =>
                update((p) => ({ ...p, adLabel: e.target.checked }))
              }
              className="h-5 w-5 shrink-0 accent-[#0a7c86]"
            />
            화면에 &apos;광고&apos; 표시 (제휴 링크를 쓰면 켜 두세요)
          </label>
        </StepCard>
      </div>

      <div className="space-y-6">
        <StepCard
          title="움직이는 영상"
          description="사진을 AI로 몇 초짜리 영상으로 바꿔요. 물결·커튼·구름처럼 장면에 있는 것만 자연스럽게 움직입니다."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={
                !!animating ||
                exporting !== null ||
                clipCount === usedPhotos.length
              }
              onClick={() => void animatePhotos()}
              className={btnInk}
            >
              {animating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {animating
                ? `영상 만드는 중 ${animating}`
                : clipCount === usedPhotos.length
                  ? "모든 장면이 영상이에요"
                  : clipCount > 0
                    ? `남은 ${usedPhotos.length - clipCount}장 영상으로`
                    : `사진 ${usedPhotos.length}장 모두 영상으로`}
            </Button>
            {clipCount > 0 && !animating ? (
              <Button
                type="button"
                variant="outline"
                className={btnGhost}
                onClick={clearClips}
              >
                사진으로 되돌리기
              </Button>
            ) : null}
            <span className="text-sm text-[#5c6170]">
              영상 {clipCount}/{usedPhotos.length}장 · Replicate 유료(장당 수 초
              분량) · 1장에 1~2분
            </span>
          </div>
        </StepCard>

        <StepCard
          title="내보내기"
          description="영상은 실제 길이만큼 재생하며 녹화합니다. 저장 중에는 탭을 닫지 마세요."
        >
          <div className="flex flex-wrap gap-2">
            {exporting === null ? (
              <Button
                type="button"
                disabled={!frameInput}
                onClick={() => void exportVideo()}
                className={btnPrimary}
              >
                <Video className="mr-2 h-4 w-4" />
                영상 저장
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className={btnGhost}
                onClick={() => abortRef.current?.abort()}
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                녹화 중 {Math.round(exporting * 100)}% · 취소
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className={btnGhost}
              disabled={!frameInput}
              onClick={exportThumbnail}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              썸네일 PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              className={btnGhost}
              onClick={() =>
                downloadBlob(
                  new Blob([buildTravelSrt(variant, timeline)], {
                    type: "text/plain;charset=utf-8",
                  }),
                  `${project.name || "travel"}.srt`,
                )
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              자막 SRT
            </Button>
            <Button
              type="button"
              variant="outline"
              className={btnGhost}
              disabled={!audio}
              onClick={() =>
                audio &&
                downloadBlob(
                  audio.blob,
                  `${project.name || "travel"}-voice.wav`,
                )
              }
            >
              <Music className="mr-2 h-4 w-4" />
              음성 WAV
            </Button>
          </div>
          {exporting !== null ? (
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-[#eceef3]"
              role="progressbar"
              aria-label="영상 녹화 진행"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(exporting * 100)}
            >
              <div
                className="h-full rounded-full bg-[#0a7c86] transition-[width] motion-reduce:transition-none"
                style={{ width: `${exporting * 100}%` }}
              />
            </div>
          ) : null}
          {!audio ? (
            <p
              role="status"
              className="mt-4 rounded-xl border border-[#f0dcae] bg-[#fdf8ec] px-4 py-3 text-sm text-[#7a5410]"
            >
              <Download className="mr-1 inline h-3.5 w-3.5" />
              음성이 없거나 대본과 맞지 않아요. 지금 저장하면 소리 없는 영상이
              됩니다.
            </p>
          ) : null}
          <ErrorNote message={error} />
        </StepCard>

        <StepCard
          title="업로드 패키지"
          description="릴스·쇼츠에 그대로 붙여 넣으세요."
        >
          <div className="space-y-3">
            {pub?.titles.map((title, i) => (
              <CopyBlock key={title} label={`제목 ${i + 1}`} text={title} />
            ))}
            <CopyBlock
              label="게시글 (본문 + 해시태그 + 제휴 고지)"
              text={postText}
            />
            <CopyBlock label="댓글·DM 답장 (예약 링크)" text={dmReply} />
            {!dmReply ? (
              <p className="text-sm text-[#5c6170]">
                1단계에 예약 링크를 넣으면 DM 답장 문구도 만들어 드려요.
              </p>
            ) : null}
          </div>
        </StepCard>
      </div>
    </div>
  );
}
