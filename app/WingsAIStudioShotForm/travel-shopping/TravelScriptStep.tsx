"use client";

import { useState } from "react";
import { Loader2, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateTravelScripts,
  motionsForPhotos,
} from "@/lib/travel-shorts/ai-client";
import {
  TRAVEL_ANGLE_LABELS,
  type TravelPublishMeta,
  type TravelScriptVariant,
} from "@/lib/travel-shorts/types";
import {
  ErrorNote,
  NextButton,
  StepCard,
  btnGhost,
  btnInk,
  inputClass,
  labelClass,
  panelClass,
  textareaClass,
  usePhotoUrls,
  type TravelStepProps,
} from "./travel-ui";

const LINE_LIMIT = 16;

function longestRow(line: string): number {
  return Math.max(0, ...line.split("\n").map((r) => r.trim().length));
}

/** 입력 중에는 글자 그대로 두고, 포커스를 벗어날 때 태그 배열로 정리 */
function HashtagInput({
  id,
  tags,
  onCommit,
}: {
  id?: string;
  tags: string[];
  onCommit: (tags: string[]) => void;
}) {
  const [text, setText] = useState(() => tags.map((h) => `#${h}`).join(" "));
  return (
    <Input
      id={id}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onCommit(
          text
            .split(/[\s,]+/)
            .map((h) => h.replace(/^#+/, ""))
            .filter(Boolean),
        )
      }
      className={inputClass}
    />
  );
}

export function TravelScriptStep({ project, update, onNext }: TravelStepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urls = usePhotoUrls(project.photos);
  const variant = project.variants[project.selectedVariant] ?? null;

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const { variants, publish } = await generateTravelScripts(project);
      update((p) => ({ ...p, variants, publish, selectedVariant: 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "대본 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const startBlank = () => {
    const motions = motionsForPhotos(project.photos);
    const blank: TravelScriptVariant = {
      angle: "secret",
      headline: ["", ""],
      scenes: project.photos.map((p, i) => ({
        photoId: p.id,
        line: "",
        motion: motions[i]!,
      })),
    };
    update((p) => ({
      ...p,
      variants: [blank],
      selectedVariant: 0,
      publish: p.publish ?? {
        titles: [],
        caption: "",
        hashtags: [],
        commentKeyword: "링크",
      },
    }));
  };

  const patchVariant = (fn: (v: TravelScriptVariant) => TravelScriptVariant) =>
    update((p) => ({
      ...p,
      variants: p.variants.map((v, i) => (i === p.selectedVariant ? fn(v) : v)),
    }));

  const patchPublish = (next: Partial<TravelPublishMeta>) =>
    update((p) =>
      p.publish ? { ...p, publish: { ...p.publish, ...next } } : p,
    );

  const ready = Boolean(variant?.scenes.every((s) => s.line.trim()));

  return (
    <StepCard
      eyebrow="Step 03 · 대본"
      title="대본 고르기"
      description="첫 3초에서 승부가 납니다. 접근이 다른 3가지 버전 중 하나를 고르고 다듬으세요."
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            className={btnGhost}
            onClick={startBlank}
            disabled={busy}
          >
            <PenLine className="mr-2 h-4 w-4" />
            직접 쓰기
          </Button>
          <Button
            type="button"
            disabled={busy || project.photos.length < 2}
            onClick={() => void generate()}
            className={btnInk}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {project.variants.length
              ? "3가지 다시 쓰기"
              : "AI 대본 3가지 만들기"}
          </Button>
        </>
      }
    >
      <ErrorNote message={error} />

      {!variant ? (
        busy ? (
          <div
            className="space-y-3"
            aria-busy="true"
            aria-label="대본 만드는 중"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex gap-4 rounded-2xl border border-[#e3e6ec] p-4"
              >
                <div className="h-24 w-[54px] animate-pulse rounded-lg bg-[#eceef3] motion-reduce:animate-none" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[#eceef3] motion-reduce:animate-none" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[#eceef3] motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#d5d9e1] px-6 py-14 text-center">
            <p className="text-base font-bold text-[#0e1016]">
              아직 대본이 없어요
            </p>
            <p className="mt-1.5 text-sm text-[#5c6170]">
              사진 설명과 입력한 장점을 바탕으로 장면마다 한 줄씩 대본을 씁니다.
              직접 써도 돼요.
            </p>
          </div>
        )
      ) : (
        <>
          {project.variants.length > 1 ? (
            <div
              className="mb-7 grid gap-3 sm:grid-cols-3"
              role="group"
              aria-label="대본 버전"
            >
              {project.variants.map((v, i) => (
                <button
                  key={v.angle}
                  type="button"
                  onClick={() => update((p) => ({ ...p, selectedVariant: i }))}
                  aria-pressed={i === project.selectedVariant}
                  className={`min-w-0 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25 motion-reduce:transition-none ${
                    i === project.selectedVariant
                      ? "border-[#0a7c86] bg-[#eef7f8]"
                      : "border-[#e3e6ec] bg-white hover:border-[#c9ced8]"
                  }`}
                >
                  <span className="block text-xs font-bold tracking-[0.04em] text-[#0a7c86]">
                    {String.fromCharCode(65 + i)}안 ·{" "}
                    {TRAVEL_ANGLE_LABELS[v.angle]}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-snug text-[#0e1016]">
                    {v.scenes[0]?.line.replace(/\n/g, " ") || "(첫 줄 없음)"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            {[0, 1].map((row) => (
              <div key={row}>
                <Label className={labelClass}>
                  상단 고정 문구 {row + 1}줄 {row === 1 ? "(노란색 강조)" : ""}
                </Label>
                <Input
                  value={variant.headline[row]}
                  maxLength={20}
                  onChange={(e) =>
                    patchVariant((v) => {
                      const headline: [string, string] = [...v.headline];
                      headline[row] = e.target.value;
                      return { ...v, headline };
                    })
                  }
                  className={inputClass}
                  placeholder={
                    row === 0 ? "예: 여기 진짜 국내 맞아?" : "예: 1박에 이 뷰"
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-7 space-y-3">
            {variant.scenes.map((scene, i) => {
              const over = longestRow(scene.line) > LINE_LIMIT;
              return (
                <div
                  key={scene.photoId}
                  className="flex gap-4 rounded-2xl border border-[#e3e6ec] p-4 focus-within:border-[#0a7c86]"
                >
                  <div className="relative h-28 w-[63px] shrink-0 overflow-hidden rounded-xl bg-[#eceef3]">
                    {urls.get(scene.photoId) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urls.get(scene.photoId)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span className="absolute left-1 top-1 rounded-md bg-[#0e1016]/75 px-1.5 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={scene.line}
                      rows={2}
                      onChange={(e) =>
                        patchVariant((v) => ({
                          ...v,
                          scenes: v.scenes.map((s, j) =>
                            j === i ? { ...s, line: e.target.value } : s,
                          ),
                        }))
                      }
                      aria-label={`${i + 1}번 장면 대본`}
                      className={`${textareaClass} mt-0 resize-none`}
                      placeholder={
                        i === 0
                          ? "첫 장면 — 궁금하게 만드는 한마디"
                          : i === variant.scenes.length - 1
                            ? "마지막 장면 — 댓글로 링크 받기 유도"
                            : "이 사진에서 보여줄 포인트"
                      }
                    />
                    <p
                      className={`mt-1.5 text-xs ${over ? "font-semibold text-[#a86a00]" : "text-[#7c818f]"}`}
                    >
                      줄바꿈 = 자막 한 줄 · 한 줄 {LINE_LIMIT}자 이내 권장
                      {over ? " (조금 길어요)" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {project.publish ? (
            <div className={`mt-7 grid gap-5 md:grid-cols-2 ${panelClass}`}>
              <div>
                <Label htmlFor="script-keyword" className={labelClass}>
                  댓글 키워드
                </Label>
                <Input
                  id="script-keyword"
                  value={project.publish.commentKeyword}
                  maxLength={8}
                  onChange={(e) =>
                    patchPublish({ commentKeyword: e.target.value })
                  }
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-[#5c6170]">
                  마지막 장면에 &quot;댓글에 &apos;
                  {project.publish.commentKeyword || "키워드"}&apos;
                  남겨주세요&quot;로 표시돼요.
                </p>
              </div>
              <div>
                <Label htmlFor="script-hashtags" className={labelClass}>
                  해시태그 (띄어쓰기로 구분)
                </Label>
                <HashtagInput
                  id="script-hashtags"
                  key={project.publish.hashtags.join(" ")}
                  tags={project.publish.hashtags}
                  onCommit={(hashtags) => patchPublish({ hashtags })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="script-caption" className={labelClass}>
                  게시글 본문
                </Label>
                <Textarea
                  id="script-caption"
                  value={project.publish.caption}
                  rows={3}
                  onChange={(e) => patchPublish({ caption: e.target.value })}
                  className={textareaClass}
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      <NextButton
        onClick={onNext}
        disabled={!ready}
        hint="모든 장면에 대본을 한 줄 이상 적어 주세요."
      />
    </StepCard>
  );
}
