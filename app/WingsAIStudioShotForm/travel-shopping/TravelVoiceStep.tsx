"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mic2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPERTONIC_BUILTIN_VOICES } from "@/lib/supertonic-local";
import { VOICE_PREVIEW_BGM_OPTIONS } from "@/lib/shotform-factory-voice-preview-bgm";
import {
  ELEVENLABS_SAMPLE_VOICES,
  synthesizeTtsPreview,
  ttsProviderFromVoiceId,
} from "@/lib/shotform-tts-providers";
import { buildTravelAudio, revokeIfBlob } from "@/lib/travel-shorts/audio";
import {
  selectedTravelScript,
  travelScriptKey,
  type TravelVoiceSettings,
} from "@/lib/travel-shorts/types";
import {
  ErrorNote,
  NextButton,
  StepCard,
  btnGhost,
  btnInk,
  chipClass,
  inputClass,
  labelClass,
  panelClass,
  rangeClass,
  selectClass,
  type TravelStepProps,
} from "./travel-ui";

const VOICE_GROUPS: Array<{
  label: string;
  note: string;
  voices: Array<{ id: string; name: string }>;
}> = [
  {
    label: "수퍼토닉3",
    note: "PC 로컬 무료",
    voices: SUPERTONIC_BUILTIN_VOICES.map((v) => ({
      id: `supertonic-${v.voice_id}`,
      name: v.name,
    })),
  },
  {
    label: "ElevenLabs",
    note: "API 키 필요",
    voices: ELEVENLABS_SAMPLE_VOICES.map((v) => ({
      id: `elevenlabs-${v.id}`,
      name: v.name,
    })),
  },
  {
    label: "아담",
    note: "PC 로컬 · 서버 필요",
    voices: [{ id: "adam-adam", name: "아담" }],
  },
];

export function TravelVoiceStep({ project, update, onNext }: TravelStepProps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { voice } = project;
  const variant = selectedTravelScript(project);
  const stale = Boolean(
    project.audio && project.audio.scriptKey !== travelScriptKey(variant),
  );

  const audioUrl = useMemo(
    () => (project.audio ? URL.createObjectURL(project.audio.blob) : ""),
    [project.audio],
  );
  useEffect(() => () => revokeIfBlob(audioUrl), [audioUrl]);

  const patchVoice = (next: Partial<TravelVoiceSettings>) =>
    update((p) => ({ ...p, voice: { ...p.voice, ...next } }));

  const preview = async () => {
    setBusy("preview");
    setError("");
    try {
      const url = await synthesizeTtsPreview(
        voice.voiceId,
        undefined,
        voice.speed,
      );
      const audio = new Audio(url);
      audio.onended = () => revokeIfBlob(url);
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "미리듣기 실패");
    } finally {
      setBusy("");
    }
  };

  const generate = async () => {
    if (!variant) return;
    setError("");
    try {
      const audio = await buildTravelAudio(variant, voice, setBusy);
      update((p) => ({ ...p, audio }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "음성 생성 실패");
    } finally {
      setBusy("");
    }
  };

  const provider = ttsProviderFromVoiceId(voice.voiceId);

  return (
    <StepCard
      eyebrow="Step 04 · 음성"
      title="목소리·배경음"
      description="장면마다 따로 읽은 뒤 이어 붙여서, 자막과 사진이 목소리에 딱 맞춰 넘어갑니다."
    >
      <div className="space-y-7">
        {VOICE_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <p className="text-[15px] font-bold text-[#0e1016]">
              {group.label}{" "}
              <span className="text-sm font-normal text-[#5c6170]">
                · {group.note}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.voices.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => patchVoice({ voiceId: v.id })}
                  aria-pressed={voice.voiceId === v.id}
                  className={chipClass(voice.voiceId === v.id)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="max-w-md">
          <Label htmlFor="voice-id" className={labelClass}>
            다른 목소리 ID 직접 입력 (타입캐스트 등)
          </Label>
          <Input
            id="voice-id"
            value={voice.voiceId}
            onChange={(e) => patchVoice({ voiceId: e.target.value.trim() })}
            className={inputClass}
            placeholder="typecast-tc_..."
          />
          {!provider ? (
            <p className="mt-1.5 text-sm text-[#a86a00]">
              supertonic- / elevenlabs- / typecast- 로 시작해야 합니다.
            </p>
          ) : null}
        </div>

        <div className={`grid gap-6 md:grid-cols-3 ${panelClass}`}>
          <div>
            <Label htmlFor="voice-speed" className={labelClass}>
              말 속도{" "}
              <span className="tabular-nums text-[#0a7c86]">
                {voice.speed.toFixed(2)}x
              </span>
            </Label>
            <input
              id="voice-speed"
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={voice.speed}
              onChange={(e) => patchVoice({ speed: Number(e.target.value) })}
              className={rangeClass}
            />
          </div>
          <div>
            <Label htmlFor="voice-bgm" className={labelClass}>
              배경음
            </Label>
            <select
              id="voice-bgm"
              value={voice.bgmId}
              onChange={(e) => patchVoice({ bgmId: e.target.value })}
              className={selectClass}
            >
              <option value="">없음</option>
              {VOICE_PREVIEW_BGM_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="voice-bgm-volume" className={labelClass}>
              배경음 크기{" "}
              <span className="tabular-nums text-[#0a7c86]">
                {voice.bgmVolume}
              </span>
            </Label>
            <input
              id="voice-bgm-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={!voice.bgmId}
              value={voice.bgmVolume}
              onChange={(e) =>
                patchVoice({ bgmVolume: Number(e.target.value) })
              }
              className={rangeClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={btnGhost}
            disabled={Boolean(busy) || !provider}
            onClick={() => void preview()}
          >
            {busy === "preview" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            미리듣기
          </Button>
          <Button
            type="button"
            disabled={Boolean(busy) || !provider || !variant}
            onClick={() => void generate()}
            className={btnInk}
          >
            {busy && busy !== "preview" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Mic2 className="mr-2 h-4 w-4" />
            )}
            {busy && busy !== "preview"
              ? busy
              : project.audio
                ? "음성 다시 만들기"
                : "전체 음성 만들기"}
          </Button>
        </div>
      </div>

      {project.audio ? (
        <div className="mt-7 rounded-2xl border border-[#0a7c86]/20 bg-[#eef7f8] p-5">
          {stale ? (
            <p
              role="status"
              className="mb-3 text-sm font-semibold text-[#a86a00]"
            >
              대본이나 사진 순서가 바뀌었어요. 음성을 다시 만들어야 자막과
              맞습니다.
            </p>
          ) : null}
          <audio controls src={audioUrl} className="w-full" />
          <p className="mt-3 text-sm tabular-nums text-[#5c6170]">
            <span className="font-bold text-[#0e1016]">
              총 {project.audio.durationSec.toFixed(1)}초
            </span>{" "}
            · 장면별{" "}
            {project.audio.sceneTimes
              .map(([s, e]) => `${(e - s).toFixed(1)}s`)
              .join(" / ")}
          </p>
        </div>
      ) : null}

      <ErrorNote message={error} />
      <NextButton
        onClick={onNext}
        disabled={!project.audio || stale}
        label="미리보기로"
        hint={
          stale
            ? "대본이 바뀌었어요. 음성을 다시 만들어 주세요."
            : "전체 음성을 먼저 만들어 주세요."
        }
      />
    </StepCard>
  );
}
