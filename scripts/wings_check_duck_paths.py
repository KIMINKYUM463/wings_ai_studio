# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
for name in ["youtube.js", "feed.js", "sort.js", "threads.js"]:
    t = (root / "content-scripts" / name).read_text(encoding="utf-8")
    for pat in [r"data-duck-mood", r"data-duck=", r"data-duck\"", r"DuckBot", r"expressions/", r"wings-mark", r"querySelectorAll\(\"[^\"]*duck"]:
        ms = list(re.finditer(pat, t))
        print(name, pat, len(ms))
        for m in ms[:2]:
            print(" ", t[max(0, m.start() - 30) : m.end() + 60].replace("\n", " ")[:130])

# icons
icons = list((root / "icons").glob("*"))
print("icons", [i.name for i in icons])
assets = list((root / "assets").glob("*"))
print("assets", [a.name for a in assets if a.is_file()])
