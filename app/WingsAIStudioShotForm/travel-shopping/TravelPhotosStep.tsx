"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  alignScenesToPhotos,
  classifyTravelPhotos,
} from "@/lib/travel-shorts/ai-client";
import { videoPosterBlob } from "@/lib/travel-shorts/render";
import {
  TRAVEL_MAX_PHOTOS,
  TRAVEL_PHOTO_ROLES,
  type TravelPhoto,
  type TravelPhotoRole,
} from "@/lib/travel-shorts/types";
import {
  ErrorNote,
  NextButton,
  StepCard,
  btnGhost,
  btnInk,
  panelClass,
  usePhotoUrls,
  type TravelStepProps,
} from "./travel-ui";

/** 프로젝트가 브라우저(IndexedDB)에 통째로 저장되므로 너무 큰 원본은 막음 */
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

const ROLE_COLOR: Record<TravelPhotoRole, string> = {
  hero: "bg-amber-100 text-amber-800",
  room: "bg-sky-100 text-sky-800",
  unique: "bg-violet-100 text-violet-800",
  food: "bg-rose-100 text-rose-800",
  around: "bg-emerald-100 text-emerald-800",
};

/** 좋은 여행 숏폼 사진 구성인지 짧게 점검 */
function compositionTips(photos: TravelPhoto[]): string[] {
  const count = (role: TravelPhotoRole) =>
    photos.filter((p) => p.role === role).length;
  const tips: string[] = [];
  if (photos.length < 5)
    tips.push(
      `사진이 ${photos.length}장이에요. 5~8장이면 15~25초 영상이 됩니다.`,
    );
  if (!count("hero"))
    tips.push("첫 컷으로 쓸 '시선 강탈' 사진(수영장·뷰·야경)이 없어요.");
  if (!count("room"))
    tips.push("객실 사진이 한 장은 있어야 예약 문의로 이어져요.");
  if (count("hero") + count("unique") < 2)
    tips.push("여기서만 볼 수 있는 장면이 2장 이상이면 저장·공유가 늘어요.");
  return tips;
}

export function TravelPhotosStep({ project, update, onNext }: TravelStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const urls = usePhotoUrls(project.photos);
  const { photos } = project;

  const setPhotos = (next: TravelPhoto[]) =>
    update((p) => ({
      ...p,
      photos: next,
      variants: p.variants.map((v) => alignScenesToPhotos(v, next)),
    }));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = TRAVEL_MAX_PHOTOS - photos.length;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, room);
    if (files.length > room)
      setError(
        `사진·영상은 합쳐서 최대 ${TRAVEL_MAX_PHOTOS}개까지 넣을 수 있어요.`,
      );
    else setError("");
    const added: TravelPhoto[] = [];
    for (const [i, file] of picked.entries()) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        setError(
          `영상은 ${MAX_VIDEO_BYTES / 1024 / 1024}MB 이하로 올려 주세요. (${file.name})`,
        );
        continue;
      }
      try {
        added.push({
          id: `ph-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          blob: isVideo ? await videoPosterBlob(file) : file,
          ...(isVideo ? { video: file } : {}),
          role: photos.length + added.length === 0 ? "hero" : "room",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
      }
    }
    if (added.length) setPhotos([...photos, ...added]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setPhotos(next);
  };

  const patchPhoto = (id: string, patch: Partial<TravelPhoto>) =>
    setPhotos(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const runClassify = async () => {
    setBusy(true);
    setError("");
    try {
      setPhotos(await classifyTravelPhotos(photos));
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 분류에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const tips = compositionTips(photos);

  return (
    <StepCard
      eyebrow={`Step 02 · 사진 ${photos.length}/${TRAVEL_MAX_PHOTOS}`}
      title="사진 넣기"
      description="숙소 상세페이지·직접 찍은 사진을 넣으세요. 사진 한 장이 장면 하나가 됩니다."
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            className={btnGhost}
            disabled={photos.length >= TRAVEL_MAX_PHOTOS}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            사진·영상 추가
          </Button>
          <Button
            type="button"
            disabled={busy || photos.length < 2}
            onClick={() => void runClassify()}
            className={btnInk}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI 분류·순서 추천
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          void addFiles(files).finally(() => {
            e.target.value = "";
          });
        }}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-20 text-[#5c6170] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25 motion-reduce:transition-none ${
            dragging
              ? "border-[#0a7c86] bg-[#eef7f8]"
              : "border-[#d5d9e1] bg-[#f8f9fb] hover:border-[#0a7c86]"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <ImagePlus className="h-6 w-6 text-[#0a7c86]" />
          </span>
          <span className="mt-4 text-base font-bold text-[#0e1016]">
            사진·영상을 끌어다 놓거나 눌러서 선택
          </span>
          <span className="mt-1.5 max-w-md text-center text-sm leading-relaxed">
            최대 {TRAVEL_MAX_PHOTOS}개 · 직접 찍은 MP4 영상도 장면이 됩니다 ·
            세로가 아니어도 화면을 꽉 채워 잘라 씁니다
          </span>
        </button>
      ) : (
        <div
          className={`grid grid-cols-2 gap-4 rounded-2xl sm:grid-cols-3 lg:grid-cols-5 ${dragging ? "ring-4 ring-[#0a7c86]/25" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
        >
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-[#e3e6ec] bg-white shadow-[0_8px_20px_-16px_rgba(14,16,22,0.4)]"
            >
              <div className="relative aspect-[9/16] bg-[#eceef3]">
                {urls.get(photo.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls.get(photo.id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <span className="absolute left-2 top-2 rounded-full bg-[#0e1016]/75 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                  {index + 1}
                  {photo.video ? " · 영상" : ""}
                </span>
                <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                  {[
                    {
                      icon: ArrowUp,
                      label: "앞으로",
                      dir: -1 as const,
                      off: index === 0,
                    },
                    {
                      icon: ArrowDown,
                      label: "뒤로",
                      dir: 1 as const,
                      off: index === photos.length - 1,
                    },
                  ].map(({ icon: Icon, label, dir, off }) => (
                    <button
                      key={label}
                      type="button"
                      aria-label={label}
                      disabled={off}
                      onClick={() => move(index, dir)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#0e1016] shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/40 disabled:opacity-30"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="삭제"
                    onClick={() =>
                      setPhotos(photos.filter((p) => p.id !== photo.id))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#c2362b] shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {photo.note ? (
                  <span className="absolute inset-x-2 bottom-2 line-clamp-2 rounded-lg bg-[#0e1016]/70 px-2 py-1.5 text-xs leading-snug text-white backdrop-blur">
                    {photo.note}
                  </span>
                ) : null}
              </div>
              <select
                value={photo.role}
                onChange={(e) =>
                  patchPhoto(photo.id, {
                    role: e.target.value as TravelPhotoRole,
                  })
                }
                aria-label={`${index + 1}번 사진 역할`}
                className={`h-10 w-full border-0 px-2.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#0a7c86]/40 ${ROLE_COLOR[photo.role]}`}
                title={
                  TRAVEL_PHOTO_ROLES.find((r) => r.id === photo.role)?.hint
                }
              >
                {TRAVEL_PHOTO_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {photos.length ? (
        <div className={`mt-6 text-sm ${panelClass}`}>
          <p className="text-[15px] font-bold text-[#0e1016]">
            {tips.length
              ? "사진 구성 점검"
              : "구성 좋아요 — 첫 컷과 마지막 컷이 가장 중요해요"}
          </p>
          {tips.length ? (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-[#5c6170]">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ErrorNote message={error} />
      <NextButton
        onClick={onNext}
        disabled={photos.length < 2}
        hint="사진을 2장 이상 넣어 주세요."
      />
    </StepCard>
  );
}
