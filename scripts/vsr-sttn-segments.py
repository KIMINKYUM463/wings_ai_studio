"""
video-subtitle-remover(STTN)로 구간별 글자 영역을 자연스럽게 지운다.

사용: python vsr-sttn-segments.py --vsr-dir <VSR 폴더> --input in.mp4 --output out.mp4 --jobs jobs.json --ffmpeg <ffmpeg 경로>
jobs.json: {"segments": [{"start": 초, "end": 초, "rects": [[x, y, w, h], ...]}]}  (원본 픽셀 좌표)

- 모델은 한 번만 불러오고, 프레임을 순서대로 읽어 구간에 속한 프레임만 모아 STTN 으로 처리한다.
- 구간 밖 프레임은 그대로 둔다. 결과는 ffmpeg 로 바로 인코딩하고 원본 오디오를 복사한다.
- 진행률은 stdout 에 "PROGRESS <0~1>" 줄로 출력한다.
"""
import argparse
import json
import os
import subprocess
import sys

CHUNK = 120  # STTN 한 번에 넣는 최대 프레임 수 (GPU 메모리 보호)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vsr-dir", required=True)
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--jobs", required=True)
    ap.add_argument("--ffmpeg", required=True)
    args = ap.parse_args()

    vsr_dir = os.path.abspath(args.vsr_dir)
    os.chdir(vsr_dir)
    sys.path.insert(0, vsr_dir)
    sys.path.insert(0, os.path.join(vsr_dir, "backend"))

    import cv2
    import numpy as np
    import torch
    from backend.inpaint.sttn_auto_inpaint import STTNInpaint
    from backend.tools.model_config import ModelConfig

    with open(args.jobs, "r", encoding="utf-8") as f:
        segments = json.load(f).get("segments", [])

    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        print(f"ERROR 영상을 열 수 없습니다: {args.input}", file=sys.stderr)
        return 2
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) + 0.5) or 1

    # 프레임 번호별로 적용할 마스크(구간마다 하나)를 정한다. 겹치는 구간은 박스를 합친다.
    masks = []
    frame_mask = {}
    for seg in segments:
        a = max(0, int(round(float(seg["start"]) * fps)))
        b = min(total, int(round(float(seg["end"]) * fps)))
        rects = [r for r in seg.get("rects", []) if r[2] > 1 and r[3] > 1]
        if b <= a or not rects:
            continue
        for fi in range(a, b):
            frame_mask.setdefault(fi, []).extend(rects)
    # 같은 박스 조합끼리 마스크를 공유
    key_to_mask = {}
    frame_key = {}
    for fi, rects in frame_mask.items():
        key = tuple(sorted(tuple(int(v) for v in r) for r in rects))
        if key not in key_to_mask:
            m = np.zeros((height, width), dtype="uint8")
            for x, y, w, h in key:
                cv2.rectangle(m, (max(0, x), max(0, y)), (min(width - 1, x + w), min(height - 1, y + h)), 255, thickness=-1)
            key_to_mask[key] = m
        frame_key[fi] = key

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = STTNInpaint(device, ModelConfig().STTN_AUTO_MODEL_PATH)

    enc = subprocess.Popen(
        [
            args.ffmpeg, "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{width}x{height}", "-r", f"{fps:.6f}", "-i", "-",
            "-i", args.input,
            "-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", args.output,
        ],
        stdin=subprocess.PIPE,
    )

    def flush(buf, key):
        if not buf:
            return
        out = model(buf, key_to_mask[key]) if key is not None else buf
        for fr in out:
            enc.stdin.write(np.ascontiguousarray(fr, dtype=np.uint8).tobytes())

    buf = []
    buf_key = None
    fi = 0
    last_pct = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        key = frame_key.get(fi)
        if key != buf_key or len(buf) >= CHUNK:
            flush(buf, buf_key)
            buf = []
            buf_key = key
        buf.append(frame)
        fi += 1
        pct = int(fi * 100 / total)
        if pct != last_pct and pct % 5 == 0:
            last_pct = pct
            print(f"PROGRESS {min(1.0, fi / total):.3f}", flush=True)
    flush(buf, buf_key)
    cap.release()
    enc.stdin.close()
    code = enc.wait()
    if code != 0:
        print(f"ERROR 인코딩 실패 (ffmpeg {code})", file=sys.stderr)
        return 3
    print("PROGRESS 1.000", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
