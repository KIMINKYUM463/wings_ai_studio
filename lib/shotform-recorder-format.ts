/** 클라이언트 전용 — MediaRecorder 출력 형식 선택·마무리 */

import { fixWebmBlobDuration } from "@/lib/mvp-webm-to-mp4"

const WITH_AUDIO_MIMES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
]

const VIDEO_ONLY_MIMES = [
  "video/mp4;codecs=avc1.640028",
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
]

/** 릴스·틱톡·쇼츠 업로드는 MP4(H.264+AAC)가 가장 안정적 — 지원 브라우저는 바로 MP4로 녹화 */
export function pickVideoRecorderMime(hasAudio: boolean): string {
  const candidates = hasAudio ? WITH_AUDIO_MIMES : VIDEO_ONLY_MIMES
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return "video/webm"
}

/** "video/mp4;codecs=..." → "video/mp4" */
export function recorderContainerMime(recorder: MediaRecorder, requested: string): string {
  return (recorder.mimeType || requested || "video/webm").split(";")[0]!
}

/**
 * 녹화 조각을 하나의 파일로 묶음. WebM은 길이 메타가 비어 있어
 * Windows 플레이어가 길이를 못 읽으므로 durationSec로 보정한다.
 */
export async function finalizeRecordedVideo(
  chunks: BlobPart[],
  containerMime: string,
  durationSec: number
): Promise<{ blob: Blob; extension: "mp4" | "webm" }> {
  const blob = new Blob(chunks, { type: containerMime })
  if (containerMime.startsWith("video/mp4")) return { blob, extension: "mp4" }
  try {
    return { blob: await fixWebmBlobDuration(blob, durationSec), extension: "webm" }
  } catch {
    return { blob, extension: "webm" }
  }
}
