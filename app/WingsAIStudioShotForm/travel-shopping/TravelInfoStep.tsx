"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  alignScenesToPhotos,
  importCoupangTravel,
} from "@/lib/travel-shorts/ai-client";
import {
  TRAVEL_MAX_PHOTOS,
  TRAVEL_PLATFORMS,
  type TravelInfo,
} from "@/lib/travel-shorts/types";
import {
  ErrorNote,
  NextButton,
  StepCard,
  btnPrimary,
  chipClass,
  inputClass,
  labelClass,
  panelClass,
  textareaClass,
  type TravelStepProps,
} from "./travel-ui";

export function TravelInfoStep({ project, update, onNext }: TravelStepProps) {
  const { info } = project;
  const patch = (next: Partial<TravelInfo>) =>
    update((p) => ({ ...p, info: { ...p.info, ...next } }));
  const ready = Boolean(info.placeName.trim() || info.region.trim());
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  /** 쿠팡 정보로 칸을 채우고, 사진은 빈 자리만큼 뒤에 붙임 */
  const importLink = async () => {
    setImporting(true);
    setError("");
    try {
      const imported = await importCoupangTravel(link);
      update((p) => {
        const photos = [...p.photos, ...imported.photos].slice(
          0,
          TRAVEL_MAX_PHOTOS,
        );
        return {
          ...p,
          info: { ...p.info, ...imported.info },
          photos,
          variants: p.variants.map((v) => alignScenesToPhotos(v, photos)),
        };
      });
      setLink("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "쿠팡 링크를 불러오지 못했습니다.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <StepCard
      eyebrow="Step 01 · 숙소·상품"
      title="어떤 숙소·여행상품인가요?"
      description="입력한 내용만 대본에 씁니다. 모르는 칸은 비워 두면 AI가 지어내지 않아요."
    >
      <div className="mb-8 rounded-2xl border border-[#0a7c86]/20 bg-[#eef7f8] p-5">
        <Label htmlFor="info-import" className={labelClass}>
          쿠팡 트래블 링크로 채우기
        </Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="info-import"
            value={link}
            disabled={importing}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && link.trim() && void importLink()
            }
            className={`${inputClass} mt-0 flex-1`}
            placeholder="https://trip.coupang.com/tp/products/..."
          />
          <Button
            type="button"
            disabled={importing || !link.trim()}
            onClick={() => void importLink()}
            className={`${btnPrimary} shrink-0`}
          >
            {importing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Link2 className="mr-1.5 h-4 w-4" />
            )}
            불러오기
          </Button>
        </div>
        <p className="mt-2 text-sm text-[#5c6170]">
          숙소명·지역·편의시설·평점과 사진 최대 8장을 가져옵니다. 가격은
          날짜마다 달라서 직접 적어 주세요.
        </p>
        <ErrorNote message={error} />
      </div>

      <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
        <div>
          <Label className={labelClass}>숙소·상품 이름</Label>
          <Input
            value={info.placeName}
            onChange={(e) => patch({ placeName: e.target.value })}
            className={inputClass}
            placeholder="예: 바다정원 풀빌라"
          />
        </div>
        <div>
          <Label className={labelClass}>지역</Label>
          <Input
            value={info.region}
            onChange={(e) => patch({ region: e.target.value })}
            className={inputClass}
            placeholder="예: 제주 서귀포"
          />
        </div>
        <div>
          <Label className={labelClass}>가격 문구 (선택)</Label>
          <Input
            value={info.priceText}
            onChange={(e) => patch({ priceText: e.target.value })}
            className={inputClass}
            placeholder="예: 1박 18만원대"
          />
        </div>
        <div>
          <Label className={labelClass}>예약 링크 (선택 · 제휴 링크)</Label>
          <Input
            value={info.bookingUrl}
            onChange={(e) => patch({ bookingUrl: e.target.value })}
            className={inputClass}
            placeholder="https://"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className={labelClass} id="info-platform">
          예약 플랫폼
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-labelledby="info-platform"
        >
          {TRAVEL_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patch({ platform: p.id })}
              aria-pressed={info.platform === p.id}
              className={chipClass(info.platform === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Label className={labelClass}>이 숙소의 장점 (한 줄에 하나)</Label>
        <Textarea
          value={info.highlights}
          onChange={(e) => patch({ highlights: e.target.value })}
          className={textareaClass}
          rows={4}
          placeholder={"예:\n전 객실 개별 온수풀\n조식 포함\n공항에서 20분"}
        />
      </div>

      <label
        className={`mt-6 flex cursor-pointer items-start gap-3 ${panelClass} has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0a7c86]/25`}
      >
        <input
          type="checkbox"
          checked={info.hideName}
          onChange={(e) => patch({ hideName: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a7c86]"
        />
        <span>
          <span className="block text-[15px] font-semibold text-[#0e1016]">
            영상에서 숙소명·지역 숨기기
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-[#5c6170]">
            &quot;어딘지 궁금하면 댓글&quot; 방식으로 댓글·DM 문의를 늘릴 때
            켜세요. 대본·제목·해시태그에서 이름과 지역을 뺍니다.
          </span>
        </span>
      </label>

      <NextButton
        onClick={onNext}
        disabled={!ready}
        hint="숙소 이름이나 지역 중 하나는 적어 주세요."
      />
    </StepCard>
  );
}
