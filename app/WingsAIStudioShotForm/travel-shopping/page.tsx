"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plane,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AUTO_BUILD_STAGES,
  autoBuildFromCoupang,
  type AutoBuildStageId,
} from "@/lib/travel-shorts/auto-build";
import {
  deleteTravelProject,
  listTravelProjects,
  loadTravelProject,
  saveTravelProject,
} from "@/lib/travel-shorts/store";
import {
  TRAVEL_STEPS,
  newTravelProject,
  type TravelProject,
  type TravelStep,
} from "@/lib/travel-shorts/types";
import { TravelInfoStep } from "./TravelInfoStep";
import { TravelPhotosStep } from "./TravelPhotosStep";
import { TravelPreviewStep } from "./TravelPreviewStep";
import { TravelScriptStep } from "./TravelScriptStep";
import { TravelVoiceStep } from "./TravelVoiceStep";
import { ErrorNote, btnGhost, inputClass } from "./travel-ui";

const AUTOSAVE_MS = 600;

/** 단계별 완료 여부 — 탭에 체크 표시 */
function stepDone(project: TravelProject, step: TravelStep): boolean {
  switch (step) {
    case "info":
      return Boolean(
        project.info.placeName.trim() || project.info.region.trim(),
      );
    case "photos":
      return project.photos.length >= 2;
    case "script":
      return project.variants.length > 0;
    case "voice":
      return Boolean(project.audio);
    case "preview":
      return false;
  }
}

function relativeTime(ts: number): string {
  const sec = Math.max(0, Date.now() - ts) / 1000;
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

/** 프로젝트 카드 커버 — 첫 사진 */
function Cover({ blob }: { blob?: Blob }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) return setUrl("");
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#0a7c86_0%,#0e3a40_100%)]">
        <Plane className="h-8 w-8 -rotate-12 text-white/50" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25";

export default function TravelShoppingPage() {
  const [projects, setProjects] = useState<TravelProject[]>([]);
  const [project, setProject] = useState<TravelProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [error, setError] = useState("");
  /** 자동 만들기가 중간에 멈췄을 때 프로젝트 화면 위에 띄우는 안내 */
  const [notice, setNotice] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [building, setBuilding] = useState<{
    stage: AutoBuildStageId;
    detail?: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );
  const dirtyRef = useRef(false);

  const refreshList = useCallback(async () => {
    try {
      setProjects(await listTravelProjects());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "프로젝트 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  /** 변경 후 잠깐 기다렸다가 저장 (타이핑마다 저장하지 않도록) */
  useEffect(() => {
    if (!project || !dirtyRef.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      saveTravelProject(project)
        .then(() => {
          dirtyRef.current = false;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [project]);

  const update = useCallback((fn: (prev: TravelProject) => TravelProject) => {
    dirtyRef.current = true;
    setProject((prev) =>
      prev ? { ...fn(prev), updatedAt: Date.now() } : prev,
    );
  }, []);

  const goStep = (step: TravelStep) => update((p) => ({ ...p, step }));

  const create = async () => {
    const created = newTravelProject(newName.trim() || "새 여행 숏폼");
    await saveTravelProject(created);
    setNewName("");
    setProject(created);
  };

  const buildFromLink = async () => {
    const url = linkUrl.trim();
    if (!url || building) return;
    setError("");
    setNotice("");
    setBuilding({ stage: "import" });
    try {
      const result = await autoBuildFromCoupang(
        newTravelProject("쿠팡 링크 숏폼"),
        url,
        {
          onStage: (stage, detail) => setBuilding({ stage, detail }),
          onProject: (p) => void saveTravelProject(p),
        },
      );
      await saveTravelProject(result.project);
      dirtyRef.current = false;
      setLinkUrl("");
      setNotice(result.error ?? "");
      setProject(result.project);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "쿠팡 링크를 불러오지 못했습니다.",
      );
    } finally {
      setBuilding(null);
    }
  };

  const open = async (id: string) => {
    const found = await loadTravelProject(id);
    if (found) {
      setNotice("");
      setProject(found);
    }
  };

  const remove = async (id: string) => {
    if (
      !window.confirm(
        "이 프로젝트를 삭제할까요? 사진과 음성도 함께 지워집니다.",
      )
    )
      return;
    await deleteTravelProject(id);
    await refreshList();
  };

  const commitRename = async () => {
    if (!renaming) return;
    const target = projects.find((p) => p.id === renaming.id);
    const name = renaming.name.trim();
    setRenaming(null);
    if (!target || !name || name === target.name) return;
    await saveTravelProject({ ...target, name, updatedAt: Date.now() });
    await refreshList();
  };

  const backToList = async () => {
    if (project && dirtyRef.current) await saveTravelProject(project);
    dirtyRef.current = false;
    setNotice("");
    setProject(null);
    await refreshList();
  };

  if (!project) {
    const currentStage = building
      ? AUTO_BUILD_STAGES.findIndex((s) => s.id === building.stage)
      : -1;
    return (
      <div className="light-keep min-h-screen bg-[#f5f6fa] text-[#0e1016] antialiased">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pt-8">
          <div className="flex items-center justify-between">
            <Link
              href="/WingsAIStudioShotForm"
              className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-[#5c6170] hover:text-[#0e1016] ${focusRing}`}
            >
              <ArrowLeft className="h-4 w-4" />
              숏폼 홈
            </Link>
            <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[#9aa0ad] sm:block">
              Travel Shorts Studio
            </span>
          </div>

          <header className="mt-10 md:mt-14">
            <p className="text-sm font-bold text-[#0a7c86]">AI 여행쇼핑숏폼</p>
            <h1 className="mt-3 text-[38px] font-black leading-[1.08] tracking-[-0.04em] sm:text-5xl md:text-[60px]">
              숙소 링크 한 줄이면,
              <br />
              <span className="text-[#5c6170]">떠나고 싶어지는 숏폼.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#5c6170]">
              쿠팡 트래블 숙소 링크를 넣으면 사진 고르기·대본·목소리까지 이어서
              만들어, 제휴 링크용 세로 영상으로 완성합니다.
            </p>
          </header>

          {/* 보딩패스 — 메인 입력 */}
          <section
            aria-label="쿠팡 트래블 링크로 바로 만들기"
            className="relative mt-10 grid overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(14,16,22,0.05),0_30px_60px_-30px_rgba(14,16,22,0.28)] md:grid-cols-[1fr_260px]"
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[#9aa0ad]">
                <span>Boarding pass</span>
                <span>9:16 · Shorts / Reels</span>
              </div>

              <div className="mt-5 flex items-end gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#9aa0ad]">출발</p>
                  <p className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">
                    LINK
                  </p>
                </div>
                <div className="relative mb-3 flex-1 border-t-2 border-dashed border-[#d5d9e1]">
                  <Plane className="absolute -top-[11px] left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-white text-[#0a7c86]" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-[#9aa0ad]">도착</p>
                  <p className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">
                    SHORTS
                  </p>
                </div>
              </div>

              <label
                htmlFor="travel-link"
                className="mt-7 block text-[13px] font-semibold text-[#2a2e38]"
              >
                숙소 상세 링크{" "}
                <span className="font-normal text-[#5c6170]">
                  · 파트너스 링크도 돼요
                </span>
              </label>
              <Input
                id="travel-link"
                value={linkUrl}
                disabled={building !== null}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void buildFromLink()}
                className={`${inputClass} h-14 text-base md:text-base`}
                placeholder="https://trip.coupang.com/tp/products/... 또는 https://link.coupang.com/a/..."
              />

              {building ? (
                <ol
                  className="mt-6 grid gap-2 sm:grid-cols-2"
                  aria-live="polite"
                >
                  {AUTO_BUILD_STAGES.map((stage, i) => {
                    const state =
                      i < currentStage
                        ? "done"
                        : i === currentStage
                          ? "active"
                          : "todo";
                    return (
                      <li
                        key={stage.id}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${
                          state === "active"
                            ? "bg-[#eaf5f6] font-semibold text-[#0e1016]"
                            : state === "done"
                              ? "text-[#0a7c86]"
                              : "text-[#9aa0ad]"
                        }`}
                      >
                        {state === "done" ? (
                          <Check className="h-4 w-4 shrink-0" />
                        ) : state === "active" ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0a7c86] motion-reduce:animate-none" />
                        ) : (
                          <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[#d5d9e1]" />
                        )}
                        <span className="min-w-0">
                          {stage.label}
                          {state === "active" && building.detail ? (
                            <span className="block truncate text-xs font-normal text-[#5c6170]">
                              {building.detail}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-[#5c6170]">
                  사진·대본·음성까지 한 번에 만든 뒤 완성 화면으로 넘어갑니다.
                </p>
              )}
            </div>

            {/* 절취선 + 스텁 */}
            <div className="relative flex flex-col justify-between gap-6 border-t-2 border-dashed border-[#e3e6ec] bg-[#0a7c86] p-6 text-white sm:p-8 md:border-l-2 md:border-t-0 md:border-[#f5f6fa]/0">
              <span
                aria-hidden
                className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full bg-[#f5f6fa] md:block"
              />
              <span
                aria-hidden
                className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full bg-[#f5f6fa] md:block"
              />
              <span
                aria-hidden
                className="absolute inset-y-4 left-0 hidden border-l-2 border-dashed border-white/40 md:block"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">
                  Gate
                </p>
                <p className="mt-1 text-[34px] font-black leading-none tracking-[-0.03em]">
                  → 숏폼
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  링크만 넣고 출발하세요. 결과는 이 브라우저에 저장돼요.
                </p>
              </div>
              <Button
                type="button"
                disabled={building !== null || !linkUrl.trim()}
                onClick={() => void buildFromLink()}
                className={`h-14 w-full rounded-2xl bg-white text-base font-black text-[#0e1016] hover:bg-[#f0f7f8] disabled:bg-white/80 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50`}
              >
                {building ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                    만드는 중
                  </>
                ) : (
                  <>숏폼 만들기</>
                )}
              </Button>
            </div>
          </section>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#e3e6ec] bg-white/60 p-3 sm:flex-row sm:items-center sm:pl-5">
            <span className="shrink-0 text-sm font-semibold text-[#2a2e38]">
              링크 없이 직접 만들기
            </span>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
              className={`${inputClass} mt-0`}
              placeholder="프로젝트 이름 (비워 두면 '새 여행 숏폼')"
              aria-label="새 프로젝트 이름"
            />
            <Button
              type="button"
              onClick={() => void create()}
              className={`${btnGhost} shrink-0`}
            >
              <Plus className="mr-1 h-4 w-4" />빈 프로젝트
            </Button>
          </div>

          <ErrorNote message={error} />

          <section className="mt-16" aria-labelledby="travel-projects">
            <div className="mb-5 flex items-end justify-between gap-3 border-b border-[#e3e6ec] pb-4">
              <div>
                <h2
                  id="travel-projects"
                  className="text-2xl font-black tracking-[-0.03em]"
                >
                  내 프로젝트
                  {!loading && projects.length ? (
                    <span className="ml-2 text-base font-bold text-[#9aa0ad]">
                      {projects.length}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-[#5c6170]">
                  이 브라우저에만 저장돼요. 다른 기기에서는 보이지 않아요.
                </p>
              </div>
            </div>

            {loading ? (
              <div
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label="불러오는 중"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-[20px] bg-white"
                  >
                    <div className="aspect-[4/3] animate-pulse bg-[#eceef3] motion-reduce:animate-none" />
                    <div className="space-y-2 p-5">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[#eceef3] motion-reduce:animate-none" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-[#eceef3] motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-[20px] border-2 border-dashed border-[#d5d9e1] px-6 py-16 text-center">
                <Plane className="mx-auto h-9 w-9 -rotate-12 text-[#c3c8d2]" />
                <p className="mt-4 text-lg font-bold">
                  아직 떠난 여행이 없어요
                </p>
                <p className="mt-1 text-sm text-[#5c6170]">
                  위 보딩패스에 숙소 링크를 넣으면 첫 숏폼이 여기에 쌓입니다.
                </p>
              </div>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                  const stepIdx = TRAVEL_STEPS.findIndex(
                    (s) => s.id === p.step,
                  );
                  const stepLabel = TRAVEL_STEPS[stepIdx]?.label;
                  const isRenaming = renaming?.id === p.id;
                  return (
                    <li
                      key={p.id}
                      className="group relative overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(14,16,22,0.05),0_12px_30px_-20px_rgba(14,16,22,0.25)] transition-shadow hover:shadow-[0_1px_2px_rgba(14,16,22,0.05),0_24px_48px_-24px_rgba(14,16,22,0.35)] motion-reduce:transition-none"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#eceef3]">
                        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none">
                          <Cover blob={p.photos[0]?.blob} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#0e1016]">
                          {stepIdx + 1}/{TRAVEL_STEPS.length} · {stepLabel}
                        </span>
                        <span className="absolute bottom-3 right-3 text-xs font-semibold text-white">
                          사진 {p.photos.length}장
                        </span>
                      </div>
                      <div className="p-5">
                        {isRenaming ? (
                          <Input
                            autoFocus
                            value={renaming.name}
                            onChange={(e) =>
                              setRenaming({ id: p.id, name: e.target.value })
                            }
                            onBlur={() => void commitRename()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commitRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            aria-label="프로젝트 이름"
                            className={`${inputClass} relative z-10 mt-0 h-9 px-2.5 font-bold`}
                          />
                        ) : (
                          // 카드 전체를 덮는 클릭 영역 (after:inset-0)
                          <button
                            type="button"
                            onClick={() => void open(p.id)}
                            className={`block max-w-full truncate rounded text-left text-[17px] font-bold after:absolute after:inset-0 after:rounded-[20px] after:content-[''] ${focusRing}`}
                          >
                            {p.name}
                          </button>
                        )}
                        <p className="mt-0.5 truncate text-sm text-[#5c6170]">
                          {[p.info.placeName, p.info.region]
                            .filter(Boolean)
                            .join(" · ") || "숙소 미입력"}
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                          <div
                            className="flex flex-1 gap-1"
                            role="img"
                            aria-label={`진행 ${stepIdx + 1}/${TRAVEL_STEPS.length}단계`}
                          >
                            {TRAVEL_STEPS.map((s, i) => (
                              <span
                                key={s.id}
                                className={`h-1 flex-1 rounded-full ${
                                  stepDone(p, s.id) || i < stepIdx
                                    ? "bg-[#0a7c86]"
                                    : i === stepIdx
                                      ? "bg-[#0a7c86]/40"
                                      : "bg-[#e3e6ec]"
                                }`}
                              />
                            ))}
                          </div>
                          <time
                            className="shrink-0 text-xs text-[#9aa0ad]"
                            dateTime={new Date(p.updatedAt).toISOString()}
                          >
                            {relativeTime(p.updatedAt)}
                          </time>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${p.name} 메뉴`}
                            className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#0e1016] shadow-sm backdrop-blur hover:bg-white ${focusRing}`}
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="light-keep min-w-[160px] rounded-xl border-[#e3e6ec] bg-white p-1.5 text-[#0e1016]"
                        >
                          <DropdownMenuItem
                            className="rounded-lg px-3 py-2 text-sm"
                            onSelect={() => void open(p.id)}
                          >
                            <Plane className="h-4 w-4" />
                            열기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="rounded-lg px-3 py-2 text-sm"
                            onSelect={() =>
                              setRenaming({ id: p.id, name: p.name })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                            이름 바꾸기
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#eceef3]" />
                          <DropdownMenuItem
                            variant="destructive"
                            className="rounded-lg px-3 py-2 text-sm"
                            onSelect={() => void remove(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    );
  }

  const stepIndex = TRAVEL_STEPS.findIndex((s) => s.id === project.step);
  const next = () =>
    goStep(TRAVEL_STEPS[Math.min(stepIndex + 1, TRAVEL_STEPS.length - 1)]!.id);
  const stepProps = { project, update, onNext: next };

  return (
    <div className="light-keep min-h-screen bg-[#f5f6fa] text-[#0e1016] antialiased">
      <header className="sticky top-0 z-30 border-b border-[#e3e6ec] bg-[#f5f6fa]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <nav
              aria-label="경로"
              className="flex items-center gap-2 text-[13px] text-[#5c6170]"
            >
              <Link
                href="/WingsAIStudioShotForm"
                className={`rounded hover:text-[#0e1016] ${focusRing}`}
                aria-label="숏폼 홈"
              >
                <Home className="h-4 w-4" />
              </Link>
              <span className="text-[#c3c8d2]">/</span>
              <button
                type="button"
                className={`rounded font-medium hover:text-[#0e1016] ${focusRing}`}
                onClick={() => void backToList()}
              >
                여행쇼핑숏폼
              </button>
            </nav>
            <Input
              value={project.name}
              onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 h-10 max-w-xl border-transparent bg-transparent px-0 text-xl font-black tracking-[-0.02em] text-[#0e1016] shadow-none hover:border-[#e3e6ec] hover:px-2 focus-visible:border-[#0a7c86] focus-visible:bg-white focus-visible:px-2 focus-visible:ring-[#0a7c86]/15 md:text-xl"
              aria-label="프로젝트 이름"
            />
          </div>
          <span
            role="status"
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold ${
              saveState === "error"
                ? "border-[#f3c7c3] text-[#a3271c]"
                : "border-[#e3e6ec] text-[#5c6170]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                saveState === "saving"
                  ? "animate-pulse bg-[#e0a43a] motion-reduce:animate-none"
                  : saveState === "error"
                    ? "bg-[#d23b2f]"
                    : "bg-[#0a7c86]"
              }`}
            />
            {saveState === "saving"
              ? "저장 중…"
              : saveState === "error"
                ? "저장 실패"
                : "자동 저장됨"}
          </span>
        </div>

        <nav
          aria-label="제작 단계"
          className="mx-auto max-w-6xl overflow-x-auto px-4 pb-4 pt-3 sm:px-6"
        >
          <ol className="flex min-w-max items-center gap-1">
            {TRAVEL_STEPS.map((step, index) => {
              const active = step.id === project.step;
              const done = stepDone(project, step.id);
              return (
                <li key={step.id} className="flex items-center gap-1">
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className={`h-px w-4 sm:w-8 ${done || active ? "bg-[#0a7c86]" : "bg-[#d5d9e1]"}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => goStep(step.id)}
                    aria-current={active ? "step" : undefined}
                    className={`flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-left transition-colors motion-reduce:transition-none ${focusRing} ${
                      active
                        ? "bg-[#0e1016] text-white"
                        : "text-[#0e1016] hover:bg-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-black ${
                        active
                          ? "bg-[#0a7c86] text-white"
                          : done
                            ? "bg-[#eaf5f6] text-[#0a7c86]"
                            : "border border-[#d5d9e1] bg-white text-[#5c6170]"
                      }`}
                    >
                      {done && !active ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-bold leading-tight">
                        {step.label}
                      </span>
                      <span
                        className={`hidden text-xs leading-tight sm:block ${active ? "text-white/65" : "text-[#5c6170]"}`}
                      >
                        {step.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        {notice ? (
          <p
            role="status"
            className="mb-5 rounded-xl border border-[#f0dcae] bg-[#fdf8ec] px-4 py-3 text-sm leading-relaxed text-[#7a5410]"
          >
            {notice}
          </p>
        ) : null}
        {project.step === "info" ? <TravelInfoStep {...stepProps} /> : null}
        {project.step === "photos" ? <TravelPhotosStep {...stepProps} /> : null}
        {project.step === "script" ? <TravelScriptStep {...stepProps} /> : null}
        {project.step === "voice" ? <TravelVoiceStep {...stepProps} /> : null}
        {project.step === "preview" ? (
          <TravelPreviewStep project={project} update={update} />
        ) : null}
      </main>
    </div>
  );
}
