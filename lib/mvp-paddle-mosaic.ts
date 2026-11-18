/**
 * 오픈소스 PaddleOCR(PP-OCRv5, Apache-2.0)로 브라우저에서 중국어 글자 위치를 찾아 모자이크 구간을 만든다.
 * API 키·비용 없음. 모델(약 20MB)은 첫 실행 때 한 번 받고 브라우저 캐시를 쓴다.
 */

import type { OcrResultItem, PaddleOCR as PaddleOcrInstance } from "@paddleocr/paddleocr-js"
import type { PlacedStudioOverlay } from "@/lib/shotform-studio-overlay-catalog"
import { padBox } from "@/lib/shotform-mosaic-detect"
import {
  buildMosaicTracks,
  mergeMosaicRowsToOverlays,
  tracksToWindows,
  type DetectedChineseMosaicBox,
  type MosaicFrameDetectRow,
} from "@/lib/mvp-mosaic-merge"
import {
  buildMosaicBoundaryTimes,
  captureMosaicFramesAtTimes,
  effectiveMosaicCaptureDuration,
  nativeMosaicCaptureWidth,
  waitForVideoReady,
  type MosaicSceneSegment,
} from "@/lib/mvp-mosaic-frame-capture"

type PaddleOcr = Pick<PaddleOcrInstance, "predict">

/** 전체 훑기 간격 — 자막이 0.2초 미만으로만 보이는 경우는 드묾 */
const SCAN_INTERVAL_SEC = 0.2
const CAPTURE_WIDTH = 720
const CHUNK_FRAMES = 10
/** 이보다 작은 글자 줄은 제품 포장지 깨알 글씨로 보고 제외(프레임 높이 대비 %) */
const MIN_LINE_HEIGHT_PCT = 1.3
/**
 * 중국어 모델은 한글·숫자를 엉뚱한 한자로 읽는다(예: "号否早卫" 0.55, "型" 0.97).
 * 실측: 한자 2자 이상 오인식은 최고 0.74, 실제 중국어 자막은 0.8~0.999 → 0.78 + 2자 이상으로 가른다.
 */
const MIN_SCORE = 0.78
const MIN_CHINESE_CHARS = 2
const CHINESE_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g
/** 기본값은 짧은 변을 736px 이상으로 키워 느림 — 긴 변 960px 이하로 제한해도 자막 크기 글자는 충분히 잡힌다 */
const DETECT_PARAMS = { textDetLimitType: "max", textDetLimitSideLen: 960 } as const

let ocrPromise: Promise<PaddleOcr> | null = null

/** 워커(별도 스레드)로 먼저 시도해 편집 화면이 버벅이지 않게 하고, 안 되면 메인 스레드로 */
export function loadPaddleOcr(): Promise<PaddleOcr> {
  ocrPromise ??= (async () => {
    const { PaddleOCR } = await import("@paddleocr/paddleocr-js")
    const base = { lang: "ch", ocrVersion: "PP-OCRv5" } as const
    try {
      // auto: WebGPU(그래픽카드)가 되면 쓰고, 아니면 wasm(CPU)
      return await PaddleOCR.create({ ...base, worker: true, ortOptions: { backend: "auto" } })
    } catch (e) {
      console.warn("[paddle-mosaic] worker 모드 실패 → 메인 스레드", e)
      return await PaddleOCR.create({ ...base, ortOptions: { backend: "auto" } })
    }
  })().catch((e) => {
    ocrPromise = null
    throw e
  })
  return ocrPromise
}

type Rect = { left: number; top: number; right: number; bottom: number; text?: string }

const toRect = (b: DetectedChineseMosaicBox): Rect => ({
  left: b.center_x_pct - b.width_pct / 2,
  top: b.center_y_pct - b.height_pct / 2,
  right: b.center_x_pct + b.width_pct / 2,
  bottom: b.center_y_pct + b.height_pct / 2,
  text: b.text,
})

const touches = (a: Rect, b: Rect, gapPct: number) =>
  a.left - gapPct <= b.right && b.left - gapPct <= a.right && a.top - gapPct <= b.bottom && b.top - gapPct <= a.bottom

/** 문단·여러 줄 자막처럼 서로 닿는 글줄은 한 덩어리로 합쳐야 시간 축 병합에서 작은 박스로 줄어들지 않는다 */
export function unionTouchingMosaicBoxes(boxes: DetectedChineseMosaicBox[], gapPct = 1.2): DetectedChineseMosaicBox[] {
  const rects = boxes.map(toRect)
  for (let merged = true; merged; ) {
    merged = false
    outer: for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (!touches(rects[i]!, rects[j]!, gapPct)) continue
        const a = rects[i]!
        const b = rects.splice(j, 1)[0]!
        rects[i] = {
          left: Math.min(a.left, b.left),
          top: Math.min(a.top, b.top),
          right: Math.max(a.right, b.right),
          bottom: Math.max(a.bottom, b.bottom),
          text: [a.text, b.text].filter(Boolean).join(" "),
        }
        merged = true
        break outer
      }
    }
  }
  return rects.map((r) => ({
    center_x_pct: (r.left + r.right) / 2,
    center_y_pct: (r.top + r.bottom) / 2,
    width_pct: r.right - r.left,
    height_pct: r.bottom - r.top,
    text: r.text,
  }))
}

export function ocrItemsToMosaicBoxes(
  items: readonly OcrResultItem[],
  imageW: number,
  imageH: number
): DetectedChineseMosaicBox[] {
  const boxes: DetectedChineseMosaicBox[] = []
  for (const item of items) {
    if (item.score < MIN_SCORE || item.poly.length < 3) continue
    if ((item.text.match(CHINESE_CHAR_RE)?.length ?? 0) < MIN_CHINESE_CHARS) continue
    const xs = item.poly.map((p) => p[0])
    const ys = item.poly.map((p) => p[1])
    const left = (Math.min(...xs) / imageW) * 100
    const right = (Math.max(...xs) / imageW) * 100
    const top = (Math.min(...ys) / imageH) * 100
    const bottom = (Math.max(...ys) / imageH) * 100
    if (bottom - top < MIN_LINE_HEIGHT_PCT) continue
    boxes.push(
      padBox(
        {
          center_x_pct: (left + right) / 2,
          center_y_pct: (top + bottom) / 2,
          width_pct: right - left,
          height_pct: bottom - top,
          text: item.text,
        },
        0.8
      )
    )
  }
  return unionTouchingMosaicBoxes(boxes)
}

async function ocrTimes(
  ocr: PaddleOcr,
  video: HTMLVideoElement,
  times: number[],
  signal: AbortSignal | undefined,
  onFrame: (done: number) => void
): Promise<MosaicFrameDetectRow[]> {
  const rows: MosaicFrameDetectRow[] = []
  const width = nativeMosaicCaptureWidth(video, CAPTURE_WIDTH)
  for (let i = 0; i < times.length; i += CHUNK_FRAMES) {
    const frames = await captureMosaicFramesAtTimes(video, times.slice(i, i + CHUNK_FRAMES), {
      maxWidth: width,
      signal,
    })
    const blobs = await Promise.all(
      frames.map((f) => fetch(`data:image/jpeg;base64,${f.imageBase64}`).then((r) => r.blob()))
    )
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const results = await ocr.predict(blobs, DETECT_PARAMS)
    results.forEach((res, k) => {
      rows.push({
        timeSec: frames[k]!.timeSec,
        boxes: ocrItemsToMosaicBoxes(res.items, res.image.width, res.image.height),
      })
    })
    onFrame(Math.min(times.length, i + CHUNK_FRAMES))
  }
  return rows
}

function buildScanTimes(durationSec: number, segments?: readonly MosaicSceneSegment[]): number[] {
  const times = new Set<number>()
  const add = (t: number) => {
    if (t > 0.02 && t < durationSec - 0.02) times.add(Math.round(t * 1000) / 1000)
  }
  for (let t = SCAN_INTERVAL_SEC / 2; t < durationSec; t += SCAN_INTERVAL_SEC) add(t)
  // 컷이 바뀌는 순간 자막도 바뀌므로 컷 양끝을 추가로 본다
  for (const seg of segments ?? []) {
    add(seg.start + 0.04)
    add(seg.end - 0.04)
  }
  return [...times].sort((a, b) => a - b)
}

/** 미리보기 재생을 방해하지 않도록 분석 전용 video 요소를 따로 만든다 */
export function createMosaicAnalysisVideo(src: string): { video: HTMLVideoElement; dispose: () => void } {
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = src
  return {
    video,
    dispose: () => {
      video.removeAttribute("src")
      video.load()
    },
  }
}

export async function detectChineseMosaicWithPaddle(args: {
  video: HTMLVideoElement
  durationSec: number
  sceneSegments?: MosaicSceneSegment[]
  signal?: AbortSignal
  onStatus?: (text: string) => void
}): Promise<PlacedStudioOverlay[]> {
  const { video, sceneSegments, signal, onStatus } = args
  if (video.readyState < 2) await waitForVideoReady(video)
  const durationSec = effectiveMosaicCaptureDuration(video, args.durationSec)

  onStatus?.("OCR 모델 준비 중… (첫 실행만 약 20MB 다운로드)")
  const ocr = await loadPaddleOcr()

  const scanTimes = buildScanTimes(durationSec, sceneSegments)
  let rows = await ocrTimes(ocr, video, scanTimes, signal, (done) =>
    onStatus?.(`중국어 글자 찾는 중 ${done}/${scanTimes.length}…`)
  )

  // 자막이 나타나고 사라지는 시각을 0.03~0.24초 단위로 다시 확인해 모자이크 시작·끝을 맞춘다
  const boundaryTimes = buildMosaicBoundaryTimes(tracksToWindows(buildMosaicTracks(rows)), durationSec, {
    existingTimes: scanTimes,
    maxExtra: 80,
  })
  if (boundaryTimes.length) {
    rows = [
      ...rows,
      ...(await ocrTimes(ocr, video, boundaryTimes, signal, (done) =>
        onStatus?.(`시작·끝 시각 맞추는 중 ${done}/${boundaryTimes.length}…`)
      )),
    ].sort((a, b) => a.timeSec - b.timeSec)
  }

  return mergeMosaicRowsToOverlays(rows, durationSec, {
    videoW: video.videoWidth,
    videoH: video.videoHeight,
    sceneSegments,
    geometry: "cover",
  }).filter((ov) => [ov.x, ov.y, ov.mosaicW, ov.mosaicH].every(Number.isFinite))
}
