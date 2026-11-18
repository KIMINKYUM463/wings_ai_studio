# -*- coding: utf-8 -*-
from pathlib import Path
import shutil
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")

# How many code refs to expression pngs?
refs = 0
for p in root.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".js", ".css", ".html", ".json"}:
        continue
    t = p.read_text(encoding="utf-8", errors="replace")
    if "hypeduck-expression" in t or "assets/expressions" in t:
        refs += 1
        print("ref", p.relative_to(root), t.count("hypeduck-expression"), t.count("assets/expressions"))

expr = root / "assets" / "expressions"
if expr.exists():
    count = sum(1 for _ in expr.rglob("*") if _.is_file())
    shutil.rmtree(expr)
    print("removed expressions dir files=", count)

# rename neutralized hypeduck svgs to wings-*
assets = root / "assets"
for p in list(assets.glob("hypeduck*.svg")) + list(assets.glob("duck-load*.svg")):
    new = assets / p.name.replace("hypeduck", "wings").replace("duck-load", "wings-load")
    if new.exists():
        p.unlink()
        print("deleted duplicate", p.name)
    else:
        p.rename(new)
        print("renamed", p.name, "->", new.name)

# rewrite any remaining asset path strings in js that point to old names
repls = [
    ("hypeduck-expression", "wings-mark"),
    ("assets/expressions/", "assets/"),
    ("hypeduck-loader.svg", "wings-loader.svg"),
    ("hypeduck-mark-transparent.svg", "wings-mark-transparent.svg"),
    ("hypeduck-mark.svg", "wings-mark.svg"),
    ("duck-load-3-white.svg", "wings-load-3-white.svg"),
    ("duck-load-2-white.svg", "wings-load-2-white.svg"),
    ("duck-load-1.svg", "wings-load-1.svg"),
    ("duck-load-2.svg", "wings-load-2.svg"),
    ("duck-load-3.svg", "wings-load-3.svg"),
]
changed = 0
for p in root.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".js", ".css", ".html", ".json"}:
        continue
    if p.name in {"wings-skin.js", "wings-skin.css"}:
        continue
    t = p.read_text(encoding="utf-8", errors="replace")
    o = t
    for a, b in repls:
        t = t.replace(a, b)
    if t != o:
        p.write_text(t, encoding="utf-8")
        changed += 1
        print("pathfix", p.relative_to(root))
print("files_path_fixed", changed, "code_refs_before", refs)
