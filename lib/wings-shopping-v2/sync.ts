import type { TimedNormBox } from './media/mosaic';
import type { Clip, Source } from './types';

/** 비트 끝에 두는 여백(초). 무음 구간 없이 바로 이어지도록 0으로 둔다. */
export const PAD = 0;
/** 이 비율 이상이면 느리게 재생해서 맞추고, 미만이면 다음 컷을 잇는다. */
export const SLOW_RATIO = 0.75;

export type SegmentPiece = {
  sourceId: string;
  start: number;
  end: number;
  speed: number; // 1 = 원속도
  freezeAfter: number; // 0 = 정지 프레임 없음
};

export function pieceOutputDuration(p: SegmentPiece): number {
  return (p.end - p.start) / p.speed + p.freezeAfter;
}

/**
 * 조각 길이들을 프레임 수로 바꾼다. 누적 경계에서 반올림해서 조각마다 생기는 반올림 오차가 쌓이지 않게 한다.
 * 프레임 수 합 = round(전체 길이 × fps)
 */
export function pieceFrameCounts(durations: number[], fps: number): number[] {
  let cum = 0;
  return durations.map((d) => {
    const a = Math.round(cum * fps);
    cum += d;
    return Math.max(1, Math.round(cum * fps) - a);
  });
}

/** 조각 구간과 겹치는 같은 소스 클립들의 글자 박스를 모은다 (모자이크용) */
export function masksForPiece(clips: Clip[], piece: SegmentPiece): number[][] {
  return clips
    .filter((c) => c.sourceId === piece.sourceId && c.start < piece.end && c.end > piece.start)
    .flatMap((c) => c.textBoxes ?? []);
}

/**
 * 긴 원본 연속 구간 안에서도 각 클립에 있던 자막이 해당 시간대에만 모자이크되도록
 * 조각 내부 상대 시각(startOffset ~ endOffset)과 함께 박스를 모은다.
 */
export function timedMasksForPiece(clips: Clip[], piece: SegmentPiece): TimedNormBox[] {
  const out: TimedNormBox[] = [];
  for (const c of clips) {
    if (c.sourceId !== piece.sourceId) continue;
    if (!c.textBoxes?.length) continue;
    const overlapStart = Math.max(piece.start, c.start);
    const overlapEnd = Math.min(piece.end, c.end);
    if (overlapEnd <= overlapStart + 0.02) continue;
    const startOffset = (overlapStart - piece.start) / piece.speed;
    const endOffset = (overlapEnd - piece.start) / piece.speed;
    for (const box of c.textBoxes) {
      out.push({ box, startOffset, endOffset });
    }
  }
  return out;
}

/** clip 뒤에 이어 쓸 수 있는 같은 소스의 컷들 (제외한 컷은 빼고, 시작 순) */
export function continuationClips(all: Clip[], clip: Clip): Clip[] {
  return all
    .filter((c) => c.sourceId === clip.sourceId && c.id !== clip.id && !c.excluded && c.start >= clip.end - 1e-6)
    .sort((a, b) => a.start - b.start);
}

/**
 * 원본 영상을 잘게 토막 내거나 슬로모션·정지화면을 걸지 않고,
 * 준비된 원본 영상을 처음부터 1.0배속 연속 통 구간으로 그대로 이어서 전체 나레이션 길이를 채운다.
 * - 사용자가 명시적으로 '뺌(excluded)' 표시한 구간만 건너뛰고, 이어진 구간은 절대 자르지 않고 하나로 합친다.
 * - 원본이 1개면 0초부터 끝까지 단 하나의 연속 스트림으로 재생된다.
 * - 원본이 여러 개면 각 원본을 한 덩어리씩 순서대로 길게 재생해 컷 난도질이 발생하지 않는다.
 */
export function planContinuousOriginalStreams(
  sources: Source[],
  clips: Clip[],
  totalDuration: number,
): SegmentPiece[] {
  const readySources = sources.filter((s) => s.status === 'ready' && s.file && (s.duration ?? 0) > 0.3);
  if (!readySources.length || totalDuration <= 0.05) return [];

  // 각 소스별로 제외(excluded)되지 않은 연속 시간 구간들을 병합해 구한다
  const spans: { sourceId: string; start: number; end: number }[] = [];
  for (const src of readySources) {
    const dur = src.duration ?? 0;
    const srcClips = clips
      .filter((c) => c.sourceId === src.id)
      .sort((a, b) => a.start - b.start);

    if (!srcClips.length || srcClips.every((c) => !c.excluded)) {
      // 제외한 장면이 하나도 없으면 원본 파일 전체 [0, dur]를 단 한 번도 자르지 않고 통째로 둔다
      spans.push({ sourceId: src.id, start: 0, end: dur });
      continue;
    }

    const usable = srcClips.filter((c) => !c.excluded);
    for (const c of usable) {
      const prev = spans[spans.length - 1];
      if (prev && prev.sourceId === src.id && Math.abs(prev.end - c.start) < 0.08) {
        prev.end = c.end;
      } else if (c.end - c.start >= 0.3) {
        spans.push({ sourceId: src.id, start: c.start, end: c.end });
      }
    }
  }

  if (!spans.length) {
    const first = readySources[0]!;
    spans.push({ sourceId: first.id, start: 0, end: first.duration ?? totalDuration });
  }

  const totalAvailable = spans.reduce((sum, s) => sum + (s.end - s.start), 0);
  const out: SegmentPiece[] = [];
  let remaining = totalDuration;

  if (spans.length === 1) {
    // 단일 연속 원본: 처음부터 필요한 길이만큼 통째로 1배속 재생 (부족할 때만 처음으로 자연스럽게 이어 재생)
    const s = spans[0]!;
    const len = s.end - s.start;
    while (remaining > 0.02) {
      const take = Math.min(len, remaining);
      out.push({ sourceId: s.sourceId, start: s.start, end: s.start + take, speed: 1, freezeAfter: 0 });
      remaining -= take;
    }
    return out;
  }

  if (totalAvailable >= totalDuration) {
    // 선택한 여러 원본들이 모두 고르게 등장하되, 각 원본 안에서는 자르지 않고 긴 통 구간 하나씩만 1배속으로 쓴다
    for (let i = 0; i < spans.length && remaining > 0.02; i++) {
      const s = spans[i]!;
      const len = s.end - s.start;
      const isLast = i === spans.length - 1;
      const share = isLast
        ? remaining
        : Math.min(len, Math.max(3.0, (len / totalAvailable) * totalDuration));
      const take = Math.min(len, remaining, share);
      if (take > 0.05) {
        out.push({
          sourceId: s.sourceId,
          start: s.start,
          end: s.start + take,
          speed: 1,
          freezeAfter: 0,
        });
        remaining -= take;
      }
    }
    // 반올림 등으로 약간 남은 시간이 있으면 여유가 남은 구간 뒤를 이어 붙인다
    for (const piece of out) {
      if (remaining <= 0.01) break;
      const span = spans.find((s) => s.sourceId === piece.sourceId && Math.abs(s.start - piece.start) < 0.01);
      if (!span) continue;
      const extra = Math.min(span.end - piece.end, remaining);
      if (extra > 0.01) {
        piece.end += extra;
        remaining -= extra;
      }
    }
  } else {
    // 전체 원본 합계가 음성보다 짧으면 정지 프레임(freezeAfter) 대신 모든 원본을 통으로 다 쓴 뒤 처음부터 이어 붙인다
    while (remaining > 0.02) {
      for (const s of spans) {
        if (remaining <= 0.02) break;
        const take = Math.min(s.end - s.start, remaining);
        out.push({
          sourceId: s.sourceId,
          start: s.start,
          end: s.start + take,
          speed: 1,
          freezeAfter: 0,
        });
        remaining -= take;
      }
    }
  }

  return out;
}

/**
 * (호환용) 단일 비트 계획 — 정지 프레임과 슬로모션 왜곡 없이 1배속을 우선한다.
 */
export function planBeat(clip: Clip, nextClipsSameSource: Clip[], ttsDuration: number): SegmentPiece[] {
  const d = ttsDuration + PAD;
  const L = clip.end - clip.start;
  const piece = (start: number, end: number, speed = 1, freezeAfter = 0): SegmentPiece => ({
    sourceId: clip.sourceId, start, end, speed, freezeAfter,
  });

  if (L >= d) {
    return [piece(clip.start, clip.start + d, 1, 0)];
  }

  const pieces = [piece(clip.start, clip.end, 1, 0)];
  let acc = L;
  for (const next of nextClipsSameSource) {
    const nl = next.end - next.start;
    if (nl <= 0) continue;
    const prev = pieces[pieces.length - 1]!;
    if (acc + nl >= d) {
      const need = d - acc;
      if (prev.sourceId === next.sourceId && Math.abs(prev.end - next.start) < 0.05) {
        prev.end = next.start + need;
      } else {
        pieces.push(piece(next.start, next.start + need, 1, 0));
      }
      return pieces;
    }
    if (prev.sourceId === next.sourceId && Math.abs(prev.end - next.start) < 0.05) {
      prev.end = next.end;
    } else {
      pieces.push(piece(next.start, next.end, 1, 0));
    }
    acc += nl;
  }
  // 그래도 부족할 때만 완만한 배속 보정 (끝 프레임 정지는 쓰지 않음)
  if (acc > 0.2 && acc < d) {
    const speed = Math.max(0.5, acc / d);
    return pieces.map((p) => ({ ...p, speed, freezeAfter: 0 }));
  }
  return pieces;
}
