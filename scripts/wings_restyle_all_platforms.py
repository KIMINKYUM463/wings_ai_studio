# -*- coding: utf-8 -*-
"""Apply WINGS visual tokens across all platform CSS/JS overlays."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
CS = ROOT / "content-scripts"

TOKEN_MAP = {
    "background": "#f3f6f5",
    "foreground": "#0f1c1a",
    "card": "#fbfcfb",
    "card-foreground": "#0f1c1a",
    "popover-foreground": "#0f1c1a",
    "primary": "#0f766e",
    "secondary": "#e4eeeb",
    "secondary-foreground": "#0f1c1a",
    "muted": "#e8efed",
    "muted-foreground": "#5b6b66",
    "accent": "#d9f3ee",
    "accent-foreground": "#115e59",
    "ring": "#0f766e",
    "brand-50": "#ecfdf8",
    "brand-100": "#d1faf0",
    "brand-500": "#0f766e",
    "brand-600": "#0d9488",
    "point": "#14b8a6",
    "point-bg": "#ccfbf1",
    "point-ink": "#115e59",
    "chart-1": "#0f766e",
    "chart-2": "#0e7490",
    "chart-3": "#5eead4",
    "chart-4": "#0369a1",
    "chart-5": "#4d7c0f",
    "chart-ring-background": "#0f766e1f",
}

GRADE_RE = re.compile(
    r'폭발:\{fg:"[^"]+",bg:"[^"]+"\},강력:\{fg:"[^"]+",bg:"[^"]+"\},우수:\{fg:"[^"]+",bg:"[^"]+"\}'
)
GRADE_NEW = '폭발:{fg:"#ecfdf8",bg:"#0f766e"},강력:{fg:"#e0f2fe",bg:"#0369a1"},우수:{fg:"#f7fee7",bg:"#4d7c0f"}'

TITLE_REPLACEMENTS = [
    ('gt("틱톡 검색 분석","TikTok Search")', 'gt("WINGS 틱톡 검색","WINGS TikTok Search")'),
    ('gt("틱톡 계정 분석","TikTok Account")', 'gt("WINGS 틱톡 계정","WINGS TikTok Account")'),
    ('yt("샤오홍슈 분석","RedNote Analysis")', 'yt("WINGS 샤오홍슈","WINGS RedNote")'),
    ('yt("샤오홍슈 탐색 분석","RedNote Explore")', 'yt("WINGS 샤오홍슈 탐색","WINGS RedNote Explore")'),
    ('yt("샤오홍슈 검색 분석","RedNote Search")', 'yt("WINGS 샤오홍슈 검색","WINGS RedNote Search")'),
    ('gt("도우인 검색 분석","Douyin Search")', 'gt("WINGS 도우인 검색","WINGS Douyin Search")'),
    ('gt("도우인 계정 분석","Douyin Account")', 'gt("WINGS 도우인 계정","WINGS Douyin Account")'),
    ('ct("전체 릴스 분석","All Reels")', 'ct("WINGS 릴스 리서치","WINGS Reels Research")'),
]


def patch_css(path: Path) -> None:
    if not path.exists():
        return
    css = path.read_text(encoding="utf-8")
    orig = css
    for name, val in TOKEN_MAP.items():
        css = re.sub(rf"(--{re.escape(name)}:)([^;]+);", rf"\g<1>{val};", css)
    css = re.sub(
        r"(--shadow-duck:)([^;]+);",
        lambda m: m.group(1) + "0 6px 18px -6px #0f766e55;",
        css,
    )
    css = re.sub(
        r"(--shadow-premium:)([^;]+);",
        lambda m: m.group(1)
        + "0 1px 2px #0f1c1a0a, 0 8px 24px -8px #0f766e2e, 0 24px 48px -20px #0f1c1a14;",
        css,
    )
    # leftover HD yellow/orange/purple hex in theme area
    css = css.replace("#ffc93c", "#14b8a6")
    css = css.replace("#ff8a00", "#0369a1")
    css = css.replace("#9a7bff", "#0e7490")
    css = css.replace("#c0a8ff", "#5eead4")
    css = css.replace("#2f7fc7", "#0f766e")
    if css != orig:
        path.write_text(css, encoding="utf-8")
        print("css", path.name)
    else:
        print("css unchanged", path.name)


def patch_js(path: Path) -> None:
    if not path.exists():
        return
    js = path.read_text(encoding="utf-8")
    orig = js
    for a, b in TITLE_REPLACEMENTS:
        js = js.replace(a, b)
    m = GRADE_RE.search(js)
    if m:
        js = js.replace(m.group(0), GRADE_NEW, 1)
    # pill radius → research chip
    js = js.replace(
        "border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:700;",
        "border-radius:4px;padding:3px 8px;font-size:11px;font-weight:650;letter-spacing:0.02em;border-left:3px solid #14b8a6;",
    )
    js = js.replace(
        "border-radius:9999px;padding:2px 9px;font-size:13px;font-weight:700;",
        "border-radius:4px;padding:3px 8px;font-size:12px;font-weight:650;letter-spacing:0.02em;border-left:3px solid #14b8a6;",
    )
    js = js.replace(
        "border-radius:9999px;padding:3px 10px;font-size:12px;font-weight:700;",
        "border-radius:4px;padding:3px 9px;font-size:12px;font-weight:650;letter-spacing:0.02em;border-left:3px solid #14b8a6;",
    )
    # template literal padding variants
    js = js.replace(
        'border-radius:9999px;padding:${i?"1px 6px":"2px 8px"};font-size:${i?"10px":"11px"};font-weight:800;',
        'border-radius:4px;padding:${i?"2px 6px":"3px 8px"};font-size:${i?"10px":"11px"};font-weight:650;border-left:3px solid #14b8a6;',
    )
    if js != orig:
        path.write_text(js, encoding="utf-8")
        print("js", path.name)
    else:
        print("js unchanged", path.name)


def main():
    for name in ["tiktok.css", "rednote.css", "douyin.css", "threads.css", "youtube.css", "sort.css"]:
        patch_css(CS / name)
    for name in ["tiktok.js", "rednote.js", "douyin.js", "threads.js", "youtube.js", "sort.js", "feed.js"]:
        patch_js(CS / name)

    # bump version
    man = ROOT / "manifest.json"
    mt = man.read_text(encoding="utf-8")
    mt2 = re.sub(r'"version": "0\.3\.65\.\d+"', '"version": "0.3.65.12"', mt)
    man.write_text(mt2, encoding="utf-8")
    bg = ROOT / "background.js"
    bt = bg.read_text(encoding="utf-8")
    bt = re.sub(r'wings_version: "0\.3\.65\.\d+"', 'wings_version: "0.3.65.12"', bt)
    bg.write_text(bt, encoding="utf-8")
    print("version 0.3.65.12")


if __name__ == "__main__":
    main()
