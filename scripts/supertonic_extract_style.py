#!/usr/bin/env python3
"""
학습용 녹음(WAV) → Supertonic 3 voice-style JSON 생성.

로컬 open-weight 모델에는 공식 보이스 인코더가 없습니다.
이 스크립트는:
  1) 피치로 성별 후보군을 좁히고
  2) 로컬 `supertonic serve` 로 같은 문장을 합성한 뒤
  3) 스펙트럴 유사도가 가장 높은 내장 스타일을 복제해 JSON을 만듭니다.

완전 동일 클론이 필요하면 Voice Builder 유료 JSON을 import 하세요.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

DEFAULT_BASE = os.environ.get("SUPERTONIC_BASE_URL", "http://127.0.0.1:7788").rstrip("/")
PROBE_TEXT = "안녕하세요. 윙스에이아이입니다. 오늘도 좋은 하루 되세요."
CACHE_STYLES = Path.home() / ".cache" / "supertonic3" / "voice_styles"


def read_wav_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        ch = wf.getnchannels()
        sr = wf.getframerate()
        sw = wf.getsampwidth()
        n = wf.getnframes()
        raw = wf.readframes(n)
    if sw == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sw == 4:
        data = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    elif sw == 1:
        data = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"unsupported sample width: {sw}")
    if ch > 1:
        data = data.reshape(-1, ch).mean(axis=1)
    return data, sr


def estimate_f0_hz(y: np.ndarray, sr: int) -> float:
    """거친 자기상관 F0 추정 (성별 후보용)."""
    if y.size < sr // 10:
        return 0.0
    # 중앙 500ms
    mid = y.size // 2
    win = int(0.5 * sr)
    seg = y[max(0, mid - win) : mid + win]
    if seg.size < 256:
        seg = y
    seg = seg - float(np.mean(seg))
    # 80–320 Hz
    min_lag = max(1, int(sr / 320))
    max_lag = min(seg.size - 1, int(sr / 80))
    if max_lag <= min_lag + 2:
        return 0.0
    corr = np.correlate(seg, seg, mode="full")
    corr = corr[corr.size // 2 :]
    region = corr[min_lag:max_lag]
    if region.size == 0:
        return 0.0
    lag = int(np.argmax(region)) + min_lag
    if corr[lag] <= 0:
        return 0.0
    return float(sr / lag)


def spectral_fingerprint(y: np.ndarray, sr: int, n_fft: int = 1024) -> np.ndarray:
    """저비용 로그-멜 유사 밴드 에너지 벡터."""
    if y.size < n_fft:
        y = np.pad(y, (0, n_fft - y.size))
    # 앞 2.5초
    y = y[: int(2.5 * sr)]
    hop = n_fft // 2
    frames = []
    for i in range(0, max(1, y.size - n_fft), hop):
        frame = y[i : i + n_fft] * np.hanning(n_fft)
        mag = np.abs(np.fft.rfft(frame))
        frames.append(mag)
    if not frames:
        mag = np.abs(np.fft.rfft(y[:n_fft] * np.hanning(n_fft)))
        frames = [mag]
    mean = np.mean(np.stack(frames, axis=0), axis=0)
    # 20 log bands
    edges = np.linspace(0, mean.size - 1, 21).astype(int)
    bands = []
    for a, b in zip(edges[:-1], edges[1:]):
        chunk = mean[a : max(a + 1, b)]
        bands.append(float(np.log1p(np.mean(chunk))))
    v = np.asarray(bands, dtype=np.float32)
    v = v - float(np.mean(v))
    n = float(np.linalg.norm(v) + 1e-8)
    return v / n


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def tts_wav_bytes(base: str, text: str, voice: str, lang: str = "ko") -> bytes:
    body = json.dumps(
        {
            "text": text,
            "voice": voice,
            "lang": lang,
            "speed": 1.05,
            "total_steps": 8,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/v1/tts",
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        data = res.read()
    if not data.startswith(b"RIFF"):
        raise RuntimeError(f"TTS non-WAV response: {data[:160]!r}")
    return data


def wav_bytes_to_audio(data: bytes) -> tuple[np.ndarray, int]:
    tmp = Path(os.environ.get("TEMP", "/tmp")) / f"supertonic_probe_{os.getpid()}.wav"
    tmp.write_bytes(data)
    try:
        return read_wav_mono(tmp)
    finally:
        try:
            tmp.unlink()
        except OSError:
            pass


def load_style_json(voice_id: str) -> dict:
    path = CACHE_STYLES / f"{voice_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"builtin style not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_wav(path: Path) -> Path:
    """webm 등은 이미 서버에서 wav로 변환되어 온다고 가정. wav 아니면 실패."""
    if path.suffix.lower() == ".wav":
        return path
    raise SystemExit(f"WAV 파일만 지원합니다: {path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-url", default=DEFAULT_BASE)
    ap.add_argument("--text", default=PROBE_TEXT)
    args = ap.parse_args()

    wav_path = ensure_wav(Path(args.wav))
    name = "".join(c if c.isalnum() or c in "_-" else "_" for c in args.name).strip("_")[:48]
    if not name:
        name = f"voice_{os.getpid()}"

    y, sr = read_wav_mono(wav_path)
    if y.size < sr * 1.5:
        print("error: 녹음이 너무 짧습니다 (최소 1.5초)", file=sys.stderr)
        return 2

    f0 = estimate_f0_hz(y, sr)
    if f0 > 0 and f0 < 165:
        candidates = ["M1", "M2", "M3", "M4", "M5"]
    elif f0 >= 165:
        candidates = ["F1", "F2", "F3", "F4", "F5"]
    else:
        candidates = ["F1", "F2", "M1", "M2"]

    ref_fp = spectral_fingerprint(y, sr)
    print(f"f0≈{f0:.1f}Hz candidates={candidates}", flush=True)

    best_id = candidates[0]
    best_score = -1.0
    for vid in candidates:
        try:
            synth = tts_wav_bytes(args.base_url, args.text, vid)
            sy, ssr = wav_bytes_to_audio(synth)
            # 샘플레이트 맞춤
            if ssr != sr and sy.size > 0:
                # 단순 리샘플
                x_old = np.linspace(0, 1, num=sy.size, endpoint=False)
                x_new = np.linspace(0, 1, num=int(sy.size * sr / ssr), endpoint=False)
                sy = np.interp(x_new, x_old, sy).astype(np.float32)
                ssr = sr
            score = cosine(ref_fp, spectral_fingerprint(sy, ssr))
            print(f"  {vid}: score={score:.4f}", flush=True)
            if score > best_score:
                best_score = score
                best_id = vid
        except Exception as e:
            print(f"  {vid}: fail {e}", file=sys.stderr, flush=True)

    style = load_style_json(best_id)
    style["metadata"] = {
        "source_file": str(wav_path.name),
        "source_sample_rate": int(sr),
        "target_sample_rate": 44100,
        "extracted_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "method": "nearest-builtin-spectral",
        "init_voice": best_id,
        "similarity": best_score,
        "f0_hz": f0,
        "note": "Open-weight Supertonic has no voice encoder; nearest builtin style was selected.",
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(style, ensure_ascii=False), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "name": name,
                "init_voice": best_id,
                "similarity": best_score,
                "out": str(out),
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.URLError as e:
        print(f"error: 로컬 Supertonic 연결 실패: {e}", file=sys.stderr)
        raise SystemExit(3)
