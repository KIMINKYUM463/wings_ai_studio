# -*- coding: utf-8 -*-
"""One-shot debrand pass for WINGS Research extension. Run from repo; do not ship inside extension."""
from __future__ import annotations

import pathlib
import re
from collections import Counter

ROOT = pathlib.Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
SKIP_NAMES = {"background.original.js", "debrand_wings.py", "check_auth_keys.py"}


def iter_text_files():
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if p.name in SKIP_NAMES:
            continue
        if p.suffix.lower() not in {".js", ".css", ".html", ".json", ".svg", ".md"}:
            continue
        yield p


def inspect_youtube():
    t = (ROOT / "content-scripts" / "youtube.js").read_text(encoding="utf-8")
    for pat in [r"6[Dd]4[Aa][Ff][Ff]", r"2[Ff]7[Ff][Cc]7", r"FFD47", r"ffcc00", r"data-duck"]:
        ms = list(re.finditer(pat, t, re.I))
        print(pat, len(ms))
        for m in ms[:2]:
            print(" ", t[max(0, m.start() - 40) : m.end() + 50].replace("\n", " ")[:140])
    fills = re.findall(r'fill:"(#[0-9a-fA-F]{3,8})"', t)
    print("top fills", Counter(fills).most_common(12))


PURPLE_TO_BLUE = [
    ("#6D4AFF", "#2F7FC7"),
    ("#6d4aff", "#2f7fc7"),
    ("#8B5CF6", "#3D9CF0"),
    ("#8b5cf6", "#3d9cf0"),
    ("#7C3AED", "#2F7FC7"),
    ("#7c3aed", "#2f7fc7"),
    ("rgb(109, 74, 255)", "rgb(47, 127, 199)"),
    ("rgb(109,74,255)", "rgb(47,127,199)"),
    ("#FFD479", "#8EC8F0"),
    ("#ffd479", "#8ec8f0"),
]


def patch_file(path: pathlib.Path) -> int:
    text = path.read_text(encoding="utf-8", errors="replace")
    orig = text
    for a, b in PURPLE_TO_BLUE:
        text = text.replace(a, b)
    text = text.replace("하입덕 오리", "WINGS")
    text = text.replace("하입덕", "WINGS")
    text = text.replace("HypeDuck", "WINGS")
    text = text.replace("Hypeduck", "WINGS")
    # earlier debrand wrongly mapped SaaS pricing → youtube pricing
    text = text.replace(
        'Ce("https://www.youtube.com/pricing")',
        "chrome.runtime.openOptionsPage()",
    )
    text = text.replace("https://www.youtube.com/pricing", "")
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return 1
    return 0


def neutralize_duck_svgs():
    mark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="WINGS">
  <rect width="64" height="64" rx="14" fill="#1a3a5c"/>
  <text x="32" y="42" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="28" font-weight="700" fill="#8ec8f0">W</text>
</svg>
"""
    assets = ROOT / "assets"
    if not assets.exists():
        return
    for p in assets.glob("*"):
        name = p.name.lower()
        if p.suffix.lower() == ".svg" and any(k in name for k in ("duck", "hypeduck", "loader")):
            p.write_text(mark, encoding="utf-8")
            print("neutralized", p.name)


def main():
    print("=== inspect ===")
    inspect_youtube()
    changed = 0
    for p in iter_text_files():
        changed += patch_file(p)
    neutralize_duck_svgs()
    print("files_patched", changed)


if __name__ == "__main__":
    main()
