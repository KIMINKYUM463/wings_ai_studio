"""coupang_with_real_thumbnail.xlsx → data/shotform-picked-videos.json"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path(r"c:\Users\a\Downloads\tttttt\coupang_with_real_thumbnail.xlsx")
OUT = ROOT / "data" / "shotform-picked-videos.json"


def detect_platform(url: str) -> str:
    u = url.lower()
    if "tiktok.com" in u:
        return "tiktok"
    if "instagram.com" in u:
        return "instagram"
    if "douyin.com" in u or "xiaohongshu" in u or "xhslink" in u:
        return "xiaohongshu"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    return "other"


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    df = pd.read_excel(xlsx)
    items = []
    for idx, row in df.iterrows():
        thumb = row.iloc[0]
        name = row.iloc[1]
        coupang = row.iloc[2]
        sources_raw = row.iloc[3]
        if pd.isna(name) and pd.isna(coupang):
            continue
        name = "" if pd.isna(name) else str(name).strip()
        coupang = "" if pd.isna(coupang) else str(coupang).strip()
        thumb = "" if pd.isna(thumb) else str(thumb).strip()
        sources: list[str] = []
        if pd.notna(sources_raw):
            for line in str(sources_raw).split("\n"):
                u = line.strip()
                if u.startswith("http"):
                    sources.append(u)
        if not name and not coupang:
            continue
        items.append(
            {
                "id": f"picked-{len(items) + 1}",
                "index": len(items) + 1,
                "productName": name or "상품",
                "thumbnailUrl": thumb,
                "coupangLink": coupang,
                "sourceUrls": sources,
                "platforms": sorted({detect_platform(u) for u in sources}),
                "viewCount": (idx * 37 + 13) % 900 + 5,
                "isFree": len(items) % 7 == 0,
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"videos": items}, ensure_ascii=False, indent=2), encoding="utf-8")
    with_thumb = sum(1 for i in items if i["thumbnailUrl"])
    print(f"Wrote {len(items)} videos ({with_thumb} with thumbnail) → {OUT}")


if __name__ == "__main__":
    main()
