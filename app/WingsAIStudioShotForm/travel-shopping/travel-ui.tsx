"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TravelPhoto, TravelProject } from "@/lib/travel-shorts/types";

export type TravelStepProps = {
  project: TravelProject;
  update: (fn: (prev: TravelProject) => TravelProject) => void;
  onNext: () => void;
};

/*
 * 디자인 토큰 (hex 고정 — light-remap 영향을 받지 않도록)
 * pearl #f5f6fa · ink #0e1016 · muted #5c6170 · line #e3e6ec · lagoon #0a7c86 (유일한 강조색)
 */
const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0a7c86]/25 focus-visible:ring-offset-0";

export const btnPrimary = `h-11 rounded-xl bg-[#0a7c86] px-5 text-[15px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(10,124,134,0.8)] transition-colors hover:bg-[#086871] disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none ${focusRing}`;

/** AI·유료 작업용 — 잉크색으로 강조색과 구분 */
export const btnInk = `h-11 rounded-xl bg-[#0e1016] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[#262a35] disabled:opacity-40 motion-reduce:transition-none ${focusRing}`;

export const btnGhost = `h-11 rounded-xl border border-[#e3e6ec] bg-white px-4 text-[15px] font-semibold text-[#0e1016] shadow-none transition-colors hover:border-[#c9ced8] hover:bg-[#f9fafc] disabled:opacity-40 motion-reduce:transition-none ${focusRing}`;

export const inputClass = `mt-2 h-11 rounded-xl border-[#e3e6ec] bg-white px-3.5 text-[15px] text-[#0e1016] shadow-none placeholder:text-[#9aa0ad] focus-visible:border-[#0a7c86] focus-visible:ring-[#0a7c86]/15 md:text-[15px]`;

export const textareaClass = `mt-2 rounded-xl border-[#e3e6ec] bg-white px-3.5 py-3 text-[15px] leading-relaxed text-[#0e1016] shadow-none placeholder:text-[#9aa0ad] focus-visible:border-[#0a7c86] focus-visible:ring-[#0a7c86]/15 md:text-[15px]`;

export const labelClass = "text-[13px] font-semibold text-[#2a2e38]";

export const selectClass = `mt-2 h-11 w-full rounded-xl border border-[#e3e6ec] bg-white px-3 text-[15px] text-[#0e1016] ${focusRing}`;

export const rangeClass = `mt-4 w-full accent-[#0a7c86] ${focusRing}`;

export function chipClass(active: boolean): string {
  return `rounded-full border px-4 py-2 text-sm transition-colors motion-reduce:transition-none ${focusRing} ${
    active
      ? "border-[#0e1016] bg-[#0e1016] font-semibold text-white"
      : "border-[#e3e6ec] bg-white text-[#3b3f4a] hover:border-[#c9ced8]"
  }`;
}

/** 패널 안의 옅은 영역 (팁·설정 묶음) */
export const panelClass =
  "rounded-2xl border border-[#eceef3] bg-[#f8f9fb] p-5";

export function StepCard({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#e3e6ec] bg-white p-5 shadow-[0_1px_2px_rgba(14,16,22,0.04),0_16px_40px_-24px_rgba(14,16,22,0.18)] sm:p-7 md:p-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0a7c86]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.02em] text-[#0e1016] md:text-[26px]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-[15px] leading-relaxed text-[#5c6170]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function NextButton({
  onClick,
  disabled,
  label = "다음 단계",
  hint,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  /** 비활성일 때 왜 못 넘어가는지 */
  hint?: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-dashed border-[#e3e6ec] pt-6">
      {disabled && hint ? (
        <p className="mr-auto text-sm text-[#5c6170]">{hint}</p>
      ) : null}
      <Button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={btnPrimary}
      >
        {label}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-[#f3c7c3] bg-[#fdf3f2] px-4 py-3 text-sm leading-relaxed text-[#a3271c]"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** 사진 Blob → 화면용 object URL (사진이 빠지면 자동 해제) */
export function usePhotoUrls(photos: TravelPhoto[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const photosRef = useRef(photos);
  photosRef.current = photos;
  // 역할·순서만 바뀌었을 때 URL을 다시 만들지 않도록 id 집합으로만 갱신
  const idKey = photos
    .map((p) => p.id)
    .sort()
    .join(",");

  useEffect(() => {
    const next = new Map(
      photosRef.current.map((p) => [p.id, URL.createObjectURL(p.blob)]),
    );
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [idKey]);

  return urls;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
